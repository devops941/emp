from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from .core.config import settings, ADMIN_EMAIL, ADMIN_PASSWORD
from .core.security import hash_password
from .core.timezone import now_ist

client = None
db = None


async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DB_NAME]
    await db["users"].create_index("email", unique=True)
    await db["admins"].create_index("email", unique=True)
    await db["projects"].create_index("name", unique=True)
    await seed_admin()


async def seed_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed")
        return
    existing = await db["admins"].find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db["admins"].insert_one({
            "name": "Admin",
            "email": ADMIN_EMAIL,
            "password": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "is_active": True,
            "created_at": now_ist(),
        })
        print(f"Admin user created in admins collection: {ADMIN_EMAIL}")


async def close_mongo_connection():
    global client
    if client:
        client.close()


def get_db():
    return db


async def resolve_user_name(db, user_id: str) -> str:
    """Resolve a user's display name from users or admins collection."""
    try:
        oid = ObjectId(user_id)
    except:
        return "Unknown"
    doc = await db["users"].find_one({"_id": oid}, {"name": 1})
    if doc:
        return doc.get("name", "Unknown")
    doc = await db["admins"].find_one({"_id": oid}, {"name": 1})
    if doc:
        return doc.get("name", "Unknown")
    return "Unknown"
