#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION="${1:-$(python3 - <<'PY'
import json
from pathlib import Path
print(json.loads(Path("package.json").read_text())["version"])
PY
)}"
OVERLAY_DIR="$(mktemp -d /tmp/pinet-cli-overlay-XXXXXX)"
PINET_HOME="$(mktemp -d /tmp/pinet-cli-home-XXXXXX)"
PINET_BIN="${OVERLAY_DIR}/usr/local/bin/pinet"

cleanup() {
    if [[ -x "${PINET_BIN}" ]]; then
        PINET_SYSTEM_ROOT="${OVERLAY_DIR}" PINET_HOME="${PINET_HOME}" "${PINET_BIN}" stop >/dev/null 2>&1 || true
    fi
    rm -rf "${OVERLAY_DIR}" "${PINET_HOME}"
}
trap cleanup EXIT

pick_port() {
    python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    if [[ "${haystack}" != *"${needle}"* ]]; then
        echo "Expected output to contain: ${needle}" >&2
        exit 1
    fi
}

assert_file() {
    local file="$1"
    [[ -f "${file}" ]] || {
        echo "Missing required file: ${file}" >&2
        exit 1
    }
}

cd "${PROJECT_ROOT}"
bash "${SCRIPT_DIR}/build-rootfs-overlay.sh" "${VERSION}" "${OVERLAY_DIR}" >/dev/null

assert_file "${OVERLAY_DIR}/usr/local/bin/pinet"
assert_file "${OVERLAY_DIR}/usr/local/bin/pinet-setup"
assert_file "${OVERLAY_DIR}/usr/local/lib/pinet-runtime.sh"
assert_file "${OVERLAY_DIR}/opt/pinet/desktop/run.py"

export PINET_SYSTEM_ROOT="${OVERLAY_DIR}"
export PINET_HOME
export PINET_DESKTOP_PORT="$(pick_port)"
export PINET_MINIMA_RPC_PORT="$(pick_port)"
export PINET_CLUSTER_API_PORT="$(pick_port)"

"${PINET_BIN}" help >/dev/null

status_json="$("${PINET_BIN}" status --json)"
assert_contains "${status_json}" '"running": false'
assert_contains "${status_json}" '"desktop": false'

if "${PINET_BIN}" start --role invalid >/dev/null 2>&1; then
    echo "Invalid role unexpectedly succeeded" >&2
    exit 1
else
    [[ $? -eq 2 ]] || {
        echo "Invalid role did not return exit code 2" >&2
        exit 1
    }
fi

if "${PINET_BIN}" join >/dev/null 2>&1; then
    echo "Join without master unexpectedly succeeded" >&2
    exit 1
else
    [[ $? -eq 2 ]] || {
        echo "Join without master did not return exit code 2" >&2
        exit 1
    }
fi

"${PINET_BIN}" start --role master >/dev/null
status_json="$("${PINET_BIN}" status --json)"
assert_contains "${status_json}" '"running": true'
assert_contains "${status_json}" '"desktop": true'
curl -fsS "http://127.0.0.1:${PINET_DESKTOP_PORT}/" >/dev/null

"${PINET_BIN}" start --role master >/dev/null
"${PINET_BIN}" stop >/dev/null

status_json="$("${PINET_BIN}" status --json)"
assert_contains "${status_json}" '"running": false'
assert_contains "${status_json}" '"desktop": false'

echo "PiNet CLI smoke test passed."
