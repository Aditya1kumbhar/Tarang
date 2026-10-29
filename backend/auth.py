"""
Authentication and Session Security Module for ORCA.
Provides:
1. Cryptographic HMAC-SHA256 session token generation and constant-time signature verification.
2. Real Google OAuth2 / Google Identity Services (GIS) ID Token verification via Google's tokeninfo API.
3. FastAPI dependency (get_current_user) enforcing zero-trust route protection.
4. HttpOnly, SameSite=Lax, Secure session cookie management conforming to Zero-Trust Rule #14.
"""

import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status
import httpx
from pydantic import BaseModel, Field

from backend.config import AUTH_SECRET, ENVIRONMENT, GOOGLE_CLIENT_ID, IS_PRODUCTION

logger = logging.getLogger("orca_auth")

COOKIE_NAME = "orca_session"
DEFAULT_SESSION_DURATION_SECONDS = 7 * 86400  # 7 days


class UserSession(BaseModel):
    """Authenticated user profile extracted from verified Google token."""
    email: str
    name: str
    picture: Optional[str] = None
    sub: str
    issued_at: int
    expires_at: int


class GoogleAuthRequest(BaseModel):
    """Payload sent by Google Identity Services on client login."""
    credential: str = Field(..., min_length=10, description="Google OAuth2 ID token (JWT)")


class DevLoginRequest(BaseModel):
    """Payload for local developer/testing authentication when Google Client ID is unconfigured."""
    email: Optional[str] = "maritime.officer@nic.in"
    name: Optional[str] = "Authorized Maritime Officer"


# ==============================================================================
# CRYPTOGRAPHIC HMAC SESSION TOKENS (Standard Library / Zero-Vulnerability)
# ==============================================================================

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * (4 - (len(s) % 4) if len(s) % 4 != 0 else 0)
    return base64.urlsafe_b64decode(s + padding)


def create_session_token(
    user_dict: dict,
    secret: str = AUTH_SECRET,
    expires_in_seconds: int = DEFAULT_SESSION_DURATION_SECONDS,
) -> str:
    """
    Creates a tamper-proof HMAC-SHA256 signed session token.
    Token structure: {base64url_payload}.{base64url_signature}
    """
    now = int(time.time())
    payload = {
        "email": user_dict["email"],
        "name": user_dict.get("name", user_dict["email"].split("@")[0]),
        "picture": user_dict.get("picture"),
        "sub": user_dict.get("sub", user_dict["email"]),
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_bytes)

    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{payload_b64}.{sig_b64}"


def verify_session_token(token: str, secret: str = AUTH_SECRET) -> Optional[UserSession]:
    """
    Verifies token signature using constant-time comparison and checks expiration.
    """
    if not token or "." not in token:
        return None

    parts = token.split(".", 1)
    if len(parts) != 2:
        return None

    payload_b64, sig_b64 = parts

    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256
        ).digest()
        provided_sig = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            logger.warning("Session token HMAC signature verification failed.")
            return None

        payload_bytes = _b64url_decode(payload_b64)
        data = json.loads(payload_bytes.decode("utf-8"))

        # Expiration check
        if data.get("exp", 0) < time.time():
            logger.info("Session token expired.")
            return None

        return UserSession(
            email=data["email"],
            name=data["name"],
            picture=data.get("picture"),
            sub=data["sub"],
            issued_at=data["iat"],
            expires_at=data["exp"],
        )
    except Exception as e:
        logger.debug("Failed to verify session token: %s", e)
        return None


# ==============================================================================
# REAL GOOGLE OAUTH2 / GIS ID TOKEN VERIFICATION
# ==============================================================================

async def verify_google_id_token(
    id_token: str,
    client_id: str = GOOGLE_CLIENT_ID,
) -> Optional[UserSession]:
    """
    Cryptographically verifies Google ID Token using Google's public tokeninfo endpoint.
    Verifies signature, issuer (accounts.google.com), audience (client_id), and verified email.
    """
    if not id_token:
        return None

    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url)
            if res.status_code != 200:
                logger.warning("Google tokeninfo returned HTTP %s: %s", res.status_code, res.text[:200])
                return None

            data = res.json()

            # 1. Verify Issuer
            iss = data.get("iss", "")
            if iss not in ["accounts.google.com", "https://accounts.google.com"]:
                logger.warning("Google token issuer mismatch: %s", iss)
                return None

            # 2. Verify Email Verified Flag
            email_verified = data.get("email_verified")
            if email_verified not in ["true", True, "1", 1]:
                logger.warning("Google account email is not verified: %s", data.get("email"))
                return None

            # 3. Verify Audience (if GOOGLE_CLIENT_ID configured on server)
            if client_id:
                aud = data.get("aud", "")
                if aud != client_id:
                    logger.warning("Google token audience mismatch: expected %s, got %s", client_id, aud)
                    return None

            # 4. Verify Expiration
            exp = int(data.get("exp", 0))
            if exp < time.time():
                logger.warning("Google ID token has expired.")
                return None

            email = data.get("email", "")
            name = data.get("name") or email.split("@")[0]
            picture = data.get("picture")
            sub = data.get("sub", email)
            now = int(time.time())

            return UserSession(
                email=email,
                name=name,
                picture=picture,
                sub=sub,
                issued_at=now,
                expires_at=now + DEFAULT_SESSION_DURATION_SECONDS,
            )
    except Exception as e:
        logger.exception("Error verifying Google ID token with Google endpoint: %s", e)
        return None


# ==============================================================================
# FASTAPI DEPENDENCY & COOKIE HELPERS
# ==============================================================================

def set_session_cookie(response: Response, token: str) -> None:
    """Sets a secure, HttpOnly, SameSite=Lax cookie on the HTTP response."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=DEFAULT_SESSION_DURATION_SECONDS,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Deletes the session cookie upon logout."""
    response.delete_cookie(key=COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> UserSession:
    """
    Enforces authentication on protected routes.
    Extracts session from HttpOnly cookie or Authorization Bearer header.
    In non-production environments, also honors X-ORCA-Test-Auth for testing.
    """
    # 1. Non-production / Test Header
    if not IS_PRODUCTION:
        test_auth = request.headers.get("X-ORCA-Test-Auth")
        if test_auth:
            now = int(time.time())
            return UserSession(
                email="maritime.officer@nic.in",
                name="Authorized Maritime Officer",
                picture=None,
                sub="test_maritime_officer_001",
                issued_at=now,
                expires_at=now + DEFAULT_SESSION_DURATION_SECONDS,
            )

    token = None

    # 2. Extract from Cookie
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        token = cookie_token

    # 3. Extract from Authorization: Bearer <token>
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with your Google account.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = verify_session_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
