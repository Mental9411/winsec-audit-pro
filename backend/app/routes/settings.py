import json
from fastapi import APIRouter
from pydantic import BaseModel

from ..utils import db

router = APIRouter()

DEFAULTS = {
    "theme": "Cyber",
    "notifications_enabled": True,
    "automatic_scans": False,
    "export_location": "",
    "ai_provider": "ollama",
    "ai_base_url": "http://localhost:11434",
    "ai_model": "llama3",
    "ai_api_key": "",  # never returned in GET response
}


class SettingsUpdate(BaseModel):
    theme: str | None = None
    notifications_enabled: bool | None = None
    automatic_scans: bool | None = None
    export_location: str | None = None
    ai_provider: str | None = None
    ai_base_url: str | None = None
    ai_model: str | None = None
    ai_api_key: str | None = None


@router.get("/settings")
def get_settings():
    stored = db.get_all_settings()
    merged = {**DEFAULTS, **stored}
    merged["notifications_enabled"] = str(merged["notifications_enabled"]).lower() == "true"
    merged["automatic_scans"] = str(merged["automatic_scans"]).lower() == "true"
    merged["ai_api_key_set"] = bool(merged.get("ai_api_key"))
    merged.pop("ai_api_key", None)  # never expose the raw key back to the client
    return merged


@router.put("/settings")
def update_settings(update: SettingsUpdate):
    data = update.model_dump(exclude_none=True)
    for key, value in data.items():
        db.set_setting(key, str(value))
    return get_settings()
