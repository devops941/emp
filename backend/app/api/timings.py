from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import timedelta, datetime
from pydantic import BaseModel
from typing import Optional
from ..database import get_db, resolve_user_name
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist
from ..socketio import emit_event, emit_admin_event


class TimingCreate(BaseModel):
    task_id: str
    action: str


class TimingResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    task_id: str
    task_title: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_minutes: Optional[float]
    is_running: bool
    is_manual: bool = False
    created_at: datetime


router = APIRouter()


@router.get("/timesheet")
async def get_timesheet(
    week_start: str = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    today = now_ist().date()
    if week_start:
        try:
            start_date = now_ist().replace(year=int(week_start[:4]), month=int(week_start[5:7]), day=int(week_start[8:10]))
        except:
            start_date = today
    else:
        start_date = today - timedelta(days=today.weekday())
    start_dt = now_ist().replace(year=start_date.year, month=start_date.month, day=start_date.day, hour=0, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(days=7)

    query = {"start_time": {"$gte": start_dt, "$lt": end_dt}}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]

    task_hours: dict[str, dict] = {}
    async for t in db["timings"].find(query):
        tid = t["task_id"]
        if tid not in task_hours:
            task_hours[tid] = {"task_id": tid, "days": {i: 0 for i in range(7)}, "total": 0}
        day_index = (t["start_time"].date() - start_dt.date()).days
        if 0 <= day_index < 7:
            mins = t.get("duration_minutes", 0) or 0
            task_hours[tid]["days"][day_index] += mins
            task_hours[tid]["total"] += mins

    result = []
    for tid, data in task_hours.items():
        task = await db["tasks"].find_one({"_id": ObjectId(tid)})
        result.append({
            "task_id": tid,
            "task_title": task["title"] if task else "Unknown",
            "project_name": None,
            "days": {str(i): round(data["days"][i], 2) for i in range(7)},
            "total": round(data["total"] / 60, 2),
        })
        if task and task.get("project_id"):
            proj = await db["projects"].find_one({"_id": ObjectId(task["project_id"])})
            if proj:
                result[-1]["project_name"] = proj["name"]
    return {"week_start": start_dt.date().isoformat(), "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "items": result}


@router.get("/")
async def get_timings(
    user_id: str = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    from_date: str = Query(default=None),
    to_date: str = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    date_filter = {}
    if from_date:
        try:
            dt = datetime.strptime(from_date, "%Y-%m-%d")
            date_filter["$gte"] = dt
        except:
            pass
    if to_date:
        try:
            dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            date_filter["$lte"] = dt
        except:
            pass
    if date_filter:
        query["start_time"] = date_filter
    total = await db["timings"].count_documents(query)
    skip = (page - 1) * per_page
    timings = []
    async for t in db["timings"].find(query).sort("created_at", -1).skip(skip).limit(per_page):
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
            is_manual=t.get("is_manual", False),
            created_at=t["created_at"],
        )
        timing.user_name = await resolve_user_name(db, t["user_id"])
        task = await db["tasks"].find_one({"_id": ObjectId(t["task_id"])})
        if task:
            timing.task_title = task["title"]
        timings.append(timing)
    return {"items": timings, "total": total, "page": page, "per_page": per_page}


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
    await emit_event("timer_started", {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "task_title": task["title"],
        "start_time": timing_doc["start_time"].isoformat(),
    }, user_id=current_user["id"])
    await emit_admin_event("timer_started", {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "task_title": task["title"],
        "start_time": timing_doc["start_time"].isoformat(),
    })
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
    await emit_event("timer_stopped", {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "duration_minutes": round(duration, 2),
    }, user_id=current_user["id"])
    await emit_admin_event("timer_stopped", {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "duration_minutes": round(duration, 2),
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


class ManualTimingCreate(BaseModel):
    task_id: str
    start_time: str  # ISO datetime string
    end_time: str
    notes: str = ""


@router.post("/manual")
async def add_manual_timing(data: ManualTimingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        task_oid = ObjectId(data.task_id)
    except Exception:
        raise HTTPException(400, "Invalid task ID")
    task = await db["tasks"].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(404, "Task not found")
    if current_user["role"] == "employee" and task.get("assigned_to") != current_user["id"]:
        raise HTTPException(403, "Task not assigned to you")

    try:
        start = datetime.fromisoformat(data.start_time)
        end = datetime.fromisoformat(data.end_time)
    except Exception:
        raise HTTPException(400, "Invalid datetime format. Use ISO 8601.")
    if end <= start:
        raise HTTPException(400, "end_time must be after start_time")

    duration_minutes = round((end - start).total_seconds() / 60, 2)
    now = now_ist()
    doc = {
        "user_id": current_user["id"],
        "task_id": data.task_id,
        "start_time": start,
        "end_time": end,
        "duration_minutes": duration_minutes,
        "is_running": False,
        "is_manual": True,
        "notes": data.notes,
        "created_at": now,
    }
    result = await db["timings"].insert_one(doc)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Manual time entry added",
        "entity_type": "timing",
        "entity_id": str(result.inserted_id),
        "details": f"Manual entry: {duration_minutes} min on task '{task.get('title', '')}'",
        "created_at": now,
    })
    return {
        "id": str(result.inserted_id),
        "task_id": data.task_id,
        "task_title": task.get("title", ""),
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration_minutes": duration_minutes,
        "is_running": False,
        "is_manual": True,
        "notes": data.notes,
        "created_at": now.isoformat(),
    }
