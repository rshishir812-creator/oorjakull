from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass
from typing import Any

from app.ai.groq_client import GroqClient
from app.core.config import settings
from app.models.contracts import GeminiAlignmentResponse
from app.pose.biomechanics import Metrics, compute_metrics, compute_pose_score, metrics_distance, round_for_summary
from app.pose.templates import POSE_TEMPLATES
from app.utils.hash import stable_hash


_DIGITS_RE = re.compile(r"\d+(?:\.\d+)?")


def _strip_digits(text: str) -> str:
    # Keep this intentionally simple: users asked for plain-English feedback
    # without numbers/angles/ranges.
    t = _DIGITS_RE.sub("", text)
    t = t.replace("°", "")
    # Preserve newlines (formatting) but collapse repeated spaces/tabs.
    t = re.sub(r"[ \t]{2,}", " ", t).strip()
    return t


def _sanitize_alignment_response(resp: dict[str, Any]) -> dict[str, Any]:
    msg = resp.get("correction_message")
    if isinstance(msg, str):
        resp["correction_message"] = _strip_digits(msg)

    devs = resp.get("deviations")
    if isinstance(devs, list):
        for d in devs:
            if isinstance(d, dict):
                issue = d.get("issue")
                ideal = d.get("ideal_range")
                if isinstance(issue, str):
                    d["issue"] = _strip_digits(issue)
                if isinstance(ideal, str):
                    d["ideal_range"] = _strip_digits(ideal)

    # Sanitize new detailed feedback fields
    bullets = resp.get("correction_bullets")
    if isinstance(bullets, list):
        resp["correction_bullets"] = [_strip_digits(b) for b in bullets if isinstance(b, str)]

    positive = resp.get("positive_observation")
    if isinstance(positive, str):
        resp["positive_observation"] = _strip_digits(positive)

    breath = resp.get("breath_cue")
    if isinstance(breath, str):
        resp["breath_cue"] = _strip_digits(breath)

    safety = resp.get("safety_note")
    if isinstance(safety, str):
        resp["safety_note"] = _strip_digits(safety)

    return resp


def _compute_metric_status(metrics: Metrics, ideal_ranges: dict[str, str]) -> dict[str, dict[str, object]]:
    """For each metric, compute whether it's in_range or out_of_range with delta."""
    status: dict[str, dict[str, object]] = {}

    all_metrics = {**metrics.angles, **metrics.symmetry, **metrics.stability}

    for key, actual in all_metrics.items():
        if math.isnan(actual) or math.isinf(actual):
            status[key] = {"status": "unmeasurable", "actual": None}
            continue

        range_text = ideal_ranges.get(key)
        if not range_text:
            status[key] = {"status": "no_reference", "actual": round(actual, 1)}
            continue

        parts = range_text.split("-")
        if len(parts) != 2:
            status[key] = {"status": "no_reference", "actual": round(actual, 1)}
            continue

        try:
            lo = float(parts[0].strip())
            hi = float(parts[1].strip())
        except ValueError:
            status[key] = {"status": "no_reference", "actual": round(actual, 1)}
            continue

        lo, hi = min(lo, hi), max(lo, hi)

        if lo <= actual <= hi:
            status[key] = {"status": "in_range", "actual": round(actual, 1), "ideal": range_text}
        else:
            delta = min(abs(actual - lo), abs(actual - hi))
            status[key] = {
                "status": "out_of_range",
                "actual": round(actual, 1),
                "ideal": range_text,
                "delta": round(delta, 1),
                "direction": "too_low" if actual < lo else "too_high",
            }

    return status


@dataclass
class ClientState:
    last_metrics: Metrics | None = None
    last_metrics_ts: float = 0.0
    last_summary_hash: str | None = None
    last_gemini_call_ts: float = 0.0
    last_response: dict[str, Any] | None = None


