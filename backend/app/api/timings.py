from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from ..database import get_db, resolve_user_name
from ..schemas.timing import TimingCreate, TimingResponse
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/", response_model=list[TimingResponse])
async def get_timings(user_id: str = None, current_user: dict = Depends(get_current_user)):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    timings = []
    async for t in db["timings"].find(query).sort("created_at", -1):
        timing = TimingResponse(
            id=str(t["_id"]),
            user_id=t["user_id"],
            user_name=None,
            task_id=t["task_id"],
            task_title=None,
            start_time=t.get("start_time"),
            end_time=t.get("end_time"),
            duration_minutes=t.get("duration_minutes"),
            is_running=t.get("is_running", False),
            created_at=t["created_at"],
        )
        timing.user_name = await resolve_user_name(db, t["user_id"])
        task = await db["tasks"].find_one({"_id": ObjectId(t["task_id"])})
        if task:
            timing.task_title = task["title"]
        timings.append(timing)
    return timings


@router.post("/start", response_model=TimingResponse)
async def start_timer(data: TimingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db["timings"].find_one(
        {"user_id": current_user["id"], "is_running": True}
    )
    if existing:
        existing_task = await db["tasks"].find_one({"_id": ObjectId(existing["task_id"])})
        raise HTTPException(
            status_code=400,
            detail=f"Already running timer on task: {existing_task['title'] if existing_task else 'Unknown'}. Stop it first.",
        )
    task = await db["tasks"].find_one({"_id": ObjectId(data.task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    timing_doc = {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "start_time": now_ist(),
        "end_time": None,
        "duration_minutes": None,
        "is_running": True,
        "created_at": now_ist(),
    }
    result = await db["timings"].insert_one(timing_doc)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Started timer",
        "entity_type": "timing",
        "entity_id": str(result.inserted_id),
        "details": f"Started timer on task: {task['title']}",
        "created_at": now_ist(),
    })
    await db["tasks"].find_one_and_update(
        {"_id": ObjectId(data.task_id)},
        {"$set": {"status": "in_progress", "updated_at": now_ist()}},
    )
    return TimingResponse(
        id=str(result.inserted_id),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        task_id=data.task_id,
        task_title=task["title"],
        start_time=timing_doc["start_time"],
        end_time=None,
        duration_minutes=None,
        is_running=True,
        created_at=timing_doc["created_at"],
    )


@router.post("/stop", response_model=TimingResponse)
async def stop_timer(data: TimingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    timing = await db["timings"].find_one(
        {"user_id": current_user["id"], "task_id": data.task_id, "is_running": True}
    )
    if not timing:
        raise HTTPException(status_code=400, detail="No running timer found for this task")
    end_time = now_ist()
    start_time = timing["start_time"]
    duration = (end_time - start_time).total_seconds() / 60
    await db["timings"].find_one_and_update(
        {"_id": timing["_id"]},
        {"$set": {
            "end_time": end_time,
            "duration_minutes": round(duration, 2),
            "is_running": False,
        }},
    )
    task = await db["tasks"].find_one({"_id": ObjectId(timing["task_id"])})
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Stopped timer",
        "entity_type": "timing",
        "entity_id": str(timing["_id"]),
        "details": f"Stopped timer on task: {task['title'] if task else 'Unknown'} ({round(duration, 2)} min)",
        "created_at": now_ist(),
    })
    return TimingResponse(
        id=str(timing["_id"]),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        task_id=timing["task_id"],
        task_title=task["title"] if task else None,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=round(duration, 2),
        is_running=False,
        created_at=timing["created_at"],
    )


@router.get("/active", response_model=TimingResponse)
async def get_active_timer(current_user: dict = Depends(get_current_user)):
    db = get_db()
    timing = await db["timings"].find_one(
        {"user_id": current_user["id"], "is_running": True}
    )
    if not timing:
        raise HTTPException(status_code=404, detail="No active timer")
    task = await db["tasks"].find_one({"_id": ObjectId(timing["task_id"])})
    return TimingResponse(
        id=str(timing["_id"]),
        user_id=timing["user_id"],
        user_name=await resolve_user_name(db, timing["user_id"]),
        task_id=timing["task_id"],
        task_title=task["title"] if task else None,
        start_time=timing.get("start_time"),
        end_time=None,
        duration_minutes=None,
        is_running=True,
        created_at=timing["created_at"],
    )
