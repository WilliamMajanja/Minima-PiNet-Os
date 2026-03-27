#!/bin/bash

set -euo pipefail

TARGET_OS="${1:-}"
MODE="${2:-}"

if [[ -z "${TARGET_OS}" ]]; then
  echo "Usage: $0 <pinet|raspbian|ubuntu|debian> [--stage-only]" >&2
  exit 64
fi

case "${TARGET_OS}" in
  pinet|raspbian|ubuntu|debian) ;;
  *)
    echo "Unsupported target OS: ${TARGET_OS}" >&2
    exit 64
    ;;
esac

REPO_ROOT="${PINET_REPO_ROOT:-}"
PINET_PROFILE_SOURCE="${PINET_SWITCH_PINET_PROFILE_DIR:-}"
PINET_ROOT_OVERRIDE="${PINET_SWITCH_PINET_ROOT:-}"

detect_boot_mount() {
  if [[ -n "${PINET_BOOT_MOUNT:-}" && -d "${PINET_BOOT_MOUNT}" ]]; then
    echo "${PINET_BOOT_MOUNT}"
    return 0
  fi

  local candidate
  for candidate in /boot/firmware /boot; do
    if [[ -d "${candidate}" && -f "${candidate}/config.txt" && -f "${candidate}/cmdline.txt" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

BOOT_MOUNT="$(detect_boot_mount || true)"
if [[ -z "${BOOT_MOUNT}" ]]; then
  echo "Unable to locate a writable Raspberry Pi boot mount with config.txt and cmdline.txt." >&2
  exit 72
fi

STATE_DIR="${PINET_SWITCH_STATE_DIR:-${BOOT_MOUNT}/pinet-switch}"
HOST_PROFILE_DIR="${PINET_SWITCH_HOST_PROFILE_DIR:-${STATE_DIR}/host-profile}"
PINET_PROFILE_DIR="${STATE_DIR}/pinet-profile"
PINET_STAGING_DIR="${STATE_DIR}/pinet-staging"
ACTIVE_PROFILE_FILE="${STATE_DIR}/active-profile"

mkdir -p "${STATE_DIR}"

ensure_repo_profile() {
  if [[ -n "${PINET_PROFILE_SOURCE}" ]]; then
    if [[ ! -d "${PINET_PROFILE_SOURCE}" ]]; then
      echo "Configured PiNet profile directory does not exist: ${PINET_PROFILE_SOURCE}" >&2
      exit 66
    fi
    rm -rf "${PINET_STAGING_DIR}"
    mkdir -p "${PINET_STAGING_DIR}"
    cp -a "${PINET_PROFILE_SOURCE}/." "${PINET_STAGING_DIR}/"
    return 0
  fi

  if [[ -z "${REPO_ROOT}" || ! -d "${REPO_ROOT}/boot" ]]; then
    echo "PINET_REPO_ROOT must point at the repository root so the PiNet boot profile can be staged." >&2
    exit 66
  fi

  rm -rf "${PINET_STAGING_DIR}"
  mkdir -p "${PINET_STAGING_DIR}"
  cp -a "${REPO_ROOT}/boot/." "${PINET_STAGING_DIR}/"
}

apply_root_override() {
  local cmdline_file="${1}/cmdline.txt"
  local root_override="${2}"

  if [[ -z "${root_override}" || ! -f "${cmdline_file}" ]]; then
    return 0
  fi

  python3 - "${cmdline_file}" "${root_override}" <<'PY'
import pathlib
import re
import sys

cmdline_path = pathlib.Path(sys.argv[1])
root_value = sys.argv[2]
content = cmdline_path.read_text(encoding='utf-8').strip()

if re.search(r'(^|\s)root=', content):
    content = re.sub(r'(^|\s)root=\S+', lambda m: f"{m.group(1)}root={root_value}", content, count=1)
else:
    content = f"{content} root={root_value}".strip()

cmdline_path.write_text(content + "\n", encoding='utf-8')
PY
}

snapshot_host_profile() {
  if [[ -f "${HOST_PROFILE_DIR}/config.txt" && -f "${HOST_PROFILE_DIR}/cmdline.txt" ]]; then
    return 0
  fi

  rm -rf "${HOST_PROFILE_DIR}"
  mkdir -p "${HOST_PROFILE_DIR}"
  (
    cd "${BOOT_MOUNT}"
    tar --exclude='./pinet-switch' -cf - .
  ) | (
    cd "${HOST_PROFILE_DIR}"
    tar -xf -
  )
}

stage_pinet_profile() {
  ensure_repo_profile
  apply_root_override "${PINET_STAGING_DIR}" "${PINET_ROOT_OVERRIDE}"
  rm -rf "${PINET_PROFILE_DIR}"
  mkdir -p "${PINET_PROFILE_DIR}"
  cp -a "${PINET_STAGING_DIR}/." "${PINET_PROFILE_DIR}/"
}

apply_profile() {
  local profile_dir="${1}"
  local label="${2}"

  if [[ ! -d "${profile_dir}" ]]; then
    echo "Boot profile directory not found: ${profile_dir}" >&2
    exit 66
  fi

  cp -a "${profile_dir}/." "${BOOT_MOUNT}/"
  printf '%s\n' "${label}" > "${ACTIVE_PROFILE_FILE}"
  sync
}

PROFILE_LABEL="host"
PROFILE_DIR="${HOST_PROFILE_DIR}"

if [[ "${TARGET_OS}" == "pinet" ]]; then
  snapshot_host_profile
  stage_pinet_profile
  PROFILE_LABEL="pinet"
  PROFILE_DIR="${PINET_PROFILE_DIR}"
else
  if [[ ! -f "${HOST_PROFILE_DIR}/config.txt" || ! -f "${HOST_PROFILE_DIR}/cmdline.txt" ]]; then
    echo "No host boot profile is available yet. Switch from your current OS into PiNet once first, or seed ${HOST_PROFILE_DIR} manually." >&2
    exit 65
  fi
fi

apply_profile "${PROFILE_DIR}" "${PROFILE_LABEL}"

printf 'boot_mount=%s\n' "${BOOT_MOUNT}"
printf 'state_dir=%s\n' "${STATE_DIR}"
printf 'profile_label=%s\n' "${PROFILE_LABEL}"
printf 'target_os=%s\n' "${TARGET_OS}"

if [[ "${MODE}" != "--stage-only" ]]; then
  systemctl reboot
fi
