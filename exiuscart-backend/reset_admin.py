"""
Run once on the server to reset (or create) the admin account.
Usage: python3 reset_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User

NEW_EMAIL = "admin@exiuscart.com"
NEW_PASSWORD = "ExiusAdmin@2026"

db = SessionLocal()
admin = db.query(User).filter(User.is_superuser == True).first()

if admin:
    print(f"Found admin: {admin.email}")
    admin.email = NEW_EMAIL
    admin.hashed_password = get_password_hash(NEW_PASSWORD)
    admin.is_active = True
    db.commit()
    print(f"Password reset.")
else:
    print("No superuser found — creating one.")
    u = User(
        email=NEW_EMAIL,
        hashed_password=get_password_hash(NEW_PASSWORD),
        full_name="Admin",
        is_superuser=True,
        is_active=True,
        is_verified=True,
    )
    db.add(u)
    db.commit()
    print(f"Admin created.")

db.close()
print(f"\nLogin at admin.exiuscart.com")
print(f"Email:    {NEW_EMAIL}")
print(f"Password: {NEW_PASSWORD}")
