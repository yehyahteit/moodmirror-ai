# MoodMirror AI

AI-powered emotion, mood, and skin wellness estimator from facial photos and text.

> **Disclaimer:** All outputs are AI-based estimates from visible facial cues, text sentiment,
> and image quality. This is **not** a medical, dermatological, or psychological diagnosis.

---

## Tech Stack

| Layer    | Technology                                          |
|----------|-----------------------------------------------------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts           |
| Backend  | Python FastAPI + DeepFace + TextBlob + TinyDB       |
| AI/ML    | DeepFace (emotion, age, gender) + TextBlob (NLP)   |
| Storage  | TinyDB (local JSON file — no database required)    |

---

## Folder Structure

```
MoodMirror AI/
├── backend/
│   ├── main.py             ← FastAPI app + all analysis logic
│   ├── requirements.txt
│   └── history.json        ← auto-created on first run
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        │   └── ResultContext.jsx
        ├── components/
        │   └── Navbar.jsx
        └── pages/
            ├── Landing.jsx
            ├── Analysis.jsx
            ├── Results.jsx
            ├── Dashboard.jsx
            └── History.jsx
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- A webcam (optional — upload also works)

---

## Installation & Setup

### 1. Backend

```bash
cd "MoodMirror AI/backend"

# Create and activate virtual environment
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

> First run will download DeepFace model weights (~400 MB) automatically.

### 2. Frontend

```bash
cd "MoodMirror AI/frontend"
npm install
```

---

## Running the App

### Terminal 1 — Start backend

```bash
cd "MoodMirror AI/backend"
source venv/bin/activate       # or venv\Scripts\activate on Windows
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Start frontend

```bash
cd "MoodMirror AI/frontend"
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

| Method | Endpoint         | Description                        |
|--------|------------------|------------------------------------|
| POST   | `/analyze`       | Submit photo + text for analysis   |
| GET    | `/history`       | Retrieve all past analyses         |
| DELETE | `/history`       | Clear all stored history           |
| GET    | `/history/stats` | Aggregated stats for dashboard     |

### POST `/analyze` — Form fields

| Field     | Type   | Required | Description                      |
|-----------|--------|----------|----------------------------------|
| `file`    | File   | Yes      | Face photo (JPG/PNG/WEBP)        |
| `text`    | String | No       | Free-text describing how you feel|
| `consent` | String | Yes      | Must be `"true"` to proceed      |

---

## Pages

| Page       | Route        | Description                                          |
|------------|--------------|------------------------------------------------------|
| Landing    | `/`          | Hero, features overview, disclaimer                  |
| Analysis   | `/analyze`   | Camera / upload / text input with consent checkbox   |
| Results    | `/results`   | Full analysis output with charts and recommendations |
| Dashboard  | `/dashboard` | Mood trend line, emotion/sentiment charts             |
| History    | `/history`   | All past analyses, click to re-view                  |

---

## What the AI Estimates

| Output               | Method                                           |
|----------------------|--------------------------------------------------|
| Emotion (7 classes)  | DeepFace deep learning model                     |
| Age range            | DeepFace age regression (±3 years)               |
| Gender expression    | DeepFace gender classifier                       |
| Text sentiment       | TextBlob NLP polarity/subjectivity               |
| Skin wellness        | OpenCV pixel statistics (heuristic)              |
| Mood score (0–100)   | Weighted blend of emotion + sentiment + skin     |
| Recommendations      | Rule-based personalised wellness suggestions     |

---

## Privacy

- All processing runs **locally** on your machine.
- No image or data is sent to any external server.
- History is stored in `backend/history.json` on your computer.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError: deepface` | Run `pip install -r requirements.txt` inside `venv` |
| Camera not working | Allow camera permissions in browser, use Upload tab instead |
| CORS error in browser | Make sure backend is running on port 8000 |
| DeepFace download hangs | First run downloads ~400 MB models; be patient |
| Port 5173 in use | Run `npm run dev -- --port 5174` |
