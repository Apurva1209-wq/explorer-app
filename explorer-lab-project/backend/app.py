"""Explorer Lab BACKEND (API only). A kid-friendly hint coach. Works with a free Gemini key and/or a free Groq key.
It finds a working model by itself, so model renames never break it."""
import os
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()
app = Flask(__name__)
CACHE = {}

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE = "https://api.groq.com/openai/v1"

LEVELS = {
    1: "TINY NUDGE: Ask one guiding question that helps the student notice something. Do not explain the answer.",
    2: "DIRECTION: Point to an idea or method to explore. Do not give the final answer.",
    3: "SCAFFOLD: Give a partial framework or a worked example of a DIFFERENT, similar problem. Do not give the final answer.",
    4: "EXPLAIN: Explain the idea simply in under 90 words, using a fun everyday example. Then ask one question to check understanding.",
}
SYSTEM = """You are Compass, a cheerful, kind helper for kids and teens aged 8 to 16.
Use very simple words and short sentences. Be warm and encouraging. Use one or two emojis.
For homework or problem questions in the hint modes, never give the final answer, only hints.
Keep replies under 80 words. End with one small thing the student can try next."""

FALLBACK = {
    1: "What do you already know about this? Tell me two things, then tell me which part feels fuzzy. 🤔",
    2: "Try breaking the problem into small parts. Which part could you solve first? 🧩",
    3: "Pick a similar but easier problem and solve that. Which steps did you use? Try the same steps here! 🪜",
    4: "I can't reach my brain right now, but let's try: say it in your own words first, then we'll fix it together! 🧸",
}


def err_text(e):
    try:
        return e.response.json()["error"]["message"][:160]
    except Exception:
        return str(e)[:160]


def gemini(prompt, key):
    H = {"x-goog-api-key": key}
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1000},
    }

    def call(model):
        r = requests.post(f"{GEMINI_BASE}/models/{model}:generateContent", json=body, headers=H, timeout=40)
        r.raise_for_status()
        parts = r.json()["candidates"][0]["content"].get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise ValueError("empty reply")
        return text

    first = CACHE.get("gemini") or os.getenv("GEMINI_MODEL")
    if first:
        try:
            return call(first)
        except requests.HTTPError as e:
            if e.response.status_code not in (400, 404):
                raise
    r = requests.get(f"{GEMINI_BASE}/models?pageSize=200", headers=H, timeout=20)
    r.raise_for_status()
    bad = ("image", "tts", "live", "audio", "embed", "robotics", "computer", "gemma", "learnlm", "vision")
    names = [m["name"].split("/")[-1] for m in r.json().get("models", [])
             if "generateContent" in m.get("supportedGenerationMethods", [])]
    good = sorted((n for n in names if "flash" in n and not any(b in n for b in bad)), reverse=True)
    last = None
    for model in good[:4]:
        try:
            text = call(model)
            CACHE["gemini"] = model
            return text
        except Exception as e:
            last = e
    raise last or RuntimeError("no usable Gemini model for this key")


def groq(prompt, key):
    H = {"Authorization": f"Bearer {key}"}

    def call(model):
        r = requests.post(f"{GROQ_BASE}/chat/completions", headers=H, timeout=40, json={
            "model": model, "temperature": 0.7, "max_tokens": 300,
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]})
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()

    first = CACHE.get("groq") or os.getenv("GROQ_MODEL")
    if first:
        try:
            return call(first)
        except requests.HTTPError as e:
            if e.response.status_code not in (400, 404):
                raise
    r = requests.get(f"{GROQ_BASE}/models", headers=H, timeout=20)
    r.raise_for_status()
    ids = [m["id"] for m in r.json()["data"]
           if not any(b in m["id"] for b in ("whisper", "guard", "tts", "orpheus", "playai", "distil"))]
    ids.sort(key=lambda i: ("instant" not in i, "llama" not in i, i))
    last = None
    for model in ids[:4]:
        try:
            text = call(model)
            CACHE["groq"] = model
            return text
        except Exception as e:
            last = e
    raise last or RuntimeError("no usable Groq model for this key")


@app.after_request
def cors(resp):
    """Lets the separate frontend (another address) talk to this backend."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    return resp


@app.get("/")
def home():
    return jsonify(status="Explorer Lab backend is running", keys_found={
        "gemini": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "groq": bool(os.getenv("GROQ_API_KEY", "").strip())})


@app.post("/api/hint")
def hint():
    data = request.get_json(force=True)
    question = (data.get("question") or "").strip()[:500]
    level = min(max(int(data.get("level", 1)), 1), 4)
    if not question:
        return jsonify(error="Type a question first."), 400
    convo = "\n".join(f"{m['role']}: {m['text']}" for m in data.get("history", [])[-6:])
    prompt = f"Recent chat:\n{convo}\n\nStudent question: {question}\n\nMode: {LEVELS[level]}"

    reasons = []
    for name, fn, key in (("Gemini", gemini, os.getenv("GEMINI_API_KEY", "").strip()),
                          ("Groq", groq, os.getenv("GROQ_API_KEY", "").strip())):
        if not key:
            continue
        try:
            return jsonify(hint=fn(prompt, key))
        except Exception as e:
            print(f"{name} error:", err_text(e))
            reasons.append(f"{name}: {err_text(e)}")
    reason = " | ".join(reasons) or "No API key found in the .env file."
    return jsonify(hint=FALLBACK[level], offline=True, reason=reason)


if __name__ == "__main__":
    app.run(debug=True)
