from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, log

_admin_client: Client | None = None
_anon_client: Client | None = None


def get_admin_client() -> Client:
    """Server-side client with service role key (bypasses RLS)."""
    global _admin_client
    if _admin_client is None:
        key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
        if key == SUPABASE_ANON_KEY:
            log.warning("SUPABASE_SERVICE_ROLE_KEY not set; using anon key for server-side operations")
        _admin_client = create_client(SUPABASE_URL, key)
    return _admin_client


def get_anon_client() -> Client:
    """Client-like access using the anon key (respects RLS)."""
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _anon_client


def health_check() -> dict:
    """Quick connectivity check against Supabase."""
    try:
        client = get_admin_client()
        client.table("profiles").select("id").limit(1).execute()
        return {"supabase": "ok"}
    except Exception as e:
        return {"supabase": f"error: {e}"}
