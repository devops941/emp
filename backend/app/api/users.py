from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from ..database import get_db
from ..schemas.user import UserCreate, UserResponse, UserUpdate
from ..core.security import hash_password, get_current_admin
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
async def get_users(current_user: dict = Depends(get_current_admin)):
    db = get_db()
    users = []
    async for u in db["users"].find():
        users.append(UserResponse(
            id=str(u["_id"]),
            name=u["name"],
            email=u["email"],
            role=u["role"],
            is_active=u.get("is_active", True),
            created_at=u["created_at"],
        ))
    return users


@router.post("/", response_model=UserResponse)
async def create_user(data: UserCreate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    existing_user = await db["users"].find_one({"email": data.email})
    existing_admin = await db["admins"].find_one({"email": data.email})
    if existing_user or existing_admin:
        raise HTTPException(status_code=400, detail="Email already exists")
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
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Created user",
        "entity_type": "user",
        "entity_id": str(result.inserted_id),
        "details": f"Created user {data.name} ({data.email})",
        "created_at": now_ist(),
    })
    return UserResponse(
        id=str(result.inserted_id),
        name=data.name,
        email=data.email,
        role=data.role,
        is_active=True,
        created_at=user_doc["created_at"],
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    u = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(u["_id"]),
        name=u["name"],
        email=u["email"],
        role=u["role"],
        is_active=u.get("is_active", True),
        created_at=u["created_at"],
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db["users"].find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Updated user",
        "entity_type": "user",
        "entity_id": user_id,
        "details": f"Updated user {result['name']}",
        "created_at": now_ist(),
    })
    return UserResponse(
        id=str(result["_id"]),
        name=result["name"],
        email=result["email"],
        role=result["role"],
        is_active=result.get("is_active", True),
        created_at=result["created_at"],
    )


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    result = await db["users"].delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}
