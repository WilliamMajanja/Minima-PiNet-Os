#!/bin/bash
# =============================================================================
# K3s Node Labelling — PiNet Cluster
# =============================================================================
# Applies the hardware-specific labels required for workload scheduling across
# the three PiNet cluster nodes.  Run this once after K3s is up on each node,
# or re-run to refresh/overwrite labels.
#
# Usage:
#   sudo bash k3s-node-label.sh [--all | --node <name>]
#
# The script detects the local hostname and applies the correct label set, or
# you can target a specific node remotely via --node.
# =============================================================================
set -euo pipefail

KUBECTL="${KUBECTL:-kubectl}"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }
err() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] ERROR: $*" >&2; }
die() { err "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Label definitions
# ---------------------------------------------------------------------------
declare -A NODE_LABELS
NODE_LABELS["pinet-alpha"]="storage=nvme pinet.io/role=control-plane"
NODE_LABELS["pinet-beta"]="storage=nvme pinet.io/role=worker"
NODE_LABELS["pinet-sigma"]="accelerator=hailo-10h pinet.io/role=ai-worker"
NODE_LABELS["pinet-rho"]="sensor=sense-hat pinet.io/role=sensor-worker"

declare -A NODE_TAINTS
NODE_TAINTS["pinet-sigma"]="accelerator=hailo-10h:NoSchedule"

label_node() {
  local node_name="$1"

  if [[ -z "${NODE_LABELS[$node_name]+x}" ]]; then
    die "Unknown node name: $node_name (expected pinet-alpha, pinet-beta, pinet-sigma, or pinet-rho)"
  fi

  log "Applying labels to node: $node_name"
  for label in ${NODE_LABELS[$node_name]}; do
    $KUBECTL label node "$node_name" "$label" --overwrite
    log "  + $label"
  done

  # Apply taints where defined
  if [[ -n "${NODE_TAINTS[$node_name]+x}" ]]; then
    log "Applying taint to node: $node_name"
    $KUBECTL taint node "$node_name" "${NODE_TAINTS[$node_name]}" --overwrite 2>/dev/null || true
    log "  ! ${NODE_TAINTS[$node_name]}"
  fi

  log "Labels and taints applied to $node_name:"
  $KUBECTL get node "$node_name" --show-labels
}

label_all_nodes() {
  for node in pinet-alpha pinet-beta pinet-sigma pinet-rho; do
    label_node "$node"
    echo
  done
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
ACTION="${1:---self}"

case "$ACTION" in
  --all)
    label_all_nodes
    ;;
  --node)
    [[ -n "${2:-}" ]] || die "Usage: $0 --node <node-name>"
    label_node "$2"
    ;;
  --self|-s)
    HOSTNAME_SHORT="$(hostname | cut -d. -f1)"
    label_node "$HOSTNAME_SHORT"
    ;;
  --help|-h)
    echo "Usage: $0 [--all | --node <name> | --self]"
    echo "  --all            Label all three PiNet nodes"
    echo "  --node <name>    Label a specific node by name"
    echo "  --self           Label the current node (default)"
    exit 0
    ;;
  *)
    die "Unknown option: $ACTION  (try --help)"
    ;;
esac