class AlignmentEvaluator:
    def __init__(self) -> None:
        self._llm = GroqClient()
        self._state: dict[str, ClientState] = {}

    def evaluate(self, client_id: str, expected_pose: str, user_level: str, landmarks: list[dict[str, float]]) -> dict[str, Any]:
        now = time.time()
        state = self._state.get(client_id) or ClientState()

        metrics = compute_metrics(landmarks=landmarks, expected_pose=expected_pose)

        # Edge: low visibility
        if metrics.visibility_mean < 0.5:
            resp = {
                "pose_match": "misaligned",
                "confidence": "low",
                "primary_focus_area": "none",
                "deviations": [],
                "correction_message": "Ensure full body is visible.",
                "score": None,
                "correction_bullets": [],
                "positive_observation": "",
                "breath_cue": "",
                "safety_note": None,
            }
            state.last_metrics = metrics
            state.last_metrics_ts = now
            state.last_response = resp
            self._state[client_id] = state
            return resp

        # Note: avoid short-circuiting here; even if the student isn't fully in position,
        # we still want the LLM to provide concrete, instructor-style cues to get them into the pose.

        template = POSE_TEMPLATES.get(expected_pose)
        if template is not None:
            ideal_ranges = template.ideal_ranges
        else:
            fallback = POSE_TEMPLATES.get("Tadasana")
            ideal_ranges = fallback.ideal_ranges if fallback is not None else {}
        score = compute_pose_score(metrics, ideal_ranges)

        biomech_summary = {
            "expected_pose": expected_pose,
            **round_for_summary(metrics),
            "visibility_mean": round(metrics.visibility_mean, 2),
            "user_level": user_level,
            "ideal_ranges": ideal_ranges,
            "metric_status": _compute_metric_status(metrics, ideal_ranges),
        }

        summary_hash = stable_hash(biomech_summary)

        # Throttle <= 1/sec
        if state.last_response is not None and (now - state.last_gemini_call_ts) < settings.gemini_min_interval_s:
            state.last_metrics = metrics
            state.last_metrics_ts = now
            self._state[client_id] = state
            state.last_response["score"] = score
            return state.last_response

        # Don't re-call Gemini if unchanged within 3 seconds
        if (
            state.last_response is not None
            and state.last_summary_hash == summary_hash
            and (now - state.last_gemini_call_ts) < settings.gemini_unchanged_cooldown_s
        ):
            state.last_metrics = metrics
            state.last_metrics_ts = now
            self._state[client_id] = state
            state.last_response["score"] = score
            return state.last_response

        # Stability / significant change gating
        stable = False
        significant_change = False
        if state.last_metrics is not None:
            d = metrics_distance(metrics, state.last_metrics)
            significant_change = d >= settings.significant_delta_threshold
            stable = (d <= settings.stable_delta_threshold) and ((now - state.last_metrics_ts) >= settings.stable_window_s)

        if state.last_response is not None and not (stable or significant_change):
            state.last_metrics = metrics
            state.last_metrics_ts = now
            self._state[client_id] = state
            state.last_response["score"] = score
            return state.last_response

        # Call LLM (Groq)
        try:
            raw = self._llm.evaluate_alignment(biomech_summary)
            parsed = GeminiAlignmentResponse.model_validate(raw).model_dump()
            parsed = _sanitize_alignment_response(parsed)
        except Exception as e:
            msg = str(e)
            if "rate_limit" in msg.lower() or "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                correction = "Groq rate limit/quota exceeded. Please retry shortly."
            elif "GROQ_API_KEY is not set" in msg:
                correction = "Groq API key is missing. Set GROQ_API_KEY and retry."
            elif "decommission" in msg.lower() or "model" in msg.lower() and ("not found" in msg.lower() or "invalid" in msg.lower() or "does not exist" in msg.lower()):
                correction = "Groq model misconfigured. Set GROQ_MODEL (recommended: llama-3.3-70b-versatile) and retry."
            else:
                correction = "Analyzing alignment..."

            parsed = {
                "pose_match": "partially_aligned",
                "confidence": "low",
                "primary_focus_area": "none",
                "deviations": [],
                "correction_message": correction,
                "score": score,
                "correction_bullets": [],
                "positive_observation": "",
                "breath_cue": "",
                "safety_note": None,
            }

        parsed = _sanitize_alignment_response(parsed)
        parsed["score"] = score

        state.last_metrics = metrics
        state.last_metrics_ts = now
        state.last_summary_hash = summary_hash
        state.last_gemini_call_ts = now
        state.last_response = parsed
        self._state[client_id] = state
        return parsed
