#!/usr/bin/env bash
# Build confidential computing enclave base image for Arm CCA / RISC-V AP-TEE
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_DIR}/output}"

TEE_TYPE="${1:-cca}"
ENCLAVE_IMAGE="${OUTPUT_DIR}/enclave-${TEE_TYPE}-base.img"
ENCLAVE_SIZE_MB="${ENCLAVE_SIZE_MB:-256}"

echo "[build-enclave] Building ${TEE_TYPE} enclave base image..."
mkdir -p "$OUTPUT_DIR"

# Create sparse image
dd if=/dev/zero of="$ENCLAVE_IMAGE" bs=1M count=0 seek="${ENCLAVE_SIZE_MB}" status=none
echo "[build-enclave] Created ${ENCLAVE_IMAGE} (${ENCLAVE_SIZE_MB} MB)"

# Generate enclave measurement
MEASUREMENT=$(echo "${ENCLAVE_IMAGE}:${TEE_TYPE}:$(date -u +%s)" | sha256sum | cut -d' ' -f1)
echo "${MEASUREMENT}" > "${OUTPUT_DIR}/enclave-${TEE_TYPE}-measurement.sha256"

echo "[build-enclave] Measurement: ${MEASUREMENT}"
echo "[build-enclave] Done. Use 'enclave init --image ${ENCLAVE_IMAGE}' to deploy."
