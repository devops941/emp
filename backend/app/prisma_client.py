from prisma import Prisma

_prisma: Prisma = None


async def connect_prisma():
    global _prisma
    _prisma = Prisma()
    await _prisma.connect()


async def disconnect_prisma():
    global _prisma
    if _prisma:
        await _prisma.disconnect()


def get_prisma() -> Prisma:
    return _prisma


async def get_attendance_config() -> dict:
    s = await _prisma.attendancesettings.find_first()
    if not s:
        return {"late_hour": 9, "late_minute": 30, "standard_hours": 8.0, "min_hours_half_day": 4.5}
    total_late_mins = s.work_start_hour * 60 + s.work_start_minute + s.late_threshold_minutes
    return {
        "late_hour": total_late_mins // 60,
        "late_minute": total_late_mins % 60,
        "standard_hours": s.standard_hours,
        "min_hours_half_day": s.min_hours_half_day,
    }
