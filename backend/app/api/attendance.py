from fastapi import APIRouter, HTTPException, Depends, Query
from ..database import get_db, resolve_user_name
from ..schemas.attendance import AttendanceResponse
from ..core.security import get_current_user
from ..core.timezone import now_ist
from ..socketio import emit_event, emit_admin_event

router = APIRouter()


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
        records.append(AttendanceResponse(
            id=str(r["_id"]),
            user_id=r["user_id"],
            user_name=await resolve_user_name(db, r["user_id"]),
            clock_in=r.get("clock_in"),
            clock_out=r.get("clock_out"),
            total_hours=r.get("total_hours"),
            break_start=r.get("break_start"),
            break_end=r.get("break_end"),
            break_total=r.get("break_total"),
            date=r["date"],
            created_at=r["created_at"],
        ))
    return {"items": records, "total": total, "page": page, "per_page": per_page}


@router.get("/today", response_model=AttendanceResponse)
async def get_today_attendance(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({
        "user_id": current_user["id"],
        "date": today_str,
    })
    if not record:
        raise HTTPException(status_code=404, detail="No attendance record for today")
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=record["user_id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=record.get("clock_in"),
        clock_out=record.get("clock_out"),
        total_hours=record.get("total_hours"),
        break_start=record.get("break_start"),
        break_end=record.get("break_end"),
        break_total=record.get("break_total"),
        date=record["date"],
        created_at=record["created_at"],
    )


@router.post("/clock-in", response_model=AttendanceResponse)
async def clock_in(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    existing = await db["attendance"].find_one({
        "user_id": current_user["id"],
        "date": today_str,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in today")
    now = now_ist()
    record = {
        "user_id": current_user["id"],
        "clock_in": now,
        "clock_out": None,
        "total_hours": None,
        "break_start": None,
        "break_end": None,
        "break_total": None,
        "date": today_str,
        "created_at": now,
    }
    result = await db["attendance"].insert_one(record)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Clocked in",
        "entity_type": "attendance",
        "entity_id": str(result.inserted_id),
        "details": "Clocked in for the day",
        "created_at": now_ist(),
    })
    await emit_event("clock_in", {"user_id": current_user["id"], "clock_in": now.isoformat()}, user_id=current_user["id"])
    await emit_admin_event("clock_in", {"user_id": current_user["id"], "clock_in": now.isoformat(), "name": current_user.get("name")})
    return AttendanceResponse(
        id=str(result.inserted_id),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=now,
        clock_out=None,
        total_hours=None,
        break_start=None,
        break_end=None,
        break_total=None,
        date=today_str,
        created_at=now,
    )


@router.post("/clock-out", response_model=AttendanceResponse)
async def clock_out(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({
        "user_id": current_user["id"],
        "date": today_str,
    })
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    if record.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    now = now_ist()
    clock_in = record["clock_in"]
    gross = (now - clock_in).total_seconds() / 3600
    break_total = record.get("break_total", 0) or 0
    net_hours = round(gross - break_total, 2)
    await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": {"clock_out": now, "total_hours": net_hours}},
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Clocked out",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Clocked out after {net_hours} hours (break: {break_total}h)",
        "created_at": now_ist(),
    })
    await emit_event("clock_out", {"user_id": current_user["id"], "clock_out": now.isoformat(), "total_hours": net_hours}, user_id=current_user["id"])
    await emit_admin_event("clock_out", {"user_id": current_user["id"], "clock_out": now.isoformat(), "total_hours": net_hours, "name": current_user.get("name")})
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=record["clock_in"],
        clock_out=now,
        total_hours=net_hours,
        break_start=record.get("break_start"),
        break_end=record.get("break_end"),
        break_total=record.get("break_total"),
        date=today_str,
        created_at=record["created_at"],
    )


@router.post("/break-start", response_model=AttendanceResponse)
async def break_start(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({
        "user_id": current_user["id"],
        "date": today_str,
    })
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    if record.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    if record.get("break_start") and not record.get("break_end"):
        raise HTTPException(status_code=400, detail="Already on break")
    now = now_ist()
    await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": {"break_start": now, "break_end": None}},
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Break started",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": "Started break",
        "created_at": now_ist(),
    })
    await emit_event("break_start", {"user_id": current_user["id"], "break_start": now.isoformat()}, user_id=current_user["id"])
    await emit_admin_event("break_start", {"user_id": current_user["id"], "break_start": now.isoformat(), "name": current_user.get("name")})
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=record["clock_in"],
        clock_out=None,
        total_hours=record.get("total_hours"),
        break_start=now,
        break_end=None,
        break_total=record.get("break_total", 0),
        date=today_str,
        created_at=record["created_at"],
    )


@router.post("/break-end", response_model=AttendanceResponse)
async def break_end(current_user: dict = Depends(get_current_user)):
    db = get_db()
    today_str = now_ist().date().isoformat()
    record = await db["attendance"].find_one({
        "user_id": current_user["id"],
        "date": today_str,
    })
    if not record:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    if not record.get("break_start") or record.get("break_end"):
        raise HTTPException(status_code=400, detail="Not on break")
    now = now_ist()
    break_start_time = record["break_start"]
    break_mins = (now - break_start_time).total_seconds() / 3600
    prev_total = record.get("break_total", 0) or 0
    new_break_total = round(prev_total + break_mins, 2)
    await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": {"break_end": now, "break_total": new_break_total}},
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Break ended",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Ended break after {round(break_mins * 60, 0)} min",
        "created_at": now_ist(),
    })
    await emit_event("break_end", {"user_id": current_user["id"], "break_end": now.isoformat(), "break_duration": round(break_mins * 60, 0)}, user_id=current_user["id"])
    await emit_admin_event("break_end", {"user_id": current_user["id"], "break_end": now.isoformat(), "break_duration": round(break_mins * 60, 0), "name": current_user.get("name")})
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=record["clock_in"],
        clock_out=None,
        total_hours=record.get("total_hours"),
        break_start=None,
        break_end=None,
        break_total=new_break_total,
        date=today_str,
        created_at=record["created_at"],
    )
