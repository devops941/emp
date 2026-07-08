from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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
    created_at: datetime


class TimingUpdate(BaseModel):
    end_time: Optional[datetime] = None
    is_running: Optional[bool] = None
