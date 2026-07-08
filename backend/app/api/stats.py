from fastapi import APIRouter, Depends
from ..database import get_db
from ..core.security import get_current_admin
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_admin)):
    db = get_db()
    total_employees = await db["users"].count_documents({})
    active_projects = await db["projects"].count_documents({"status": "active"})
    today_str = now_ist().date().isoformat()
    today_hours = 0
    async for r in db["attendance"].find({"date": today_str}):
        if r.get("total_hours"):
            today_hours += r["total_hours"]
    total_tasks = await db["tasks"].count_documents({})
    pending_tasks = await db["tasks"].count_documents({"status": "pending"})
    in_progress_tasks = await db["tasks"].count_documents({"status": "in_progress"})
    completed_tasks = await db["tasks"].count_documents({"status": "completed"})
    return {
        "total_employees": total_employees,
        "active_projects": active_projects,
        "today_hours": round(today_hours, 2),
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "completed_tasks": completed_tasks,
    }


@router.get("/employee/{user_id}")
async def get_employee_stats(user_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    total_tasks = await db["tasks"].count_documents({"assigned_to": user_id})
    completed = await db["tasks"].count_documents({"assigned_to": user_id, "status": "completed"})
    in_progress = await db["tasks"].count_documents({"assigned_to": user_id, "status": "in_progress"})
    today_str = now_ist().date().isoformat()
    today_record = await db["attendance"].find_one({"user_id": user_id, "date": today_str})
    today_hours = today_record.get("total_hours", 0) if today_record else 0
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
