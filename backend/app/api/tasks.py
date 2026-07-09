from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from math import ceil
from ..database import get_db, resolve_user_name
from ..schemas.task import TaskCreate, TaskResponse, TaskUpdate, PaginatedTaskResponse
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist
from ..socketio import emit_event, emit_admin_event

router = APIRouter()


def task_to_response(t, project_name=None, assigned_name=None, actual_hours=None):
    return TaskResponse(
        id=str(t["_id"]),
        title=t["title"],
        description=t.get("description", ""),
        project_id=t.get("project_id"),
        project_name=project_name,
        assigned_to=t.get("assigned_to"),
        assigned_name=assigned_name,
        priority=t.get("priority", "medium"),
        status=t.get("status", "pending"),
        deadline=t.get("deadline"),
        estimated_hours=t.get("estimated_hours"),
        actual_hours=actual_hours,
        created_at=t["created_at"],
        updated_at=t.get("updated_at", t["created_at"]),
    )


async def enrich_task(db, t):
    project_name = None
    assigned_name = None
    actual_hours = None
    if t.get("project_id"):
        p = await db["projects"].find_one({"_id": ObjectId(t["project_id"])})
        if p:
            project_name = p["name"]
    if t.get("assigned_to"):
        assigned_name = await resolve_user_name(db, t["assigned_to"])
    total_minutes = 0
    async for r in db["timings"].find({"task_id": str(t["_id"]), "is_running": False}):
        total_minutes += r.get("duration_minutes", 0)
    if total_minutes > 0:
        actual_hours = round(total_minutes / 60, 2)
    return task_to_response(t, project_name, assigned_name, actual_hours)


@router.get("/", response_model=PaginatedTaskResponse)
async def get_tasks(
    status: str = None,
    priority: str = None,
    project_id: str = None,
    assigned_to: str = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["assigned_to"] = current_user["id"]
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if project_id:
        query["project_id"] = project_id
    if assigned_to and current_user["role"] == "admin":
        query["assigned_to"] = assigned_to
    total = await db["tasks"].count_documents(query)
    skip = (page - 1) * per_page
    tasks = []
    cursor = db["tasks"].find(query).sort("created_at", -1).skip(skip).limit(per_page)
    async for t in cursor:
        tasks.append(await enrich_task(db, t))
    return PaginatedTaskResponse(items=tasks, total=total, page=page, per_page=per_page)


@router.post("/", response_model=TaskResponse)
async def create_task(data: TaskCreate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    task_doc = {
        "title": data.title,
        "description": data.description,
        "project_id": data.project_id,
        "assigned_to": data.assigned_to,
        "priority": data.priority,
        "status": data.status,
        "deadline": data.deadline,
        "estimated_hours": data.estimated_hours,
        "created_at": now_ist(),
        "updated_at": now_ist(),
    }
    result = await db["tasks"].insert_one(task_doc)
    task_doc["_id"] = result.inserted_id
    enriched = await enrich_task(db, task_doc)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Created task",
        "entity_type": "task",
        "entity_id": str(result.inserted_id),
        "details": f"Created task '{data.title}' for {enriched.assigned_name or 'unassigned'}",
        "created_at": now_ist(),
    })
    event_data = enriched.model_dump(mode="json")
    await emit_admin_event("task_created", event_data)
    if enriched.assigned_to:
        await emit_event("task_created", event_data, user_id=enriched.assigned_to)
    return enriched


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    t = await db["tasks"].find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return await enrich_task(db, t)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = now_ist()
    result = await db["tasks"].find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    enriched = await enrich_task(db, result)
    event_data = enriched.model_dump(mode="json")
    await emit_admin_event("task_updated", event_data)
    if enriched.assigned_to:
        await emit_event("task_updated", event_data, user_id=enriched.assigned_to)
    return enriched


STATUS_FLOW = {"pending": "in_progress", "in_progress": "completed"}

@router.put("/{task_id}/status")
async def update_task_status(task_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    db = get_db()
    valid_statuses = ["pending", "in_progress", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    task = await db["tasks"].find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = task["status"]
    # Enforce forward-only transitions
    if old_status == "completed":
        raise HTTPException(status_code=400, detail="Cannot change status of a completed task")
    if old_status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot change status of a cancelled task")
    if status != "cancelled" and STATUS_FLOW.get(old_status) != status:
        expected = STATUS_FLOW.get(old_status, "completed")
        raise HTTPException(status_code=400, detail=f"Status must move step by step: {old_status} → {expected}")
    # Auto-stop running timer if completing the task
    if status == "completed":
        running = await db["timings"].find_one({"task_id": task_id, "user_id": current_user["id"], "is_running": True})
        if running:
            end_time = now_ist()
            duration = (end_time - running["start_time"]).total_seconds() / 60
            await db["timings"].find_one_and_update(
                {"_id": running["_id"]},
                {"$set": {"end_time": end_time, "duration_minutes": round(duration, 2), "is_running": False}},
            )
            await db["activity_logs"].insert_one({
                "user_id": current_user["id"],
                "action": "Stopped timer (auto)",
                "entity_type": "timing",
                "entity_id": str(running["_id"]),
                "details": f"Timer auto-stopped on completing task ({round(duration, 2)} min)",
                "created_at": now_ist(),
            })
    result = await db["tasks"].find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": status, "updated_at": now_ist()}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": f"Task status updated to {status}",
        "entity_type": "task",
        "entity_id": task_id,
        "details": f"Task '{result['title']}' marked as {status}",
        "created_at": now_ist(),
    })
    enriched = await enrich_task(db, result)
    event_data = enriched.model_dump(mode="json")
    await emit_admin_event("task_updated", event_data)
    if enriched.assigned_to:
        await emit_event("task_updated", event_data, user_id=enriched.assigned_to)
    return {"message": f"Task status updated to {status}"}


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    result = await db["tasks"].delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    await emit_admin_event("task_deleted", {"task_id": task_id})
    return {"message": "Task deleted successfully"}
