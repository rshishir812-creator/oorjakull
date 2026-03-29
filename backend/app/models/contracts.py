from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ExpectedPose = str
UserLevel = Literal["beginner", "intermediate", "advanced"]
BreathEffect = Literal["increase", "decrease", "steady"]
BreathAnimation = Literal["expand", "hold", "contract", "pulse"]


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
    # BCP-47 language code. Examples: en-IN, hi-IN, kn-IN
    language_code: str = Field(default="en-IN", pattern=r"^[a-z]{2}-[A-Z]{2}$")
    gender: Literal["male", "female"] = "female"
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
    pitch: float = Field(default=0.0, ge=-20.0, le=20.0)


class BreathworkEffects(BaseModel):
    hr: BreathEffect
    hrv: BreathEffect
    temperature: BreathEffect | None = None


class BreathworkPhase(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    duration_sec: int = Field(ge=0, le=3600)
    instruction: str = ""
    animation: BreathAnimation


class BreathworkProtocol(BaseModel):
    id: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=120)
    tagline: str = Field(min_length=2, max_length=160)
    duration_mins: int = Field(ge=1, le=180)
    description: str = Field(min_length=20, max_length=4000)
    origin: str = Field(min_length=10, max_length=500)
    benefits: list[str] = Field(min_length=1, max_length=8)
    effects: BreathworkEffects
    difficulty: Literal["beginner", "intermediate", "advanced"]
    phases: list[BreathworkPhase] = Field(min_length=1, max_length=8)
    cycles: int = Field(ge=1, le=500)


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

    # ── Credit system fields (populated by the /api/evaluate endpoint) ───────
    credits_remaining: int | None = Field(default=None, description="Remaining credits (null = unlimited)")
    credits_exhausted: bool = Field(default=False, description="True if the user has 0 credits left")
    is_guest: bool = Field(default=False, description="True if the request was unauthenticated (guest)")

class AssistantMessage(BaseModel):
    """Represents a message in the conversation history."""
    role: Literal["user", "assistant"]
    content: str


class AssistantRequest(BaseModel):
    """Request body for the assistant endpoint."""
    message: str = Field(min_length=1, max_length=2000)
    messages: list[AssistantMessage] = Field(default_factory=list, max_length=20)


class ProductSuggestion(BaseModel):
    """An optional product cross-sell surfaced by Madhu alongside a reply."""
    type: Literal["breathwork", "pose"]
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=300)


class AssistantResponse(BaseModel):
    """Response body from the assistant endpoint."""
    reply: str
    suggestion: ProductSuggestion | None = None