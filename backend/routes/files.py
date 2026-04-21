"""File system endpoints with path traversal protection."""
from __future__ import annotations

from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import FILES_ROOT
from ..rate_limiter import (
    fs_read_limiter,
    fs_write_limiter,
    rate_limit_dependency,
)

router = APIRouter()

_files_root = Path(FILES_ROOT).resolve()


def _safe_relative_parts(requested: str) -> tuple[str, ...]:
    if not isinstance(requested, str):
        raise HTTPException(400, "Path must be a string")
    normalized = requested.replace("\\", "/")
    rel = PurePosixPath(normalized)
    if rel.is_absolute():
        raise HTTPException(403, "Access denied: absolute paths are not allowed")
    parts = tuple(p for p in rel.parts if p not in ("", "."))
    if any(p == ".." for p in parts):
        raise HTTPException(403, "Access denied: path traversal detected")
    return parts


def _safe_resolve(requested: str) -> Path:
    """Build a safe path under FILES_ROOT without allowing traversal."""
    parts = _safe_relative_parts(requested)
    current = _files_root
    for part in parts[:-1]:
        current = current / part
        if current.exists() and current.is_symlink():
            raise HTTPException(403, "Access denied: symlink traversal is not allowed")
    target = _files_root.joinpath(*parts)
    if target.exists() and target.is_symlink():
        resolved_target = target.resolve()
        try:
            resolved_target.relative_to(_files_root)
        except ValueError:
            raise HTTPException(403, "Access denied: symlink traversal is not allowed")
    return target


def _safe_resolve_delete(requested: str) -> Path:
    """Resolve a path for deletion — also prevents deleting root."""
    resolved = _safe_resolve(requested)
    if resolved == _files_root:
        raise HTTPException(403, "Access denied: refusing to delete the root directory")
    return resolved


@router.get("/files/list")
async def list_files(path: str = Query(default="")):
    dir_path = path or ""
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
