from fastapi import APIRouter, Depends, Query
from ..database import get_db, resolve_user_name
from ..schemas.log import ActivityLogResponse
from ..core.security import get_current_user

router = APIRouter()


@router.get("/", response_model=list[ActivityLogResponse])
async def get_logs(
    user_id: str = None,
    entity_type: str = None,
    limit: int = Query(default=100, le=500),
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
    logs = []
    async for log in db["activity_logs"].find(query).sort("created_at", -1).limit(limit):
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
    return logs
