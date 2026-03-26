#!/bin/sh
# PiNet-OS Runtime Library
# Shared functions for PiNet-OS lifecycle management
# POSIX-compatible — works on any Linux distro on Raspberry Pi 5

PINET_HOME="${PINET_HOME:-$HOME/.pinet}"
PINET_VERSION="3.0.0"
PINET_MINIMA_RPC_PORT="${PINET_MINIMA_RPC_PORT:-9001}"
PINET_DESKTOP_PORT="${PINET_DESKTOP_PORT:-3000}"
PINET_CLUSTER_API_PORT="${PINET_CLUSTER_API_PORT:-9090}"
PINET_MINIMA_JAR="${PINET_MINIMA_JAR:-$PINET_HOME/bin/minima.jar}"
PINET_PID_FILE="$PINET_HOME/pinet.pid"
PINET_LOG_DIR="$PINET_HOME/logs"
PINET_STATE_DIR="$PINET_HOME/state"
PINET_CONFIG_FILE="$PINET_HOME/config.json"

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# ─── Logging ──────────────────────────────────────────────────────────────────

log_info()  { printf "${CYAN}[PiNet]${NC} %s\n" "$1"; }
log_ok()    { printf "${GREEN}[PiNet]${NC} %s\n" "$1"; }
log_warn()  { printf "${YELLOW}[PiNet]${NC} %s\n" "$1"; }
log_error() { printf "${RED}[PiNet]${NC} %s\n" "$1" >&2; }

# ─── Directory Setup ──────────────────────────────────────────────────────────

init_runtime_dirs() {
  mkdir -p "$PINET_HOME/bin"
  mkdir -p "$PINET_HOME/minima-data"
  mkdir -p "$PINET_LOG_DIR"
  mkdir -p "$PINET_STATE_DIR"
  mkdir -p "$PINET_HOME/modules"
}

# ─── Config Management ────────────────────────────────────────────────────────

