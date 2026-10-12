from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db, resolve_user_name
from ..core.security import get_current_user


class ActivityLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: Optional[str]
    created_at: datetime


router = APIRouter()


@router.get("/")
async def get_logs(
    user_id: str = None,
    entity_type: str = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    if user_id and current_user["role"] == "admin":
        query["user_id"] = user_id
    if entity_type:
        query["entity_type"] = entity_type
    total = await db["activity_logs"].count_documents(query)
    skip = (page - 1) * per_page
    logs = []
    async for log in db["activity_logs"].find(query).sort("created_at", -1).skip(skip).limit(per_page):
        logs.append(ActivityLogResponse(
            id=str(log["_id"]),
            user_id=log["user_id"],
            user_name=await resolve_user_name(db, log["user_id"]),
            action=log["action"],
            entity_type=log["entity_type"],
            entity_id=log.get("entity_id"),
            details=log.get("details"),
            created_at=log["created_at"],
        ))
    return {"items": logs, "total": total, "page": page, "per_page": per_page}
