from __future__ import annotations

import base64
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any as _Any

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel as _BM, Field as _F

from app.core.config import settings
from app.models.contracts import EvaluateRequest, GeminiAlignmentResponse, TTSRequest, AssistantRequest, AssistantResponse, ProductSuggestion
from app.routers.breathwork import router as breathwork_router
from app.services.evaluator import AlignmentEvaluator
from app.services.assistant import AssistantService
from app.services.pose_library import get_library, get_pose, check_pose_contraindications

# Safety architecture imports
from app.core.auth import verify_google_token, upsert_user, get_current_user, get_optional_user
from safety.models import UserHealthInput, UserRiskProfile, SessionPlan
from safety.safety_profiler import SafetyProfiler
from session.session_orchestrator import SessionOrchestrator

# Add backend/ to path so `pose_rules` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pose_rules.angle_rules import get_rules as get_pose_rules        # noqa: E402
from pose_rules.angle_calculator import calculate_pose_score as _det_score  # noqa: E402

app = FastAPI(title="Yoga GenAI POC", version="0.1.0")

# Expose training assets (e.g., reference videos) to the frontend.
# On Vercel serverless, TRAIN/ won't exist — guard gracefully.
_repo_root = Path(__file__).resolve().parents[2]
_train_dir = _repo_root / "TRAIN"
try:
    if _train_dir.is_dir():
        app.mount("/train", StaticFiles(directory=str(_train_dir)), name="train")
except Exception:
    pass  # serverless — no static files


_TRAILING_INDEX_RE = re.compile(r"(?:[_\-\s]+\d+)$")
_SPACE_RE = re.compile(r"\s+")


def _canonical_pose_name(raw: str) -> str:
    # Normalize separators and strip trailing indices like _001 or -12.
    name = raw.replace("_", " ").replace("-", " ")
    name = _TRAILING_INDEX_RE.sub("", name)
    name = _SPACE_RE.sub(" ", name).strip()
    if not name:
        return raw.strip() or raw

    key = name.strip().lower()
    aliases = {
        "downdog": "Down Dog",
        "down dog": "Down Dog",
        "godess": "Goddess",
        "goddess": "Goddess",
        "warrior": "Warrior II",
        "warrior pose": "Warrior II",
        "warrior ii": "Warrior II",
        "tree pose": "Tree Pose",
    }
    if key in aliases:
        return aliases[key]

    # Preserve roman numerals / acronyms; otherwise capitalize words.
    roman = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}
    parts: list[str] = []
    for token in name.split(" "):
        if not token:
            continue
        low = token.lower()
        if low in roman:
            parts.append(low.upper())
        elif token.isupper() and len(token) <= 4:
            parts.append(token)
        else:
            parts.append(token[0].upper() + token[1:])
    return " ".join(parts) if parts else name


