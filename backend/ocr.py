import os
import sys
import time
from pathlib import Path
from collections import defaultdict
import json
import pytesseract
import cv2
import numpy as np
import mss
import win32gui
import requests
import tkinter as tk
import threading
from huggingface_hub import InferenceClient

STOP_FILE = Path("stop.flag")

def should_stop():
    return STOP_FILE.exists()

sys.stdout.reconfigure(encoding="utf-8")


def write_output(entries):
    try:
        with open("output.json", "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print("[WARN] Could not write output.json:", e)

# Set tesseract path
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def get_active_window_title():
    hwnd = win32gui.GetForegroundWindow()
    return win32gui.GetWindowText(hwnd)


def get_active_window_rect():
    hwnd = win32gui.GetForegroundWindow()
    return win32gui.GetWindowRect(hwnd) 


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
        ".pdf" in title
    )


def smart_content_crop(img):

    h, w = img.shape[:2]

    top = int(h * 0.16)      # remove menu
    left = int(w * 0.17)     # remove sidebar
    right = w
    bottom = int(h * 0.87)

    cropped = img[top:bottom, left:]
    return cropped

def capture_active_window():
    with mss.mss() as sct:
        monitor = sct.monitors[1]  # primary display
        img = np.array(sct.grab(monitor))
    return img

def save_image(img, prefix="capture"):
    os.makedirs("captures", exist_ok=True)

    filename = f"captures/{prefix}.png"

    cv2.imwrite(filename, img)
    print(f"[IMG] Image saved to {filename}")

def ocr_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)

    # Improve contrast
    gray = cv2.threshold(gray, 0, 255,
                          cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    config = "--oem 3 --psm 11"
    return pytesseract.image_to_string(gray, config=config)


def draw_border():
    def _run():
        try:
            root = tk.Tk()

            # Remove window decorations FIRST
            root.overrideredirect(True)

            # Always on top
            root.attributes("-topmost", True)

            # Transparent background
            transparent_color = "magenta"
            root.configure(bg=transparent_color)
            root.wm_attributes("-transparentcolor", transparent_color)

            # Get real screen size AFTER Tk init
            root.update_idletasks()
            screen_width = root.winfo_screenwidth()
            screen_height = root.winfo_screenheight()
        

            # Manually fullscreen (NO -fullscreen flag)
            root.geometry(f"{screen_width}x{6}+0+0")

            canvas = tk.Canvas(
                root,
                bg=transparent_color,
                highlightthickness=0
            )
            canvas.pack(fill="both", expand=True)

            border_thickness = 5

            def redraw(event=None):
                canvas.delete("all")
                w = root.winfo_width()
                h = root.winfo_height()

                canvas.create_rectangle(
                    0,0,
                    screen_width,6,
                    fill="red",
                outline="red",
                width=border_thickness
            )

            # Redraw on resize / DPI changes
            root.bind("<Configure>", redraw)

            redraw()

            root.bind("<Escape>", lambda e: root.destroy())
            root.mainloop()
        except Exception as e:
            print(f"[WARN] Could not draw border (GUI unavailable): {e}")

    threading.Thread(target=_run, daemon=True).start()


def send_text_to_server(text, title):
    # Prefer topic extraction endpoint so the UI can show detected topics.
    url = "http://127.0.0.1:8000/detect/topic"

    payload = {
        "text": text,
        "title": title,
    }

    try:
        response = requests.post(url, json=payload, timeout=10)

        print("HTTP STATUS:", response.status_code)

        # 🔥 ALWAYS print response text
        print(response)

        # Try JSON only if possible
        try:
            data = response.json()
            print("JSON RESPONSE:", data)
            return data
        except Exception:
            print("Response is not JSON")

    except requests.exceptions.RequestException as e:
        print("[ERROR] Request failed:", e)

    except Exception as e:
        print("[ERROR] Unexpected error:", e)

HF_TOKEN = os.getenv("HF_TOKEN")

def generate_summary(text):
    if not HF_TOKEN:
        return None

    # Keep requests reasonably sized for hosted models.
    text = (text or "").strip()
    if not text:
        return None

    client = InferenceClient(
    provider="hf-inference",
    api_key=HF_TOKEN,
    )

    result = client.summarization(
    text,
    model="facebook/bart-large-cnn",
    )
    print(result)
    return result


API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else None

def query(payload):
    if not headers:
        return None
    response = requests.post(API_URL, headers=headers, json=payload, timeout=10)
    return response.json()

def detect_text_classification(text):
    # If HF token isn't configured, don't block detection.
    if not HF_TOKEN:
        return True

    output = query(
        {
            "inputs": text,
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
        }
    )

    #print(output)

    # HF router can return either:
    # 1) {"labels": [...], "scores": [...]} (common)
    # 2) a list of {"label": ..., "score": ...}
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
        is_educational = True

    summary = send_text_to_server(captured_text, window_title)

    entry = {
        "title": window_title,
        "started_at": started_at,
        "ended_at": ended_at,
        "is_educational": is_educational,
        "ocr_text": captured_text,
        "server": summary
    }
    entries.append(entry)
    write_output(entries)


# -------- MAIN --------
border_drawn = False

try:
    print("[OCR] Starting OCR process...")
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

        # If window changed, flush the previous window's accumulated OCR text.
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

        # Initialize buffer on first iteration.
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
                # While the window stays the same, keep accumulating text.
                buffer_text += ("\n" if buffer_text else "") + extracted

            del img
        else:
            print("[SKIP] OCR skipped:", title)

    # Flush the last active window before exiting.
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
        data = {
            "window_title": window,
            "time_spent_sec": seconds
        }
        entries.append(data)

    # Final write (includes time_spent summary entries)
    write_output(entries)

except Exception as e:
    print("[ERROR] Unexpected error:", e)
    raise