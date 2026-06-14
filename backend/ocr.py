"""OCR screen capture with cross-platform support and privacy toggle.

Platform support:
  - Windows: win32gui for active window detection
  - macOS/Linux: falls back to full-screen capture (no window title filtering)
  - All platforms: Tesseract auto-detection via pytesseract

Privacy toggle:
  - Set OCR_ENABLED=false in .env to disable screen capture entirely
  - Users can paste text manually via the /detect/topic endpoint instead
"""

import os
import sys
import time
import platform
from pathlib import Path
from collections import defaultdict
import json
import threading

STOP_FILE = Path("stop.flag")
PLATFORM = platform.system()  # "Windows", "Darwin", "Linux"
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").lower() not in ("false", "0", "no")

sys.stdout.reconfigure(encoding="utf-8")


def should_stop():
    return STOP_FILE.exists()


def write_output(entries):
    try:
        with open("output.json", "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("[WARN] Could not write output.json:", e)


# ── Tesseract auto-detection ──────────────────────────────────────────────

def _find_tesseract():
    """Auto-detect Tesseract binary path across platforms."""
    import shutil

    # Check env override first
    env_path = os.getenv("TESSERACT_CMD")
    if env_path and Path(env_path).exists():
        return env_path

    # Platform-specific defaults
    candidates = []
    if PLATFORM == "Windows":
        candidates = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]
    elif PLATFORM == "Darwin":
        candidates = [
            "/usr/local/bin/tesseract",
            "/opt/homebrew/bin/tesseract",
        ]
    else:
        candidates = [
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
        ]

    for c in candidates:
        if Path(c).exists():
            return c

    # Try PATH
    found = shutil.which("tesseract")
    if found:
        return found

    return None


def _init_pytesseract():
    import pytesseract
    tess_path = _find_tesseract()
    if tess_path:
        pytesseract.pytesseract.tesseract_cmd = tess_path
    return pytesseract


pytesseract = _init_pytesseract()

# ── Platform-specific window detection ───────────────────────────────────

def get_active_window_title():
    if PLATFORM == "Windows":
        try:
            import win32gui
            hwnd = win32gui.GetForegroundWindow()
            return win32gui.GetWindowText(hwnd)
        except Exception:
            return "Unknown"
    elif PLATFORM == "Darwin":
        try:
            import subprocess
            result = subprocess.run(
                ["osascript", "-e", 'tell application "System Events" to get name of first process whose frontmost is true'],
                capture_output=True, text=True, timeout=5,
            )
            return result.stdout.strip() or "Unknown"
        except Exception:
            return "Unknown"
    else:
        try:
            import subprocess
            result = subprocess.run(
                ["xdotool", "getactivewindow", "getwindowname"],
                capture_output=True, text=True, timeout=5,
            )
            return result.stdout.strip() or "Unknown"
        except Exception:
            return "Unknown"


def get_active_window_rect():
    if PLATFORM == "Windows":
        try:
            import win32gui
            hwnd = win32gui.GetForegroundWindow()
            return win32gui.GetWindowRect(hwnd)
        except Exception:
            return (0, 0, 1920, 1080)
    return (0, 0, 1920, 1080)


def should_capture(title: str) -> bool:
    title = title.lower()
    return (
        "visual studio code" in title or
        "chrome" in title or
        "firefox" in title or
        "edge" in title or
        "vscode" in title or
        "powerpoint" in title or
        "word" in title or
        ".pdf" in title or
        "safari" in title or
        "brave" in title or
        "notion" in title or
        "obsidian" in title
    )


def smart_content_crop(img):
    import numpy as np
    h, w = img.shape[:2]
    top = int(h * 0.16)
    left = int(w * 0.17)
    bottom = int(h * 0.87)
    cropped = img[top:bottom, left:]
    return cropped


def capture_active_window():
    import numpy as np
    import mss
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        img = np.array(sct.grab(monitor))
    return img


def save_image(img, prefix="capture"):
    import cv2
    os.makedirs("captures", exist_ok=True)
    filename = f"captures/{prefix}.png"
    cv2.imwrite(filename, img)
    print(f"[IMG] Image saved to {filename}")


def ocr_image(img):
    import cv2
    gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    config = "--oem 3 --psm 11"
    return pytesseract.image_to_string(gray, config=config)


