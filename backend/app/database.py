from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import urlparse
from bson import ObjectId
from .core.config import settings, ADMIN_EMAIL, ADMIN_PASSWORD
from .core.security import hash_password
from .core.timezone import now_ist

client = None
db = None


async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_name = urlparse(settings.MONGODB_URI).path.lstrip("/").split("?")[0]
    db = client[db_name]
    await db["users"].create_index("email", unique=True)
    await db["admins"].create_index("email", unique=True)
    await db["projects"].create_index("name", unique=True)
    # TTL: blacklisted tokens auto-expire after 2h (longer than access token)
    await db["token_blacklist"].create_index("expires_at", expireAfterSeconds=0)
    await db["token_blacklist"].create_index("token")
    await seed_admin()


async def seed_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        return
    hashed = hash_password(ADMIN_PASSWORD)
    existing = await db["admins"].find_one({"email": ADMIN_EMAIL})
    if existing:
        await db["admins"].update_one(
            {"_id": existing["_id"]},
            {"$set": {"password": hashed}},
        )
    else:
        old = await db["admins"].find_one({"role": "admin"})
        if old:
            await db["admins"].update_one(
                {"_id": old["_id"]},
                {"$set": {"email": ADMIN_EMAIL, "password": hashed}},
            )
        else:
            await db["admins"].insert_one({
                "name": "Admin",
                "email": ADMIN_EMAIL,
                "password": hashed,
                "role": "admin",
                "is_active": True,
                "created_at": now_ist(),
            })
    print(f"Admin synced: {ADMIN_EMAIL}")


async def close_mongo_connection():
    global client
    if client:
        client.close()


def get_db():
    return db


async def resolve_user_name(db, user_id: str) -> str:
    try:
        oid = ObjectId(user_id)
    except Exception:
        return "Unknown"
    doc = await db["users"].find_one({"_id": oid}, {"name": 1})
    if doc:
        return doc.get("name", "Unknown")
    doc = await db["admins"].find_one({"_id": oid}, {"name": 1})
    if doc:
        return doc.get("name", "Unknown")
    return "Unknown"
