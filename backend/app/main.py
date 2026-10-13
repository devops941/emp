from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import socketio
import os
from datetime import datetime
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

_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    return HTMLResponse(content=f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EmpTask API</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }}
    .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 48px 56px; max-width: 520px; width: 90%; text-align: center; }}
    .dot {{ width: 12px; height: 12px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 8px; animation: pulse 2s infinite; }}
    @keyframes pulse {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:.4; }} }}
    h1 {{ font-size: 2rem; font-weight: 700; margin: 20px 0 8px; color: #f8fafc; }}
    .subtitle {{ color: #94a3b8; font-size: 0.95rem; margin-bottom: 32px; }}
    .status {{ display: inline-flex; align-items: center; background: #064e3b; color: #6ee7b7; border-radius: 999px; padding: 6px 16px; font-size: 0.85rem; font-weight: 600; margin-bottom: 32px; }}
    .meta {{ color: #64748b; font-size: 0.8rem; margin-bottom: 32px; }}
    .links {{ display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }}
    a {{ background: #334155; color: #cbd5e1; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 500; transition: background .2s; }}
    a:hover {{ background: #475569; color: #f1f5f9; }}
    a.primary {{ background: #10b981; color: #fff; }}
    a.primary:hover {{ background: #059669; }}
  </style>
</head>
<body>
  <div class="card">
    <div><span class="dot"></span></div>
    <h1>EmpTask API</h1>
    <p class="subtitle">Employee Task Management &amp; Time Tracking</p>
    <div class="status"><span class="dot"></span> Backend is running</div>
    <p class="meta">Server time: {now}</p>
    <div class="links">
      <a class="primary" href="/docs">Swagger UI</a>
      <a href="/redoc">ReDoc</a>
      <a href="/openapi.json">OpenAPI JSON</a>
    </div>
  </div>
</body>
</html>
""")

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
