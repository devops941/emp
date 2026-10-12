from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..database import get_db, resolve_user_name
from ..core.security import get_current_user
from ..core.timezone import now_ist
from ..socketio import emit_event, emit_admin_event
from ..prisma_client import get_attendance_config
from bson import ObjectId
import calendar


class BreakEntry(BaseModel):
    type: str = "short"
    start: datetime
    end: Optional[datetime] = None
    duration_mins: Optional[float] = None


class AttendanceSummary(BaseModel):
    month: int
    year: int
    working_days: int
    total_hours: float
    avg_hours_per_day: float
    late_days: int
    overtime_days: int
    total_overtime: float
    present_days: int
    half_days: int


class AttendanceResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    clock_in: Optional[datetime]
    clock_out: Optional[datetime]
    total_hours: Optional[float]
    overtime_hours: Optional[float] = None
    breaks: List[BreakEntry] = []
    break_total: Optional[float] = None
    is_late: Optional[bool] = None
    status: Optional[str] = None
    work_type: str = "office"
    date: str
    created_at: datetime


router = APIRouter()


def build_response(record: dict, user_name: str) -> AttendanceResponse:
    breaks = [
        BreakEntry(
            type=b.get("type", "short"),
            start=b["start"],
            end=b.get("end"),
            duration_mins=b.get("duration_mins"),
        )
        for b in record.get("breaks", [])
    ]
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=record["user_id"],
        user_name=user_name,
        clock_in=record.get("clock_in"),
        clock_out=record.get("clock_out"),
        total_hours=record.get("total_hours"),
        overtime_hours=record.get("overtime_hours"),
        breaks=breaks,
        break_total=record.get("break_total"),
        is_late=record.get("is_late"),
        status=record.get("status"),
        work_type=record.get("work_type", "office"),
        date=record["date"],
        created_at=record["created_at"],
    )