@app.get("/api/train/poses")
def list_train_poses() -> dict[str, object]:
    """Return unique pose names derived from files in TRAIN/ with their media URLs."""
    if not _train_dir.exists():
        return {"poses": []}

    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".mp4"}
    pose_to_media: dict[str, list[dict[str, str]]] = {}

    for p in sorted(_train_dir.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext not in allowed_exts:
            continue

        pose = _canonical_pose_name(p.stem)
        kind = "video" if ext == ".mp4" else "image"
        media = {"kind": kind, "src": f"/train/{p.name}", "filename": p.name}
        pose_to_media.setdefault(pose, []).append(media)

    poses_payload: list[dict[str, object]] = []
    for pose in sorted(pose_to_media.keys(), key=lambda s: s.lower()):
        media_list = pose_to_media[pose]
        media_list.sort(key=lambda m: (0 if m.get("kind") == "image" else 1, str(m.get("filename", "")).lower()))
        poses_payload.append({"pose": pose, "media": media_list})

    return {"poses": poses_payload}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

evaluator = AlignmentEvaluator()
assistant_service = AssistantService()

app.include_router(breathwork_router)


@app.get("/api/debug/env")
def debug_env():
    """Temporary diagnostic — delete after confirming env vars work."""
    import os
    return {
        "GOOGLE_CLIENT_ID": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "VITE_GOOGLE_CLIENT_ID": bool(os.getenv("VITE_GOOGLE_CLIENT_ID")),
        "SUPABASE_URL": bool(os.getenv("SUPABASE_URL")),
        "SUPABASE_SERVICE_KEY": bool(os.getenv("SUPABASE_SERVICE_KEY")),
        "settings.google_client_id": bool(settings.google_client_id),
        "settings.supabase_url": bool(settings.supabase_url),
    }


# ── Google Cloud Text-to-Speech voices ──────────────────────────────────────
# Neural2 voices for en-IN — consistent across all browsers.
_TTS_VOICES = {
    "female": "en-IN-Neural2-A",
    "male": "en-IN-Neural2-B",
}
_TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/assistant", response_model=AssistantResponse)
def assistant_message(req: AssistantRequest) -> dict[str, str]:
    """
    Handle conversational requests from the Madhu assistant.

    Request:
    {
      "message": "What is Warrior II?",
      "messages": [
        {"role": "user", "content": "Hi there"},
        {"role": "assistant", "content": "Namaste! How can I help?"}
      ]
    }

    Response:
    {
      "reply": "Warrior II is a powerful standing pose..."
    }
    """
    # Convert pydantic messages to dict format for the service
    history = [{"role": msg.role, "content": msg.content} for msg in req.messages]

    # Generate response (returns AssistantResponse with reply + optional suggestion)
    return assistant_service.generate_response(user_message=req.message, conversation_history=history)


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest) -> Response:
    """Synthesize speech using Google Cloud TTS and return MP3 audio bytes."""
    api_key = settings.google_tts_api_key
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="TTS API key not configured. Set GOOGLE_TTS_API_KEY env var.",
        )

    voice_name = _TTS_VOICES.get(req.gender, _TTS_VOICES["female"])

    body = {
        "input": {"text": req.text},
        "voice": {
            "languageCode": "en-IN",
            "name": voice_name,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": req.speed,
            "pitch": req.pitch,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_TTS_API_URL}?key={api_key}",
            json=body,
            timeout=15.0,
        )

    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else "Unknown TTS error"
        raise HTTPException(status_code=502, detail=f"Google TTS error: {detail}")

    audio_bytes = base64.b64decode(resp.json()["audioContent"])
    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.post("/api/evaluate", response_model=GeminiAlignmentResponse)
def evaluate(req: EvaluateRequest) -> dict:
    landmarks = [lm.model_dump() for lm in req.landmarks]
    return evaluator.evaluate(
        client_id=req.client_id,
        expected_pose=req.expected_pose,
        user_level=req.user_level,
        landmarks=landmarks,
    )


# ── Fast deterministic pose scoring (no LLM, <20ms) ────────────────────────


class PoseScoreRequest(_BM):
    pose_id: str
    landmarks: list[dict[str, float]]


class PoseScoreViolation(_BM):
    joint: str
    severity: str
    feedback: str


class PoseScoreResponse(_BM):
    score: int
    violations: list[PoseScoreViolation]
    is_stable: bool
    feedback_priority: str | None = None


@app.post("/api/pose/score", response_model=PoseScoreResponse)
def pose_score(req: PoseScoreRequest) -> dict[str, _Any]:
    """Pure deterministic pose scoring — no LLM. Called every frame."""
    rules = get_pose_rules(req.pose_id)
    if rules is None:
        # Fallback: return neutral score
        return {
            "score": 50,
            "violations": [],
            "is_stable": True,
            "feedback_priority": None,
        }
    return _det_score(req.landmarks, req.pose_id, rules)


# ── Pose library endpoints ──────────────────────────────────────────────────

@app.get("/api/pose/library")
def pose_library_list() -> dict[str, _Any]:
    """Return the full pose library (cached in memory)."""
    return {"poses": get_library()}


