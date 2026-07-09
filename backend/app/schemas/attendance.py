from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AttendanceCreate(BaseModel):
    action: str


class AttendanceResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    clock_in: Optional[datetime]
    clock_out: Optional[datetime]
    total_hours: Optional[float]
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    break_total: Optional[float] = None
    date: str
    created_at: datetime
