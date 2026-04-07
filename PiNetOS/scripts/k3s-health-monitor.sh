#!/bin/bash
# =============================================================================
# K3s Health Monitor — PiNet Cluster
# =============================================================================
# Monitors K3s node and pod health, auto-remediates common failure conditions,
# and exposes a simple HTTP health endpoint for Prometheus scraping.
#
# Usage:
#   sudo bash k3s-health-monitor.sh
#
# Runs as a long-lived daemon; intended to be managed by the
# pinet-k3s-health.service systemd unit.
# =============================================================================
set -euo pipefail

KUBECTL="${KUBECTL:-kubectl}"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"   # seconds between health checks
HEALTH_PORT="${HEALTH_PORT:-9191}"       # port for the HTTP health endpoint
MAX_RESTART_ATTEMPTS=3

log()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }
err()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] ERROR: $*" >&2; }

# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------
check_k3s_service() {
  if ! systemctl is-active --quiet k3s 2>/dev/null && \
     ! systemctl is-active --quiet k3s-agent 2>/dev/null; then
    err "K3s service is not running — attempting restart"
    if systemctl is-active --quiet k3s 2>/dev/null; then
      systemctl restart k3s
    else
      systemctl restart k3s-agent
    fi
    return 1
  fi
  return 0
}

check_node_ready() {
  local not_ready
  not_ready="$($KUBECTL get nodes --no-headers 2>/dev/null | grep -v ' Ready' | grep -v 'NAME' || true)"
  if [[ -n "$not_ready" ]]; then
    err "Nodes not Ready: $not_ready"
    return 1
  fi
  return 0
}

check_system_pods() {
  local failed_pods
  failed_pods="$($KUBECTL get pods -A --no-headers 2>/dev/null \
    | awk '$4 ~ /^(Error|CrashLoopBackOff|OOMKilled|ImagePullBackOff|Pending)$/ {print $1"/"$2}' || true)"
  if [[ -n "$failed_pods" ]]; then
    err "Unhealthy pods detected:"
    echo "$failed_pods" | while read -r pod; do
      err "  - $pod"
    done
    return 1
  fi
  return 0
}

restart_failed_pods() {
  log "Attempting to delete/restart failed pods…"
  $KUBECTL get pods -A --no-headers 2>/dev/null \
    | awk '$4 ~ /^(Error|CrashLoopBackOff|OOMKilled)$/ {print "-n "$1" "$2}' \
    | while read -r args; do
        $KUBECTL delete pod $args --grace-period=0 2>/dev/null || true
      done
}

check_disk_pressure() {
  local usage
  usage="$(df /var/lib/rancher 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}' || echo 0)"
  if [[ "$usage" -gt 85 ]]; then
    err "Disk usage on /var/lib/rancher is ${usage}% — cleaning old container images"
    k3s crictl rmi --prune 2>/dev/null || true
  fi
}

check_memory_pressure() {
  local avail_mb
  avail_mb="$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo)"
  if [[ "$avail_mb" -lt 256 ]]; then
    err "Low memory: ${avail_mb}MB available — dropping caches"
    echo 1 > /proc/sys/vm/drop_caches
  fi
}

# ---------------------------------------------------------------------------
# Simple HTTP health endpoint (serves JSON on $HEALTH_PORT)
# ---------------------------------------------------------------------------
serve_health_endpoint() {
  local healthy=true
  check_k3s_service  >/dev/null 2>&1 || healthy=false
  check_node_ready   >/dev/null 2>&1 || healthy=false
  check_system_pods  >/dev/null 2>&1 || healthy=false

  local status="ok"
  $healthy || status="degraded"

  local response
  response="{\"status\":\"${status}\",\"node\":\"$(hostname)\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

  {
    printf "HTTP/1.1 200 OK\r\n"
    printf "Content-Type: application/json\r\n"
    printf "Content-Length: %d\r\n" "${#response}"
    printf "\r\n"
    printf "%s" "$response"
  } | nc -l -p "$HEALTH_PORT" -q 1 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Main monitoring loop
# ---------------------------------------------------------------------------
log "PiNet K3s Health Monitor starting (interval=${CHECK_INTERVAL}s, health-port=${HEALTH_PORT})"

failure_count=0
while true; do
  ok=true

  check_k3s_service  || ok=false
  check_node_ready   || ok=false
  check_system_pods  || { restart_failed_pods; ok=false; }
  check_disk_pressure
  check_memory_pressure

  if $ok; then
    log "All checks passed"
    failure_count=0
  else
    failure_count=$((failure_count + 1))
    err "Health check failed (consecutive failures: $failure_count)"
  fi

  # Background the health endpoint so it doesn't block the main loop
  serve_health_endpoint &

  sleep "$CHECK_INTERVAL"
done
