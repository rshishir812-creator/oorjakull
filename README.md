<<<<<<< HEAD
# AI Instructor-Led Yoga Class POC – Dynamic Highlight Mode (Groq)

POC: instructor selects a known pose (no open-ended classification). The system evaluates alignment fidelity against that expected pose and provides dynamic, structured correction feedback.

## Requirements snapshot
- Frontend: React (Vite), WebRTC camera, MediaPipe Pose (JS), canvas skeleton overlay, SVG highlight overlay, optional browser TTS.
- Backend: FastAPI, landmark → angles/metrics, pose templates, Groq LLM JSON-only evaluation.
- Supported poses (POC): Tadasana, Warrior II, Tree Pose, Down Dog, Goddess, Plank.

## Setup

### 1) Backend (FastAPI)

1. Create and activate a virtualenv.
2. Install deps:

```bash
cd backend
python -m pip install -r requirements.txt
```

3. Set Groq API key:

- Option A (recommended): create `backend/.env`:
```env
GROQ_API_KEY=YOUR_GROQ_API_KEY
GROQ_MODEL=llama-3.3-70b-versatile
```

- Option B (PowerShell for one session):
```powershell
$env:GROQ_API_KEY = "YOUR_GROQ_API_KEY"
$env:GROQ_MODEL = "llama-3.3-70b-versatile"
```

Security note: if you previously committed/shared a real API key, rotate it and treat it as compromised.

4. Run:

```bash
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Backend will serve:
- `POST /api/evaluate`
- `GET /health`

### 2) Frontend (Vite + React)

You need Node.js + npm installed.

Windows note: if you installed Node.js while VS Code was open, restart VS Code (or at least open a new terminal) so `node`/`npm` are available on PATH.

If `node` is still not found, you can temporarily fix PATH for the current terminal session:

```powershell
$env:Path = $env:Path + ";C:\Program Files\nodejs"
```

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL.

## Notes / Assumptions
- This POC assumes **front-facing camera** and **front-view pose references**.
- For Warrior II, the template assumes **left leg is the “front” (bent) knee** and arms extended horizontally.

## TODO (placeholders only)
- TTT grading mode
- Adaptive difficulty
- Injury-aware corrections
- Multi-user studio mode
- Performance scoring system
=======
# Yoga_GenAI
>>>>>>> 46fb71bb83a9688599836594e9ae21c231105e9f
