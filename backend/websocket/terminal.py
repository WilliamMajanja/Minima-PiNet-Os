"""WebSocket terminal handler using Python pty for real shell access."""
from __future__ import annotations

import asyncio
import fcntl
import logging
import os
import pty
import select
import signal
import struct
import termios

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_PTY_COLS = 500
MAX_PTY_ROWS = 200


@router.websocket("/ws")
async def websocket_terminal(websocket: WebSocket):
    """WebSocket endpoint providing a real PTY shell."""
    await websocket.accept()
    print("Terminal client connected")

    # Create PTY
    master_fd, slave_fd = pty.openpty()
    shell = os.environ.get("SHELL", "/bin/bash")
    env = {
        **os.environ,
        "TERM": "xterm-256color",
        "PS1": r"\u@\h:\w\$ ",
    }

    pid = os.fork()
    if pid == 0:
        # Child process
        os.close(master_fd)
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(slave_fd)
        os.execvpe(shell, [shell], env)

    # Parent process
    os.close(slave_fd)

    # Set master_fd to non-blocking
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    async def read_pty():
        """Read from PTY and send to WebSocket."""
        asyncio.get_event_loop()
        try:
            while True:
                await asyncio.sleep(0.01)
                try:
                    r, _, _ = select.select([master_fd], [], [], 0)
                    if r:
                        data = os.read(master_fd, 4096)
                        if data:
                            import json
                            await websocket.send_text(json.dumps({"type": "output", "data": data.decode("utf-8", errors="replace")}))
                except OSError:
                    break
        except (WebSocketDisconnect, Exception):
            logger.debug("PTY read loop ended", exc_info=True)

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            import json
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "input":
                    os.write(master_fd, msg["data"].encode("utf-8"))
                elif msg.get("type") == "resize":
                    cols = max(1, min(MAX_PTY_COLS, int(msg.get("cols", 80))))
                    rows = max(1, min(MAX_PTY_ROWS, int(msg.get("rows", 24))))
                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
            except (json.JSONDecodeError, KeyError, ValueError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        read_task.cancel()
        os.close(master_fd)
        try:
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, 0)
        except Exception:
            logger.debug("Failed to clean up terminal child process", exc_info=True)
        print("Terminal client disconnected")
