from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..core.security import get_current_user
from ..core.timezone import now_ist


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime


router = APIRouter()


def _build(n: dict) -> NotificationResponse:
    return NotificationResponse(
        id=str(n["_id"]),
        user_id=n["user_id"],
        title=n["title"],
        message=n["message"],
        type=n.get("type", "info"),
        entity_type=n.get("entity_type"),
        entity_id=n.get("entity_id"),
        is_read=n.get("is_read", False),
        created_at=n["created_at"],
    )


@router.get("/")
async def get_notifications(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {"user_id": current_user["id"]}
    total = await db["notifications"].count_documents(query)
    unread = await db["notifications"].count_documents({**query, "is_read": False})
    skip = (page - 1) * per_page
    items = []
    async for n in db["notifications"].find(query).sort("created_at", -1).skip(skip).limit(per_page):
        items.append(_build(n))
    return {"items": items, "total": total, "unread": unread, "page": page, "per_page": per_page}


@router.put("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db["notifications"].update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"ok": True}


@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db["notifications"].update_one(
        {"_id": ObjectId(notif_id), "user_id": current_user["id"]},
        {"$set": {"is_read": True}},
    )
    return {"ok": True}