generate_node_id() {
  # Generate a stable node ID from hostname + MAC address
  if command -v ip >/dev/null 2>&1; then
    _mac=$(ip link show 2>/dev/null | grep -m1 'link/ether' | awk '{print $2}' | tr -d ':')
  else
    _mac=$(cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' || echo "000000000000")
  fi
  _host=$(hostname 2>/dev/null || echo "pinet-node")
  printf "pinet-%s-%s" "$_host" "$(echo "$_mac" | tail -c 7)"
}

generate_config() {
  _role="${1:-worker}"
  _master_addr="${2:-}"
  _node_id=$(generate_node_id)

  cat > "$PINET_CONFIG_FILE" << CONFIGEOF
{
  "version": "$PINET_VERSION",
  "nodeId": "$_node_id",
  "role": "$_role",
  "masterAddress": "$_master_addr",
  "ports": {
    "minimaRpc": $PINET_MINIMA_RPC_PORT,
    "desktop": $PINET_DESKTOP_PORT,
    "clusterApi": $PINET_CLUSTER_API_PORT
  },
  "maxima": {
    "application": "pinet-cluster",
    "heartbeatInterval": 10000,
    "heartbeatTimeout": 30000,
    "nodeOfflineTimeout": 60000
  },
  "provenance": {
    "enabled": true,
    "batchInterval": 60000,
    "burnAmount": "0.001"
  },
  "connectivity": {
    "wireguard": false,
    "meshEnabled": false,
    "fallback2g": false
  },
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
CONFIGEOF
  log_ok "Configuration generated: $PINET_CONFIG_FILE"
}

read_config_value() {
  # Simple JSON value reader (no jq dependency)
  _key="$1"
  if [ -f "$PINET_CONFIG_FILE" ]; then
    grep "\"$_key\"" "$PINET_CONFIG_FILE" | head -1 | sed 's/.*: *"\{0,1\}\([^",}]*\)"\{0,1\}.*/\1/'
  fi
}

# ─── Prerequisites Check ─────────────────────────────────────────────────────

check_java() {
  if command -v java >/dev/null 2>&1; then
    _java_ver=$(java -version 2>&1 | head -1)
    log_ok "Java found: $_java_ver"
    return 0
  else
    log_error "Java not found. Minima requires Java 17+."
    log_info "Install with: sudo apt install -y openjdk-17-jre-headless"
    return 1
  fi
}

check_node() {
  if command -v node >/dev/null 2>&1; then
    _node_ver=$(node --version 2>/dev/null)
    log_ok "Node.js found: $_node_ver"
    return 0
  else
    log_error "Node.js not found. Web desktop requires Node.js 18+."
    log_info "Install with: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    return 1
  fi
}

check_prerequisites() {
  _ok=0
  check_java  || _ok=1
  check_node  || _ok=1

  if [ ! -f "$PINET_MINIMA_JAR" ]; then
    log_warn "Minima JAR not found at $PINET_MINIMA_JAR"
    log_info "Run 'pinet setup' to download and install Minima."
    _ok=1
  fi

  return $_ok
}

# ─── Process Management ───────────────────────────────────────────────────────

is_running() {
  if [ -f "$PINET_PID_FILE" ]; then
    _pid=$(cat "$PINET_PID_FILE" 2>/dev/null)
    if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

wait_for_port() {
  _port="$1"
  _timeout="${2:-30}"
  _elapsed=0
  while [ "$_elapsed" -lt "$_timeout" ]; do
    if command -v curl >/dev/null 2>&1; then
      curl -s "http://127.0.0.1:$_port" >/dev/null 2>&1 && return 0
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O /dev/null "http://127.0.0.1:$_port" 2>/dev/null && return 0
    else
      # Fallback: try /dev/tcp if bash, or just sleep
      (echo > "/dev/tcp/127.0.0.1/$_port") 2>/dev/null && return 0
    fi
    sleep 1
    _elapsed=$((_elapsed + 1))
  done
  return 1
}

start_minima() {
  log_info "Starting Minima node on RPC port $PINET_MINIMA_RPC_PORT..."
  java -jar "$PINET_MINIMA_JAR" \
    -data "$PINET_HOME/minima-data" \
    -rpcenable -rpc "$PINET_MINIMA_RPC_PORT" \
    > "$PINET_LOG_DIR/minima.log" 2>&1 &
  _minima_pid=$!
  echo "$_minima_pid" > "$PINET_HOME/minima.pid"

  log_info "Waiting for Minima RPC to become available..."
  if wait_for_port "$PINET_MINIMA_RPC_PORT" 60; then
    log_ok "Minima node started (PID: $_minima_pid)"
    return 0
  else
    log_warn "Minima RPC not responding yet — it may still be starting up"
    return 0
  fi
}

start_desktop() {
  _desktop_dir="${1:-$(dirname "$(readlink -f "$0")")/..}"
  log_info "Starting web desktop on port $PINET_DESKTOP_PORT..."

  cd "$_desktop_dir" 2>/dev/null || {
    log_error "Desktop directory not found: $_desktop_dir"
    return 1
  }

  PINET_MINIMA_RPC_PORT="$PINET_MINIMA_RPC_PORT" \
  PINET_HOME="$PINET_HOME" \
  PORT="$PINET_DESKTOP_PORT" \
  node server.ts > "$PINET_LOG_DIR/desktop.log" 2>&1 &
  _desktop_pid=$!
  echo "$_desktop_pid" > "$PINET_HOME/desktop.pid"

  if wait_for_port "$PINET_DESKTOP_PORT" 30; then
    log_ok "Web desktop started (PID: $_desktop_pid)"
    log_ok "Access at: http://localhost:$PINET_DESKTOP_PORT"
    return 0
  else
    log_warn "Desktop server not responding yet — check logs at $PINET_LOG_DIR/desktop.log"
    return 0
  fi
}

stop_process() {
  _name="$1"
  _pidfile="$PINET_HOME/${_name}.pid"
  if [ -f "$_pidfile" ]; then
    _pid=$(cat "$_pidfile" 2>/dev/null)
    if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null; then
      log_info "Stopping $_name (PID: $_pid)..."
      kill "$_pid" 2>/dev/null
      # Wait up to 10 seconds for graceful shutdown
      _w=0
      while [ "$_w" -lt 10 ] && kill -0 "$_pid" 2>/dev/null; do
        sleep 1
        _w=$((_w + 1))
      done
      # Force kill if still running
      if kill -0 "$_pid" 2>/dev/null; then
        kill -9 "$_pid" 2>/dev/null
      fi
      log_ok "$_name stopped."
    fi
    rm -f "$_pidfile"
  fi
}

stop_all() {
  log_info "Stopping PiNet-OS services..."
  stop_process "desktop"
  stop_process "cluster-manager"
  stop_process "minima"
  rm -f "$PINET_PID_FILE"
  log_ok "All PiNet-OS services stopped."
}

# ─── Status ───────────────────────────────────────────────────────────────────

show_status() {
  printf "\n${WHITE}╔══════════════════════════════════════════════╗${NC}\n"
  printf "${WHITE}║       PiNet-OS v%s Status               ║${NC}\n" "$PINET_VERSION"
  printf "${WHITE}╚══════════════════════════════════════════════╝${NC}\n\n"

  # Node ID
  _node_id=$(read_config_value "nodeId")
  _role=$(read_config_value "role")
  printf "  ${CYAN}Node ID:${NC}    %s\n" "${_node_id:-unknown}"
  printf "  ${CYAN}Role:${NC}       %s\n" "${_role:-unknown}"
  printf "  ${CYAN}Platform:${NC}   %s %s\n" "$(uname -s)" "$(uname -m)"

  # Minima status
  if [ -f "$PINET_HOME/minima.pid" ] && kill -0 "$(cat "$PINET_HOME/minima.pid" 2>/dev/null)" 2>/dev/null; then
    printf "  ${GREEN}Minima:${NC}     ● Running (port %s)\n" "$PINET_MINIMA_RPC_PORT"
  else
    printf "  ${RED}Minima:${NC}     ○ Stopped\n"
  fi

  # Desktop status
  if [ -f "$PINET_HOME/desktop.pid" ] && kill -0 "$(cat "$PINET_HOME/desktop.pid" 2>/dev/null)" 2>/dev/null; then
    printf "  ${GREEN}Desktop:${NC}    ● Running (port %s)\n" "$PINET_DESKTOP_PORT"
  else
    printf "  ${RED}Desktop:${NC}    ○ Stopped\n"
  fi

  # Cluster info
  if [ -f "$PINET_STATE_DIR/cluster.json" ]; then
    printf "  ${CYAN}Cluster:${NC}    State file present\n"
  else
    printf "  ${YELLOW}Cluster:${NC}    Not joined\n"
  fi

  printf "\n"
}

# ─── Maxima Helpers ───────────────────────────────────────────────────────────

maxima_send() {
  _to="$1"
  _app="$2"
  _data="$3"

  if command -v curl >/dev/null 2>&1; then
    curl -s "http://127.0.0.1:$PINET_MINIMA_RPC_PORT/maxima+action:send+to:${_to}+application:${_app}+data:${_data}" 2>/dev/null
  fi
}

maxima_contacts() {
  if command -v curl >/dev/null 2>&1; then
    curl -s "http://127.0.0.1:$PINET_MINIMA_RPC_PORT/maxima+action:contacts" 2>/dev/null
  fi
}
