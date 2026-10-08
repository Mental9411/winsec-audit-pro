from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..utils import db, ai_assistant

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


def _get_ai_provider_config():
    settings = db.get_all_settings()
    provider = settings.get("ai_provider", "ollama")
    config = {
        "base_url": settings.get("ai_base_url", "http://localhost:11434"),
        "model": settings.get("ai_model", "llama3"),
        "api_key": settings.get("ai_api_key", ""),
    }
    return provider, config


@router.post("/ai/chat")
async def ai_chat(req: ChatRequest):
    provider, config = _get_ai_provider_config()
    scan = db.latest_completed_scan()
    scan_context = ai_assistant.build_context_message(scan)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        reply = await ai_assistant.chat(provider, config, messages, scan_context)
    except ai_assistant.AIError as e:
        raise HTTPException(502, str(e))

    return {"reply": reply}


@router.get("/ai/status")
async def ai_status():
    """Lightweight connectivity check for the configured AI provider -
    used by the Settings 'Test Connection' button and the AI Assistant
    page's readiness banner, without spending a real chat completion."""
    provider, config = _get_ai_provider_config()
    result = await ai_assistant.check_status(provider, config)
    return {"provider": provider, **result}


@router.get("/ai/context")
def ai_context():
    scan = db.latest_completed_scan()
    return {"context": ai_assistant.build_context_message(scan)}
