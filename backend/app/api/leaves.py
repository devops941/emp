from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from ..database import get_db, resolve_user_name
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist
from ..socketio import emit_event, emit_admin_event


class LeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str


class LeaveUpdate(BaseModel):
    status: str
    admin_comment: Optional[str] = None


class LeaveResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    leave_type: str
    start_date: str
    end_date: str
    days: float
    reason: str
    status: str
    admin_comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


router = APIRouter()

LEAVE_TYPES = {"sick", "casual", "pto", "half_day"}
LEAVE_LIMITS = {"sick": 12, "casual": 12, "pto": 15, "half_day": 24}


def _count_days(start_date: str, end_date: str, leave_type: str) -> float:
    if leave_type == "half_day":
        return 0.5
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    return float(max(1, (end - start).days + 1))


def _build(r: dict, user_name: str) -> LeaveResponse:
    return LeaveResponse(
        id=str(r["_id"]),
        user_id=r["user_id"],
        user_name=user_name,
        leave_type=r["leave_type"],
        start_date=r["start_date"],
        end_date=r["end_date"],
        days=r.get("days", 1.0),
        reason=r["reason"],
        status=r["status"],
        admin_comment=r.get("admin_comment"),
        created_at=r["created_at"],
        updated_at=r.get("updated_at"),
    )


async def _create_notification(db, user_id: str, title: str, message: str, ntype: str, entity_type: str = None, entity_id: str = None):
    doc = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": ntype,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "is_read": False,
        "created_at": now_ist(),
    }
    result = await db["notifications"].insert_one(doc)
    await emit_event("notification", {
        "id": str(result.inserted_id),
        "title": title,
        "message": message,
        "type": ntype,
    }, user_id=user_id)


@router.get("/balance")
async def get_leave_balance(current_user: dict = Depends(get_current_user)):
    db = get_db()
    year = now_ist().year
    approved = []
    async for r in db["leaves"].find({
        "user_id": current_user["id"],
        "status": "approved",
        "created_at": {"$gte": datetime(year, 1, 1)},
    }):
        approved.append(r)

    used: dict = {}
    for leave in approved:
        lt = leave["leave_type"]
        used[lt] = used.get(lt, 0.0) + leave.get("days", 1.0)

    return {
        t: {
            "total": limit,
            "used": round(used.get(t, 0.0), 1),
            "remaining": round(limit - used.get(t, 0.0), 1),
        }
        for t, limit in LEAVE_LIMITS.items()
    }


@router.get("/")
async def get_leaves(
    status: str = None,
    user_id: str = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    if status:
        query["status"] = status
    total = await db["leaves"].count_documents(query)
    skip = (page - 1) * per_page
    items = []
    async for r in db["leaves"].find(query).sort("created_at", -1).skip(skip).limit(per_page):
        items.append(_build(r, await resolve_user_name(db, r["user_id"])))
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.post("/")
async def create_leave(data: LeaveCreate, current_user: dict = Depends(get_current_user)):
    if data.leave_type not in LEAVE_TYPES:
        raise HTTPException(400, f"Invalid leave type. Choose from: {', '.join(LEAVE_TYPES)}")
    db = get_db()
    days = _count_days(data.start_date, data.end_date, data.leave_type)
    doc = {
        "user_id": current_user["id"],
        "leave_type": data.leave_type,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "days": days,
        "reason": data.reason,
        "status": "pending",
        "admin_comment": None,
        "created_at": now_ist(),
        "updated_at": None,
    }
    result = await db["leaves"].insert_one(doc)
    doc["_id"] = result.inserted_id
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Leave requested",
        "entity_type": "leave",
        "entity_id": str(result.inserted_id),
        "details": f"{current_user['name']} requested {data.leave_type} leave ({days} days)",
        "created_at": now_ist(),
    })
    await emit_admin_event("leave_request", {
        "user_id": current_user["id"],
        "name": current_user["name"],
        "leave_type": data.leave_type,
        "days": days,
    })
    return _build(doc, current_user["name"])


@router.put("/{leave_id}")
async def update_leave_status(
    leave_id: str,
    data: LeaveUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    if data.status not in {"approved", "rejected"}:
        raise HTTPException(400, "Status must be 'approved' or 'rejected'")
    db = get_db()
    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(400, "Invalid leave ID")
    leave = await db["leaves"].find_one({"_id": oid})
    if not leave:
        raise HTTPException(404, "Leave not found")
    if leave["status"] != "pending":
        raise HTTPException(400, "Only pending leaves can be updated")
    now = now_ist()
    await db["leaves"].update_one(
        {"_id": oid},
        {"$set": {"status": data.status, "admin_comment": data.admin_comment, "updated_at": now}},
    )
    await _create_notification(
        db,
        leave["user_id"],
        title=f"Leave {data.status.capitalize()}",
        message=f"Your {leave['leave_type']} leave request has been {data.status}." + (f" Note: {data.admin_comment}" if data.admin_comment else ""),
        ntype="success" if data.status == "approved" else "error",
        entity_type="leave",
        entity_id=leave_id,
    )
    await db["activity_logs"].insert_one({
        "user_id": current_admin["id"],
        "action": f"Leave {data.status}",
        "entity_type": "leave",
        "entity_id": leave_id,
        "details": f"Leave {data.status} by {current_admin['name']}",
        "created_at": now,
    })
    updated = await db["leaves"].find_one({"_id": oid})
    return _build(updated, await resolve_user_name(db, leave["user_id"]))


@router.delete("/{leave_id}")
async def cancel_leave(leave_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(leave_id)
    except Exception:
        raise HTTPException(400, "Invalid leave ID")
    leave = await db["leaves"].find_one({"_id": oid})
    if not leave:
        raise HTTPException(404, "Leave not found")
    if leave["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(403, "Not authorized")
    if leave["status"] == "approved":
        raise HTTPException(400, "Cannot cancel an approved leave")
    await db["leaves"].delete_one({"_id": oid})
    return {"message": "Leave request cancelled"}
