"""Settings persistence endpoints."""
from fastapi import APIRouter

from ..state import get_state, save_state

router = APIRouter()


@router.get("/settings")
async def get_settings():
    state = get_state()
    return state.settings.model_dump(by_alias=True)


@router.post("/settings")
async def update_settings(body: dict):
    state = get_state()
    for key, value in body.items():
        if hasattr(state.settings, key):
            setattr(state.settings, key, value)
        # Handle camelCase aliases
        alias_map = {"nodeAlias": "node_alias", "torEnabled": "tor_enabled"}
        if key in alias_map and hasattr(state.settings, alias_map[key]):
            setattr(state.settings, alias_map[key], value)
    save_state()
    return {"success": True}
