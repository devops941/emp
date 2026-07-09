from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from ..database import get_db, resolve_user_name
from ..schemas.comment import CommentCreate, CommentResponse
from ..core.security import get_current_user
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/{task_id}", response_model=list[CommentResponse])
async def get_comments(task_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    comments = []
    async for c in db["comments"].find({"task_id": task_id}).sort("created_at", 1):
        comments.append(CommentResponse(
            id=str(c["_id"]),
            task_id=c["task_id"],
            user_id=c["user_id"],
            user_name=c.get("user_name", "Unknown"),
            content=c["content"],
            created_at=c["created_at"],
        ))
    return comments


@router.post("/", response_model=CommentResponse, status_code=201)
async def create_comment(data: CommentCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    task = await db["tasks"].find_one({"_id": ObjectId(data.task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    user_name = await resolve_user_name(db, current_user["id"])
    doc = {
        "task_id": data.task_id,
        "user_id": current_user["id"],
        "user_name": user_name,
        "content": data.content,
        "created_at": now_ist(),
    }
    result = await db["comments"].insert_one(doc)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Commented on task",
        "entity_type": "task",
        "entity_id": data.task_id,
        "details": f"{user_name} commented on task '{task['title']}'",
        "created_at": now_ist(),
    })
    return CommentResponse(
        id=str(result.inserted_id),
        task_id=data.task_id,
        user_id=current_user["id"],
        user_name=user_name,
        content=data.content,
        created_at=doc["created_at"],
    )


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    comment = await db["comments"].find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")
    await db["comments"].delete_one({"_id": ObjectId(comment_id)})
    return {"message": "Comment deleted"}
