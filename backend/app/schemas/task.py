from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: str = "medium"
    status: str = "pending"
    deadline: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    project_id: Optional[str]
    project_name: Optional[str]
    assigned_to: Optional[str]
    assigned_name: Optional[str]
    priority: str
    status: str
    deadline: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None
