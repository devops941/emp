from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActivityLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: Optional[str]
    created_at: datetime
