from fastapi import APIRouter, HTTPException, Depends
from ..database import get_db, resolve_user_name
from ..schemas.attendance import AttendanceResponse
from ..core.security import get_current_user
from ..core.timezone import now_ist

router = APIRouter()


@router.get("/", response_model=list[AttendanceResponse])
async def get_attendance(user_id: str = None, current_user: dict = Depends(get_current_user)):
    db = get_db()
    query = {}
    if current_user["role"] == "employee":
        query["user_id"] = current_user["id"]
    elif user_id:
        query["user_id"] = user_id
    records = []
    async for r in db["attendance"].find(query).sort("date", -1):
        records.append(AttendanceResponse(
            id=str(r["_id"]),
            user_id=r["user_id"],
            user_name=await resolve_user_name(db, r["user_id"]),
            clock_in=r.get("clock_in"),
            clock_out=r.get("clock_out"),
            total_hours=r.get("total_hours"),
            date=r["date"],
            created_at=r["created_at"],
        ))
    return records


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
    return AttendanceResponse(
        id=str(result.inserted_id),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=now,
        clock_out=None,
        total_hours=None,
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
    total_hours = round((now - clock_in).total_seconds() / 3600, 2)
    await db["attendance"].find_one_and_update(
        {"_id": record["_id"]},
        {"$set": {"clock_out": now, "total_hours": total_hours}},
    )
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Clocked out",
        "entity_type": "attendance",
        "entity_id": str(record["_id"]),
        "details": f"Clocked out after {total_hours} hours",
        "created_at": now_ist(),
    })
    return AttendanceResponse(
        id=str(record["_id"]),
        user_id=current_user["id"],
        user_name=await resolve_user_name(db, current_user["id"]),
        clock_in=record["clock_in"],
        clock_out=now,
        total_hours=total_hours,
        date=today_str,
        created_at=record["created_at"],
    )
