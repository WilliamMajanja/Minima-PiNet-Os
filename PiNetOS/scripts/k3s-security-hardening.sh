#!/bin/bash
# =============================================================================
# K3s Security Hardening — PiNet Cluster
# =============================================================================
# Applies firewall rules, tightens K3s configuration, and enforces security
# best practices for Raspberry Pi 5 nodes in the PiNet cluster.
#
# Usage:
#   sudo bash k3s-security-hardening.sh [server|agent]
#
# Run after K3s is installed.  Re-running is safe (idempotent).
# =============================================================================
set -euo pipefail

NODE_ROLE="${1:-agent}"   # server = control-plane, agent = worker

log()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] ERROR: $*" >&2; }
die()  { err "$*"; exit 1; }

[[ "$(id -u)" -eq 0 ]] || die "Must be run as root"

# ---------------------------------------------------------------------------
# 1. iptables / netfilter rules
# ---------------------------------------------------------------------------
configure_firewall() {
  log "Configuring iptables rules for K3s…"

  # Back up existing rules before making any changes
  local backup_file="/etc/iptables/rules.v4.pre-k3s-hardening.$(date +%Y%m%d%H%M%S)"
  mkdir -p /etc/iptables
  if iptables-save > "$backup_file" 2>/dev/null; then
    log "Existing iptables rules backed up to $backup_file"
  else
    log "Could not back up iptables rules (may not be installed yet)"
  fi

  # Flush existing rules — backup has been taken above
  iptables -F INPUT   2>/dev/null || true
  iptables -F FORWARD 2>/dev/null || true

  # Default policies
  iptables -P INPUT   DROP
  iptables -P FORWARD DROP
  iptables -P OUTPUT  ACCEPT

  # Allow established / related traffic
  iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

  # Loopback
  iptables -A INPUT -i lo -j ACCEPT

  # SSH (preserve remote access)
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT

  # K3s API server (control-plane only)
  if [[ "$NODE_ROLE" == "server" ]]; then
    iptables -A INPUT -p tcp --dport 6443 -j ACCEPT   # Kubernetes API
    iptables -A INPUT -p tcp --dport 2379 -j ACCEPT   # etcd client
    iptables -A INPUT -p tcp --dport 2380 -j ACCEPT   # etcd peer
  fi

  # K3s required ports (all nodes)
  iptables -A INPUT -p tcp --dport 10250 -j ACCEPT    # kubelet metrics
  iptables -A INPUT -p tcp --dport 9191  -j ACCEPT    # PiNet health monitor
  iptables -A INPUT -p udp --dport 8472  -j ACCEPT    # VXLAN (flannel)
  iptables -A INPUT -p udp --dport 51820 -j ACCEPT    # WireGuard (if enabled)

  # Allow all pod-to-pod traffic within the cluster network (flannel default)
  iptables -A FORWARD -s 10.42.0.0/16 -j ACCEPT
  iptables -A FORWARD -d 10.42.0.0/16 -j ACCEPT

  # Persist rules
  if command -v iptables-save >/dev/null 2>&1; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
    iptables-save > /etc/iptables.rules 2>/dev/null || true
  fi

  log "Firewall rules applied."
}

# ---------------------------------------------------------------------------
# 2. K3s configuration hardening
# ---------------------------------------------------------------------------
harden_k3s_config() {
  log "Hardening K3s configuration…"

  mkdir -p /etc/rancher/k3s

  if [[ "$NODE_ROLE" == "server" ]]; then
    cat > /etc/rancher/k3s/config.yaml <<'CFG'
# K3s server hardening configuration
kube-apiserver-arg:
  - "anonymous-auth=false"
  - "audit-log-path=/var/log/k3s-audit.log"
  - "audit-log-maxsize=100"
  - "audit-log-maxbackup=5"
  - "audit-log-maxage=30"
  - "enable-admission-plugins=NodeRestriction,PodSecurity"
  - "tls-min-version=VersionTLS12"
kube-controller-manager-arg:
  - "terminated-pod-gc-threshold=10"
kubelet-arg:
  - "protect-kernel-defaults=true"
  - "streaming-connection-idle-timeout=5m"
  - "make-iptables-util-chains=true"
write-kubeconfig-mode: "0600"
CFG
  else
    cat > /etc/rancher/k3s/config.yaml <<'CFG'
# K3s agent hardening configuration
kubelet-arg:
  - "protect-kernel-defaults=true"
  - "streaming-connection-idle-timeout=5m"
  - "make-iptables-util-chains=true"
CFG
  fi

  chmod 0600 /etc/rancher/k3s/config.yaml
  log "K3s config written to /etc/rancher/k3s/config.yaml"
}

# ---------------------------------------------------------------------------
# 3. File-system hardening
# ---------------------------------------------------------------------------
harden_filesystem() {
  log "Hardening file-system permissions…"

  # K3s data directory
  chmod -R o-rwx /var/lib/rancher 2>/dev/null || true

  # Kubeconfig must not be world-readable
  chmod 0600 /etc/rancher/k3s/k3s.yaml 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 4. Kernel hardening parameters
# ---------------------------------------------------------------------------
harden_kernel() {
  log "Applying kernel security parameters…"

  cat > /etc/sysctl.d/99-k3s-security.conf <<'SYSCTL'
# Disable IP forwarding for non-cluster traffic
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.default.send_redirects=0
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv4.conf.all.accept_source_route=0
net.ipv4.conf.all.log_martians=1
# Required for K3s networking
net.ipv4.ip_forward=1
net.bridge.bridge-nf-call-iptables=1
# Protect against SYN flood
net.ipv4.tcp_syncookies=1
SYSCTL

  sysctl --system >/dev/null 2>&1 || true
  log "Kernel parameters applied."
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
log "Starting K3s security hardening (role=$NODE_ROLE)…"

configure_firewall
harden_k3s_config
harden_filesystem
harden_kernel

log "Security hardening complete."