@router.get("/summary")
async def get_summary(
    month: int = Query(default=None, ge=1, le=12),
    year: int = Query(default=None, ge=2020),
    user_id: str = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    now = now_ist()
    target_month = month or now.month
    target_year = year or now.year

    uid = current_user["id"] if current_user["role"] == "employee" else (user_id or current_user["id"])

    _, days_in_month = calendar.monthrange(target_year, target_month)
    month_start = f"{target_year}-{target_month:02d}-01"
    month_end = f"{target_year}-{target_month:02d}-{days_in_month:02d}"

    records = []
    async for r in db["attendance"].find({
        "user_id": uid,
        "date": {"$gte": month_start, "$lte": month_end},
    }):
        records.append(r)

    working_days = len(records)
    total_hours = sum(r.get("total_hours") or 0 for r in records)
    avg_hours = round(total_hours / working_days, 2) if working_days else 0
    late_days = sum(1 for r in records if r.get("is_late"))
    overtime_days = sum(1 for r in records if (r.get("overtime_hours") or 0) > 0)
    total_overtime = round(sum(r.get("overtime_hours") or 0 for r in records), 2)
    present_days = sum(1 for r in records if r.get("status") == "present")
    half_days = sum(1 for r in records if r.get("status") == "half_day")

    return AttendanceSummary(
        month=target_month,
        year=target_year,
        working_days=working_days,
        total_hours=round(total_hours, 2),
        avg_hours_per_day=avg_hours,
        late_days=late_days,
        overtime_days=overtime_days,
        total_overtime=total_overtime,
        present_days=present_days,
        half_days=half_days,
    )


@router.get("/")
async def get_attendance(
    user_id: str = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    total = await db["attendance"].count_documents(query)
    skip = (page - 1) * per_page
    records = []
    async for r in db["attendance"].find(query).sort("date", -1).skip(skip).limit(per_page):
        records.append(build_response(r, await resolve_user_name(db, r["user_id"])))
    return {"items": records, "total": total, "page": page, "per_page": per_page}


@router.get("/today", response_model=AttendanceResponse)
async def get_today_attendance(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({"user_id": current_user["id"], "date": today_str})
    if not record:
        raise HTTPException(status_code=404, detail="No attendance record for today")
    return build_response(record, await resolve_user_name(db, current_user["id"]))


@router.post("/clock-in", response_model=AttendanceResponse)
async def clock_in(
    work_type: str = Query(default="office", pattern="^(office|wfh)$"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    today_str = now_ist().date().isoformat()
    existing = await db["attendance"].find_one({"user_id": current_user["id"], "date": today_str})
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in today")
    now = now_ist()
    cfg = await get_attendance_config()
    is_late = now.hour > cfg["late_hour"] or (now.hour == cfg["late_hour"] and now.minute > cfg["late_minute"])
    record = {
        "user_id": current_user["id"],
        "clock_in": now,
        "clock_out": None,
        "total_hours": None,
        "overtime_hours": None,
        "breaks": [],
        "break_total": None,
        "is_late": is_late,
        "status": None,
        "work_type": work_type,
        "date": today_str,
        "created_at": now,
    }
    result = await db["attendance"].insert_one(record)
    record["_id"] = result.inserted_id
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Clocked in",
        "entity_type": "attendance",
        "entity_id": str(result.inserted_id),
        "details": f"Clocked in {'(late)' if is_late else ''} via {work_type}",
        "created_at": now_ist(),
    })
    await emit_event("clock_in", {"user_id": current_user["id"], "clock_in": now.isoformat(), "is_late": is_late}, user_id=current_user["id"])
    await emit_admin_event("clock_in", {"user_id": current_user["id"], "clock_in": now.isoformat(), "is_late": is_late, "name": current_user.get("name")})
    return build_response(record, await resolve_user_name(db, current_user["id"]))


@router.post("/clock-out", response_model=AttendanceResponse)
async def clock_out(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({"user_id": current_user["id"], "date": today_str})
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    if record.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")

    # End any active break before clocking out
    breaks = record.get("breaks", [])
    now = now_ist()
    active_idx = next((i for i, b in enumerate(breaks) if b.get("end") is None), None)
    update_fields = {}
    break_total = record.get("break_total", 0) or 0
    if active_idx is not None:
        duration_mins = (now - breaks[active_idx]["start"]).total_seconds() / 60
        break_total = round(break_total + duration_mins / 60, 4)
        update_fields[f"breaks.{active_idx}.end"] = now
        update_fields[f"breaks.{active_idx}.duration_mins"] = round(duration_mins, 2)
        update_fields["break_total"] = break_total

    gross = (now - record["clock_in"]).total_seconds() / 3600
    net_hours = round(gross - break_total, 2)
    cfg = await get_attendance_config()
    overtime = round(max(0, net_hours - cfg["standard_hours"]), 2)
    status = "present" if net_hours >= cfg["min_hours_half_day"] else "half_day"

    update_fields.update({
        "clock_out": now,
        "total_hours": net_hours,
        "overtime_hours": overtime,
        "status": status,
    })
    updated = await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": update_fields},
        return_document=True,
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Clocked out",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Clocked out after {net_hours}h net (OT: {overtime}h, status: {status})",
        "created_at": now_ist(),
    })
    await emit_event("clock_out", {"user_id": current_user["id"], "total_hours": net_hours, "overtime_hours": overtime}, user_id=current_user["id"])
    await emit_admin_event("clock_out", {"user_id": current_user["id"], "total_hours": net_hours, "overtime_hours": overtime, "name": current_user.get("name")})
    return build_response(updated, await resolve_user_name(db, current_user["id"]))


@router.post("/break-start", response_model=AttendanceResponse)
async def break_start(
    break_type: str = Query(default="short", pattern="^(lunch|tea|short)$"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({"user_id": current_user["id"], "date": today_str})
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    if record.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out")
    breaks = record.get("breaks", [])
    if any(b.get("end") is None for b in breaks):
        raise HTTPException(status_code=400, detail="Already on a break")
    now = now_ist()
    new_break = {"type": break_type, "start": now, "end": None, "duration_mins": None}
    updated = await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$push": {"breaks": new_break}},
        return_document=True,
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": f"Break started ({break_type})",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Started {break_type} break",
        "created_at": now_ist(),
    })
    await emit_event("break_start", {"user_id": current_user["id"], "type": break_type}, user_id=current_user["id"])
    await emit_admin_event("break_start", {"user_id": current_user["id"], "type": break_type, "name": current_user.get("name")})
    return build_response(updated, await resolve_user_name(db, current_user["id"]))


@router.post("/break-end", response_model=AttendanceResponse)
async def break_end(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({"user_id": current_user["id"], "date": today_str})
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    breaks = record.get("breaks", [])
    active_idx = next((i for i, b in enumerate(breaks) if b.get("end") is None), None)
    if active_idx is None:
        raise HTTPException(status_code=400, detail="Not on break")
    now = now_ist()
    duration_mins = (now - breaks[active_idx]["start"]).total_seconds() / 60
    prev_total = record.get("break_total", 0) or 0
    new_break_total = round(prev_total + duration_mins / 60, 4)
    updated = await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": {
            f"breaks.{active_idx}.end": now,
            f"breaks.{active_idx}.duration_mins": round(duration_mins, 2),
            "break_total": new_break_total,
        }},
        return_document=True,
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Break ended",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Ended break after {round(duration_mins, 0)} min",
        "created_at": now_ist(),
    })
    await emit_event("break_end", {"user_id": current_user["id"], "duration_mins": round(duration_mins, 2)}, user_id=current_user["id"])
    await emit_admin_event("break_end", {"user_id": current_user["id"], "duration_mins": round(duration_mins, 2), "name": current_user.get("name")})
    return build_response(updated, await resolve_user_name(db, current_user["id"]))
