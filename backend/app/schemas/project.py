from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    status: str = "active"
    assigned_employees: List[str] = []


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    status: str
    assigned_employees: List[str]
    created_at: datetime


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_employees: Optional[List[str]] = None
