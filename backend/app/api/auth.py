from fastapi import APIRouter, HTTPException, status, Depends
from ..database import get_db
from ..schemas.user import UserCreate, LoginRequest, TokenResponse, UserResponse
from ..core.security import hash_password, verify_password, create_access_token, get_current_user
from ..core.timezone import now_ist

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    db = get_db()
    existing_user = await db["users"].find_one({"email": data.email})
    existing_admin = await db["admins"].find_one({"email": data.email})
    if existing_user or existing_admin:
        raise HTTPException(status_code=400, detail="Email already registered")
    data.role = "employee"
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": data.role,
        "is_active": True,
        "created_at": now_ist(),
    }
    result = await db["users"].insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    token = create_access_token({"sub": user_doc["email"], "user_id": user_doc["id"], "role": user_doc["role"]})
    await db["activity_logs"].insert_one({
        "user_id": user_doc["id"],
        "action": "User registered",
        "entity_type": "user",
        "entity_id": user_doc["id"],
        "details": f"User {data.name} registered as {data.role}",
        "created_at": now_ist(),
    })
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_doc["id"],
            name=user_doc["name"],
            email=user_doc["email"],
            role=user_doc["role"],
            is_active=user_doc["is_active"],
            created_at=user_doc["created_at"],
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    db = get_db()
    user = await db["users"].find_one({"email": data.email})
    if not user:
        user = await db["admins"].find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    user["id"] = str(user.pop("_id"))
    token = create_access_token({"sub": user["email"], "user_id": user["id"], "role": user["role"]})
    await db["activity_logs"].insert_one({
        "user_id": user["id"],
        "action": "User logged in",
        "entity_type": "user",
        "entity_id": user["id"],
        "details": f"User {user['name']} logged in",
        "created_at": now_ist(),
    })
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=user["created_at"],
        ),
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "User logged out",
        "entity_type": "user",
        "entity_id": current_user["id"],
        "details": f"User {current_user['name']} logged out",
        "created_at": now_ist(),
    })
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        is_active=current_user.get("is_active", True),
        created_at=current_user["created_at"],
    )
