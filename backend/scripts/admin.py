#!/usr/bin/env python
"""PrankFX operator console.

Everything you actually need to do when a user writes in — look up an account,
hand back FX after a failed clip, check why a job died, delete an account on
request — without building and securing a web admin panel that would itself
become the most attractive target in the system.

Run from the `backend/` directory, on the server (or anywhere with access to
the same MONGO_URL):

    python scripts/admin.py stats
    python scripts/admin.py user maxim@example.com
    python scripts/admin.py fx maxim@example.com +10 --reason "failed snap"
    python scripts/admin.py premium maxim@example.com on
    python scripts/admin.py snaps --status failed --limit 10
    python scripts/admin.py purchases maxim@example.com
    python scripts/admin.py delete-user maxim@example.com --yes

Every write is recorded in the `admin_actions` collection with the operating
system user and the machine that ran it, so a balance change is never a
mystery three weeks later.
"""
import argparse
import asyncio
import getpass
import os
import socket
import sys
from datetime import timedelta
from pathlib import Path

# Allow `python scripts/admin.py` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings                        # noqa: E402
from app.database import client, db                    # noqa: E402
from app.repositories.user_repository import UserRepository  # noqa: E402
from app.services.auth_service import AuthService      # noqa: E402
from app.utils.datetime import utc_now                 # noqa: E402


users = UserRepository()


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def line(label: str, value) -> None:
    print(f"  {label:<22} {value}")


async def audit(action: str, details: dict) -> None:
    try:
        await db.admin_actions.insert_one(
            {
                "action": action,
                "details": details,
                "operator": f"{getpass.getuser()}@{socket.gethostname()}",
                "at": utc_now(),
            }
        )
    except Exception as e:
        print(f"  (warning: could not write the audit record: {e})")


async def find_user(email: str) -> dict | None:
    """Look an account up by email, by user_id, or `last`.

    `last` is the most recently active account — handy while testing on your
    own phone as a guest, whose "email" is an internal guest.<id>@… address
    nobody remembers.
    """
    key = email.strip()

    if key.lower() in ("last", "latest", "me"):
        cursor = db.users.find({}, {"_id": 0}).sort("created_at", -1).limit(1)
        found = await cursor.to_list(length=1)
        user = found[0] if found else None
    else:
        user = await users.get_by_email(key.lower()) or await users.get_by_user_id(key)

    if not user:
        print(f"No account for {email}")

    return user


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

async def cmd_stats(args) -> None:
    day_ago = utc_now() - timedelta(days=1)
    week_ago = utc_now() - timedelta(days=7)

    total = await db.users.count_documents({})
    new_day = await db.users.count_documents({"created_at": {"$gte": day_ago}})
    new_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    premium = await db.users.count_documents({"is_premium": True})

    projects = await db.projects.count_documents({})
    projects_day = await db.projects.count_documents({"created_at": {"$gte": day_ago}})

    snaps_total = await db.snap_jobs.count_documents({})
    snaps_failed = await db.snap_jobs.count_documents({"status": "failed"})
    snaps_day = await db.snap_jobs.count_documents({"created_at": {"$gte": day_ago}})

    purchases = await db.purchases.count_documents({"processed": True})

    # FX still sitting in accounts — the liability side of the business.
    cursor = db.users.aggregate(
        [{"$group": {"_id": None, "fx": {"$sum": "$fx_credits"}}}]
    )
    outstanding = 0
    async for row in cursor:
        outstanding = row.get("fx") or 0

    print("\nPrankFX — current state\n")
    line("Users", f"{total}  (+{new_day} today, +{new_week} this week)")
    line("Premium", premium)
    line("FX outstanding", outstanding)
    print()
    line("Photo projects", f"{projects}  (+{projects_day} today)")
    line("Snap clips", f"{snaps_total}  (+{snaps_day} today)")
    line("Snap failures", snaps_failed)
    line("Purchase events", purchases)
    print()
    line("Mock purchases", "ON — NOT FOR PRODUCTION" if settings.ALLOW_MOCK_PURCHASES else "off")
    line("RevenueCat webhook", "configured" if settings.REVENUECAT_WEBHOOK_AUTH else "MISSING")
    line("Decart key", "configured" if settings.DECART_API_KEY else "MISSING")
    line("fal.ai key (PixVerse)", "configured" if settings.FAL_KEY else "missing")
    line("Photo Snap engine", f"{settings.SNAP_PHOTO_ENGINE} (fallback {'on' if settings.SNAP_PHOTO_FALLBACK else 'off'})")
    line("Gemini key", "configured" if settings.GEMINI_API_KEY else "MISSING")
    print()


async def cmd_user(args) -> None:
    user = await find_user(args.email)

    if not user:
        return

    uid = user["user_id"]

    projects = await db.projects.count_documents({"user_id": uid})
    snaps = await db.snap_jobs.count_documents({"user_id": uid})
    failed = await db.snap_jobs.count_documents({"user_id": uid, "status": "failed"})
    # Events are keyed on `app_user_id` — that is the field RevenueCat sends.
    spent = await db.purchases.count_documents({"app_user_id": uid})

    print(f"\n{user.get('email')}\n")
    line("user_id", uid)
    line("Name", user.get("name") or "—")
    line("Sign-in method", user.get("provider"))
    line("Registered", user.get("created_at"))
    line("FX balance", user.get("fx_credits", 0))
    line("Premium", user.get("is_premium", False))
    line("Premium tier", user.get("premium_tier") or "—")
    print()
    line("Photo projects", projects)
    line("Snap clips", f"{snaps}  ({failed} failed)")
    line("Purchases", spent)
    print()


