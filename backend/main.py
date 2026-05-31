"""
MoodMirror AI — FastAPI Backend
AI-based emotion, sentiment, wellness estimation from face photo + text.
NOT a medical, dermatological, or psychological diagnosis.
"""

import io
import uuid
import base64
import random
import traceback
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from textblob import TextBlob
from tinydb import TinyDB, Query
from deepface import DeepFace

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="MoodMirror AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = TinyDB("history.json")
history_table = db.table("analyses")

DISCLAIMER = (
    "This result is an AI-based estimate from visible facial cues, text sentiment, "
    "and image quality. It is not a medical, dermatological, or psychological diagnosis."
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)


def analyze_text_sentiment(text: str) -> dict:
    if not text or not text.strip():
        return {"label": "neutral", "score": 0.0, "subjectivity": 0.0}
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity          # -1 … +1
    subjectivity = blob.sentiment.subjectivity  # 0 … 1
    if polarity > 0.1:
        label = "positive"
    elif polarity < -0.1:
        label = "negative"
    else:
        label = "neutral"
    return {"label": label, "score": round(polarity, 3), "subjectivity": round(subjectivity, 3)}


def analyze_skin_wellness(img_bgr: np.ndarray, face_region: Optional[dict] = None) -> dict:
    """
    Heuristic skin wellness analysis from pixel statistics.
    All values are AI-based observations, not clinical measurements.
    """
    if face_region:
        x, y, w, h = face_region.get("x", 0), face_region.get("y", 0), \
                     face_region.get("w", img_bgr.shape[1]), face_region.get("h", img_bgr.shape[0])
        face = img_bgr[y:y+h, x:x+w]
    else:
        face = img_bgr

    if face.size == 0:
        face = img_bgr

    # Convert channels
    face_rgb  = cv2.cvtColor(face, cv2.COLOR_BGR2RGB).astype(np.float32)
    face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY).astype(np.float32)

    r_mean = float(np.mean(face_rgb[:, :, 0]))
    g_mean = float(np.mean(face_rgb[:, :, 1]))
    b_mean = float(np.mean(face_rgb[:, :, 2]))

    # Redness: red channel dominance
    redness_score = round(min(100, max(0, (r_mean - g_mean) * 2)), 1)

    # Brightness: average luminance 0-255 → 0-100
    brightness = round(float(np.mean(face_gray)) / 255 * 100, 1)

    # Texture: Laplacian variance (higher = more textured / rougher)
    lap_var = float(cv2.Laplacian(face_gray.astype(np.uint8), cv2.CV_64F).var())
    texture_score = round(min(100, lap_var / 20), 1)   # normalised heuristic

    # Dark circles: lower-eye region darkness estimate (bottom 20% of face)
    lower_band = face_gray[int(face_gray.shape[0] * 0.7):, :]
    dark_circle_score = round(100 - float(np.mean(lower_band)) / 255 * 100, 1)

    # Overall wellness score (simple weighted heuristic)
    wellness = round(
        (brightness * 0.3) +
        (max(0, 100 - redness_score) * 0.25) +
        (max(0, 100 - texture_score) * 0.25) +
        (max(0, 100 - dark_circle_score) * 0.2),
        1,
    )

    return {
        "redness": redness_score,
        "texture": texture_score,
        "dark_circles": dark_circle_score,
        "brightness": brightness,
        "wellness_score": wellness,
        "note": "AI-based observation from visible image cues only.",
    }


def compute_mood_score(emotion: str, sentiment_score: float, wellness: float) -> int:
    """Blend emotion weight + text sentiment + skin wellness into 0-100 mood score."""
    emotion_weights = {
        "happy": 85, "surprise": 65, "neutral": 55,
        "fear": 35,  "sad": 30,     "disgust": 25, "angry": 20,
    }
    base = emotion_weights.get(emotion.lower(), 50)
    text_boost  = sentiment_score * 15        # -15 … +15
    skin_boost  = (wellness - 50) * 0.2       # -10 … +10
    raw = base + text_boost + skin_boost
    return int(min(100, max(0, round(raw))))