@app.get("/api/pose/library/{pose_id}")
def pose_library_detail(pose_id: str) -> dict[str, _Any]:
    """Return a single pose's data."""
    pose = get_pose(pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail=f"Pose '{pose_id}' not found")
    return pose


class ContraindicationRequest(_BM):
    pose_id: str
    user_conditions: list[str]


@app.post("/api/pose/contraindications")
def pose_contraindications(req: ContraindicationRequest) -> dict[str, _Any]:
    """Check if a pose has contraindications for the user's conditions."""
    pose = get_pose(req.pose_id)
    if not pose:
        raise HTTPException(status_code=404, detail=f"Pose '{req.pose_id}' not found")
    warnings = check_pose_contraindications(pose, req.user_conditions)
    return {"warnings": warnings, "safe": len(warnings) == 0}


# ═══════════════════════════════════════════════════════════════════════════
#  SAFETY ARCHITECTURE — New routes
# ═══════════════════════════════════════════════════════════════════════════

safety_profiler = SafetyProfiler()
session_orchestrator = SessionOrchestrator()


# ── Auth ────────────────────────────────────────────────────────────────────

class GoogleAuthRequest(_BM):
    credential: str = _F(description="Google OAuth credential JWT from the frontend")


class GoogleAuthResponse(_BM):
    user_id: str
    google_sub: str
    email: str
    display_name: str
    picture_url: str


@app.post("/api/auth/google", response_model=GoogleAuthResponse)
def auth_google(req: GoogleAuthRequest) -> dict[str, _Any]:
    """Verify a Google OAuth token and upsert the user."""
    payload = verify_google_token(req.credential)
    user = upsert_user(payload)
    return {
        "user_id": user["id"],
        "google_sub": user["google_sub"],
        "email": user.get("email", ""),
        "display_name": user.get("display_name", ""),
        "picture_url": user.get("picture_url", ""),
    }


# ── Safety Profile ──────────────────────────────────────────────────────────

