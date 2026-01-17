from pathlib import Path
import threading
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sys
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv


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

if not api_key:
    raise RuntimeError(
        "Gemini API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY in your environment or .env file."
    )

genai.configure(api_key=api_key)

model = genai.GenerativeModel("gemini-2.5-flash")

def ask_gemini(prompt: str) -> str:
    response = model.generate_content(prompt)
    return response.text


app = FastAPI(
    title="Adaptive Learning Agent API",
    description="AI-powered adaptive learning system with real-time content detection and personalized learning paths",
    version="1.0.0"
)


# OCR PROCESS MANAGEMENT

_ocr_process = None
_ocr_lock = threading.Lock()


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
        
        stop_file = Path("stop.flag")
        if stop_file.exists():
            stop_file.unlink()

        script_path = _ocr_script_path()
        if not script_path.exists():
            raise RuntimeError(f"OCR script not found at {script_path}")

        backend_dir = script_path.parent
        
        _ocr_process = subprocess.Popen(
            [sys.executable, str(script_path)],
            cwd=str(backend_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
        return True 
    
def stop_ocr() -> bool:
    global _ocr_process
    with _ocr_lock:
        if _ocr_process is None:
            return False
        Path("stop.flag").touch()

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

    try:
        topic = ask_gemini(prompt).strip()
        if not topic:
            raise RuntimeError("Empty topic")
        return {"topic": topic, "confidence": None, "raw": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ocr/status")
def ocr_status():
    global _ocr_process
    exit_code = None
    
    with _ocr_lock:
        if _ocr_process is not None:
            exit_code = _ocr_process.poll()
    
    return {
        "running": is_ocr_running(),
        "exit_code": exit_code
    }

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


