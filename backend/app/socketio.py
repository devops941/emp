import socketio
from .core.security import decode_token

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=["http://localhost:3000"])

# Track connected users: sid -> user_id
connected_users: dict[str, str] = {}


@sio.event
async def connect(sid, environ, auth):
    token = None
    qs = environ.get("QUERY_STRING", "")
    for part in qs.split("&"):
        if part.startswith("token="):
            token = part.split("=", 1)[1]
            break
    if not token:
        raise ConnectionRefusedError("No token provided")
    try:
        payload = decode_token(token)
        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            raise ConnectionRefusedError("Invalid token")
        connected_users[sid] = user_id
        await sio.enter_room(sid, user_id)
        role = payload.get("role", "employee")
        if role == "admin":
            await sio.enter_room(sid, "admins")
    except Exception as e:
        raise ConnectionRefusedError(str(e))


@sio.event
async def disconnect(sid):
    connected_users.pop(sid, None)


async def emit_event(event: str, data: dict, user_id: str = None):
    if user_id:
        await sio.emit(event, data, to=user_id)
    else:
        await sio.emit(event, data)


async def emit_admin_event(event: str, data: dict):
    await sio.emit(event, data, to="admins")
