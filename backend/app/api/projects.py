from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..database import get_db
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    status: str = "active"
    assigned_employees: List[str] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_employees: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    status: str
    assigned_employees: List[str]
    created_at: datetime


router = APIRouter()


@router.get("/", response_model=list[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    db = get_db()
    projects = []
    query = {}
    if current_user["role"] == "employee":
        query = {"assigned_employees": current_user["id"]}
    async for p in db["projects"].find(query).sort("created_at", -1):
        projects.append(ProjectResponse(
            id=str(p["_id"]),
            name=p["name"],
            description=p.get("description", ""),
            status=p.get("status", "active"),
            assigned_employees=p.get("assigned_employees", []),
            created_at=p["created_at"],
        ))
    return projects


@router.post("/", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    existing = await db["projects"].find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Project already exists")
    project_doc = {
        "name": data.name,
        "description": data.description,
        "status": data.status,
        "assigned_employees": data.assigned_employees,
        "created_at": now_ist(),
    }
    result = await db["projects"].insert_one(project_doc)
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Created project",
        "entity_type": "project",
        "entity_id": str(result.inserted_id),
        "details": f"Created project {data.name}",
        "created_at": now_ist(),
    })
    return ProjectResponse(
        id=str(result.inserted_id),
        name=data.name,
        description=data.description,
        status=data.status,
        assigned_employees=data.assigned_employees,
        created_at=project_doc["created_at"],
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    p = await db["projects"].find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=str(p["_id"]),
        name=p["name"],
        description=p.get("description", ""),
        status=p.get("status", "active"),
        assigned_employees=p.get("assigned_employees", []),
        created_at=p["created_at"],
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, data: ProjectUpdate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db["projects"].find_one_and_update(
        {"_id": ObjectId(project_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Updated project",
        "entity_type": "project",
        "entity_id": project_id,
        "details": f"Updated project {result['name']}",
        "created_at": now_ist(),
    })
    return ProjectResponse(
        id=str(result["_id"]),
        name=result["name"],
        description=result.get("description", ""),
        status=result.get("status", "active"),
        assigned_employees=result.get("assigned_employees", []),
        created_at=result["created_at"],
    )


@router.delete("/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    result = await db["projects"].delete_one({"_id": ObjectId(project_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    await db["activity_logs"].insert_one({
        "user_id": current_user["id"],
        "action": "Deleted project",
        "entity_type": "project",
        "entity_id": project_id,
        "details": "Deleted project",
        "created_at": now_ist(),
    })
    return {"message": "Project deleted successfully"}
