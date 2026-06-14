from pathlib import Path
import re
import hashlib
import json
import logging
import random
import string
import threading
import uuid
from datetime import datetime, timezone, date as date_type, timedelta
from math import exp
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import subprocess
import sys
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import Any

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from urllib.parse import urlparse
from graph.builder import build_concept_graph, graph_to_legacy_format
from config import (
    GOOGLE_API_KEY, SERPAPI_API_KEY, CORS_ORIGINS, RATE_LIMIT_AI, RATE_LIMIT_DATA,
    REQUEST_ID_CTX, setup_logging, validate_config,
)
from auth import get_current_user_id, get_optional_user_id
from db import get_admin_client, health_check as db_health_check
from bkt import (
    update_on_quiz_submit as bkt_update_on_quiz,
    get_review_queue, load_bkt_state, get_daily_goal_progress,
    get_difficulty_level, compute_streak as bkt_compute_streak,
    apply_mastery_decay,
)
from llm.provider import get_provider as get_llm_provider, get_telemetry as get_llm_telemetry


def _quiz_module():
    """Import quiz generator with support for different working directories."""
    try:
        import quizz  # type: ignore

        return quizz
    except ModuleNotFoundError:
        from backend import quizz  # type: ignore

        return quizz


class AskRequest(BaseModel):
    prompt: str

class AskResponse(BaseModel):
    response: str


class DetectTopicRequest(BaseModel):
    text: str
    title: str | None = None


class DetectTopicResponse(BaseModel):
    topic: str
    confidence: float | None = None
    subtopics: list[str] = []
    raw: str | None = None

load_dotenv()
setup_logging()
log = logging.getLogger("ala")
validate_config()

api_key = GOOGLE_API_KEY

_gemini_ready = bool(api_key)
if _gemini_ready:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
else:
    model = None

limiter = Limiter(key_func=get_remote_address)

def ask_gemini(prompt: str) -> str:
    if model is None:
        raise RuntimeError(
            "Gemini API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY in your environment or .env file."
        )

    response = model.generate_content(prompt)
    return response.text


app = FastAPI(
    title="Adaptive Learning Agent API",
    description="AI-powered adaptive learning system with real-time content detection and personalized learning paths",
    version="1.0.0",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "rate_limit", "message": "Too many requests. Please slow down."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal", "message": "An unexpected error occurred."},
    )

# Include timetable router (works from both repo root and backend/ cwd)
try:
    from timetable.routes import router as timetable_router
except ModuleNotFoundError:
    from backend.timetable.routes import router as timetable_router

app.include_router(timetable_router)


def _backend_dir() -> Path:
    return Path(__file__).resolve().parent


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "topic"


class DetectorSnippet(BaseModel):
    source: str = "screen"
    where: str = "Active window"
    text: str
    strength: str = "medium"


class DetectedTopic(BaseModel):
    id: str
    title: str
    level: str = "intermediate"
    confidence: float | None = None
    tags: list[str] = []
    detectedAt: str | None = None
    snippets: list[DetectorSnippet] = []
    detectedConcepts: list[dict[str, Any]] = []
    subtopics: list[str] = []
    summary: str | None = None


class ResourceItem(BaseModel):
    title: str
    url: str
    type: str  # docs | article | video
    source: str | None = None  # domain or channel
    snippet: str | None = None
    score: int


class ResourcesResponse(BaseModel):
    query: str
    topicId: str | None = None
    subtopicId: str | None = None
    resources: list[ResourceItem]


class QuizSubmitRequest(BaseModel):
    subtopicId: str
    answers: list[int]
    clientTime: str | None = None


class ExplainerSection(BaseModel):
    title: str
    bullets: list[str] = []


class ExplainerResponse(BaseModel):
    topicId: str
    subtopicId: str
    overview: str
    prerequisites: list[str] = []
    keyIdeas: list[str] = []
    pitfalls: list[str] = []
    sections: list[ExplainerSection] = []
    generatedAt: str | None = None


_quiz_file_lock = threading.Lock()

_explainer_lock = threading.Lock()


def _explainer_cache_path() -> Path:
    return _backend_dir() / "explainer_cache.json"


