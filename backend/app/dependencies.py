from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from functools import lru_cache
from app.config import get_settings

security = HTTPBearer(auto_error=False)
settings = get_settings()

# ── Dev mode mock user ────────────────────────────────────────
DEV_USER = {
    "sub": "dev-user-001",
    "email": "admin@ckd-otto.com",
    "name": "IT Admin (Dev)",
    "roles": ["admin", "it_staff"],
    "username": "admin.dev",
}


@lru_cache(maxsize=1)
def _get_keycloak_public_key() -> str:
    """Fetch Keycloak realm public key (cached)."""
    url = f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        raw_key = resp.json()["public_key"]
        return f"-----BEGIN PUBLIC KEY-----\n{raw_key}\n-----END PUBLIC KEY-----"
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Keycloak: {e}")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Validate Keycloak JWT. In development mode, return mock user."""
    # ── Bypass auth in development ──
    if settings.ENVIRONMENT == "development":
        return DEV_USER

    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        public_key = _get_keycloak_public_key()
        payload = jwt.decode(
            creds.credentials,
            public_key,
            algorithms=["RS256"],
            audience="account",
            options={"verify_aud": False},
        )
        return {
            "sub": payload.get("sub"),
            "email": payload.get("email", ""),
            "name": payload.get("name", payload.get("preferred_username", "")),
            "roles": payload.get("realm_access", {}).get("roles", []),
            "username": payload.get("preferred_username", ""),
        }
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


def require_role(*roles: str):
    """Dependency factory that checks if user has at least one of the specified roles."""
    async def _check(user: dict = Depends(get_current_user)):
        if not roles:
            return user
        # ── Skip role check in development ──
        if settings.ENVIRONMENT == "development":
            return user
        user_roles = set(user.get("roles", []))
        if not user_roles.intersection(set(roles)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check
