"""File system endpoints with path traversal protection."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import FILES_ROOT
from ..rate_limiter import (
    fs_read_limiter,
    fs_write_limiter,
    rate_limit_dependency,
)

router = APIRouter()

_files_root = Path(FILES_ROOT).resolve()


def _ensure_within_root(path: Path) -> Path:
    """Ensure a resolved path is within FILES_ROOT."""
    try:
        path.relative_to(_files_root)
    except ValueError:
        raise HTTPException(403, "Access denied: path is outside the allowed directory")
    return path


def _safe_resolve(requested: str) -> Path:
    """Resolve a path, ensuring it is within FILES_ROOT."""
    requested_path = Path(requested)
    resolved = (requested_path if requested_path.is_absolute() else (_files_root / requested_path)).resolve()
    return _ensure_within_root(resolved)


def _safe_resolve_delete(requested: str) -> Path:
    """Resolve a path for deletion — also prevents deleting root."""
    resolved = _safe_resolve(requested)
    if resolved == _files_root:
        raise HTTPException(403, "Access denied: refusing to delete the root directory")
    return resolved


@router.get("/files/list")
async def list_files(path: str = Query(default="")):
    dir_path = path or str(_files_root)
    try:
        abs_path = _safe_resolve(dir_path)
        items = []
        for entry in abs_path.iterdir():
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "type": "dir" if entry.is_dir() else "file",
                "size": stat.st_size,
                "modified": stat.st_mtime * 1000,
                "permissions": "rw-r--r--",
            })
        return items
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.get("/files/read", dependencies=[Depends(rate_limit_dependency(fs_read_limiter))])
async def read_file(path: str = Query(...)):
    try:
        content = _safe_resolve(path).read_text(encoding="utf-8")
        return {"content": content}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.post("/files/write", dependencies=[Depends(rate_limit_dependency(fs_write_limiter))])
async def write_file(body: dict):
    file_path = body.get("path", "")
    content = body.get("content", "")
    if not file_path:
        raise HTTPException(400, "Path required")
    try:
        _safe_resolve(file_path).write_text(content, encoding="utf-8")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@router.delete("/files/delete", dependencies=[Depends(rate_limit_dependency(fs_write_limiter))])
async def delete_file(path: str = Query(...)):
    try:
        abs_path = _safe_resolve_delete(path)
        if abs_path.is_dir():
            raise HTTPException(400, "Directory deletion is not allowed via this endpoint")
        abs_path.unlink()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))
