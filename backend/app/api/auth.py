"""
ShieldHer – Authentication API Endpoints (/auth).

Provides:
- User registration with role assignment.
- JWT login with password hashing validation.
- Current user profile endpoint (/auth/me).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.database import get_db_session
from app.models.entities import User, UserRole
from app.schemas.cases import (
    FirebaseLoginRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import AuthService, get_auth_service, get_current_user
from app.services.crypto_service import CryptoService, get_crypto_service

router = APIRouter(prefix="/auth", tags=["auth"])
logger = structlog.get_logger(__name__)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new ShieldHer user",
)
async def register_user(
    req: UserRegisterRequest,
    crypto: CryptoService = Depends(get_crypto_service),
) -> UserResponse:
    async with get_db_session() as session:
        # Check existing email
        existing = await session.execute(select(User).where(User.email == req.email.lower()))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        hashed = crypto.hash_password(req.password)
        new_user = User(
            email=req.email.lower(),
            hashed_password=hashed,
            full_name=req.full_name,
            role=req.role,
            is_active=True,
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

    logger.info("Registered new user", email=new_user.email, role=new_user.role.value)
    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Authenticate and issue JWT access token",
)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth: AuthService = Depends(get_auth_service),
    crypto: CryptoService = Depends(get_crypto_service),
) -> TokenResponse:
    async with get_db_session() as session:
        result = await session.execute(select(User).where(User.email == form_data.username.lower()))
        user = result.scalar_one_or_none()

    if not user or not crypto.verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login attempt", username=form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = auth.create_access_token(user_id=user.id, email=user.email, role=user.role)

    logger.info("User authenticated successfully", user_id=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=auth.settings.jwt_access_token_expire_minutes,
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user via JSON credentials and issue JWT access token",
)
@router.post(
    "/signin",
    response_model=TokenResponse,
    summary="Alias for /auth/login with JSON credentials",
)
async def login_with_json(
    req: UserLoginRequest,
    auth: AuthService = Depends(get_auth_service),
    crypto: CryptoService = Depends(get_crypto_service),
) -> TokenResponse:
    async with get_db_session() as session:
        result = await session.execute(select(User).where(User.email == req.email.lower()))
        user = result.scalar_one_or_none()

    if not user or not crypto.verify_password(req.password, user.hashed_password):
        logger.warning("Failed login attempt via JSON", email=req.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = auth.create_access_token(user_id=user.id, email=user.email, role=user.role)
    logger.info("User authenticated successfully via JSON", user_id=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=auth.settings.jwt_access_token_expire_minutes,
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )


@router.post(
    "/firebase",
    response_model=TokenResponse,
    summary="Authenticate or synchronize Firebase user and issue JWT access token",
)
async def login_with_firebase(
    req: FirebaseLoginRequest,
    auth: AuthService = Depends(get_auth_service),
    crypto: CryptoService = Depends(get_crypto_service),
) -> TokenResponse:
    async with get_db_session() as session:
        result = await session.execute(select(User).where(User.email == req.email.lower()))
        user = result.scalar_one_or_none()

        if not user:
            # Auto-provision user for Firebase account
            hashed = crypto.hash_password(f"Firebase_{uuid.uuid4().hex}")
            user = User(
                email=req.email.lower(),
                hashed_password=hashed,
                full_name=req.full_name or req.email.split("@")[0],
                role=req.role,
                is_active=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info("Auto-provisioned new user via Firebase", email=user.email, role=user.role.value)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = auth.create_access_token(user_id=user.id, email=user.email, role=user.role)
    logger.info("Firebase user authenticated successfully", user_id=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=auth.settings.jwt_access_token_expire_minutes,
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get authenticated user profile",
)
async def get_my_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )
