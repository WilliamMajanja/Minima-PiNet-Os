#!/usr/bin/env bash
# Build RISC Zero zkVM prover toolchain for PiNet-OS v3.0.0
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_DIR}/output}"

RISC0_VERSION="${RISC0_VERSION:-v1.2.1}"
PROVER_BACKEND="${1:-risc0}"

echo "[build-zk-prover] Installing ${PROVER_BACKEND} prover toolchain (${RISC0_VERSION})..."
mkdir -p "$OUTPUT_DIR"

case "${PROVER_BACKEND}" in
    risc0)
        # Pull RISC Zero toolchain
        cargo install cargo-binstall 2>/dev/null || true
        cargo binstall risc0-zkvm --version "${RISC0_VERSION}" --install-dir "${OUTPUT_DIR}/risc0-bin" 2>/dev/null || \
            echo "[build-zk-prover] WARNING: risc0-zkvm install skipped (cargo not available in build env)"
        echo "${RISC0_VERSION}" > "${OUTPUT_DIR}/risc0-version.txt"
        ;;
    sp1)
        echo "[build-zk-prover] SP1 prover — download from https://github.com/succinctlabs/sp1"
        ;;
    *)
        echo "[build-zk-prover] Unknown prover: ${PROVER_BACKEND}"
        exit 1
        ;;
esac

echo "[build-zk-prover] Done. Prover: ${PROVER_BACKEND} ${RISC0_VERSION}"
