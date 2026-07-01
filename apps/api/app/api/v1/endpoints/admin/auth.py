from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.base import get_db
from app.middleware.auth import get_current_admin
from app.models.admin_user import AdminUser
from app.schemas.admin_auth import AdminLoginRequest, TokenResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    email = payload.email.strip().lower()
    admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    if admin is None or not verify_password(payload.password, admin.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token = create_access_token(
        {"sub": admin.id},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=token)


@router.get("/me")
def admin_me(admin: AdminUser = Depends(get_current_admin)) -> dict:
    """Return the currently authenticated admin (frontend session check)."""
    return {
        "id": str(admin.id),
        "email": admin.email,
        "role": "admin",
        "is_active": True,
        "created_at": admin.created_at.isoformat() if getattr(admin, "created_at", None) else None,
    }
