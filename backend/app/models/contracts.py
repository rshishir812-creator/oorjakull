from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ExpectedPose = str
UserLevel = Literal["beginner", "intermediate", "advanced"]


class Landmark(BaseModel):
    x: float
    y: float
    z: float
    visibility: float = Field(ge=0.0, le=1.0)


class EvaluateRequest(BaseModel):
    client_id: str = Field(min_length=4)
    expected_pose: ExpectedPose
    user_level: UserLevel = "beginner"
    landmarks: list[Landmark] = Field(min_length=33, max_length=33)


class TTSRequest(BaseModel):
    """Request body for the text-to-speech endpoint."""
    text: str = Field(min_length=1, max_length=5000)
    gender: Literal["male", "female"] = "female"
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
    pitch: float = Field(default=0.0, ge=-20.0, le=20.0)


PoseMatch = Literal["aligned", "partially_aligned", "misaligned"]
Confidence = Literal["high", "medium", "low"]
FocusArea = Literal["front_knee", "back_leg", "arms", "torso", "hips", "balance", "none"]
Severity = Literal["minor", "moderate", "major"]


class Deviation(BaseModel):
    issue: str
    joint_or_area: str
    measured_value: float
    ideal_range: str
    severity: Severity


class GeminiAlignmentResponse(BaseModel):
    pose_match: PoseMatch
    confidence: Confidence
    primary_focus_area: FocusArea
    deviations: list[Deviation]
    correction_message: str
    score: int | None = Field(default=None, ge=0, le=100)
    correction_bullets: list[str] = Field(default_factory=list)
    positive_observation: str = ""
    breath_cue: str = ""
    safety_note: str | None = None
