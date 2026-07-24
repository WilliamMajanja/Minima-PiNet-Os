"""User management endpoints."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException

from ..config import DEFAULT_SHELL, DEFAULT_UID, DEFAULT_USER, PASSWORD_MIN_LENGTH
from ..rate_limiter import auth_login_limiter, rate_limit_dependency

router = APIRouter()

# In-memory user store (in production, would use system PAM or database)
_users: dict[int, dict] = {
    DEFAULT_UID: {
        "uid": DEFAULT_UID,
        "username": DEFAULT_USER,
        "fullName": "Default Pi User",
        "shell": DEFAULT_SHELL,
        "home": f"/home/{DEFAULT_USER}",
        "groups": ["pi", "sudo", "audio", "video"],
        "sudoer": True,
        "createdAt": time.time(),
    }
}
_next_uid = DEFAULT_UID + 1
_sessions: list[dict] = []


@router.get("/users")
async def list_users():
    return {
        "users": list(_users.values()),
        "groups": list({g for u in _users.values() for g in u.get("groups", [])}),
        "sessions": _sessions,
    }


@router.get("/users/{uid}")
async def get_user(uid: int):
    user = _users.get(uid)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.post("/users")
async def create_user(body: dict):
    global _next_uid
    username = body.get("username", "")
    full_name = body.get("fullName", "")
    password = body.get("password", "")
    shell = body.get("shell", DEFAULT_SHELL)
    groups = body.get("groups", [])
    sudoer = body.get("sudoer", False)

    if not username or not full_name or not password:
        raise HTTPException(400, "Missing required fields")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(400, f"Password must be at least {PASSWORD_MIN_LENGTH} characters")

    # Check duplicates
    if any(u["username"] == username for u in _users.values()):
        raise HTTPException(409, "User already exists")

    uid = _next_uid
    _next_uid += 1
    user = {
        "uid": uid,
        "username": username,
        "fullName": full_name,
        "shell": shell,
        "home": f"/home/{username}",
        "groups": groups if isinstance(groups, list) else [],
        "sudoer": bool(sudoer),
        "createdAt": time.time(),
    }
    _users[uid] = user
    return {"success": True, "user": user}


@router.delete("/users/{uid}")
async def delete_user(uid: int):
    if uid not in _users:
        raise HTTPException(404, "User not found")
    del _users[uid]
    return {"success": True}


@router.post("/auth/login", dependencies=[Depends(rate_limit_dependency(auth_login_limiter))])
async def login(body: dict):
    username = body.get("username", "")
    password = body.get("password", "")
    if not username or not password:
        raise HTTPException(400, "Missing credentials")
    user = next((u for u in _users.values() if u["username"] == username), None)
    if not user:
        return {"success": False, "error": "Invalid credentials"}
    # Simplified auth — in production, use proper password hashing
    session = {"uid": user["uid"], "username": username, "loginAt": time.time()}
    _sessions.append(session)
    return {"success": True, "session": session}
