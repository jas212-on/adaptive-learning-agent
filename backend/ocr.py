import os
import sys
import time
from pathlib import Path
import time
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
import requests

STOP_FILE = Path("stop.flag")

def should_stop():
    return STOP_FILE.exists()

sys.stdout.reconfigure(encoding="utf-8")

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
    url = "http://127.0.0.1:8000/ask"

    # Combine window title and OCR text into a single prompt
    prompt = f"Window title: {title}\n\n{text}"

    payload = {
        "prompt": prompt
    }

    try:
        response = requests.post(url, json=payload)

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


API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
headers = {
    "Authorization": f"Bearer {os.environ['HF_TOKEN']}",
}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()

def detect_text_classification(text):
    output = query({
        "inputs": text,
        "parameters": {"candidate_labels": ["educational content","personal data",
            "credentials","sensitive information","entertainment","other"]},
    })

    print(output)
    top_item = max(output, key=lambda x: x["score"])
    return top_item["label"] == "educational content"


# -------- MAIN --------
border_drawn = False

try:
    print("[OCR] Starting OCR process...")
    time_spent = defaultdict(int)

    prev_window = None
    prev_time = time.time()

    start_time = time.time()

    entries=[]

    while not should_stop():
        
        for _ in range(20):  
            if should_stop():
                break
            time.sleep(0.1)

        title = get_active_window_title()
        current_time = time.time()
        if prev_window is not None:
            elapsed = int(current_time - prev_time)
            time_spent[prev_window] += elapsed

        prev_window = title
        prev_time = current_time
        

        if should_capture(title):
            if not border_drawn:
                draw_border()
                border_drawn = True
            print("[OCR] Triggered for:", title)

            img = capture_active_window()     
            img = smart_content_crop(img)
            save_image(img, prefix="cropped")
            text = ocr_image(img)
            isEducational = detect_text_classification(text)
            print(isEducational)
            response = send_text_to_server(text, title)
            data = {
                    "title": title,
                    "ocr_text": text,
                    "server_response": response
                }
            entries.append(data)
            print(data)

            del img
        else:
            print("[SKIP] OCR skipped:", title)

    for window, seconds in time_spent.items():
        data = {
            "window_title": window,
            "time_spent_sec": seconds
        }
        entries.append(data)

    with open("output.json", "w", encoding="utf-8") as f: 
        json.dump(entries, f, indent=4, ensure_ascii=False)

except Exception as e:
    print("[ERROR] Unexpected error:", e)
    raise