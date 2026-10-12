from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional
from ..core.security import get_current_user, get_current_admin
from ..prisma_client import get_prisma

router = APIRouter()


class AttendanceSettingsSchema(BaseModel):
    work_start_hour: int = Field(default=9, ge=0, le=23)
    work_start_minute: int = Field(default=0, ge=0, le=59)
    late_threshold_minutes: int = Field(default=30, ge=0, le=120)
    standard_hours: float = Field(default=8.0, ge=1.0, le=24.0)
    min_hours_half_day: float = Field(default=4.5, ge=0.5, le=12.0)


@router.get("/attendance")
async def get_attendance_settings(current_user: dict = Depends(get_current_user)):
    prisma = get_prisma()
    s = await prisma.attendancesettings.find_first()
    if not s:
        return AttendanceSettingsSchema()
    return {
        "work_start_hour": s.work_start_hour,
        "work_start_minute": s.work_start_minute,
        "late_threshold_minutes": s.late_threshold_minutes,
        "standard_hours": s.standard_hours,
        "min_hours_half_day": s.min_hours_half_day,
    }


@router.put("/attendance")
async def update_attendance_settings(
    data: AttendanceSettingsSchema,
    current_admin: dict = Depends(get_current_admin),
):
    prisma = get_prisma()
    existing = await prisma.attendancesettings.find_first()
    payload = {
        "work_start_hour": data.work_start_hour,
        "work_start_minute": data.work_start_minute,
        "late_threshold_minutes": data.late_threshold_minutes,
        "standard_hours": data.standard_hours,
        "min_hours_half_day": data.min_hours_half_day,
        "updated_by": current_admin["id"],
    }
    if existing:
        updated = await prisma.attendancesettings.update(where={"id": existing.id}, data=payload)
    else:
        updated = await prisma.attendancesettings.create(data=payload)
    return {
        "work_start_hour": updated.work_start_hour,
        "work_start_minute": updated.work_start_minute,
        "late_threshold_minutes": updated.late_threshold_minutes,
        "standard_hours": updated.standard_hours,
        "min_hours_half_day": updated.min_hours_half_day,
    }