def _load_explainer_cache() -> dict[str, Any]:
    path = _explainer_cache_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_explainer_cache(cache: dict[str, Any]) -> None:
    path = _explainer_cache_path()
    try:
        path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not isinstance(text, str) or not text.strip():
        return None
    s = text.strip()
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    # Try to pull the first {...} block.
    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        chunk = s[start : end + 1]
        try:
            obj = json.loads(chunk)
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _clean_str_list(x: Any, max_items: int = 10) -> list[str]:
    if not isinstance(x, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in x:
        if not isinstance(item, str):
            continue
        s = re.sub(r"\s+", " ", item).strip(" \t\r\n-•*")
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= max_items:
            break
    return out


def _build_explainer(topic_title: str, subtopic_title: str) -> dict[str, Any]:
    prompt = (
        "You are a helpful tutor in an adaptive learning app.\n"
        "Generate a concise explainer for the given subtopic.\n"
        "Return STRICT JSON only (no markdown, no prose outside JSON).\n\n"
        "JSON schema:\n"
        "{\n"
        '  "overview": "string (2-4 sentences)",\n'
        '  "prerequisites": ["..."],\n'
        '  "keyIdeas": ["..."],\n'
        '  "pitfalls": ["..."],\n'
        '  "sections": [\n'
        '    {"title": "string", "bullets": ["..."]}\n'
        "  ]\n"
        "}\n\n"
        "Guidelines:\n"
        "- prerequisites: 4-8 bullets\n"
        "- keyIdeas: 4-8 bullets\n"
        "- pitfalls: 4-8 bullets\n"
        "- sections: exactly 3 items titled Prerequisites, Key Ideas, Pitfalls with matching bullets\n\n"
        f"Topic: {topic_title}\n"
        f"Subtopic: {subtopic_title}\n"
    )

    raw = ask_gemini(prompt)
    obj = _extract_json_object(raw)
    if not obj:
        # Fallback: treat entire response as overview
        return {
            "overview": (raw or "").strip() or "(No explainer returned)",
            "prerequisites": [],
            "keyIdeas": [],
            "pitfalls": [],
            "sections": [],
        }

    prerequisites = _clean_str_list(obj.get("prerequisites"), 12)
    key_ideas = _clean_str_list(obj.get("keyIdeas"), 12)
    pitfalls = _clean_str_list(obj.get("pitfalls"), 12)
    overview = obj.get("overview")
    if not isinstance(overview, str) or not overview.strip():
        overview = f"An explainer for {subtopic_title}."
    overview = re.sub(r"\s+", " ", overview).strip()

    # Normalize sections
    sections_in = obj.get("sections")
    sections: list[dict[str, Any]] = []
    if isinstance(sections_in, list):
        for s in sections_in:
            if not isinstance(s, dict):
                continue
            title = s.get("title")
            if not isinstance(title, str) or not title.strip():
                continue
            bullets = _clean_str_list(s.get("bullets"), 12)
            sections.append({"title": title.strip(), "bullets": bullets})
            if len(sections) >= 6:
                break

    # Ensure the three requested sections exist.
    if not sections:
        sections = [
            {"title": "Prerequisites", "bullets": prerequisites},
            {"title": "Key Ideas", "bullets": key_ideas},
            {"title": "Pitfalls", "bullets": pitfalls},
        ]

    return {
        "overview": overview,
        "prerequisites": prerequisites,
        "keyIdeas": key_ideas,
        "pitfalls": pitfalls,
        "sections": sections,
    }

_bkt_state_lock = threading.Lock()


def _bkt_update_on_quiz_submit(
    *, user_id: str | None, topic_id: str, subtopic_id: str,
    score_pct: int, correct_count: int, total: int, submitted_at: str,
) -> float:
    """Update mastery using full 4-parameter BKT with decay and spaced repetition."""
    result = bkt_update_on_quiz(
        topic_id=topic_id, subtopic_id=subtopic_id,
        score_pct=score_pct, correct_count=correct_count,
        total=total, submitted_at=submitted_at,
    )
    mastery = result["mastery"]

    if user_id:
        try:
            db = get_admin_client()
            db.table("mastery").upsert({
                "user_id": user_id,
                "topic_id": topic_id,
                "subtopic_id": subtopic_id,
                "mastery": mastery,
                "attempts": result["attempts"],
                "last_score_pct": int(score_pct),
                "last_correct_count": int(correct_count),
                "last_total": int(total),
                "updated_at": submitted_at,
            }).execute()

            db.table("quiz_attempts").insert({
                "user_id": user_id,
                "topic_id": topic_id,
                "subtopic_id": subtopic_id,
                "score_pct": int(score_pct),
                "correct_count": int(correct_count),
                "total": int(total),
                "mastery_after": mastery,
                "submitted_at": submitted_at,
            }).execute()

            # Update spaced repetition schedule
            try:
                from bkt import compute_stability, next_review_date, SR_INTERVALS
                avg_score = float(score_pct) / 100.0
                stability = compute_stability(result["attempts"], avg_score)
                sr_idx = result.get("sr_interval_index", 0)
                last_seen = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                review_dt = next_review_date(last_seen, stability, sr_idx)

                db.table("review_schedule").upsert({
                    "user_id": user_id,
                    "topic_id": topic_id,
                    "subtopic_id": subtopic_id,
                    "next_review_at": review_dt.isoformat(),
                    "stability": stability,
                    "interval_index": sr_idx,
                    "last_reviewed_at": submitted_at,
                }).execute()
            except Exception as e:
                log.warning("Review schedule update failed: %s", e)

            # Track study session
            try:
                db.table("study_sessions").insert({
                    "user_id": user_id,
                    "topic_id": topic_id,
                    "subtopic_id": subtopic_id,
                    "activity": "quiz",
                    "duration_seconds": 0,
                    "started_at": submitted_at,
                }).execute()
            except Exception:
                pass
        except Exception as e:
            log.warning("Supabase mastery sync failed: %s", e)

    return mastery


def _quiz_cache_path_candidates(topic_id: str, topic_title: str, subtopic_id: str) -> list[Path]:
    root = _backend_dir() / "quiz_cache"
    candidates: list[Path] = []
    candidates.append(root / topic_id / f"{subtopic_id}.json")
    candidates.append(root / _slugify(topic_title) / f"{subtopic_id}.json")
    # De-dupe while preserving order
    out: list[Path] = []
    seen: set[str] = set()
    for p in candidates:
        s = str(p)
        if s in seen:
            continue
        seen.add(s)
        out.append(p)
    return out


def _load_quiz_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Invalid quiz JSON")
    return data


def _domain_from_url(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


_TRUSTED_DOMAINS: dict[str, int] = {
    # Official / reference (general)
    "wikipedia.org": 55,
    "britannica.com": 55,
    "openstax.org": 65,
    "khanacademy.org": 65,
    "mit.edu": 55,
    "ocw.mit.edu": 75,
    "coursera.org": 40,
    "edx.org": 40,

    # Science / biology (examples)
    "ncbi.nlm.nih.gov": 80,
    "nih.gov": 70,
    "genome.gov": 70,
    "nature.com": 55,
    "science.org": 55,

    # Programming (keep)
    "python.org": 120,
    "docs.python.org": 140,
    "developer.mozilla.org": 70,
    "freecodecamp.org": 90,
    "realpython.com": 80,
    "w3schools.com": 35,
}


_TRUSTED_VIDEO_CHANNELS: dict[str, int] = {
    "freecodecamp.org": 90,
    "programming with mosh": 75,
    "corey schafer": 80,
    "tech with tim": 70,
    "cs50": 70,
    "khan academy": 80,
    "crashcourse": 70,
    "mit opencourseware": 75,
    "ted-ed": 60,
}


_DOMAIN_BLOCKLIST: set[str] = {
    "reddit.com",
    "quora.com",
    "pinterest.com",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
}


def _domain_base_score(domain: str) -> int:
    if not domain:
        return 0
    for bad in _DOMAIN_BLOCKLIST:
        if domain == bad or domain.endswith("." + bad):
            return -999
    base = 0
    for trusted, pts in _TRUSTED_DOMAINS.items():
        if domain == trusted or domain.endswith("." + trusted):
            base = max(base, pts)
    # Generic trust for academic/government sites
    if base <= 0 and (domain.endswith(".edu") or domain.endswith(".gov")):
        base = 55
    return base


def _score_resource(title: str, snippet: str, url: str, base: int = 0) -> int:
    text = f"{title} {snippet}".lower()
    score = int(base)

    # Positive keywords
    for kw, pts in (
        ("official", 30),
        ("documentation", 25),
        ("docs", 10),
        ("reference", 15),
        ("tutorial", 20),
        ("beginner", 20),
        ("for beginners", 25),
        ("crash course", 15),
        ("guide", 15),
        ("getting started", 20),
        ("examples", 10),
        ("best practices", 10),
    ):
        if kw in text:
            score += pts

    # URL signals
    url_l = (url or "").lower()
    if "/docs" in url_l or "docs." in url_l:
        score += 10
    if url_l.endswith(".pdf"):
        score -= 30

    # Lightweight penalties for low-signal pages
    if "login" in url_l or "signup" in url_l:
        score -= 20
    if "reddit.com" in url_l:
        score -= 30

    return score


def _extract_serp_resources(results: dict[str, Any], query: str, limit: int) -> list[ResourceItem]:
    items: list[ResourceItem] = []
    seen_urls: set[str] = set()

    organic = results.get("organic_results")
    if isinstance(organic, list):
        for r in organic:
            if not isinstance(r, dict):
                continue
            title = str(r.get("title") or "").strip()
            url = str(r.get("link") or "").strip()
            if not title or not url:
                continue
            if url in seen_urls:
                continue

            domain = _domain_from_url(url)
            base = _domain_base_score(domain)
            if base < 0:
                continue

            snippet = str(r.get("snippet") or "").strip() or None
            score = _score_resource(title, snippet or "", url, base=base)

            # If not trusted/edu/gov, only keep if it still scores well.
            if base == 0 and score < 70:
                continue

            res_type = "docs" if ("docs" in domain or domain.endswith("python.org")) else "article"

            items.append(
                ResourceItem(
                    title=title,
                    url=url,
                    type=res_type,
                    source=domain,
                    snippet=snippet,
                    score=score,
                )
            )
            seen_urls.add(url)

    inline_videos = results.get("inline_videos")
    # SerpAPI can return inline_videos as {"videos": [...]} or directly a list.
    videos_list: list[Any] = []
    if isinstance(inline_videos, dict) and isinstance(inline_videos.get("videos"), list):
        videos_list = inline_videos.get("videos")
    elif isinstance(inline_videos, list):
        videos_list = inline_videos

    for v in videos_list:
        if not isinstance(v, dict):
            continue
        title = str(v.get("title") or "").strip()
        url = str(v.get("link") or v.get("url") or "").strip()
        channel = str(v.get("channel") or v.get("author") or "").strip()
        if not title or not url:
            continue
        if url in seen_urls:
            continue

        channel_key = channel.lower()
        base = 0
        for trusted_name, pts in _TRUSTED_VIDEO_CHANNELS.items():
            if trusted_name in channel_key:
                base = max(base, pts)
        # Accept youtube videos if channel is trusted; otherwise ignore.
        if base <= 0:
            continue

        snippet = str(v.get("snippet") or v.get("description") or "").strip() or None
        score = _score_resource(title, snippet or "", url, base=base)

        items.append(
            ResourceItem(
                title=title,
                url=url,
                type="video",
                source=channel or "YouTube",
                snippet=snippet,
                score=score,
            )
        )
        seen_urls.add(url)

    # Sort and trim
    items.sort(key=lambda x: x.score, reverse=True)
    hard_cap = 60
    n = int(limit) if isinstance(limit, int) or (isinstance(limit, str) and str(limit).isdigit()) else 0
    if n <= 0:
        n = hard_cap
    n = max(1, min(n, hard_cap))
    return items[:n]


def _serp_search(query: str, location: str | None = None) -> dict[str, Any]:
    serp_key = os.getenv("SERPAPI_API_KEY") or os.getenv("SERP_API_KEY")
    if not serp_key:
        raise RuntimeError("SerpAPI key not found. Set SERPAPI_API_KEY (or SERP_API_KEY).")

    try:
        from serpapi import GoogleSearch
    except Exception as e:
        raise RuntimeError(
            "SerpAPI client not installed. Install backend requirements (google-search-results)."
        ) from e

    params = {
        "engine": "google",
        "google_domain": "google.com",
        "hl": "en",
        "gl": "us",
        "q": query,
        "api_key": serp_key,
    }
    if location:
        params["location"] = location

    search = GoogleSearch(params)
    return search.get_dict()


def _read_output_entries() -> list[dict[str, Any]]:
    path = _backend_dir() / "output.json"
    if not path.exists():
        return []
    try:
        import json

        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        return []
    except Exception:
        return []


_summary_lock = threading.Lock()
_summary_cache: dict[str, dict[str, str]] | None = None


def _summary_cache_path() -> Path:
    return _backend_dir() / "summary_cache.json"


def _load_summary_cache() -> dict[str, dict[str, str]]:
    global _summary_cache
    with _summary_lock:
        if _summary_cache is not None:
            return _summary_cache

        path = _summary_cache_path()
        if not path.exists():
            _summary_cache = {}
            return _summary_cache

        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                # { topic_id: { "hash": "...", "summary": "..." } }
                _summary_cache = {
                    k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, dict)
                }
            else:
                _summary_cache = {}
        except Exception:
            _summary_cache = {}

        return _summary_cache


def _save_summary_cache(cache: dict[str, dict[str, str]]) -> None:
    path = _summary_cache_path()
    try:
        with path.open("w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception:
        # Cache is best-effort; ignore write failures.
        pass


def _entries_for_topic(entries: list[dict[str, Any]], topic_id: str) -> list[dict[str, Any]]:
    out = []
    for e in entries:
        ocr_text = (e.get("ocr_text") or "").strip()
        if not ocr_text:
            continue

        server_resp = e.get("server_response")
        if not isinstance(server_resp, dict):
            server_resp = e.get("server")
        topic = ""
        if isinstance(server_resp, dict):
            topic = (server_resp.get("topic") or "").strip() or (server_resp.get("response") or "").strip()
        if not topic:
            topic = (e.get("title") or "").strip() or "Detected topic"

        if _slugify(topic) == topic_id:
            out.append(e)
    return out


def _build_summary_input(entries: list[dict[str, Any]]) -> str:
    # Build a compact prompt input: include window title + OCR text snippets.
    chunks: list[str] = []
    for e in entries[-12:]:
        title = (e.get("title") or "").strip() or "Active window"
        text = (e.get("ocr_text") or "").strip()
        if not text:
            continue
        text = re.sub(r"\s+", " ", text)
        if len(text) > 900:
            text = text[:900].rstrip() + "…"
        chunks.append(f"[{title}] {text}")

    combined = "\n".join(chunks).strip()
    # Hard cap to keep requests cheap.
    if len(combined) > 6000:
        combined = combined[-6000:]
    return combined


def _summarize_captured_content(topic_title: str, captured: str) -> str:
    if not captured.strip():
        return "No captured content yet."

    prompt = (
        "You are an assistant inside an adaptive learning app.\n"
        "Summarize the captured on-screen content for the learner.\n"
        "- Output a concise summary in 4-8 bullet points\n"
        "- Focus on the educational/technical concepts\n"
        "- Ignore navigation/UI noise and repeated text\n"
        "- Do not include any sensitive/personal data\n\n"
        f"Detected topic: {topic_title}\n\n"
        "Captured content:\n"
        f"{captured}\n"
    )

    try:
        return ask_gemini(prompt).strip() or "(Empty summary)"
    except Exception:
        # Fallback: lightweight local summary (first lines)
        return captured[:500].rstrip() + ("…" if len(captured) > 500 else "")


def get_topic_summary(topic_id: str, topic_title: str, entries: list[dict[str, Any]]) -> str | None:
    topic_entries = _entries_for_topic(entries, topic_id)
    captured = _build_summary_input(topic_entries)
    if not captured:
        return None

    content_hash = hashlib.sha256(captured.encode("utf-8", errors="ignore")).hexdigest()
    cache = _load_summary_cache()

    with _summary_lock:
        existing = cache.get(topic_id)
        if isinstance(existing, dict) and existing.get("hash") == content_hash:
            summary = existing.get("summary")
            if isinstance(summary, str) and summary.strip():
                return summary

    summary = _summarize_captured_content(topic_title, captured)

    with _summary_lock:
        cache[topic_id] = {"hash": content_hash, "summary": summary}
        _save_summary_cache(cache)

    return summary


def _build_topics_from_entries(entries: list[dict[str, Any]]) -> list[DetectedTopic]:
    # Expected capture entry shape (from ocr.py):
    # {"title": <window title>, "ocr_text": <text>, "server": {"topic": ..., "subtopics": [...] } }
    # Back-compat: some runs used "server_response" instead of "server".
    # There may also be summary entries: {"window_title": ..., "time_spent_sec": ...}
    by_topic: dict[str, DetectedTopic] = {}
    subtopic_keys: dict[str, set[str]] = {}

    def _clean_subtopics(items: Any) -> list[str]:
        if not isinstance(items, list):
            return []
        out: list[str] = []
        seen: set[str] = set()
        for x in items:
            if not isinstance(x, str):
                continue
            s = re.sub(r"\s+", " ", x).strip(" \t\r\n-•*\"")
            if not s:
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
            if len(out) >= 16:
                break
        return out

    for e in entries:
        ocr_text = (e.get("ocr_text") or "").strip()
        if not ocr_text:
            continue

        server_resp = e.get("server_response")
        if not isinstance(server_resp, dict):
            server_resp = e.get("server")
        topic = ""
        if isinstance(server_resp, dict):
            topic = (server_resp.get("topic") or "").strip() or (server_resp.get("response") or "").strip()

        if not topic:
            # If OCR is running but topic extraction isn't wired, fall back to window title.
            topic = (e.get("title") or "").strip() or "Detected topic"

        topic_id = _slugify(topic)
        window_title = (e.get("title") or "").strip() or "Active window"

        if topic_id not in by_topic:
            by_topic[topic_id] = DetectedTopic(
                id=topic_id,
                title=topic,
                level="intermediate",
                confidence=None,
                tags=[],
                detectedAt=None,
                snippets=[],
                detectedConcepts=[],
                subtopics=[],
            )
            subtopic_keys[topic_id] = set()

        # Merge subtopics captured in output.json (dedupe, keep stable order).
        if isinstance(server_resp, dict):
            seen = subtopic_keys.setdefault(topic_id, set())
            for st in _clean_subtopics(server_resp.get("subtopics")):
                key = st.lower()
                if key in seen:
                    continue
                seen.add(key)
                by_topic[topic_id].subtopics.append(st)

        snippet_text = ocr_text
        if len(snippet_text) > 220:
            snippet_text = snippet_text[:220].rstrip() + "…"

        by_topic[topic_id].snippets.append(
            DetectorSnippet(source="screen", where=window_title, text=snippet_text, strength="medium")
        )

    # Enrich topics with real confidence, level, and summary derived from data
    try:
        bkt_state = load_bkt_state()
    except Exception:
        bkt_state = {}

    for topic_id, topic_obj in by_topic.items():
        # Confidence: derived from number of captured snippets (more evidence = higher confidence)
        snippet_count = len(topic_obj.snippets)
        topic_obj.confidence = min(1.0, snippet_count * 0.20)

        # Level: derived from BKT mastery if quizzes have been taken
        topic_bkt = bkt_state.get(topic_id, {})
        subs_bkt = topic_bkt.get("subtopics", {}) if isinstance(topic_bkt, dict) else {}
        if subs_bkt:
            masteries = [
                float(v.get("mastery", 0.0))
                for v in subs_bkt.values()
                if isinstance(v, dict)
            ]
            avg_mastery = sum(masteries) / len(masteries) if masteries else 0.0
            if avg_mastery >= 0.75:
                topic_obj.level = "advanced"
            elif avg_mastery >= 0.40:
                topic_obj.level = "intermediate"
            else:
                topic_obj.level = "beginner"
        # else keep default "intermediate"

        # Summary: aggregate unique text from the first few snippets
        if not topic_obj.summary and topic_obj.snippets:
            seen_texts: set[str] = set()
            parts: list[str] = []
            for s in topic_obj.snippets[:5]:
                key = s.text[:60].lower().strip()
                if key and key not in seen_texts:
                    seen_texts.add(key)
                    clean = s.text.strip().rstrip("…").strip()
                    if clean:
                        parts.append(clean)
            if parts:
                topic_obj.summary = " • ".join(parts[:3])

    # Return in stable order (most recent last in file tends to be newest; reverse for UI)
    topics = list(by_topic.values())
    topics.sort(key=lambda t: t.title)
    return topics


# OCR PROCESS MANAGEMENT

_ocr_process = None
_ocr_lock = threading.Lock()


def _stop_flag_path() -> Path:
    return _backend_dir() / "stop.flag"


def _ocr_log_path() -> Path:
    return _backend_dir() / "ocr.log"


def _ocr_script_path() -> Path:
    return Path(__file__).with_name("ocr.py")


def is_ocr_running() -> bool:
    global _ocr_process
    with _ocr_lock:
        return _ocr_process is not None and _ocr_process.poll() is None
    

def start_ocr() -> bool:
    global _ocr_process
    with _ocr_lock:
        if _ocr_process is not None and _ocr_process.poll() is None:
            return False

        stop_file = _stop_flag_path()
        if stop_file.exists():
            stop_file.unlink()

        script_path = _ocr_script_path()
        if not script_path.exists():
            raise RuntimeError(f"OCR script not found at {script_path}")

        backend_dir = script_path.parent

        log_path = _ocr_log_path()
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_file = open(log_path, "a", encoding="utf-8")
        
        _ocr_process = subprocess.Popen(
            [sys.executable, str(script_path)],
            cwd=str(backend_dir),
            stdout=log_file,
            stderr=log_file,
            stdin=subprocess.DEVNULL,
        )
        return True 
    
def stop_ocr() -> bool:
    global _ocr_process
    with _ocr_lock:
        if _ocr_process is None:
            return False

        _stop_flag_path().touch()

        try:
            _ocr_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _ocr_process.kill()

        _ocr_process = None
        return True


# MIDDLEWARE

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = REQUEST_ID_CTX.set(request_id)
    try:
        response = await call_next(request)
    finally:
        REQUEST_ID_CTX.reset(token)
    response.headers["X-Request-ID"] = request_id
    return response

# EXISTING DETECTION ENDPOINTS

@app.get("/")
def read_root():
    return {"message": "Adaptive Learning Agent API is running."}


@app.post("/ask", response_model=AskResponse)
@limiter.limit(RATE_LIMIT_AI)
def ask_ai(request: Request, data: AskRequest):
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        answer = ask_gemini(data.prompt)
        return {"response": answer}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/topic", response_model=DetectTopicResponse)
@limiter.limit(RATE_LIMIT_AI)
def detect_topic(request: Request, data: DetectTopicRequest):
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    title = (data.title or "").strip()

    prompt = (
        "You are helping an adaptive learning app label OCR text.\n"
        "Extract (1) the single most likely learning topic, and (2) a short list of subtopics.\n\n"
        "Return ONLY valid JSON (no markdown, no code fences) with this shape:\n"
        '{"topic": "<short noun phrase, max 8 words>", "subtopics": ["<short phrase>", "..."]}\n\n'
        "Rules:\n"
        "- subtopics: 0-8 items, each max 6 words\n"
        "- Prefer concrete concepts (e.g., 'DNA replication', 'INNER JOIN')\n"
        "- Do not include UI/browser/app names\n\n"
        f"Window title: {title}\n\n"
        f"OCR text:\n{text}"
    )

    def fallback_topic() -> str:
        if title:
            return title
        words = [w for w in re.split(r"\s+", text) if w]
        return " ".join(words[:8]) or "Detected topic"

    def _clean_subtopics(items: Any) -> list[str]:
        if not isinstance(items, list):
            return []
        out: list[str] = []
        seen: set[str] = set()
        for x in items:
            if not isinstance(x, str):
                continue
            s = re.sub(r"\s+", " ", x).strip(" \t\r\n-•*\"")
            if not s:
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
            if len(out) >= 8:
                break
        return out

    def _parse_gemini_json(raw_text: str) -> tuple[str | None, list[str] | None]:
        candidate = (raw_text or "").strip()
        if not candidate:
            return None, None

        # Gemini sometimes wraps JSON in markdown fences; try to extract the first JSON object.
        if candidate.startswith("```"):
            candidate = re.sub(r"^```[a-zA-Z]*\n", "", candidate)
            candidate = re.sub(r"\n```$", "", candidate).strip()

        m = re.search(r"\{[\s\S]*\}", candidate)
        if m:
            candidate = m.group(0).strip()

        try:
            obj = json.loads(candidate)
        except Exception:
            return None, None

        if not isinstance(obj, dict):
            return None, None

        topic_val = obj.get("topic")
        topic_str = topic_val.strip() if isinstance(topic_val, str) else None
        subtopics = _clean_subtopics(obj.get("subtopics"))
        return topic_str, subtopics

    try:
        raw = ask_gemini(prompt)
        topic, subtopics = _parse_gemini_json(raw)
        if not topic:
            topic = fallback_topic()
        if subtopics is None:
            subtopics = []
        return {"topic": topic, "subtopics": subtopics, "confidence": None, "raw": None}
    except RuntimeError as e:
        # Missing key / AI disabled
        return {"topic": fallback_topic(), "subtopics": [], "confidence": None, "raw": str(e)}
    except Exception as e:
        # Quota / transient errors shouldn't kill detection.
        return {"topic": fallback_topic(), "subtopics": [], "confidence": None, "raw": str(e)}

@app.get("/ocr/status")
def ocr_status():
    global _ocr_process
    exit_code = None
    pid = None
    
    with _ocr_lock:
        if _ocr_process is not None:
            exit_code = _ocr_process.poll()
            pid = _ocr_process.pid
    
    return {
        "running": is_ocr_running(),
        "exit_code": exit_code,
        "pid": pid,
        "log": str(_ocr_log_path())
    }


@app.get("/ocr/log")
def ocr_log(lines: int = 200):
    path = _ocr_log_path()
    if not path.exists():
        return {"lines": []}

    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            content = f.read().splitlines()
        tail = content[-max(1, min(lines, 2000)) :]
        return {"lines": tail}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ocr/start")
def ocr_start():
    try:
        log.info("Starting OCR process...")
        started = start_ocr()
        return {"started": started, "running": is_ocr_running()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr/stop")
def ocr_stop():
    stopped = stop_ocr()
    return {"stopped": stopped, "running": is_ocr_running()}


# FRONTEND-FRIENDLY DETECTOR ENDPOINTS (aliases)

@app.get("/detector/status")
def detector_status():
    return ocr_status()


@app.post("/detector/start")
def detector_start():
    return ocr_start()


@app.post("/detector/stop")
def detector_stop():
    return ocr_stop()


def _sync_topics_to_supabase(user_id: str | None, topics: list[DetectedTopic]) -> None:
    """Best-effort sync of topic metadata to Supabase (no raw OCR text)."""
    if not user_id or not topics:
        return
    try:
        db = get_admin_client()
        rows = [
            {
                "id": t.id,
                "user_id": user_id,
                "title": t.title,
                "level": t.level,
                "confidence": t.confidence or 0.0,
                "tags": t.tags or [],
                "subtopics": t.subtopics or [],
                "summary": t.summary,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            for t in topics
        ]
        db.table("topics").upsert(rows, on_conflict="id,user_id").execute()
    except Exception as e:
        log.warning("Topic sync to Supabase failed: %s", e)


@app.get("/detector/topics", response_model=list[DetectedTopic])
def detector_topics(user_id: str | None = Depends(get_optional_user_id)):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    _sync_topics_to_supabase(user_id, topics)
    return topics


@app.get("/detector/topics/{topic_id}", response_model=DetectedTopic)
def detector_topic(topic_id: str, user_id: str | None = Depends(get_optional_user_id)):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    for t in topics:
        if t.id == topic_id:
            t.summary = get_topic_summary(t.id, t.title, entries)
            _sync_topics_to_supabase(user_id, [t])
            return t
    raise HTTPException(status_code=404, detail="Topic not found")


@app.get("/detector/topics/{topic_id}/resources", response_model=ResourcesResponse)
def detector_topic_resources(
    topic_id: str,
    subtopic_id: str | None = None,
    limit: int = 8,
    location: str | None = None,
):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    topic = next((t for t in topics if t.id == topic_id), None)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    query = topic.title
    chosen_subtopic: str | None = None
    if subtopic_id:
        for st in topic.subtopics or []:
            if _slugify(st) == subtopic_id:
                chosen_subtopic = st
                break
        if chosen_subtopic:
            query = f"{topic.title} {chosen_subtopic}"

    try:
        raw = _serp_search(query=query, location=location)
        resources = _extract_serp_resources(raw, query=query, limit=limit)
        return {
            "query": query,
            "topicId": topic_id,
            "subtopicId": subtopic_id,
            "resources": resources,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/detector/topics/{topic_id}/quiz")
@limiter.limit(RATE_LIMIT_AI)
def detector_topic_quiz(
    request: Request,
    topic_id: str,
    subtopic_id: str | None = None,
    subtopic_title: str | None = None,
    n_questions: int = Query(5, ge=1, le=10),
    force: bool = False,
    difficulty: str = Query("medium", regex="^(easy|medium|hard|expert|auto)$"),
    user_id: str | None = Depends(get_optional_user_id),
):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    topic = next((t for t in topics if t.id == topic_id), None)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    chosen_subtopic: str | None = None
    if subtopic_title:
        chosen_subtopic = str(subtopic_title).strip()
    elif subtopic_id:
        for st in topic.subtopics or []:
            if _slugify(st) == subtopic_id:
                chosen_subtopic = st
                break

    if not chosen_subtopic:
        raise HTTPException(status_code=400, detail="subtopic_id or subtopic_title is required")

    # Auto-detect difficulty from mastery level
    actual_difficulty = difficulty
    if difficulty == "auto":
        sid = _slugify(chosen_subtopic)
        state = load_bkt_state()
        skill = state.get(topic_id, {}).get("subtopics", {}).get(sid, {})
        mastery = float(skill.get("mastery", 0.0))
        attempts = int(skill.get("attempts", 0))
        actual_difficulty = get_difficulty_level(mastery, attempts)

    try:
        quizz = _quiz_module()
        payload = quizz.generate_quiz(
            topic_title=topic.title,
            subtopic_title=chosen_subtopic,
            n_questions=n_questions,
            force=force,
            difficulty=actual_difficulty,
        )

        # Ensure ids match the route/query ids we use on the frontend.
        payload["topicId"] = topic_id
        payload["subtopicId"] = _slugify(chosen_subtopic)

        # Do not leak correct answers to the client.
        qs = payload.get("questions")
        if isinstance(qs, list):
            payload["questions"] = [
                {
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "difficulty": q.get("difficulty", "medium"),
                    "skill": q.get("skill", "conceptual"),
                }
                for q in qs
                if isinstance(q, dict)
            ]

        payload["difficulty"] = actual_difficulty

        # Remove internal fields that may contain correct answers.
        payload.pop("sets", None)
        payload.pop("activeSetId", None)
        return payload
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/detector/topics/{topic_id}/explainer", response_model=ExplainerResponse)
@limiter.limit(RATE_LIMIT_AI)
def detector_topic_explainer(
    request: Request,
    topic_id: str,
    subtopic_id: str | None = None,
    subtopic_title: str | None = None,
    force: bool = False,
):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    topic = next((t for t in topics if t.id == topic_id), None)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    chosen_subtopic: str | None = None
    if subtopic_title:
        chosen_subtopic = str(subtopic_title).strip()
    elif subtopic_id:
        for st in topic.subtopics or []:
            if _slugify(st) == subtopic_id:
                chosen_subtopic = st
                break

    if not chosen_subtopic:
        raise HTTPException(status_code=400, detail="subtopic_id or subtopic_title is required")

    sid = _slugify(chosen_subtopic)
    cache_key = f"{topic_id}:{sid}"

    with _explainer_lock:
        cache = _load_explainer_cache()
        cached = cache.get(cache_key) if isinstance(cache, dict) else None
        if not force and isinstance(cached, dict) and isinstance(cached.get("overview"), str):
            return {
                "topicId": topic_id,
                "subtopicId": sid,
                "overview": cached.get("overview") or "",
                "prerequisites": cached.get("prerequisites") or [],
                "keyIdeas": cached.get("keyIdeas") or [],
                "pitfalls": cached.get("pitfalls") or [],
                "sections": cached.get("sections") or [],
                "generatedAt": cached.get("generatedAt"),
            }

    try:
        built = _build_explainer(topic.title, chosen_subtopic)
        generated_at = datetime.now(timezone.utc).isoformat()
        payload = {
            "topicId": topic_id,
            "subtopicId": sid,
            "overview": built.get("overview") or "",
            "prerequisites": built.get("prerequisites") or [],
            "keyIdeas": built.get("keyIdeas") or [],
            "pitfalls": built.get("pitfalls") or [],
            "sections": built.get("sections") or [],
            "generatedAt": generated_at,
        }

        with _explainer_lock:
            cache = _load_explainer_cache()
            if not isinstance(cache, dict):
                cache = {}
            cache[cache_key] = {
                "overview": payload["overview"],
                "prerequisites": payload["prerequisites"],
                "keyIdeas": payload["keyIdeas"],
                "pitfalls": payload["pitfalls"],
                "sections": payload["sections"],
                "generatedAt": generated_at,
            }
            _save_explainer_cache(cache)

        return payload
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detector/topics/{topic_id}/quiz/submit")
def detector_topic_quiz_submit(
    topic_id: str, body: QuizSubmitRequest,
    user_id: str | None = Depends(get_optional_user_id),
):
    subtopic_id = _slugify(body.subtopicId)
    if not subtopic_id:
        raise HTTPException(status_code=400, detail="subtopicId is required")
    if not isinstance(body.answers, list) or not body.answers:
        raise HTTPException(status_code=400, detail="answers is required")

    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    topic = next((t for t in topics if t.id == topic_id), None)
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    candidates = _quiz_cache_path_candidates(topic_id=topic_id, topic_title=topic.title, subtopic_id=subtopic_id)
    quiz_path = next((p for p in candidates if p.exists()), None)
    if quiz_path is None:
        raise HTTPException(status_code=404, detail="Quiz not found. Load/generate the quiz first.")

    with _quiz_file_lock:
        try:
            quiz = _load_quiz_json(quiz_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read quiz file: {e}")

        # Choose the active set if present; otherwise fall back to top-level questions.
        questions = None
        active_set_id = quiz.get("activeSetId") if isinstance(quiz.get("activeSetId"), str) else None
        sets = quiz.get("sets")
        active_set = None
        if isinstance(sets, list) and active_set_id:
            for s in sets:
                if isinstance(s, dict) and s.get("setId") == active_set_id:
                    active_set = s
                    break
        if isinstance(active_set, dict) and isinstance(active_set.get("questions"), list):
            questions = active_set.get("questions")
        else:
            questions = quiz.get("questions")

        if not isinstance(questions, list):
            raise HTTPException(status_code=500, detail="Quiz file missing questions")

        total = min(len(questions), len(body.answers))
        correct = 0
        graded_flags: list[bool] = []

        for idx in range(total):
            q = questions[idx]
            if not isinstance(q, dict):
                graded_flags.append(False)
                continue

            options = q.get("options")
            correct_answer = q.get("correctAnswer")
            if not isinstance(options, list) or not isinstance(correct_answer, str):
                q["isCorrect"] = False
                graded_flags.append(False)
                continue

            try:
                chosen_index = int(body.answers[idx])
            except Exception:
                chosen_index = -1

            chosen = options[chosen_index] if 0 <= chosen_index < len(options) else None
            is_correct = bool(chosen == correct_answer)
            q["isCorrect"] = is_correct
            graded_flags.append(is_correct)
            if is_correct:
                correct += 1

        submitted_at = datetime.now(timezone.utc).isoformat()
        score_pct = int(round((correct / total) * 100)) if total else 0

        # Persist: store set-level submittedAt and mirror active questions to top-level questions.
        if isinstance(active_set, dict):
            active_set["submittedAt"] = submitted_at
            active_set["clientTime"] = body.clientTime
        quiz["questions"] = questions
        quiz["updatedAt"] = submitted_at
        quiz.pop("lastAttempt", None)
        quiz.pop("attempts", None)

        try:
            quiz_path.write_text(json.dumps(quiz, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write quiz file: {e}")

    mastery = _bkt_update_on_quiz_submit(
        user_id=user_id,
        topic_id=topic_id,
        subtopic_id=subtopic_id,
        score_pct=score_pct,
        correct_count=correct,
        total=total,
        submitted_at=submitted_at,
    )

    # Build per-question explanations for wrong answers
    per_question = []
    for idx in range(total):
        q = questions[idx] if idx < len(questions) else {}
        if not isinstance(q, dict):
            continue
        entry: dict[str, Any] = {
            "correct": graded_flags[idx] if idx < len(graded_flags) else False,
            "correct_index": None,
            "explanation": None,
        }
        opts = q.get("options", [])
        ca = q.get("correctAnswer")
        if isinstance(opts, list) and isinstance(ca, str):
            for oi, opt in enumerate(opts):
                if opt == ca:
                    entry["correct_index"] = oi
                    break
        if not entry["correct"]:
            entry["explanation"] = q.get("explanation") or None
        per_question.append(entry)

    return {
        "ok": True,
        "topicId": topic_id,
        "subtopicId": subtopic_id,
        "quizPath": str(quiz_path),
        "submittedAt": submitted_at,
        "total": total,
        "correctCount": correct,
        "scorePct": score_pct,
        "masteryPct": int(round(mastery * 100)),
        "graded": graded_flags,
        "questions": per_question,
    }


@app.get("/detector/topics/{topic_id}/graph")
def detector_topic_graph(
    topic_id: str,
    max_depth: int = Query(2, ge=0, le=2, description="Maximum depth of subtopic expansion (0-2)"),
    max_children: int = Query(5, ge=1, le=10, description="Maximum children per node"),
    use_gemini: bool = Query(True, description="Use Gemini AI for subtopic expansion when needed"),
):
    """
    Build a concept dependency graph for a detected topic.
    
    The graph shows the topic hierarchy with subtopics expanded up to max_depth levels.
    Uses detected concepts from OCR when available, falls back to Gemini AI expansion.
    
    Returns:
        {
            "nodes": [{"id", "label", "kind", "depth", "parentId"}],
            "edges": [{"from", "to", "relation"}],
            "rootId": str,
            "maxDepth": int
        }
    """
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    
    target_topic = None
    for t in topics:
        if t.id == topic_id:
            target_topic = t
            break
    
    if not target_topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Build the concept graph
    graph = build_concept_graph(
        topic_id=target_topic.id,
        topic_title=target_topic.title,
        detected_concepts=target_topic.detectedConcepts,
        max_depth=max_depth,
        max_children=max_children,
        use_gemini_fallback=use_gemini,
    )
    
    return graph_to_legacy_format(graph)


def _compute_streak(user_id: str | None) -> dict[str, Any]:
    """Compute current and longest streak from quiz_attempts or bkt_state.json."""
    attempt_dates: list[str] = []

    if user_id:
        try:
            db = get_admin_client()
            rows = (
                db.table("quiz_attempts")
                .select("submitted_at")
                .eq("user_id", user_id)
                .execute()
            )
            for r in rows.data or []:
                ts = r.get("submitted_at")
                if isinstance(ts, str):
                    attempt_dates.append(ts)
        except Exception as e:
            log.warning("Supabase quiz_attempts fetch failed: %s", e)

    if not attempt_dates:
        bkt_state = load_bkt_state()
        for tid, tdata in bkt_state.items():
            if not isinstance(tdata, dict):
                continue
            subs = tdata.get("subtopics") if isinstance(tdata, dict) else {}
            if isinstance(subs, dict):
                for sid, skill in subs.items():
                    if isinstance(skill, dict):
                        ts = skill.get("updatedAt") or skill.get("last_seen")
                        if isinstance(ts, str):
                            attempt_dates.append(ts)

    return bkt_compute_streak(attempt_dates)


@app.get("/streaks")
def get_streaks(user_id: str | None = Depends(get_optional_user_id)):
    return _compute_streak(user_id)


@app.get("/analytics")
def get_analytics(user_id: str | None = Depends(get_optional_user_id)):
    """Return lightweight analytics driven by quiz mastery."""
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)

    # Try Supabase mastery first, fall back to local file
    supabase_mastery: dict[str, dict[str, float]] = {}
    bkt_state: dict[str, Any] = {}
    if user_id:
        try:
            db = get_admin_client()
            rows = db.table("mastery").select("topic_id,subtopic_id,mastery").eq("user_id", user_id).execute()
            for r in rows.data or []:
                supabase_mastery.setdefault(r["topic_id"], {})[r["subtopic_id"]] = r["mastery"]
        except Exception as e:
            log.warning("Supabase mastery fetch failed, using local: %s", e)

    if not supabase_mastery:
        bkt_state = load_bkt_state()
        now_utc = datetime.now(timezone.utc)
        for tid, tdata in bkt_state.items():
            subs = tdata.get("subtopics") if isinstance(tdata, dict) else {}
            if isinstance(subs, dict):
                for sid, skill in subs.items():
                    if isinstance(skill, dict):
                        try:
                            raw_m = float(skill.get("mastery") or 0.0)
                            last_seen_str = skill.get("last_seen") or skill.get("updatedAt")
                            days = 0.0
                            if last_seen_str:
                                try:
                                    last_dt = datetime.fromisoformat(
                                        str(last_seen_str).replace("Z", "+00:00")
                                    )
                                    days = max(0.0, (now_utc - last_dt).total_seconds() / 86400.0)
                                except Exception:
                                    pass
                            supabase_mastery.setdefault(tid, {})[sid] = apply_mastery_decay(raw_m, days)
                        except Exception:
                            pass

    by_topic: list[dict[str, Any]] = []
    progress_vals: list[float] = []

    for t in topics:
        sub_mastery = supabase_mastery.get(t.id, {})
        subtopics = t.subtopics or []
        if not subtopics:
            progress = 0.0
        else:
            mastery_list: list[float] = []
            for st in subtopics:
                sid = _slugify(st)
                m = sub_mastery.get(sid, 0.0)
                mastery_list.append(max(0.0, min(1.0, m)))
            progress = sum(mastery_list) / len(mastery_list) if mastery_list else 0.0

        progress_vals.append(progress)
        by_topic.append(
            {
                "id": t.id,
                "title": t.title,
                "progress": progress,
                "score": int(round(progress * 100)),
                "minutes": 0,
            }
        )

    avg_score = int(round((sum(progress_vals) / len(progress_vals)) * 100)) if progress_vals else 0
    topics_learned = sum(1 for p in progress_vals if p >= 0.999)

    streak_info = _compute_streak(user_id)

    # Compute time spent from study_sessions (Supabase) or estimate from BKT attempt count
    time_spent_minutes = 0
    if user_id:
        try:
            db = get_admin_client()
            rows = db.table("study_sessions").select("duration_seconds").eq("user_id", user_id).not_.is_("duration_seconds", "null").execute()
            total_sec = sum(int(r.get("duration_seconds") or 0) for r in rows.data or [])
            time_spent_minutes = total_sec // 60
        except Exception:
            pass
    if time_spent_minutes == 0:
        # Estimate: 5 minutes per quiz attempt recorded in BKT state
        total_attempts = sum(
            int(v.get("attempts") or 0)
            for tdata in bkt_state.values() if isinstance(tdata, dict)
            for v in (tdata.get("subtopics") or {}).values() if isinstance(v, dict)
        )
        time_spent_minutes = total_attempts * 5

    # Enrich by_topic with per-topic time from study_sessions
    if user_id:
        try:
            db = get_admin_client()
            rows = db.table("study_sessions").select("topic_id,duration_seconds").eq("user_id", user_id).not_.is_("duration_seconds", "null").execute()
            topic_time: dict[str, int] = {}
            for r in rows.data or []:
                tid = r.get("topic_id") or ""
                topic_time[tid] = topic_time.get(tid, 0) + int(r.get("duration_seconds") or 0)
            for item in by_topic:
                item["minutes"] = topic_time.get(item["id"], 0) // 60
        except Exception:
            pass

    return {
        "streakDays": streak_info["currentStreak"],
        "timeSpentMinutes": time_spent_minutes,
        "topicsLearned": topics_learned,
        "avgScore": avg_score,
        "byTopic": by_topic,
    }


# ============================= Suggestions Endpoint =============================

_suggestions_lock = threading.Lock()
_suggestions_cache: dict[str, Any] = {}


def _build_suggestions_prompt(topics: list[DetectedTopic]) -> str:
    """Build a prompt for Gemini to generate topic suggestions."""
    if not topics:
        return ""
    
    topics_info = []
    for t in topics[:10]:  # Limit to 10 topics
        subtopics_str = ", ".join(t.subtopics[:5]) if t.subtopics else "none"
        tags_str = ", ".join(t.tags[:5]) if t.tags else "none"
        topics_info.append(
            f"- {t.title} (level: {t.level}, confidence: {t.confidence or 'unknown'}, "
            f"subtopics: [{subtopics_str}], tags: [{tags_str}])"
        )
    
    topics_list = "\n".join(topics_info)
    
    return f"""You are an intelligent learning assistant. Based on the following detected topics that a student is currently learning, suggest 5-8 related topics or concepts they should explore next.

DETECTED TOPICS:
{topics_list}

For each suggestion, provide:
1. A clear, concise title (2-6 words)
2. A brief reason why this topic is relevant (1 sentence, relate it to detected topics)
3. A priority level: "high", "medium", or "low"
4. A category: "prerequisite" (should learn first), "parallel" (can learn alongside), or "advanced" (learn after mastering current)

Return ONLY valid JSON in this exact format, no extra text:
{{
  "suggestions": [
    {{
      "title": "Topic Title",
      "reason": "Why this is relevant to their learning path",
      "priority": "high",
      "category": "parallel",
      "relatedTo": ["topic name it relates to"]
    }}
  ]
}}
"""


def _generate_suggestions_with_gemini(topics: list[DetectedTopic]) -> dict[str, Any]:
    """Generate suggestions using Gemini AI."""
    if not topics:
        return {"suggestions": []}
    
    prompt = _build_suggestions_prompt(topics)
    if not prompt:
        return {"suggestions": []}
    
    try:
        from llm.gemini import ask_gemini
    except ImportError:
        try:
            from backend.llm.gemini import ask_gemini
        except ImportError:
            return {"suggestions": [], "error": "Gemini module not available"}
    
    try:
        response = ask_gemini(prompt)
        result = _extract_json_object(response)
        if result and isinstance(result.get("suggestions"), list):
            # Add unique IDs to each suggestion
            for i, s in enumerate(result["suggestions"]):
                s["id"] = f"sug-{i+1}-{_slugify(s.get('title', 'unknown'))[:20]}"
            return result
        return {"suggestions": [], "error": "Invalid response format"}
    except Exception as e:
        return {"suggestions": [], "error": str(e)}


class SuggestionItem(BaseModel):
    id: str
    title: str
    reason: str
    priority: str = "medium"
    category: str = "parallel"
    relatedTo: list[str] = []


class SuggestionsResponse(BaseModel):
    suggestions: list[SuggestionItem]
    generatedAt: str | None = None
    basedOnTopics: list[str] = []
    error: str | None = None


@app.get("/suggestions", response_model=SuggestionsResponse)
@limiter.limit(RATE_LIMIT_AI)
def get_suggestions(request: Request, force: bool = False):
    """
    Generate AI-powered learning suggestions based on detected topics.
    
    Uses Gemini to analyze detected topics and suggest related concepts,
    prerequisites, and advanced topics the student should explore.
    """
    global _suggestions_cache
    
    # Get current topics
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    
    if not topics:
        return SuggestionsResponse(
            suggestions=[],
            generatedAt=datetime.now(timezone.utc).isoformat(),
            basedOnTopics=[],
            error="No topics detected yet. Start detection to get personalized suggestions."
        )
    
    # Create cache key based on topic IDs
    topic_ids = sorted([t.id for t in topics])
    cache_key = ":".join(topic_ids)
    
    with _suggestions_lock:
        # Check cache unless force refresh
        if not force and cache_key in _suggestions_cache:
            cached = _suggestions_cache[cache_key]
            # Return cached if less than 30 minutes old
            cached_time = cached.get("generatedAt")
            if cached_time:
                try:
                    gen_dt = datetime.fromisoformat(cached_time.replace("Z", "+00:00"))
                    if (datetime.now(timezone.utc) - gen_dt).total_seconds() < 1800:
                        return SuggestionsResponse(**cached)
                except Exception:
                    pass
        
        # Generate new suggestions
        result = _generate_suggestions_with_gemini(topics)
        
        generated_at = datetime.now(timezone.utc).isoformat()
        response_data = {
            "suggestions": result.get("suggestions", []),
            "generatedAt": generated_at,
            "basedOnTopics": [t.title for t in topics],
            "error": result.get("error"),
        }
        
        # Cache the result
        _suggestions_cache[cache_key] = response_data
        
        return SuggestionsResponse(**response_data)


# ============================= Topic Assistant Endpoint =============================

class AssistantMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AssistantChatRequest(BaseModel):
    topicTitle: str
    question: str
    history: list[AssistantMessage] = []


class AssistantChatResponse(BaseModel):
    answer: str


def _build_assistant_prompt(topic_title: str, question: str, history: list[AssistantMessage]) -> str:
    """Build a prompt for the topic assistant."""
    history_text = ""
    if history:
        history_lines = []
        for msg in history[-10:]:  # Keep last 10 messages
            role = "Student" if msg.role == "user" else "Assistant"
            history_lines.append(f"{role}: {msg.content}")
        history_text = "\n".join(history_lines)
        history_text = f"\nPrevious conversation:\n{history_text}\n"

    return f"""You are a helpful learning assistant specializing in "{topic_title}". Your role is to:
1. Answer questions clearly and concisely about this topic
2. Clarify doubts and explain concepts in simple terms
3. Provide relevant examples when helpful
4. Stay focused on the topic - politely redirect if asked about unrelated subjects

IMPORTANT: Keep your responses concise (2-4 paragraphs max). Use simple language appropriate for a student learning this topic.
{history_text}
Student's question: {question}

Provide a helpful, focused answer:"""


@app.post("/assistant/chat", response_model=AssistantChatResponse)
@limiter.limit(RATE_LIMIT_AI)
def assistant_chat(request: Request, body: AssistantChatRequest):
    """
    Simple topic-focused chatbot using Gemini.
    Answers questions and clarifies doubts about a specific topic.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    
    if not body.topicTitle.strip():
        raise HTTPException(status_code=400, detail="Topic title is required")
    
    try:
        from llm.gemini import ask_gemini
    except ImportError:
        try:
            from backend.llm.gemini import ask_gemini
        except ImportError:
            raise HTTPException(status_code=503, detail="Gemini module not available")
    
    try:
        prompt = _build_assistant_prompt(body.topicTitle, body.question, body.history)
        answer = ask_gemini(prompt)
        
        # Clean up the response
        answer = answer.strip()
        if not answer:
            answer = "I'm sorry, I couldn't generate a response. Please try rephrasing your question."
        
        return AssistantChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")


# ============================= Roadmap Progress Endpoints =============================

class RoadmapProgressUpdate(BaseModel):
    topicId: str
    subtopicId: str
    explainerDone: bool | None = None
    resourcesDone: bool | None = None
    quizDone: bool | None = None


@app.get("/progress/{topic_id}")
def get_roadmap_progress(topic_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        rows = (
            db.table("roadmap_progress")
            .select("*")
            .eq("user_id", user_id)
            .eq("topic_id", topic_id)
            .execute()
        )
        progress = {}
        for r in rows.data or []:
            progress[r["subtopic_id"]] = {
                "explainer": r.get("explainer_done", False),
                "resources": r.get("resources_done", False),
                "quiz": r.get("quiz_done", False),
            }
        return progress
    except HTTPException:
        raise
    except Exception as e:
        log.warning("Progress fetch failed: %s", e)
        return {}


@app.put("/progress")
def update_roadmap_progress(body: RoadmapProgressUpdate, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        row: dict[str, Any] = {
            "user_id": user_id,
            "topic_id": body.topicId,
            "subtopic_id": body.subtopicId,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if body.explainerDone is not None:
            row["explainer_done"] = body.explainerDone
        if body.resourcesDone is not None:
            row["resources_done"] = body.resourcesDone
        if body.quizDone is not None:
            row["quiz_done"] = body.quizDone

        db.table("roadmap_progress").upsert(row, on_conflict="user_id,topic_id,subtopic_id").execute()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= User Settings Endpoints =============================

class UserSettingsUpdate(BaseModel):
    lastViewed: dict | None = None
    theme: str | None = None


@app.get("/settings")
def get_user_settings(user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        result = db.table("user_settings").select("*").eq("user_id", user_id).single().execute()
        return result.data or {}
    except Exception:
        return {}


@app.put("/settings")
def update_user_settings(body: UserSettingsUpdate, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        row: dict[str, Any] = {
            "user_id": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if body.lastViewed is not None:
            row["last_viewed"] = body.lastViewed
        if body.theme is not None:
            row["theme"] = body.theme

        db.table("user_settings").upsert(row).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Spaced Repetition Endpoints =============================

@app.get("/review-queue")
def get_review_queue_endpoint(user_id: str | None = Depends(get_optional_user_id)):
    """Get topics due for review based on spaced repetition scheduling."""
    # Try Supabase first
    if user_id:
        try:
            db = get_admin_client()
            now = datetime.now(timezone.utc).isoformat()
            rows = (
                db.table("review_schedule")
                .select("*")
                .eq("user_id", user_id)
                .lte("next_review_at", now)
                .order("next_review_at")
                .limit(20)
                .execute()
            )
            if rows.data:
                return {
                    "items": [
                        {
                            "topicId": r["topic_id"],
                            "subtopicId": r["subtopic_id"],
                            "nextReviewAt": r["next_review_at"],
                            "stability": r.get("stability", 0),
                            "intervalIndex": r.get("interval_index", 0),
                        }
                        for r in rows.data
                    ],
                    "total": len(rows.data),
                }
        except Exception as e:
            log.warning("Supabase review queue fetch failed: %s", e)

    # Fallback to local BKT state
    state = load_bkt_state()
    items = get_review_queue(state)
    return {"items": items[:20], "total": len(items)}


@app.get("/daily-progress")
def get_daily_progress(user_id: str | None = Depends(get_optional_user_id)):
    """Get daily study goal progress and streak info."""
    state = load_bkt_state()
    goal_progress = get_daily_goal_progress(state)
    streak_info = _compute_streak(user_id)

    # Get study goal settings
    daily_goal = 3
    if user_id:
        try:
            db = get_admin_client()
            row = db.table("study_goals").select("*").eq("user_id", user_id).single().execute()
            if row.data:
                daily_goal = row.data.get("daily_quiz_goal", 3)
        except Exception:
            pass

    goal_progress["goalQuizzes"] = daily_goal
    goal_progress["progressPct"] = min(100, int(round(goal_progress["quizzesToday"] / max(1, daily_goal) * 100)))
    goal_progress["completed"] = goal_progress["quizzesToday"] >= daily_goal

    return {**goal_progress, **streak_info}


class StudyGoalUpdate(BaseModel):
    dailyQuizGoal: int | None = None
    dailyMinutesGoal: int | None = None


@app.put("/daily-progress/goal")
def update_daily_goal(body: StudyGoalUpdate, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        row: dict[str, Any] = {"user_id": user_id}
        if body.dailyQuizGoal is not None:
            row["daily_quiz_goal"] = max(1, min(20, body.dailyQuizGoal))
        if body.dailyMinutesGoal is not None:
            row["daily_minutes_goal"] = max(5, min(480, body.dailyMinutesGoal))
        db.table("study_goals").upsert(row).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Resource Voting =============================

class ResourceVote(BaseModel):
    topicId: str
    subtopicId: str | None = None
    resourceUrl: str
    vote: int  # 1 or -1


@app.post("/resources/vote")
def vote_resource(body: ResourceVote, user_id: str = Depends(get_current_user_id)):
    if body.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="vote must be 1 or -1")
    try:
        db = get_admin_client()
        db.table("resource_votes").upsert({
            "user_id": user_id,
            "topic_id": body.topicId,
            "subtopic_id": body.subtopicId,
            "resource_url": body.resourceUrl,
            "vote": body.vote,
        }).execute()

        # Update aggregate score in cache
        try:
            agg = db.table("resource_votes").select("vote").eq("resource_url", body.resourceUrl).execute()
            total_score = sum(r["vote"] for r in (agg.data or []))
            db.table("resource_cache").upsert({
                "topic_id": body.topicId,
                "subtopic_id": body.subtopicId or "",
                "resource_url": body.resourceUrl,
                "vote_score": total_score,
            }).execute()
        except Exception:
            pass

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/resources/votes")
def get_resource_votes(
    topic_id: str,
    user_id: str | None = Depends(get_optional_user_id),
):
    """Get vote scores for resources in a topic."""
    try:
        db = get_admin_client()
        rows = db.table("resource_cache").select("resource_url,vote_score").eq("topic_id", topic_id).execute()
        votes: dict[str, int] = {}
        for r in rows.data or []:
            votes[r["resource_url"]] = r.get("vote_score", 0)

        user_votes: dict[str, int] = {}
        if user_id:
            uv = db.table("resource_votes").select("resource_url,vote").eq("user_id", user_id).eq("topic_id", topic_id).execute()
            for r in uv.data or []:
                user_votes[r["resource_url"]] = r["vote"]

        return {"votes": votes, "userVotes": user_votes}
    except Exception:
        return {"votes": {}, "userVotes": {}}


# ============================= Generated Content Storage =============================

@app.post("/content/store")
def store_generated_content(
    body: dict,
    user_id: str = Depends(get_current_user_id),
):
    """Store generated content (explainer/quiz/summary/graph) in Supabase for multi-device."""
    topic_id = body.get("topicId")
    subtopic_id = body.get("subtopicId")
    content_type = body.get("contentType")
    content = body.get("content")

    if not topic_id or not content_type or content is None:
        raise HTTPException(status_code=400, detail="topicId, contentType, content are required")

    try:
        db = get_admin_client()
        content_hash = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
        db.table("generated_content").upsert({
            "user_id": user_id,
            "topic_id": topic_id,
            "subtopic_id": subtopic_id or "",
            "content_type": content_type,
            "content": content,
            "content_hash": content_hash,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return {"ok": True, "hash": content_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/content/{topic_id}")
def get_generated_content(
    topic_id: str,
    content_type: str | None = None,
    subtopic_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    try:
        db = get_admin_client()
        q = db.table("generated_content").select("*").eq("user_id", user_id).eq("topic_id", topic_id)
        if content_type:
            q = q.eq("content_type", content_type)
        if subtopic_id:
            q = q.eq("subtopic_id", subtopic_id)
        rows = q.execute()
        items = []
        for r in rows.data or []:
            items.append({
                "topicId": r["topic_id"],
                "subtopicId": r.get("subtopic_id"),
                "contentType": r["content_type"],
                "content": r["content"],
                "generatedAt": r.get("generated_at"),
            })
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Classroom / Collaborative =============================

class CreateClassroom(BaseModel):
    name: str
    description: str | None = None


class JoinClassroom(BaseModel):
    joinCode: str


class ShareRoadmap(BaseModel):
    topicId: str
    title: str
    subtopics: list[str] = []
    description: str | None = None
    classroomId: str | None = None
    isPublic: bool = False


def _generate_join_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@app.post("/classrooms")
def create_classroom(body: CreateClassroom, user_id: str = Depends(get_current_user_id)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    try:
        db = get_admin_client()
        join_code = _generate_join_code()
        row = {
            "name": body.name.strip(),
            "description": (body.description or "").strip(),
            "instructor_id": user_id,
            "join_code": join_code,
        }
        result = db.table("classrooms").insert(row).execute()
        classroom = result.data[0] if result.data else row

        db.table("classroom_members").insert({
            "classroom_id": classroom["id"],
            "user_id": user_id,
            "role": "instructor",
        }).execute()

        return {"ok": True, "classroom": classroom, "joinCode": join_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/classrooms/join")
def join_classroom(body: JoinClassroom, user_id: str = Depends(get_current_user_id)):
    if not body.joinCode.strip():
        raise HTTPException(status_code=400, detail="joinCode is required")
    try:
        db = get_admin_client()
        result = db.table("classrooms").select("*").eq("join_code", body.joinCode.strip().upper()).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Classroom not found")
        classroom = result.data

        db.table("classroom_members").upsert({
            "classroom_id": classroom["id"],
            "user_id": user_id,
            "role": "student",
        }).execute()

        return {"ok": True, "classroom": classroom}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/classrooms")
def list_classrooms(user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        memberships = db.table("classroom_members").select("classroom_id,role").eq("user_id", user_id).execute()
        if not memberships.data:
            return {"classrooms": []}

        classroom_ids = [m["classroom_id"] for m in memberships.data]
        roles = {m["classroom_id"]: m["role"] for m in memberships.data}

        classrooms = db.table("classrooms").select("*").in_("id", classroom_ids).execute()
        items = []
        for c in classrooms.data or []:
            c["role"] = roles.get(c["id"], "student")
            members = db.table("classroom_members").select("user_id,role").eq("classroom_id", c["id"]).execute()
            c["memberCount"] = len(members.data) if members.data else 0
            items.append(c)

        return {"classrooms": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/classrooms/{classroom_id}")
def get_classroom(classroom_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        membership = (
            db.table("classroom_members")
            .select("role")
            .eq("classroom_id", classroom_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not membership.data:
            raise HTTPException(status_code=403, detail="Not a member of this classroom")

        classroom = db.table("classrooms").select("*").eq("id", classroom_id).single().execute()
        members = db.table("classroom_members").select("user_id,role,joined_at").eq("classroom_id", classroom_id).execute()
        roadmaps = db.table("shared_roadmaps").select("*").eq("classroom_id", classroom_id).execute()

        return {
            "classroom": classroom.data,
            "role": membership.data["role"],
            "members": members.data or [],
            "roadmaps": roadmaps.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/shared-roadmaps")
def share_roadmap(body: ShareRoadmap, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        row = {
            "owner_id": user_id,
            "topic_id": body.topicId,
            "title": body.title,
            "subtopics": body.subtopics,
            "description": body.description,
            "is_public": body.isPublic,
        }
        if body.classroomId:
            row["classroom_id"] = body.classroomId
        result = db.table("shared_roadmaps").insert(row).execute()
        return {"ok": True, "roadmap": result.data[0] if result.data else row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/shared-roadmaps")
def list_shared_roadmaps(
    classroom_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    try:
        db = get_admin_client()
        if classroom_id:
            rows = db.table("shared_roadmaps").select("*").eq("classroom_id", classroom_id).execute()
        else:
            rows = db.table("shared_roadmaps").select("*").eq("owner_id", user_id).execute()
        return {"roadmaps": rows.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard")
def get_leaderboard(
    classroom_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    """Get anonymized leaderboard for a classroom or global."""
    try:
        db = get_admin_client()
        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=today.weekday())

        q = db.table("leaderboard_entries").select("*").eq("week_start", week_start.isoformat())
        if classroom_id:
            q = q.eq("classroom_id", classroom_id)
        rows = q.order("avg_score", desc=True).limit(50).execute()

        entries = []
        for i, r in enumerate(rows.data or []):
            entries.append({
                "rank": i + 1,
                "isYou": r["user_id"] == user_id,
                "quizzesCompleted": r.get("quizzes_completed", 0),
                "avgScore": round(r.get("avg_score", 0), 1),
                "topicsMastered": r.get("topics_mastered", 0),
                "streakDays": r.get("streak_days", 0),
                "studyMinutes": r.get("total_study_minutes", 0),
            })
        return {"weekStart": week_start.isoformat(), "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Study Sessions (Time Tracking) =============================

class StudySessionStart(BaseModel):
    topicId: str
    subtopicId: str | None = None
    activity: str = "quiz"


class StudySessionEnd(BaseModel):
    sessionId: str
    durationSeconds: int


@app.post("/study-sessions/start")
def start_study_session(body: StudySessionStart, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        session_id = str(uuid.uuid4())
        db.table("study_sessions").insert({
            "id": session_id,
            "user_id": user_id,
            "topic_id": body.topicId,
            "subtopic_id": body.subtopicId,
            "activity": body.activity,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return {"sessionId": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/study-sessions/end")
def end_study_session(body: StudySessionEnd, user_id: str = Depends(get_current_user_id)):
    try:
        db = get_admin_client()
        now = datetime.now(timezone.utc).isoformat()
        db.table("study_sessions").update({
            "duration_seconds": max(0, body.durationSeconds),
            "ended_at": now,
        }).eq("id", body.sessionId).eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/study-sessions/stats")
def get_study_stats(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user_id),
):
    try:
        db = get_admin_client()
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        rows = db.table("study_sessions").select("*").eq("user_id", user_id).gte("started_at", since).execute()

        total_seconds = 0
        by_topic: dict[str, int] = {}
        by_activity: dict[str, int] = {}
        by_date: dict[str, int] = {}

        for r in rows.data or []:
            dur = r.get("duration_seconds", 0)
            total_seconds += dur
            tid = r.get("topic_id", "unknown")
            by_topic[tid] = by_topic.get(tid, 0) + dur
            act = r.get("activity", "other")
            by_activity[act] = by_activity.get(act, 0) + dur
            dt = r.get("started_at", "")[:10]
            if dt:
                by_date[dt] = by_date.get(dt, 0) + dur

        return {
            "totalMinutes": round(total_seconds / 60, 1),
            "byTopic": {k: round(v / 60, 1) for k, v in by_topic.items()},
            "byActivity": {k: round(v / 60, 1) for k, v in by_activity.items()},
            "byDate": {k: round(v / 60, 1) for k, v in by_date.items()},
            "days": days,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Learning Report (PDF Export) =============================

@app.get("/report")
def generate_learning_report(user_id: str = Depends(get_current_user_id)):
    """Generate a learning report with mastery data, quiz history, and study time."""
    try:
        db = get_admin_client()

        # Mastery data
        mastery_rows = db.table("mastery").select("*").eq("user_id", user_id).execute()
        mastery_data = []
        for r in mastery_rows.data or []:
            mastery_data.append({
                "topicId": r["topic_id"],
                "subtopicId": r["subtopic_id"],
                "mastery": round(r.get("mastery", 0), 4),
                "attempts": r.get("attempts", 0),
                "lastScorePct": r.get("last_score_pct"),
            })

        # Quiz history
        quiz_rows = (
            db.table("quiz_attempts")
            .select("*")
            .eq("user_id", user_id)
            .order("submitted_at", desc=True)
            .limit(100)
            .execute()
        )
        quiz_history = []
        for r in quiz_rows.data or []:
            quiz_history.append({
                "topicId": r["topic_id"],
                "subtopicId": r["subtopic_id"],
                "scorePct": r["score_pct"],
                "correctCount": r["correct_count"],
                "total": r["total"],
                "masteryAfter": r.get("mastery_after"),
                "submittedAt": r["submitted_at"],
            })

        # Study sessions
        sessions = db.table("study_sessions").select("*").eq("user_id", user_id).execute()
        total_study_seconds = sum(r.get("duration_seconds", 0) for r in (sessions.data or []))

        # Streak
        streak = _compute_streak(user_id)

        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "userId": user_id,
            "mastery": mastery_data,
            "quizHistory": quiz_history,
            "totalStudyMinutes": round(total_study_seconds / 60, 1),
            "streak": streak,
            "topicsCount": len(set(m["topicId"] for m in mastery_data)),
            "quizzesCompleted": len(quiz_history),
            "avgScore": round(sum(q["scorePct"] for q in quiz_history) / max(1, len(quiz_history)), 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================= Quiz Difficulty =============================

@app.get("/quiz/difficulty/{topic_id}/{subtopic_id}")
def get_quiz_difficulty(topic_id: str, subtopic_id: str, user_id: str | None = Depends(get_optional_user_id)):
    """Get recommended quiz difficulty based on mastery level."""
    state = load_bkt_state()
    topic_data = state.get(topic_id, {})
    subs = topic_data.get("subtopics", {})
    skill = subs.get(subtopic_id, {})
    mastery = float(skill.get("mastery", 0.0))
    attempts = int(skill.get("attempts", 0))
    difficulty = get_difficulty_level(mastery, attempts)

    return {
        "topicId": topic_id,
        "subtopicId": subtopic_id,
        "mastery": round(mastery, 4),
        "attempts": attempts,
        "recommendedDifficulty": difficulty,
    }


# ============================= Extended Health Check =============================

@app.get("/health")
def health():
    db_status = db_health_check()
    gemini_status = "ok" if _gemini_ready else "not configured"

    llm_telemetry = get_llm_telemetry()

    # SerpAPI latency check
    serp_status = "not configured"
    if SERPAPI_API_KEY:
        serp_status = "configured"

    ok = db_status.get("supabase") == "ok"
    return {
        "status": "healthy" if ok else "degraded",
        "gemini": gemini_status,
        "serpapi": serp_status,
        "llm": llm_telemetry,
        **db_status,
    }


# ============================= Observability =============================

@app.get("/usage-stats")
def get_usage_stats(user_id: str = Depends(get_current_user_id)):
    """Usage analytics dashboard data (distinct from learning analytics)."""
    llm_telemetry = get_llm_telemetry()
    return {
        "llm": llm_telemetry,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================= Request ID Middleware =============================

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    REQUEST_ID_CTX.set(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response