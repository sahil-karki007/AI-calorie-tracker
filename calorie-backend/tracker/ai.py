import json
from dotenv import load_dotenv
from google import genai
import time
from google.genai import errors
from google.genai import types
load_dotenv()

client = genai.Client(http_options=types.HttpOptions(timeout=60000))
MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]

PROMPT = """Look at this meal photo. Identify every food item, estimate the portion,
and return JSON in this format:
{"items": [{"name": "", "portion": "", "calories": 0, "carbs_g": 0, "protein_g": 0, "fat_g": 0}],
 }"""
def generate_with_retry(image_bytes, mime_type, retries=2):
    last_error = None
    for model in MODELS:
        for attempt in range(retries):
            try:
                return client.models.generate_content(
                    model=model,
                    contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type), PROMPT],
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
            except errors.APIError as e:
                last_error = e
                if e.code in (429, 503, 504):
                    print(f"{model} busy (error {e.code}), attempt {attempt + 1} of {retries}")
                    if attempt < retries - 1:
                        time.sleep(2)
                    continue
                if e.code == 404:
                    print(f"{model} not available, trying next model")
                    break
                raise
    raise last_error
def add_totals(data):
    keys = ["calories", "carbs_g", "protein_g", "fat_g"]
    data["total"] = {k: round(sum(item[k] for item in data["items"]), 1) for k in keys}
    return data
def analyze_food(image_bytes, mime_type):
    response = generate_with_retry(image_bytes, mime_type)
    return add_totals(json.loads(response.text))