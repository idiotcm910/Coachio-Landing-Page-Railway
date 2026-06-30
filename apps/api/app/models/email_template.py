import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.db.base import Base


class EmailTemplate(Base):
    """Email template tùy biến — GENERIC, dùng chung cho nhiều tính năng.

    Một template được định danh bởi bộ 3 ``(scope, owner_id, template_key)``:
      - ``scope``: miền tính năng, vd ``"course"``, ``"workshop"``, ``"user_onboarding"``.
      - ``owner_id``: id thực thể trong scope (vd course_id). ``NULL`` = template mặc
        định/global của scope (không gắn entity cụ thể).
      - ``template_key``: loại email trong scope, vd ``"verify" | "credentials" | "receipt"``
        (mỗi tính năng tự định nghĩa tập key của mình).

    Owner dạng polymorphic (KHÔNG FK cứng tới 1 bảng) để tái dùng cho mọi tính năng;
    việc dọn dẹp khi xoá entity do tầng app xử lý. ``subject``/``html_body`` chứa biến
    ``{{key}}`` được thay bằng dữ liệu thật lúc gửi (xem ``email_render.py``).
    """

    __tablename__ = "email_templates"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    scope = Column(String(50), nullable=False)
    owner_id = Column(String(36), nullable=True)
    template_key = Column(String(50), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    subject = Column(Text, nullable=False, default="", server_default="")
    html_body = Column(Text, nullable=False, default="", server_default="")
    updated_by = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Lưu ý: với owner_id = NULL, Postgres coi các NULL là khác nhau → unique không
        # chặn trùng cho template global. Hiện owner_id luôn có giá trị (course_id) nên OK;
        # nếu sau này cần template global theo scope, thêm partial unique index riêng.
        UniqueConstraint("scope", "owner_id", "template_key", name="uq_email_template_scope_owner_key"),
        Index("ix_email_templates_scope_owner", "scope", "owner_id"),
    )
