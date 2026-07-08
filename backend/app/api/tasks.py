from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from ..database import get_db, resolve_user_name
from ..schemas.task import TaskCreate, TaskResponse, TaskUpdate
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/", response_model=list[TaskResponse])
async def get_tasks(
    status: str = None,
    priority: str = None,
    project_id: str = None,
    assigned_to: str = None,
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
    tasks = []
    async for t in db["tasks"].find(query).sort("created_at", -1):
        task = TaskResponse(
            id=str(t["_id"]),
            title=t["title"],
            description=t.get("description", ""),
            project_id=t.get("project_id"),
            project_name=None,
            assigned_to=t.get("assigned_to"),
            assigned_name=None,
            priority=t.get("priority", "medium"),
            status=t.get("status", "pending"),
            deadline=t.get("deadline"),
            created_at=t["created_at"],
            updated_at=t.get("updated_at", t["created_at"]),
        )
        if t.get("project_id"):
            project = await db["projects"].find_one({"_id": ObjectId(t["project_id"])})
            if project:
                task.project_name = project["name"]
        if t.get("assigned_to"):
            task.assigned_name = await resolve_user_name(db, t["assigned_to"])
        tasks.append(task)
    return tasks


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
        "created_at": now_ist(),
        "updated_at": now_ist(),
    }
    result = await db["tasks"].insert_one(task_doc)
    project_name = None
    assigned_name = None
    if data.project_id:
        p = await db["projects"].find_one({"_id": ObjectId(data.project_id)})
        if p:
            project_name = p["name"]
    if data.assigned_to:
        assigned_name = await resolve_user_name(db, data.assigned_to)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Created task",
        "entity_type": "task",
        "entity_id": str(result.inserted_id),
        "details": f"Created task '{data.title}' for {assigned_name or 'unassigned'}",
        "created_at": now_ist(),
    })
    return TaskResponse(
        id=str(result.inserted_id),
        title=data.title,
        description=data.description,
        project_id=data.project_id,
        project_name=project_name,
        assigned_to=data.assigned_to,
        assigned_name=assigned_name,
        priority=data.priority,
        status=data.status,
        deadline=data.deadline,
        created_at=task_doc["created_at"],
        updated_at=task_doc["updated_at"],
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    t = await db["tasks"].find_one({"_id": ObjectId(task_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    project_name = None
    assigned_name = None
    if t.get("project_id"):
        p = await db["projects"].find_one({"_id": ObjectId(t["project_id"])})
        if p:
            project_name = p["name"]
    if t.get("assigned_to"):
        assigned_name = await resolve_user_name(db, t["assigned_to"])
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
        created_at=t["created_at"],
        updated_at=t.get("updated_at", t["created_at"]),
    )


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = now_ist()
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db["tasks"].find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    project_name = None
    assigned_name = None
    if result.get("project_id"):
        p = await db["projects"].find_one({"_id": ObjectId(result["project_id"])})
        if p:
            project_name = p["name"]
    if result.get("assigned_to"):
        assigned_name = await resolve_user_name(db, result["assigned_to"])
    return TaskResponse(
        id=str(result["_id"]),
        title=result["title"],
        description=result.get("description", ""),
        project_id=result.get("project_id"),
        project_name=project_name,
        assigned_to=result.get("assigned_to"),
        assigned_name=assigned_name,
        priority=result.get("priority", "medium"),
        status=result.get("status", "pending"),
        deadline=result.get("deadline"),
        created_at=result["created_at"],
        updated_at=result.get("updated_at", result["created_at"]),
    )


@router.put("/{task_id}/status")
async def update_task_status(task_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    db = get_db()
    valid_statuses = ["pending", "in_progress", "completed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    result = await db["tasks"].find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": {"status": status, "updated_at": now_ist()}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": f"Task status updated to {status}"}


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    result = await db["tasks"].delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}
