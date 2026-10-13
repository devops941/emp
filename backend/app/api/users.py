from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..core.security import hash_password, get_current_admin
from ..core.timezone import now_ist


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


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


@router.get("/{user_id}/details")
async def get_user_details(user_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Stats
    total_tasks = await db["tasks"].count_documents({"assigned_to": user_id})
    completed_tasks = await db["tasks"].count_documents({"assigned_to": user_id, "status": "completed"})
    in_progress_tasks = await db["tasks"].count_documents({"assigned_to": user_id, "status": "in_progress"})
    pending_tasks = await db["tasks"].count_documents({"assigned_to": user_id, "status": "pending"})

    total_hours = 0.0
    async for r in db["attendance"].find({"user_id": user_id}):
        total_hours += r.get("total_hours") or 0

    # Tasks list
    tasks = []
    async for t in db["tasks"].find({"assigned_to": user_id}).sort("created_at", -1).limit(50):
        proj = None
        if t.get("project_id"):
            proj = await db["projects"].find_one({"_id": ObjectId(t["project_id"])})
        tasks.append({
            "id": str(t["_id"]),
            "title": t["title"],
            "status": t["status"],
            "priority": t["priority"],
            "project_name": proj["name"] if proj else None,
            "deadline": t.get("deadline").isoformat() if t.get("deadline") else None,
            "estimated_hours": t.get("estimated_hours"),
            "actual_hours": t.get("actual_hours"),
            "created_at": t["created_at"].isoformat(),
        })

    # Attendance records (last 30)
    attendance = []
    async for a in db["attendance"].find({"user_id": user_id}).sort("date", -1).limit(30):
        breaks = []
        for b in (a.get("breaks") or []):
            breaks.append({
                "type": b.get("type", "short"),
                "start": b["start"].isoformat() if hasattr(b.get("start"), "isoformat") else str(b.get("start", "")),
                "end": b["end"].isoformat() if b.get("end") and hasattr(b.get("end"), "isoformat") else None,
                "duration_mins": b.get("duration_mins"),
            })
        attendance.append({
            "id": str(a["_id"]),
            "date": a["date"],
            "clock_in": a["clock_in"].isoformat() if a.get("clock_in") else None,
            "clock_out": a["clock_out"].isoformat() if a.get("clock_out") else None,
            "total_hours": a.get("total_hours"),
            "overtime_hours": a.get("overtime_hours"),
            "break_total": a.get("break_total"),
            "is_late": a.get("is_late"),
            "status": a.get("status"),
            "work_type": a.get("work_type", "office"),
            "breaks": breaks,
        })

    # Leaves list
    leaves = []
    async for l in db["leaves"].find({"user_id": user_id}).sort("created_at", -1).limit(30):
        leaves.append({
            "id": str(l["_id"]),
            "leave_type": l["leave_type"],
            "start_date": l["start_date"],
            "end_date": l["end_date"],
            "days": l.get("days", 1),
            "reason": l["reason"],
            "status": l["status"],
            "admin_comment": l.get("admin_comment"),
            "created_at": l["created_at"].isoformat(),
        })

    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"].isoformat(),
        "stats": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "pending_tasks": pending_tasks,
            "total_hours": round(total_hours, 1),
        },
        "tasks": tasks,
        "attendance": attendance,
        "leaves": leaves,
    }
