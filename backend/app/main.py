from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import socketio
from .database import connect_to_mongo, close_mongo_connection
from .prisma_client import connect_prisma, disconnect_prisma
from .api import auth, users, projects, tasks, timings, attendance, logs, stats, comments, upload, settings, leaves, notifications, departments, reports
from .socketio import sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await connect_prisma()
    yield
    await disconnect_prisma()
    await close_mongo_connection()


fastapi_app = FastAPI(title="Employee Task Assignment System", lifespan=lifespan)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
fastapi_app.include_router(users.router, prefix="/api/users", tags=["Users"])
fastapi_app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
fastapi_app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
fastapi_app.include_router(timings.router, prefix="/api/timings", tags=["Timings"])
fastapi_app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
fastapi_app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])
fastapi_app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
fastapi_app.include_router(comments.router, prefix="/api/comments", tags=["Comments"])
fastapi_app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
fastapi_app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
fastapi_app.include_router(leaves.router, prefix="/api/leaves", tags=["Leaves"])
fastapi_app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
fastapi_app.include_router(departments.router, prefix="/api/departments", tags=["Departments"])
fastapi_app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])

app = socketio.ASGIApp(sio, fastapi_app)