def draw_border():
    if PLATFORM != "Windows":
        return

    def _run():
        try:
            import tkinter as tk
            root = tk.Tk()
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            transparent_color = "magenta"
            root.configure(bg=transparent_color)
            root.wm_attributes("-transparentcolor", transparent_color)
            root.update_idletasks()
            screen_width = root.winfo_screenwidth()
            root.geometry(f"{screen_width}x{6}+0+0")
            canvas = tk.Canvas(root, bg=transparent_color, highlightthickness=0)
            canvas.pack(fill="both", expand=True)

            def redraw(event=None):
                canvas.delete("all")
                canvas.create_rectangle(0, 0, screen_width, 6, fill="red", outline="red", width=5)

            root.bind("<Configure>", redraw)
            redraw()
            root.bind("<Escape>", lambda e: root.destroy())
            root.mainloop()
        except Exception as e:
            print(f"[WARN] Could not draw border (GUI unavailable): {e}")

    threading.Thread(target=_run, daemon=True).start()


def send_text_to_server(text, title):
    import requests as req
    url = "http://127.0.0.1:8000/detect/topic"
    payload = {"text": text, "title": title}
    try:
        response = req.post(url, json=payload, timeout=10)
        try:
            return response.json()
        except Exception:
            return None
    except Exception as e:
        print("[ERROR] Request failed:", e)
        return None


HF_TOKEN = os.getenv("HF_TOKEN")


def detect_text_classification(text):
    if not HF_TOKEN:
        return True

    import requests as req
    API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        output = req.post(API_URL, headers=headers, json={
            "inputs": text[:6000],
            "parameters": {
                "candidate_labels": [
                    "educational content",
                    "personal data",
                    "credentials",
                    "sensitive information",
                    "entertainment",
                    "other",
                ]
            },
        }, timeout=10).json()
    except Exception:
        return True

    if isinstance(output, dict):
        labels = output.get("labels") or []
        scores = output.get("scores") or []
        if labels and scores and len(labels) == len(scores):
            max_index = scores.index(max(scores))
            return labels[max_index] == "educational content"

    if isinstance(output, list) and output:
        try:
            top_item = max(output, key=lambda x: x.get("score", 0))
            return top_item.get("label") == "educational content"
        except Exception:
            return True

    return True


def finalize_window_capture(entries, window_title, captured_text, started_at, ended_at):
    captured_text = (captured_text or "").strip()
    if not captured_text:
        return

    is_educational = True
    try:
        is_educational = bool(detect_text_classification(captured_text[:6000]))
    except Exception as e:
        print("[WARN] Classification failed:", e)

    summary = send_text_to_server(captured_text, window_title)

    entry = {
        "title": window_title,
        "started_at": started_at,
        "ended_at": ended_at,
        "is_educational": is_educational,
        "ocr_text": captured_text,
        "server": summary,
    }
    entries.append(entry)
    write_output(entries)


# ── MAIN ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not OCR_ENABLED:
        print("[OCR] Screen capture is disabled (OCR_ENABLED=false).")
        print("[OCR] Users can paste text manually via the /detect/topic endpoint.")
        sys.exit(0)

    border_drawn = False

    try:
        print(f"[OCR] Starting OCR process on {PLATFORM}...")
        time_spent = defaultdict(int)

        prev_title = None
        prev_time = time.time()

        entries = []
        buffer_title = None
        buffer_started_at = None
        buffer_text = ""

        while not should_stop():
            for _ in range(20):
                if should_stop():
                    break
                time.sleep(0.1)

            title = get_active_window_title()
            current_time = time.time()

            if prev_title is not None:
                elapsed = int(current_time - prev_time)
                time_spent[prev_title] += elapsed

            if prev_title is not None and title != prev_title:
                if should_capture(prev_title):
                    finalize_window_capture(
                        entries,
                        window_title=buffer_title or prev_title,
                        captured_text=buffer_text,
                        started_at=buffer_started_at,
                        ended_at=current_time,
                    )
                buffer_text = ""
                buffer_title = title
                buffer_started_at = current_time

            if prev_title is None:
                buffer_title = title
                buffer_started_at = current_time

            prev_title = title
            prev_time = current_time

            if should_capture(title):
                if not border_drawn:
                    draw_border()
                    border_drawn = True
                print("[OCR] Triggered for:", title)

                img = capture_active_window()
                img = smart_content_crop(img)
                save_image(img, prefix="cropped")
                extracted = ocr_image(img)
                if extracted:
                    buffer_text += ("\n" if buffer_text else "") + extracted

                del img
            else:
                print("[SKIP] OCR skipped:", title)

        end_time = time.time()
        if buffer_title and should_capture(buffer_title):
            finalize_window_capture(
                entries,
                window_title=buffer_title,
                captured_text=buffer_text,
                started_at=buffer_started_at,
                ended_at=end_time,
            )

        for window, seconds in time_spent.items():
            entries.append({"window_title": window, "time_spent_sec": seconds})

        write_output(entries)

    except Exception as e:
        print("[ERROR] Unexpected error:", e)
        raise
