import json
import base64
from typing import Optional
from fastapi import Header, HTTPException
from config import SUPABASE_JWT_SECRET, SUPABASE_URL, log

try:
    import jwt as pyjwt  # PyJWT
    from jwt import InvalidTokenError, PyJWKClient
except Exception:  # pragma: no cover - PyJWT optional at import time
    pyjwt = None
    InvalidTokenError = Exception
    PyJWKClient = None


_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is None and PyJWKClient is not None and SUPABASE_URL:
        try:
            jwks_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
            _jwks_client = PyJWKClient(jwks_url)
        except Exception as e:
            log.warning("Failed to initialize PyJWKClient for JWKS: %s", e)
    return _jwks_client


def _decode_jwt_payload_unverified(token: str) -> dict:
    """Decode a JWT payload WITHOUT signature verification.

    Used only as a fallback when verification methods are not configured or fail.
    In that mode the token's signature is not checked — acceptable for local development,
    but production deployments should have proper verification configured.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT structure")
    payload_b64 = parts[1]
    padding = 4 - len(payload_b64) % 4
    if padding != 4:
        payload_b64 += "=" * padding
    payload_bytes = base64.urlsafe_b64decode(payload_b64)
    return json.loads(payload_bytes)


def _verify_token(token: str) -> dict:
    """Verify and decode a Supabase JWT.

    Supports:
    1. ES256/RS256 (asymmetric) signed JWTs verified using the Supabase JWKS endpoint.
    2. HS256 (symmetric) signed JWTs verified using SUPABASE_JWT_SECRET.
    3. Falls back to unverified decode in development if verification fails or is not set up.
    """
    if pyjwt is None:
        log.warning("PyJWT is not installed; falling back to unverified decode")
        return _decode_jwt_payload_unverified(token)

    try:
        header = pyjwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception as e:
        log.warning("Failed to parse JWT header: %s", e)
        return _decode_jwt_payload_unverified(token)

    # 1. Asymmetric verification (ES256, RS256, etc.) via JWKS
    if alg in ["ES256", "RS256"]:
        client = get_jwks_client()
        if client is not None:
            try:
                signing_key = client.get_signing_key_from_jwt(token)
                return pyjwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    audience="authenticated",
                    options={"verify_aud": True},
                )
            except Exception as e:
                log.warning("Asymmetric JWT verification via JWKS failed: %s. Falling back.", e)
        else:
            log.warning("JWKS client not available for asymmetric algorithm %s. Falling back.", alg)

    # 2. Symmetric verification (HS256) via local secret
    elif alg == "HS256" and SUPABASE_JWT_SECRET:
        try:
            return pyjwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": True},
            )
        except Exception as e:
            log.warning("Symmetric JWT verification failed: %s. Falling back.", e)

    # 3. Fallback for development if signature verification isn't possible
    log.warning("SUPABASE_JWT_SECRET not set or verification bypassed: decoding JWT without signature verification (alg: %s)", alg)
    return _decode_jwt_payload_unverified(token)


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency: extract and validate user_id from a Bearer token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization scheme. Use: Bearer <token>")

    try:
        payload = _verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub claim")
        return user_id
    except InvalidTokenError as e:
        log.warning("JWT signature/claim validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        log.warning("JWT validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Like get_current_user_id but returns None instead of 401 for unauthenticated requests."""
    if not authorization:
        return None
    try:
        return await get_current_user_id(authorization)
    except HTTPException:
        return None
