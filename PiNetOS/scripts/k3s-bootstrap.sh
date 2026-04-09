#!/bin/bash
# =============================================================================
# K3s Bootstrap — PiNet Cluster
# =============================================================================
# Installs and configures K3s on a Raspberry Pi 5 node.
# Run as root.  Supports three roles: server (control-plane), agent (worker),
# and the three named nodes: pinet-alpha, pinet-sigma, pinet-rho.
#
# Usage:
#   sudo bash k3s-bootstrap.sh server          # Control-plane node (pinet-alpha)
#   sudo bash k3s-bootstrap.sh agent <server-ip> <join-token>  # Worker node
#   sudo bash k3s-bootstrap.sh label <role>    # Label the node after join
#
# Environment variables:
#   K3S_VERSION   — Pin a specific K3s release (default: latest stable)
#   KUBECONFIG    — Path to write the kubeconfig (default: /etc/rancher/k3s/k3s.yaml)
# =============================================================================
set -euo pipefail

K3S_VERSION="${K3S_VERSION:-}"
KUBECONFIG_PATH="/etc/rancher/k3s/k3s.yaml"
K3S_INSTALL_URL="https://get.k3s.io"

log()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] ERROR: $*" >&2; }
die()  { err "$*"; exit 1; }

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "This script must be run as root"
}

check_prereqs() {
  for cmd in curl iptables; do
    command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
  done
}

apply_pi_optimisations() {
  log "Applying Raspberry Pi 5 kernel/cgroup optimisations…"

  # Enable cgroups v2 (required for K3s resource management)
  local CMDLINE="/boot/firmware/cmdline.txt"
  if [[ -f "$CMDLINE" ]] && ! grep -q "cgroup_enable=cpuset" "$CMDLINE"; then
    sed -i 's/$/ cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory/' "$CMDLINE"
    log "Updated $CMDLINE with cgroup parameters (reboot required)"
  fi

  # Increase inotify limits for Kubernetes pod watchers
  cat > /etc/sysctl.d/99-k3s-pinet.conf <<'SYSCTL'
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
net.ipv4.ip_forward=1
net.bridge.bridge-nf-call-iptables=1
net.bridge.bridge-nf-call-ip6tables=1
SYSCTL
  sysctl --system >/dev/null 2>&1 || true

  # Load required kernel modules
  modprobe br_netfilter 2>/dev/null || true
  modprobe overlay       2>/dev/null || true
  cat > /etc/modules-load.d/k3s.conf <<'MODS'
br_netfilter
overlay
MODS
}

install_k3s_server() {
  log "Installing K3s server (control-plane)…"

  local install_args=(
    "--disable" "traefik"     # PiNet uses its own ingress
    "--disable" "servicelb"   # Lightweight; use MetalLB or node-port
    "--write-kubeconfig-mode" "0644"
    "--kube-apiserver-arg" "audit-log-path=/var/log/k3s-audit.log"
    "--kube-apiserver-arg" "audit-log-maxsize=100"
  )

  if [[ -n "$K3S_VERSION" ]]; then
    export INSTALL_K3S_VERSION="$K3S_VERSION"
  fi

  curl -sfL "$K3S_INSTALL_URL" | INSTALL_K3S_EXEC="${install_args[*]}" sh -

  log "K3s server installed.  Waiting for node to be ready…"
  local retries=0
  until k3s kubectl get nodes 2>/dev/null | grep -q " Ready"; do
    sleep 5
    retries=$((retries + 1))
    [[ $retries -lt 24 ]] || die "Timeout waiting for K3s node to become Ready"
  done

  log "Control-plane node is Ready."
  log "Join token:  $(cat /var/lib/rancher/k3s/server/node-token)"
  log "Kubeconfig:  $KUBECONFIG_PATH"
}

install_k3s_agent() {
  local server_ip="${1:-}"
  local join_token="${2:-}"

  [[ -n "$server_ip"   ]] || die "Usage: k3s-bootstrap.sh agent <server-ip> <join-token>"
  [[ -n "$join_token"  ]] || die "Usage: k3s-bootstrap.sh agent <server-ip> <join-token>"

  log "Installing K3s agent — joining server at $server_ip…"

  if [[ -n "$K3S_VERSION" ]]; then
    export INSTALL_K3S_VERSION="$K3S_VERSION"
  fi

  curl -sfL "$K3S_INSTALL_URL" | \
    K3S_URL="https://${server_ip}:6443" \
    K3S_TOKEN="$join_token" \
    sh -

  log "K3s agent installed and joined the cluster."
}

label_node() {
  local role="${1:-}"
  local hostname
  hostname="$(hostname)"

  case "$role" in
    pinet-alpha)
      log "Labelling $hostname as storage=nvme (control-plane / NVMe node)…"
      k3s kubectl label node "$hostname" storage=nvme --overwrite
      k3s kubectl label node "$hostname" pinet.io/role=control-plane --overwrite
      ;;
    pinet-beta)
      log "Labelling $hostname as storage=nvme (worker / NVMe node)…"
      k3s kubectl label node "$hostname" storage=nvme --overwrite
      k3s kubectl label node "$hostname" pinet.io/role=worker --overwrite
      ;;
    pinet-sigma)
      log "Labelling $hostname as accelerator=hailo-10h (AI worker)…"
      k3s kubectl label node "$hostname" accelerator=hailo-10h --overwrite
      k3s kubectl label node "$hostname" pinet.io/role=ai-worker --overwrite
      ;;
    pinet-rho)
      log "Labelling $hostname as sensor=sense-hat (sensor worker)…"
      k3s kubectl label node "$hostname" sensor=sense-hat --overwrite
      k3s kubectl label node "$hostname" pinet.io/role=sensor-worker --overwrite
      ;;
    *)
      die "Unknown role: $role — use pinet-alpha, pinet-beta, pinet-sigma, or pinet-rho"
      ;;
  esac

  log "Node labels applied."
  k3s kubectl get node "$hostname" --show-labels
}

# =============================================================================
# Entry point
# =============================================================================
require_root
check_prereqs

ACTION="${1:-help}"

case "$ACTION" in
  server)
    apply_pi_optimisations
    install_k3s_server
    label_node "pinet-alpha"
    log "Bootstrap complete.  Apply Kubernetes manifests with:"
    log "  kubectl apply -f k8s/"
    ;;
  agent)
    apply_pi_optimisations
    install_k3s_agent "${2:-}" "${3:-}"
    ;;
  label)
    label_node "${2:-}"
    ;;
  help|*)
    echo "Usage: $0 {server|agent <server-ip> <token>|label <role>}"
    echo "  server                 — Install K3s control-plane (run on pinet-alpha)"
    echo "  agent <ip> <token>     — Install K3s agent and join cluster"
    echo "  label <role>           — Label this node (pinet-alpha|pinet-beta|pinet-sigma|pinet-rho)"
    exit 0
    ;;
esac
