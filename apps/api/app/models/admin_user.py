"""Admin user — chỉ phục vụ admin JWT login (email/password). Thay cho User cũ.

Public funnel hoàn toàn ẩn danh; chỉ admin cần tài khoản. Vì vậy bỏ hết
credits / can_access_api / role (mọi user đều là admin).
"""
import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.db.base import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