def wellness_recommendations(emotion: str, mood_score: int, sentiment: str) -> list[str]:
    recs = []
    e = emotion.lower()
    if e == "happy":
        recs += ["Keep up your positive energy — share it with someone today!",
                 "Document this mood in a gratitude journal."]
    elif e == "sad":
        recs += ["Consider a short walk outdoors — sunlight can lift your mood.",
                 "Reach out to a trusted friend or family member.",
                 "Try 5 minutes of deep breathing or light stretching."]
    elif e == "angry":
        recs += ["Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.",
                 "Step away from screens for 10 minutes.",
                 "Cold water on the face can calm the nervous system."]
    elif e == "fear":
        recs += ["Ground yourself: name 5 things you can see right now.",
                 "Slow, controlled breathing activates the parasympathetic system.",
                 "Journaling fears can reduce their intensity."]
    elif e in ("disgust", "neutral"):
        recs += ["A short mindfulness break can reset your emotional state.",
                 "Hydrate well — dehydration affects mood and focus."]
    elif e == "surprise":
        recs += ["Channel that energy into something creative!",
                 "Take a moment to reflect on what caused the surprise."]

    if mood_score < 40:
        recs.append("Your estimated mood score is low — rest, hydration, and social connection all help.")
    if sentiment == "negative":
        recs.append("Your text reflects some negativity — consider reframing your thoughts positively.")

    recs.append("Consistent sleep (7-9 hours) is the single biggest mood stabiliser.")
    return recs[:5]  # cap at 5


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "MoodMirror AI API running"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    text: Optional[str] = Form(default=""),
    consent: str = Form(...),
):
    if consent.lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=400, detail="Consent is required to proceed.")

    # ── Load image ──
    raw = await file.read()
    try:
        pil_img = Image.open(io.BytesIO(raw))
        img_bgr = pil_to_cv2(pil_img)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image. Please upload a valid photo.")

    # ── DeepFace analysis ──
    face_region = None
    try:
        results = DeepFace.analyze(
            img_path=img_bgr,
            actions=["emotion", "age", "gender"],
            enforce_detection=False,
            silent=True,
        )
        res = results[0] if isinstance(results, list) else results

        dominant_emotion = res.get("dominant_emotion", "neutral")
        emotion_scores   = res.get("emotion", {})
        age_val          = res.get("age", 0)
        gender_data      = res.get("gender", {})
        face_region      = res.get("region", None)

        # Age range — very wide bins; DeepFace has ±10+ yr error on children/elderly
        def age_to_range(a):
            if a < 13:  return "Child (under 13)"
            if a < 20:  return "Teen (13–19)"
            if a < 30:  return "Young Adult (20s)"
            if a < 45:  return "Adult (30s–40s)"
            if a < 60:  return "Middle-aged (45–60)"
            return "Senior (60+)"
        age_range = age_to_range(age_val)

        # Gender expression
        if isinstance(gender_data, dict):
            dominant_gender = max(gender_data, key=gender_data.get)
            gender_conf     = round(gender_data[dominant_gender], 1)
        else:
            dominant_gender = str(gender_data)
            gender_conf     = None

    except Exception as e:
        traceback.print_exc()
        # Graceful fallback — still return skin + sentiment
        dominant_emotion = "neutral"
        emotion_scores   = {"neutral": 100.0}
        age_range        = "N/A"
        dominant_gender  = "N/A"
        gender_conf      = None

    # ── Text sentiment ──
    sentiment = analyze_text_sentiment(text or "")

    # ── Skin wellness ──
    skin = analyze_skin_wellness(img_bgr, face_region)

    # ── Mood score ──
    mood_score = compute_mood_score(dominant_emotion, sentiment["score"], skin["wellness_score"])

    # ── Recommendations ──
    recs = wellness_recommendations(dominant_emotion, mood_score, sentiment["label"])

    # ── Build result ──
    result = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "emotion": {
            "dominant": dominant_emotion,
            "scores": {k: round(v, 2) for k, v in emotion_scores.items()},
        },
        "sentiment": sentiment,
        "age_range": age_range,
        "age_raw": int(age_val),   # raw DeepFace estimate — shown with disclaimer
        "gender_expression": {
            "label": dominant_gender,
            "confidence": gender_conf,
            "note": "AI-based observation — not a biological determination.",
        },
        "skin_wellness": skin,
        "face_region": face_region,   # pixel coords of detected face for frontend overlay
        "mood_score": mood_score,
        "recommendations": recs,
        "disclaimer": DISCLAIMER,
    }

    # ── Persist to history ──
    history_table.insert({**result, "text_input": text or ""})

    return JSONResponse(content=result)


@app.get("/history")
def get_history():
    records = history_table.all()
    # Sort newest first
    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return {"history": records}


@app.delete("/history")
def clear_history():
    history_table.truncate()
    return {"message": "History cleared."}


@app.get("/history/stats")
def history_stats():
    records = history_table.all()
    if not records:
        return {"count": 0, "avg_mood": None, "emotion_distribution": {}, "sentiment_distribution": {}}

    moods = [r["mood_score"] for r in records if "mood_score" in r]
    emotions = {}
    sentiments = {}
    for r in records:
        e = r.get("emotion", {}).get("dominant", "unknown")
        emotions[e] = emotions.get(e, 0) + 1
        s = r.get("sentiment", {}).get("label", "unknown")
        sentiments[s] = sentiments.get(s, 0) + 1

    return {
        "count": len(records),
        "avg_mood": round(sum(moods) / len(moods), 1) if moods else None,
        "emotion_distribution": emotions,
        "sentiment_distribution": sentiments,
        "mood_trend": [{"timestamp": r["timestamp"], "mood_score": r["mood_score"]}
                       for r in records[-30:]],   # last 30
    }
