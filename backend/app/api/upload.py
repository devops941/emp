import os
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from ..core.config import CLOUDINARY_NAME, CLOUDINARY_KEY, CLOUDINARY_SECRET
from ..core.security import get_current_user

router = APIRouter()

if CLOUDINARY_NAME and CLOUDINARY_KEY and CLOUDINARY_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_NAME,
        api_key=CLOUDINARY_KEY,
        api_secret=CLOUDINARY_SECRET,
    )


@router.post("/")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not CLOUDINARY_NAME or not CLOUDINARY_KEY or not CLOUDINARY_SECRET:
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    allowed = {"image/jpeg", "image/png", "image/gif", "application/pdf", "text/plain",
               "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
               "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")
    contents = await file.read()
    max_size = 10 * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    try:
        result = cloudinary.uploader.upload(
            contents,
            resource_type="auto",
            folder="emp_task_system",
            public_id=None,
        )
        return {
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "original_name": file.filename,
            "format": result.get("format", ""),
            "bytes": result.get("bytes", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
