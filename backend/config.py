import contextvars
import json
import logging
import os
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("ala")

REQUEST_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


def _require(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


def _optional(name: str, default: str = "") -> str:
    return os.getenv(name, default)


# --- Gemini AI ---
GOOGLE_API_KEY = _optional("GOOGLE_API_KEY") or _optional("GEMINI_API_KEY")

# --- LLM ---
LLM_PROVIDER = _optional("LLM_PROVIDER", "gemini")
GEMINI_MODEL = _optional("GEMINI_MODEL", "gemini-2.5-flash")

# --- SerpAPI ---
SERPAPI_API_KEY = _optional("SERPAPI_API_KEY") or _optional("SERP_API_KEY")

# --- Supabase ---
SUPABASE_URL = _require("VITE_SUPABASE_URL")
SUPABASE_ANON_KEY = _require("VITE_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _optional("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = _optional("SUPABASE_JWT_SECRET")

# --- CORS ---
CORS_ORIGINS = [
    o.strip()
    for o in _optional("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

# --- Rate Limiting ---
RATE_LIMIT_AI = _optional("RATE_LIMIT_AI", "10/minute")
RATE_LIMIT_DATA = _optional("RATE_LIMIT_DATA", "60/minute")

# --- Environment flag ---
ENV = _optional("ENV", "development").lower()


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        extra: dict = {}
        for key, val in record.__dict__.items():
            if key in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ):
                continue
            extra[key] = val

        request_id = REQUEST_ID_CTX.get("")
        entry: dict = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if request_id:
            entry["request_id"] = request_id
        if extra:
            entry["extra"] = extra
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def validate_config() -> None:
    if not SUPABASE_SERVICE_ROLE_KEY:
        log.warning(
            "SUPABASE_SERVICE_ROLE_KEY not set; server-side writes will use the anon "
            "key and be blocked by RLS. Set it from Supabase > Settings > API."
        )
    if not SUPABASE_JWT_SECRET:
        log.warning(
            "SUPABASE_JWT_SECRET not set; JWTs are decoded WITHOUT signature "
            "verification. Set it before deploying to production."
        )
    if not GOOGLE_API_KEY:
        msg = "GOOGLE_API_KEY / GEMINI_API_KEY not set; AI content generation is disabled."
        if ENV == "production":
            raise RuntimeError(msg)
        log.warning(msg)
    if not SERPAPI_API_KEY:
        log.warning("SERPAPI_API_KEY not set; resource search will return no results.")
    if ENV == "production" and any(o.startswith("http://localhost") for o in CORS_ORIGINS):
        log.warning("CORS_ORIGINS still allows localhost in production; set CORS_ORIGINS to your domain.")


def setup_logging() -> None:
    log_format = _optional("LOG_FORMAT", "json").strip().lower()
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    if not root.handlers:
        handler = logging.StreamHandler()
        if log_format == "text":
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S",
                )
            )
        else:
            handler.setFormatter(_JsonFormatter())
        root.addHandler(handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
