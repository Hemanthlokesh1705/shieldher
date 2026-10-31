"""
ShieldHer – Authentication, Authorization, and RBAC Services.

Implements:
- JWT token issuing, verification, and revocation checks.
- Role-Based Access Control (RBAC): VICTIM, EXAMINER, ADVOCATE, ADMIN.
- Strict Case Ownership verification: Victims can only access their own cases.
"""
from __future__ import annotations

import datetime
from typing import Callable, List, Optional
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.config import get_settings
from app.database import get_db_session
from app.models.entities import Case, User, UserRole
from app.services.crypto_service import get_crypto_service
from app.services.redis_service import get_redis_service

logger = structlog.get_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


class AuthService:
    def __init__(self):
        self.settings = get_settings()
        self.crypto = get_crypto_service()

    def create_access_token(
        self,
        user_id: uuid.UUID,
        email: str,
        role: UserRole,
        expires_delta: Optional[datetime.timedelta] = None,
    ) -> str:
        expire = datetime.datetime.now(datetime.timezone.utc) + (
            expires_delta or datetime.timedelta(minutes=self.settings.jwt_access_token_expire_minutes)
        )
        claims = {
            "sub": str(user_id),
            "email": email,
            "role": role.value,
            "jti": uuid.uuid4().hex,
            "exp": expire,
            "iat": datetime.datetime.now(datetime.timezone.utc),
        }
        encoded_jwt = jwt.encode(claims, self.settings.jwt_secret_key, algorithm=self.settings.jwt_algorithm)
        return encoded_jwt

    def decode_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret_key,
                algorithms=[self.settings.jwt_algorithm],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            )


_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service


# ── Dependency Helpers ─────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    payload = auth_service.decode_token(token)
    user_id_str = payload.get("sub")
    jti = payload.get("jti")

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identity",
        )

    # Check revocation in Redis if JTI present
    if jti:
        redis_service = get_redis_service()
        if await redis_service.is_token_revoked(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
            )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID format")

    # Fetch user from DB
    async with get_db_session() as session:
        result = await session.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")

    return user


async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    auth_service: AuthService = Depends(get_auth_service),
) -> Optional[User]:
    """Dependency helper returning the authenticated user if Bearer token is provided, or None."""
    if not token:
        return None
    try:
        return await get_current_user(token=token, auth_service=auth_service)
    except HTTPException:
        return None


def require_roles(*allowed_roles: UserRole) -> Callable:
    """Dependency factory checking that the authenticated user possesses an allowed role."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != UserRole.ADMIN:
            logger.warning(
                "Access forbidden: insufficient role permissions",
                user_id=str(current_user.id),
                user_role=current_user.role.value,
                required_roles=[r.value for r in allowed_roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the following roles: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker


def check_case_ownership_or_permission(case: Case, user: User, allow_examiners: bool = True) -> None:
    """
    Enforces strict case authorization:
    - Admins: full access.
    - Owners (Victims): full access to own cases.
    - Examiners / Advocates: read/review access if allow_examiners is True.
    - Others: HTTP 403 Forbidden.
    """
    if user.role == UserRole.ADMIN:
        return

    if case.user_id == user.id:
        return

    if allow_examiners and user.role in (UserRole.EXAMINER, UserRole.ADVOCATE):
        return

    logger.warning(
        "Unauthorized case access attempt",
        case_id=str(case.id),
        case_owner=str(case.user_id),
        requesting_user=str(user.id),
        user_role=user.role.value,
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have authorization to view or modify this case.",
    )