@app.post("/api/safety/profile")
def create_or_update_safety_profile(
    health_input: UserHealthInput,
    user: dict = Depends(get_current_user),
) -> dict[str, _Any]:
    """Build a safety profile from questionnaire answers and persist it."""
    from app.core.db import get_supabase

    user_id = user["id"]
    library = get_library()

    # Check existing profile version
    sb = get_supabase()
    existing = (
        sb.table("user_risk_profiles")
        .select("profile_version")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    existing_version = existing.data[0]["profile_version"] if existing.data else 0

    profile = safety_profiler.build_profile(
        health_input,
        library,
        user_id=user_id,
        existing_version=existing_version,
    )

    # Persist to DB
    sb.table("user_risk_profiles").insert({
        "user_id": user_id,
        "risk_tier": profile.risk_tier,
        "profile_json": profile.model_dump(mode="json"),
        "consent_given": profile.consent_given,
        "consent_at": profile.consent_timestamp.isoformat() if profile.consent_timestamp else None,
        "profile_version": profile.profile_version,
    }).execute()

    return profile.model_dump(mode="json")


@app.get("/api/safety/profile")
def get_safety_profile(
    user: dict = Depends(get_current_user),
) -> dict[str, _Any]:
    """Return the latest safety profile for the authenticated user."""
    from app.core.db import get_supabase

    sb = get_supabase()
    result = (
        sb.table("user_risk_profiles")
        .select("profile_json, risk_tier, consent_given, profile_version")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {"exists": False}
    row = result.data[0]
    return {
        "exists": True,
        "risk_tier": row["risk_tier"],
        "consent_given": row["consent_given"],
        "profile_version": row["profile_version"],
        "profile": row["profile_json"],
    }


# ── Session Plan ────────────────────────────────────────────────────────────

class SessionPlanRequest(_BM):
    flow_id: str = _F(description="Sequence / flow identifier")
    pose_ids: list[str] = _F(description="Ordered pose IDs for the session")


@app.post("/api/session/plan")
def create_session_plan(
    req: SessionPlanRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, _Any]:
    """Create a safety-filtered session plan."""
    from app.core.db import get_supabase
    from data.progression_service import ProgressionService

    user_id = user["id"]
    sb = get_supabase()

    # Load the user's latest profile
    profile_result = (
        sb.table("user_risk_profiles")
        .select("profile_json")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not profile_result.data:
        raise HTTPException(
            status_code=400,
            detail="No safety profile found. Complete the health questionnaire first.",
        )

    profile = UserRiskProfile(**profile_result.data[0]["profile_json"])

    # Build library lookup
    library = get_library()
    lookup = {p["pose_id"]: p for p in library}

    # Carry-over risk
    prog = ProgressionService()
    last_risk = prog.get_last_session_risk_score(user_id)

    plan = session_orchestrator.build_plan(
        profile=profile,
        flow_id=req.flow_id,
        requested_pose_ids=req.pose_ids,
        library_lookup=lookup,
        last_session_risk_score=last_risk,
    )

    # Persist session log (state=planned)
    sb.table("session_logs").insert({
        "id": plan.session_id,
        "user_id": user_id,
        "flow_id": plan.flow_id,
        "state": "planned",
        "session_plan_json": plan.model_dump(mode="json"),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return plan.model_dump(mode="json")


# ── Session State Updates ───────────────────────────────────────────────────

class SessionStateUpdate(_BM):
    state: str = _F(description="New state: started | completed | aborted")
    final_risk_score: int = _F(default=0, description="Final accumulated risk score")
    duration_seconds: int = _F(default=0, description="Total session duration")
    pose_attempts: list[dict] = _F(default_factory=list, description="Pose attempt summaries")
    risk_events: list[dict] = _F(default_factory=list, description="Risk events that occurred")


@app.patch("/api/session/{session_id}/state")
def update_session_state(
    session_id: str,
    update: SessionStateUpdate,
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Update session state (start, complete, abort) and persist logs."""
    from app.core.db import get_supabase

    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Update session log
    sb.table("session_logs").update({
        "state": update.state,
        "final_risk_score": update.final_risk_score,
        "duration_seconds": update.duration_seconds,
        "ended_at": now if update.state in ("completed", "aborted") else None,
    }).eq("id", session_id).execute()

    # Persist pose attempts
    for attempt in update.pose_attempts:
        sb.table("pose_attempt_logs").insert({
            "session_id": session_id,
            "pose_id": attempt.get("pose_id", ""),
            "peak_score": attempt.get("peak_score", 0),
            "avg_score": attempt.get("avg_score", 0),
            "completed": attempt.get("completed", False),
            "hold_seconds": attempt.get("hold_seconds", 0),
            "violations_json": attempt.get("violations", []),
            "llm_feedback": attempt.get("llm_feedback", ""),
        }).execute()

    # Persist risk events
    for event in update.risk_events:
        sb.table("risk_event_logs").insert({
            "session_id": session_id,
            "pose_id": event.get("pose_id", ""),
            "event_type": event.get("event_type", "warn"),
            "risk_score_at": event.get("risk_score_at", 0),
            "signals_json": event.get("signals", []),
            "reason": event.get("reason", ""),
        }).execute()

    return {"status": "ok"}


# ── Pain Check ──────────────────────────────────────────────────────────────

class PainCheckRequest(_BM):
    session_id: str
    pose_id: str = ""
    pain_level: str = _F(description="none | mild | moderate | severe")


@app.post("/api/session/pain-check")
def record_pain_check(
    req: PainCheckRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Record a pain check during a session."""
    from app.core.db import get_supabase

    sb = get_supabase()
    sb.table("pain_check_logs").insert({
        "session_id": req.session_id,
        "pose_id": req.pose_id,
        "pain_level": req.pain_level,
    }).execute()
    return {"status": "ok"}


# ── User Progression ────────────────────────────────────────────────────────

@app.get("/api/user/progression")
def user_progression(
    user: dict = Depends(get_current_user),
) -> dict[str, _Any]:
    """Return the user's practice progression summary."""
    from data.progression_service import ProgressionService

    prog = ProgressionService()
    return prog.get_user_progression(user["id"])