async def cmd_fx(args) -> None:
    user = await find_user(args.email)

    if not user:
        return

    amount = int(args.amount)

    if amount == 0:
        print("Amount must not be zero.")
        return

    before = user.get("fx_credits", 0)

    if amount > 0:
        updated = await users.add_fx_credits(user["user_id"], amount)
    else:
        updated = await users.deduct_fx_credits(user["user_id"], -amount)

    after = (updated or {}).get("fx_credits", before)

    await audit(
        "fx",
        {
            "user_id": user["user_id"],
            "email": user["email"],
            "amount": amount,
            "before": before,
            "after": after,
            "reason": args.reason,
        },
    )

    print(f"{user['email']}: {before} → {after} FX  ({amount:+d}, {args.reason})")


async def cmd_premium(args) -> None:
    user = await find_user(args.email)

    if not user:
        return

    on = args.state == "on"

    await users.update(
        user["user_id"],
        {
            "is_premium": on,
            "premium_tier": "manual" if on else None,
        },
    )

    await audit(
        "premium",
        {"user_id": user["user_id"], "email": user["email"], "state": args.state},
    )

    print(f"{user['email']}: premium {'ON' if on else 'OFF'}")

    if on:
        print(
            "  Note: a real subscription is driven by the RevenueCat webhook. "
            "A manual grant here is overwritten the next time that fires."
        )


async def cmd_snaps(args) -> None:
    query = {}

    if args.status:
        query["status"] = args.status

    cursor = (
        db.snap_jobs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(args.limit)
    )

    rows = await cursor.to_list(length=args.limit)

    if not rows:
        print("Nothing found.")
        return

    print()

    for job in rows:
        print(f"  {job.get('created_at')}  {job.get('status'):<10} {job.get('effect_id')}  [{job.get('engine') or '-'}]")
        print(f"    job_id  {job.get('job_id')}   user  {job.get('user_id')}")

        if job.get("error"):
            print(f"    error   {job['error'][:160]}")

        print()


async def cmd_purchases(args) -> None:
    user = await find_user(args.email)

    if not user:
        return

    cursor = (
        db.purchases.find({"app_user_id": user["user_id"]}, {"_id": 0})
        .sort("received_at", -1)
        .limit(args.limit)
    )

    rows = await cursor.to_list(length=args.limit)

    if not rows:
        print("No purchase events for this account.")
        return

    print()

    for event in rows:
        fx = event.get("fx_added") or (-(event.get("fx_removed") or 0)) or 0

        print(
            f"  {event.get('received_at')}  {event.get('type'):<24} "
            f"{event.get('product_id') or '—':<24} {fx:+d} FX"
        )

    print()


async def cmd_delete_user(args) -> None:
    user = await find_user(args.email)

    if not user:
        return

    if not args.yes:
        print(
            f"This permanently deletes {user['email']}, their photo history "
            "and their clips. Re-run with --yes to confirm."
        )
        return

    await AuthService().delete_account(user["user_id"])

    await audit("delete_user", {"user_id": user["user_id"], "email": user["email"]})

    print(f"Deleted {user['email']} and everything that belonged to it.")


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="admin.py",
        description="PrankFX operator console",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("stats", help="overview of users, content and configuration")

    p = sub.add_parser("user", help="everything about one account")
    p.add_argument("email")

    p = sub.add_parser("fx", help="grant (+N) or take back (-N) FX credits")
    p.add_argument("email")
    p.add_argument("amount", help="e.g. +10 or -5")
    p.add_argument("--reason", default="support", help="written into the audit log")

    p = sub.add_parser("premium", help="switch the premium flag by hand")
    p.add_argument("email")
    p.add_argument("state", choices=["on", "off"])

    p = sub.add_parser("snaps", help="recent Snap jobs, newest first")
    p.add_argument("--status", choices=["queued", "processing", "completed", "failed"])
    p.add_argument("--limit", type=int, default=20)

    p = sub.add_parser("purchases", help="purchase events for one account")
    p.add_argument("email")
    p.add_argument("--limit", type=int, default=20)

    p = sub.add_parser("delete-user", help="delete an account and all its content")
    p.add_argument("email")
    p.add_argument("--yes", action="store_true", help="skip the confirmation")

    return parser


COMMANDS = {
    "stats": cmd_stats,
    "user": cmd_user,
    "fx": cmd_fx,
    "premium": cmd_premium,
    "snaps": cmd_snaps,
    "purchases": cmd_purchases,
    "delete-user": cmd_delete_user,
}


async def main() -> None:
    args = build_parser().parse_args()

    try:
        await COMMANDS[args.command](args)
    finally:
        client.close()


if __name__ == "__main__":
    if os.name == "nt":
        # Motor needs the proactor loop on Windows for its socket transport.
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    asyncio.run(main())
