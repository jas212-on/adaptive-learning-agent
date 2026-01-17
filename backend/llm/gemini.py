import google.generativeai as genai
import os
from dotenv import load_dotenv

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