from datetime import timedelta, datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer as _RawOAuth2
from pydantic import BaseModel, EmailStr
from typing import Optional
from ..database import get_db
from ..core.security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, create_refresh_token, decode_refresh_token,
    get_current_user,
)
from ..core.config import settings
from ..core.timezone import now_ist


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


router = APIRouter()
_raw_token_scheme = _RawOAuth2(tokenUrl="/api/auth/login")


async def _check_rate_limit(db, email: str):
    window_start = now_ist() - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
    count = await db["login_attempts"].count_documents({
        "email": email,
        "created_at": {"$gte": window_start},
    })
    if count >= settings.LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Account locked for {settings.LOGIN_LOCKOUT_MINUTES} minutes.",
        )


async def _record_failed_attempt(db, email: str):
    await db["login_attempts"].insert_one({"email": email, "created_at": now_ist()})


async def _clear_attempts(db, email: str):
    await db["login_attempts"].delete_many({"email": email})


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    error = validate_password_strength(data.password)
    if error:
        raise HTTPException(status_code=422, detail=error)
    db = get_db()
    if await db["users"].find_one({"email": data.email}) or await db["admins"].find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": "employee",
        "is_active": True,
        "created_at": now_ist(),
    }
    result = await db["users"].insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, "employee")
    refresh_token = create_refresh_token(user_id, "employee")
    await db["activity_logs"].insert_one({
        "user_id": user_id,
        "action": "User registered",
        "entity_type": "user",
        "entity_id": user_id,
        "details": f"New employee {data.name} registered",
        "created_at": now_ist(),
    })
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=user_id, name=data.name, email=data.email,
            role="employee", is_active=True, created_at=user_doc["created_at"],
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    db = get_db()
    await _check_rate_limit(db, data.email)
    user = await db["users"].find_one({"email": data.email})
    if not user:
        user = await db["admins"].find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        await _record_failed_attempt(db, data.email)
        window_start = now_ist() - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
        count = await db["login_attempts"].count_documents({"email": data.email, "created_at": {"$gte": window_start}})
        remaining = max(0, settings.LOGIN_MAX_ATTEMPTS - count)
        raise HTTPException(
            status_code=401,
            detail=f"Invalid email or password. {remaining} attempt(s) remaining before lockout.",
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact your administrator.")
    await _clear_attempts(db, data.email)
    user_id = str(user.pop("_id"))
    access_token = create_access_token(user_id, user["role"])
    refresh_token = create_refresh_token(user_id, user["role"])
    await db["activity_logs"].insert_one({
        "user_id": user_id,
        "action": "User logged in",
        "entity_type": "user",
        "entity_id": user_id,
        "details": f"{user['name']} logged in as {user['role']}",
        "created_at": now_ist(),
    })
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=user_id, name=user["name"], email=user["email"],
            role=user["role"], is_active=user.get("is_active", True),
            created_at=user["created_at"],
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshTokenRequest):
    from bson import ObjectId
    payload = decode_refresh_token(data.refresh_token)
    user_id = payload.get("sub")
    role = payload.get("role")
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    collection = "admins" if role == "admin" else "users"
    user = await db[collection].find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    new_access = create_access_token(user_id, role)
    new_refresh = create_refresh_token(user_id, role)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=UserResponse(
            id=user_id, name=user["name"], email=user["email"],
            role=role, is_active=user.get("is_active", True),
            created_at=user["created_at"],
        ),
    )


@router.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    raw_token: str = Depends(_raw_token_scheme),
):
    db = get_db()
    expires_at = now_ist() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    await db["token_blacklist"].insert_one({
        "token": raw_token,
        "user_id": current_user["id"],
        "expires_at": expires_at,
        "created_at": now_ist(),
    })
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "User logged out",
        "entity_type": "user",
        "entity_id": current_user["id"],
        "details": f"{current_user['name']} logged out",
        "created_at": now_ist(),
    })
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"], name=current_user["name"],
        email=current_user["email"], role=current_user["role"],
        is_active=current_user.get("is_active", True),
        created_at=current_user["created_at"],
    )
