from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from ..database import get_db
from ..core.security import get_current_user, get_current_admin
from ..core.timezone import now_ist

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None


async def _build(db, d: dict) -> dict:
    manager_name = None
    if d.get("manager_id"):
        try:
            mgr = await db["users"].find_one({"_id": ObjectId(d["manager_id"])}, {"name": 1})
            if mgr:
                manager_name = mgr["name"]
        except Exception:
            pass
    return {
        "id": str(d["_id"]),
        "name": d["name"],
        "description": d.get("description"),
        "manager_id": d.get("manager_id"),
        "manager_name": manager_name,
        "created_at": d.get("created_at"),
    }


@router.get("/")
async def list_departments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    items = []
    async for d in db["departments"].find().sort("name", 1):
        items.append(await _build(db, d))
    return items


@router.post("/")
async def create_department(data: DepartmentCreate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    existing = await db["departments"].find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
    doc = {
        "name": data.name,
        "description": data.description,
        "manager_id": data.manager_id,
        "created_at": now_ist(),
    }
    result = await db["departments"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _build(db, doc)


@router.put("/{dept_id}")
async def update_department(dept_id: str, data: DepartmentUpdate, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid department ID")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "name" in update_data:
        conflict = await db["departments"].find_one({"name": update_data["name"], "_id": {"$ne": oid}})
        if conflict:
            raise HTTPException(status_code=400, detail="Department with this name already exists")
    result = await db["departments"].find_one_and_update(
        {"_id": oid},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Department not found")
    return await _build(db, result)


@router.delete("/{dept_id}")
async def delete_department(dept_id: str, current_user: dict = Depends(get_current_admin)):
    db = get_db()
    try:
        oid = ObjectId(dept_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid department ID")
    result = await db["departments"].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "Department deleted successfully"}
