from __future__ import annotations

import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.models.contracts import EvaluateRequest, GeminiAlignmentResponse
from app.services.evaluator import AlignmentEvaluator

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
        "warrior pose": "Warrior II",
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/evaluate", response_model=GeminiAlignmentResponse)
def evaluate(req: EvaluateRequest) -> dict:
    landmarks = [lm.model_dump() for lm in req.landmarks]
    return evaluator.evaluate(
        client_id=req.client_id,
        expected_pose=req.expected_pose,
        user_level=req.user_level,
        landmarks=landmarks,
    )
