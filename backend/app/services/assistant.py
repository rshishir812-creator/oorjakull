from __future__ import annotations

import json

from app.ai.groq_client import GroqClient
from app.core.config import settings
from app.models.contracts import AssistantResponse, ProductSuggestion


MADHU_SYSTEM_PROMPT = """
You are Madhu, a calm and knowledgeable wellness assistant embedded in a yoga and breathwork app called OorjaKull.

You help users with:
- Yoga pose guidance: form corrections, beginner modifications, pose sequencing, contraindications
- Breathwork protocols: technique explanations, when to use which protocol, physiological effects (HR, HRV, temperature)
- Session support: motivating users, answering mid-session questions, suggesting what to try next
- General wellness: sleep, stress, recovery, nervous system regulation — only where it intersects with yoga/breathwork

Tone: warm, grounding, expert but never clinical. Speak like a seasoned yoga teacher, not a chatbot.

Strict boundaries — you must refuse and redirect if the user asks about:
- Medical diagnosis, treatment, or medication
- Nutrition, diet plans, or supplements
- Mental health therapy or crisis support
- Anything unrelated to yoga, breathwork, or movement wellness

When refusing: be warm, acknowledge the question, explain you are focused on yoga and breathwork, and offer to help with something relevant instead.

Keep responses concise — 2 to 4 sentences unless the user explicitly asks for detail.
Never use bullet points unless the user asks for a list.
Never break character or reveal you are powered by an LLM.
If anyone asks your name, you are Madhu.

--- OUTPUT FORMAT ---
You MUST always respond with valid JSON only. No markdown, no backticks, no explanation outside the JSON.

Default (no suggestion):
{"reply": "your response here", "suggestion": null}

When a specific OorjaKull product naturally fits the conversation — include a suggestion. Only suggest when it genuinely adds value, not on every message.

For a yoga pose:
{"reply": "your response here", "suggestion": {"type": "pose", "id": "<pose_id>", "label": "Try <Pose Name>", "reason": "One sentence on why this pose fits right now."}}

For breathwork:
{"reply": "your response here", "suggestion": {"type": "breathwork", "id": "breathwork", "label": "Explore Breathwork", "reason": "One sentence on why a breathwork session would help right now."}}

Valid pose IDs (use exact spelling): Tadasana, Down Dog, Goddess, Plank, Warrior II, Ashwa Sanchalanasana, Hasta Uttanasana, Padahastasana, Pranamasana

Rules for suggestions:
- Only suggest a pose if the user is asking about that specific pose or a closely related one.
- Only suggest breathwork if the user mentions stress, anxiety, sleep, energy, focus, or nervous system regulation.
- Never suggest on greetings, simple factual questions, or when you already just made a suggestion in this conversation.
- The reason must be one short, specific, compelling sentence — not generic.
"""


class AssistantService:
    """Service for handling conversational requests using the Groq-powered Madhu assistant."""

    def __init__(self) -> None:
        self._llm = GroqClient()

    def generate_response(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> AssistantResponse:
        """
        Generate a response from Madhu given a user message and optional conversation history.

        Returns:
            AssistantResponse with reply text and optional product suggestion.
        """
        _fallback = AssistantResponse(reply="I'm having a moment of stillness — please try again shortly.")

        messages: list[dict[str, str]] = [
            {"role": "system", "content": MADHU_SYSTEM_PROMPT}
        ]

        if conversation_history:
            messages.extend(conversation_history[-10:])

        messages.append({"role": "user", "content": user_message})

        try:
            self._llm._ensure_client()
            resp = self._llm._client.chat.completions.create(
                model=settings.groq_model,
                temperature=0.7,
                response_format={"type": "json_object"},
                messages=messages,
            )

            raw = ""
            if resp and resp.choices:
                raw = (resp.choices[0].message.content or "").strip()

            if not raw:
                return _fallback

            # Parse JSON response
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return AssistantResponse(reply=raw or _fallback.reply)

            reply_text = (data.get("reply") or "").strip()
            if not reply_text:
                return _fallback

            suggestion: ProductSuggestion | None = None
            suggestion_data = data.get("suggestion")
            if suggestion_data and isinstance(suggestion_data, dict):
                try:
                    suggestion = ProductSuggestion(**suggestion_data)
                except Exception:
                    suggestion = None

            return AssistantResponse(reply=reply_text, suggestion=suggestion)

        except Exception as e:
            error_msg = str(e).lower()
            if "rate_limit" in error_msg or "429" in error_msg or "quota" in error_msg:
                return _fallback
            elif "groq_api_key" in error_msg:
                raise RuntimeError("GROQ_API_KEY is not set")
            else:
                print(f"Assistant error: {e}")
                return _fallback
                return "I'm having a moment of stillness — please try again shortly."
