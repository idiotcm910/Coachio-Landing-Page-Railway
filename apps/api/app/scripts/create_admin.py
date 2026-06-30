"""Seed script: create or update the first admin user.

Usage (from apps/api/ with venv activated):
    python -m app.scripts.create_admin --email admin@coachio.ai --password <secret>

Or set env vars ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD and run without args.
"""
import argparse
import os
import sys

# Allow running as `python app/scripts/create_admin.py` from repo root too.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.core.security import get_password_hash
from app.db.base import SessionLocal
from app.models.admin_user import AdminUser


def create_or_update_admin(email: str, password: str) -> None:
    db = SessionLocal()
    try:
        email = email.strip().lower()
        hashed = get_password_hash(password)
        admin = db.query(AdminUser).filter(AdminUser.email == email).first()
        if admin is None:
            admin = AdminUser(email=email, hashed_password=hashed)
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"Admin created: {admin.email} (id={admin.id})")
        else:
            admin.hashed_password = hashed
            db.commit()
            print(f"Admin password updated: {admin.email} (id={admin.id})")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update an admin user.")
    parser.add_argument(
        "--email",
        default=os.environ.get("ADMIN_SEED_EMAIL", "admin@coachio.ai"),
        help="Admin email (default: env ADMIN_SEED_EMAIL or admin@coachio.ai)",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_SEED_PASSWORD", ""),
        help="Admin password (default: env ADMIN_SEED_PASSWORD)",
    )
    args = parser.parse_args()

    if not args.password:
        parser.error("--password or env ADMIN_SEED_PASSWORD is required")

    create_or_update_admin(args.email, args.password)


if __name__ == "__main__":
    main()
