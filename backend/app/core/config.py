from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


# Load optional backend/.env for local dev (does not override already-set env vars).
# Resolve relative to this file so it works whether you run from repo root or from backend/.
_BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend
_ENV_BACKEND = _BACKEND_DIR / ".env"
_ENV_REPO_ROOT = _BACKEND_DIR.parent / ".env"
load_dotenv(dotenv_path=_ENV_BACKEND, override=False)
load_dotenv(dotenv_path=_ENV_REPO_ROOT, override=False)


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value


def get_csv_env(name: str, default: list[str] | None = None) -> list[str]:
    raw = get_env(name)
    if raw is None:
        return default or []
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values if values else (default or [])


class Settings:
    groq_api_key: str | None = get_env("GROQ_API_KEY")
    groq_model: str = get_env("GROQ_MODEL", "llama-3.3-70b-versatile") or "llama-3.3-70b-versatile"
    groq_temperature: float = float(get_env("GROQ_TEMPERATURE", "0.3") or "0.3")

    gemini_api_key: str | None = get_env("GEMINI_API_KEY")
    gemini_model: str = get_env("GEMINI_MODEL", "gemini-2.5-pro") or "gemini-2.5-pro"
    gemini_temperature: float = float(get_env("GEMINI_TEMPERATURE", "0.3") or "0.3")

    # Google Cloud Text-to-Speech (consistent voice across all browsers)
    google_tts_api_key: str | None = get_env("GOOGLE_TTS_API_KEY") or get_env("GEMINI_API_KEY")

    # Google Cloud Translate v2 (REST API key)
    google_translate_api_key: str | None = get_env("GOOGLE_TRANSLATE_API_KEY")

    # Performance constraints
    gemini_min_interval_s: float = float(get_env("GEMINI_MIN_INTERVAL_S", "1.0") or "1.0")
    gemini_unchanged_cooldown_s: float = float(get_env("GEMINI_UNCHANGED_COOLDOWN_S", "3.0") or "3.0")

    # Stability gating
    stable_window_s: float = float(get_env("STABLE_WINDOW_S", "0.5") or "0.5")
    stable_delta_threshold: float = float(get_env("STABLE_DELTA_THRESHOLD", "3.0") or "3.0")
    significant_delta_threshold: float = float(get_env("SIGNIFICANT_DELTA_THRESHOLD", "8.0") or "8.0")

    # Supabase
    supabase_url: str | None = get_env("SUPABASE_URL")
    supabase_service_key: str | None = get_env("SUPABASE_SERVICE_KEY")

    # Google OAuth (for backend JWT verification)
    # Accept both GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID (Vercel shares frontend vars)
    google_client_id: str | None = get_env("GOOGLE_CLIENT_ID") or get_env("VITE_GOOGLE_CLIENT_ID")

    # CORS
    cors_origins: list[str] = get_csv_env(
        "CORS_ORIGINS",
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "capacitor://localhost",
            "https://localhost",
            "https://oorjakull-six.vercel.app",
            "https://oorjakull.com",
            "https://www.oorjakull.com",
        ],
    )


settings = Settings()
