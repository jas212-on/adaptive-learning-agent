from pathlib import Path
import re
import hashlib
import json
import threading
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sys
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
from typing import Any


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

# Include timetable router
from timetable.routes import router as timetable_router
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
    summary: str | None = None


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
    # {"title": <window title>, "ocr_text": <text>, "server_response": {"topic": ...} }
    # There may also be summary entries: {"window_title": ..., "time_spent_sec": ...}
    by_topic: dict[str, DetectedTopic] = {}

    for e in entries:
        ocr_text = (e.get("ocr_text") or "").strip()
        if not ocr_text:
            continue

        server_resp = e.get("server_response")
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
            )

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
        "Extract the single most likely learning topic from the following OCR text. "
        "Return ONLY the topic as a short noun phrase (max 8 words).\n\n"
        f"Window title: {title}\n\n"
        f"OCR text:\n{text}"
    )

    def fallback_topic() -> str:
        if title:
            return title
        words = [w for w in re.split(r"\s+", text) if w]
        return " ".join(words[:8]) or "Detected topic"

    try:
        topic = ask_gemini(prompt).strip()
        if not topic:
            topic = fallback_topic()
        return {"topic": topic, "confidence": None, "raw": None}
    except RuntimeError as e:
        # Missing key / AI disabled
        return {"topic": fallback_topic(), "confidence": None, "raw": str(e)}
    except Exception as e:
        # Quota / transient errors shouldn't kill detection.
        return {"topic": fallback_topic(), "confidence": None, "raw": str(e)}

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


