"""Seed an admin user. Run once after fresh DB."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "api"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db.session import Base
from app.db.models import User, UserRole
from app.core.security import hash_password
from app.core.config import get_settings

settings = get_settings()
engine = create_engine(settings.DATABASE_URL_SYNC)

with Session(engine) as db:
    # Check if admin exists
    existing = db.query(User).filter(User.email == "admin@dominator.gg").first()
    if existing:
        print("Admin already exists, skipping.")
    else:
        admin = User(
            email="admin@dominator.gg",
            password_hash=hash_password("admin123"),
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        print("✅ Admin created: admin@dominator.gg / admin123")

    # Also create a player account
    existing_player = db.query(User).filter(User.email == "player@dominator.gg").first()
    if existing_player:
        print("Player already exists, skipping.")
    else:
        player = User(
            email="player@dominator.gg",
            password_hash=hash_password("player123"),
            role=UserRole.player,
        )
        db.add(player)
        db.commit()
        print("✅ Player created: player@dominator.gg / player123")