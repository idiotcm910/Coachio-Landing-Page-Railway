from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.models.admin_user import AdminUser

security = HTTPBearer()


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> AdminUser:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    admin = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if admin is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found",
                            headers={"WWW-Authenticate": "Bearer"})
    return admin


def require_role(required_role: str = "admin"):
    """Tương thích ngược: mọi user còn lại đều là admin → chỉ cần JWT hợp lệ.
    Giữ chữ ký `require_role("admin")` để không phải sửa ~198 call-sites endpoint."""
    async def _checker(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
        return admin
    return _checker
