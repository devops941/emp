import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from ..database import get_db, resolve_user_name
from ..core.security import get_current_admin
from ..core.timezone import now_ist
from bson import ObjectId

router = APIRouter()


@router.get("/attendance")
async def export_attendance(
    month: int = Query(default=None, ge=1, le=12),
    year: int = Query(default=None, ge=2020),
    user_id: str = Query(default=None),
    current_user: dict = Depends(get_current_admin),
):
    db = get_db()
    now = now_ist()
    target_month = month or now.month
    target_year = year or now.year
    month_prefix = f"{target_year}-{target_month:02d}-"
    query = {"date": {"$regex": f"^{month_prefix}"}}
    if user_id:
        query["user_id"] = user_id
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Employee", "Clock In", "Clock Out", "Total Hours", "Overtime", "Status", "Work Type", "Late"])
    async for r in db["attendance"].find(query).sort("date", 1):
        name = await resolve_user_name(db, r["user_id"])
        writer.writerow([
            r.get("date", ""),
            name,
            r["clock_in"].strftime("%H:%M:%S") if r.get("clock_in") else "",
            r["clock_out"].strftime("%H:%M:%S") if r.get("clock_out") else "",
            r.get("total_hours", ""),
            r.get("overtime_hours", ""),
            r.get("status", ""),
            r.get("work_type", ""),
            "Yes" if r.get("is_late") else "No",
        ])
    filename = f"attendance_{target_year}_{target_month:02d}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/tasks")
async def export_tasks(
    status: str = Query(default=None),
    project_id: str = Query(default=None),
    current_user: dict = Depends(get_current_admin),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if project_id:
        query["project_id"] = project_id
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Title", "Assigned To", "Project", "Priority", "Status", "Estimated Hours", "Actual Hours", "Deadline", "Created At"])
    async for t in db["tasks"].find(query).sort("created_at", -1):
        assigned_name = await resolve_user_name(db, t["assigned_to"]) if t.get("assigned_to") else ""
        project_name = ""
        if t.get("project_id"):
            try:
                p = await db["projects"].find_one({"_id": ObjectId(t["project_id"])}, {"name": 1})
                if p:
                    project_name = p["name"]
            except Exception:
                pass
        total_minutes = 0
        async for r in db["timings"].find({"task_id": str(t["_id"]), "is_running": False}):
            total_minutes += r.get("duration_minutes", 0)
        actual_hours = round(total_minutes / 60, 2) if total_minutes > 0 else ""
        deadline = t["deadline"].strftime("%Y-%m-%d") if t.get("deadline") else ""
        created_at = t["created_at"].strftime("%Y-%m-%d %H:%M") if t.get("created_at") else ""
        writer.writerow([
            t.get("title", ""),
            assigned_name,
            project_name,
            t.get("priority", ""),
            t.get("status", ""),
            t.get("estimated_hours", ""),
            actual_hours,
            deadline,
            created_at,
        ])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks.csv"},
    )


@router.get("/leaves")
async def export_leaves(
    status: str = Query(default=None),
    user_id: str = Query(default=None),
    current_user: dict = Depends(get_current_admin),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Type", "Start Date", "End Date", "Days", "Status", "Reason", "Applied At"])
    async for r in db["leaves"].find(query).sort("created_at", -1):
        name = await resolve_user_name(db, r["user_id"])
        applied_at = r["created_at"].strftime("%Y-%m-%d %H:%M") if r.get("created_at") else ""
        writer.writerow([
            name,
            r.get("leave_type", ""),
            r.get("start_date", ""),
            r.get("end_date", ""),
            r.get("days", ""),
            r.get("status", ""),
            r.get("reason", ""),
            applied_at,
        ])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leaves.csv"},
    )
