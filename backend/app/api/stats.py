from fastapi import APIRouter, Depends
from ..database import get_db
from ..core.security import get_current_admin, get_current_user
from ..core.timezone import now_ist
from datetime import timedelta

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_admin)):
    db = get_db()
    total_employees = await db["users"].count_documents({})
    active_projects = await db["projects"].count_documents({"status": "active"})
    now = now_ist()
    today_str = now.date().isoformat()
    today_hours = 0
    async for r in db["attendance"].find({"date": today_str}):
        if r.get("total_hours"):
            today_hours += r["total_hours"]
    total_tasks = await db["tasks"].count_documents({})
    pending_tasks = await db["tasks"].count_documents({"status": "pending"})
    in_progress_tasks = await db["tasks"].count_documents({"status": "in_progress"})
    completed_tasks = await db["tasks"].count_documents({"status": "completed"})
    overdue_tasks = await db["tasks"].count_documents({
        "status": {"$nin": ["completed", "cancelled"]},
        "deadline": {"$lt": now},
    })
    today_present = await db["attendance"].count_documents({
        "date": today_str,
        "$or": [
            {"status": {"$in": ["present", "half_day"]}},
            {"clock_in": {"$exists": True}, "clock_out": None},
        ],
    })
    completion_rate = round(completed_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0
    pending_leaves = await db["leaves"].count_documents({"status": "pending"})
    return {
        "total_employees": total_employees,
        "active_projects": active_projects,
        "today_hours": round(today_hours, 2),
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "completed_tasks": completed_tasks,
        "overdue_tasks": overdue_tasks,
        "today_present": today_present,
        "completion_rate": completion_rate,
        "pending_leaves": pending_leaves,
    }


@router.get("/employee/{user_id}")
async def get_employee_stats(user_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    total_tasks = await db["tasks"].count_documents({"assigned_to": user_id})
    completed = await db["tasks"].count_documents({"assigned_to": user_id, "status": "completed"})
    in_progress = await db["tasks"].count_documents({"assigned_to": user_id, "status": "in_progress"})
    today_str = now_ist().date().isoformat()
    today_record = await db["attendance"].find_one({"user_id": user_id, "date": today_str})
    today_hours = (today_record.get("total_hours") or 0) if today_record else 0
    total_hours = 0
    async for r in db["attendance"].find({"user_id": user_id}):
        if r.get("total_hours"):
            total_hours += r["total_hours"]
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed,
        "in_progress_tasks": in_progress,
        "today_hours": round(today_hours, 2),
        "total_hours": round(total_hours, 2),
    }


@router.get("/weekly-tasks")
async def get_weekly_tasks(current_user: dict = Depends(get_current_admin)):
    db = get_db()
    today = now_ist().date()
    labels = []
    data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        labels.append(day.strftime("%a"))
        start = now_ist().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        end = start + timedelta(days=1)
        count = await db["tasks"].count_documents({"created_at": {"$gte": start, "$lt": end}})
        data.append(count)
    return {"labels": labels, "data": data}


@router.get("/project-hours")
async def get_project_hours(current_user: dict = Depends(get_current_admin)):
    db = get_db()
    projects = []
    async for p in db["projects"].find({"status": "active"}):
        total = 0
        async for t in db["tasks"].find({"project_id": str(p["_id"])}):
            async for r in db["timings"].find({"task_id": str(t["_id"]), "is_running": False}):
                total += r.get("duration_minutes", 0)
        if total > 0:
            projects.append({"name": p["name"], "hours": round(total / 60, 1)})
    return projects


@router.get("/my-weekly")
async def get_my_weekly_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today = now_ist().date()
    labels = []
    data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        labels.append(day.strftime("%a"))
        start = now_ist().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        end = start + timedelta(days=1)
        count = await db["tasks"].count_documents({
            "assigned_to": current_user["id"],
            "status": "completed",
            "updated_at": {"$gte": start, "$lt": end},
        })
        data.append(count)
    total_hours = 0
    async for r in db["attendance"].find({"user_id": current_user["id"]}):
        total_hours += r.get("total_hours") or 0
    return {"labels": labels, "data": data, "total_hours": round(total_hours, 1)}
