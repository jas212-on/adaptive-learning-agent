from pathlib import Path
import re
import hashlib
import json
import threading
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sys
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import Any

from urllib.parse import urlparse
from graph.builder import build_concept_graph, graph_to_legacy_format


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

api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

_gemini_ready = bool(api_key)
if _gemini_ready:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
else:
    model = None

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
    version="1.0.0"
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EXISTING DETECTION ENDPOINTS

@app.get("/")
def read_root():
    return {"message": "Adaptive Learning Agent API is running."}

@app.post("/ask", response_model=AskResponse)
def ask_ai(data: AskRequest):
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
def detect_topic(data: DetectTopicRequest):
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
        print("Starting OCR process...")
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


@app.get("/detector/topics", response_model=list[DetectedTopic])
def detector_topics():
    entries = _read_output_entries()
    return _build_topics_from_entries(entries)


@app.get("/detector/topics/{topic_id}", response_model=DetectedTopic)
def detector_topic(topic_id: str):
    entries = _read_output_entries()
    topics = _build_topics_from_entries(entries)
    for t in topics:
        if t.id == topic_id:
            t.summary = get_topic_summary(t.id, t.title, entries)
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


