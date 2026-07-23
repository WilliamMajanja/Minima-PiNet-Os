#!/bin/sh
# PiNet-OS Runtime Library
# Shared functions for PiNet-OS lifecycle management
# POSIX-compatible — works on any Linux distro on Raspberry Pi 5

detect_pinet_version() {
  for _candidate in \
    "${PINET_VERSION_FILE:-}" \
    "${PINET_PROJECT_DIR:-}/package.json"
  do
    [ -n "$_candidate" ] || continue
    [ -f "$_candidate" ] || continue

    case "$_candidate" in
      *.json)
        if command -v python3 >/dev/null 2>&1; then
          _version="$(python3 - "$_candidate" <<'PY'
import json
import sys
from pathlib import Path

try:
    print(json.loads(Path(sys.argv[1]).read_text()).get("version", ""))
except Exception:
    print("")
PY
)"
        else
          _version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_candidate" | head -1)"
        fi
        ;;
      *)
        _version="$(head -1 "$_candidate" | tr -d '\r')"
        ;;
    esac

    if [ -n "$_version" ]; then
      printf "%s" "$_version"
      return 0
    fi
  done

  printf "unknown"
}

PINET_HOME="${PINET_HOME:-$HOME/.pinet}"
PINET_VERSION="${PINET_VERSION:-$(detect_pinet_version)}"

# Minima port layout: base port (default 9001) = P2P, base+4 = RPC
# PiNet-OS connects to the RPC port for all command communication.
PINET_MINIMA_P2P_PORT="${PINET_MINIMA_P2P_PORT:-9001}"
PINET_MINIMA_RPC_PORT="${PINET_MINIMA_RPC_PORT:-$((PINET_MINIMA_P2P_PORT + 4))}"
PINET_MINIMA_RPC_URL="${PINET_MINIMA_RPC_URL:-http://127.0.0.1:$PINET_MINIMA_RPC_PORT}"
PINET_DESKTOP_PORT="${PINET_DESKTOP_PORT:-3000}"
PINET_CLUSTER_API_PORT="${PINET_CLUSTER_API_PORT:-9090}"
PINET_MINIMA_JAR="${PINET_MINIMA_JAR:-$PINET_HOME/bin/minima.jar}"
PINET_MINIMA_VERSION="${PINET_MINIMA_VERSION:-1.0.49-cpip}"
PINET_PID_FILE="$PINET_HOME/pinet.pid"
PINET_LOG_DIR="$PINET_HOME/logs"
PINET_STATE_DIR="$PINET_HOME/state"
PINET_CONFIG_FILE="$PINET_HOME/config.json"
PINET_RUNTIME_SERVICES="${PINET_RUNTIME_SERVICES:-desktop minima cluster-manager}"

# ─── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

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
  "minimaVersion": "$PINET_MINIMA_VERSION",
  "ports": {
    "minimaP2P": $PINET_MINIMA_P2P_PORT,
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

check_python() {
  if command -v python3 >/dev/null 2>&1; then
    _python_ver=$(python3 --version 2>/dev/null)
    log_ok "Python found: $_python_ver"
    return 0
  else
    log_error "Python3 not found. Web desktop requires Python 3.11+."
    log_info "Install with: sudo apt install -y python3 python3-pip"
    return 1
  fi
}

check_prerequisites() {
  _ok=0
  check_java  || _ok=1
  check_python || _ok=1

  if [ ! -f "$PINET_MINIMA_JAR" ]; then
    log_warn "Minima JAR not found at $PINET_MINIMA_JAR"
    log_info "Run 'pinet setup' to download and install Minima."
    _ok=1
  fi

  return $_ok
}

# ─── Process Management ───────────────────────────────────────────────────────

is_running() {
  for _service in $PINET_RUNTIME_SERVICES; do
    _service_pid_file="$PINET_HOME/${_service}.pid"
    if [ -f "$_service_pid_file" ]; then
      _service_pid=$(cat "$_service_pid_file" 2>/dev/null)
      if [ -n "$_service_pid" ] && kill -0 "$_service_pid" 2>/dev/null; then
        return 0
      fi
      rm -f "$_service_pid_file"
    fi
  done

  if [ -f "$PINET_PID_FILE" ]; then
    _pid=$(cat "$PINET_PID_FILE" 2>/dev/null)
    if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$PINET_PID_FILE"
  fi
  return 1
}

wait_for_port() {
  _port="$1"
  _timeout="${2:-30}"
  _elapsed=0
  while [ "$_elapsed" -lt "$_timeout" ]; do
    if command -v curl >/dev/null 2>&1; then
      curl -sf "http://127.0.0.1:$_port/" >/dev/null 2>&1 && return 0
      curl -skf "https://127.0.0.1:$_port/" >/dev/null 2>&1 && return 0
      curl -sf "http://127.0.0.1:$_port/status" >/dev/null 2>&1 && return 0
      curl -skf "https://127.0.0.1:$_port/status" >/dev/null 2>&1 && return 0
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O /dev/null "http://127.0.0.1:$_port/" 2>/dev/null && return 0
      wget -q -O /dev/null "https://127.0.0.1:$_port/" 2>/dev/null && return 0
    fi
    (echo > "/dev/tcp/127.0.0.1/$_port") 2>/dev/null && return 0
    sleep 1
    _elapsed=$((_elapsed + 1))
  done
  return 1
}

start_minima() {
  log_info "Starting Minima node (P2P port $PINET_MINIMA_P2P_PORT, RPC port $PINET_MINIMA_RPC_PORT)..."

  # Start CPIP security sidecar before Minima
  if [ "${CPIP_ENABLED:-1}" = "1" ]; then
    start_cpip_sidecar
  fi

  java -Xmx512m -jar "$PINET_MINIMA_JAR" \
    -data "$PINET_HOME/minima-data" \
    -port "$PINET_MINIMA_P2P_PORT" \
    -rpcenable \
    -mdsenable \
    > "$PINET_LOG_DIR/minima.log" 2>&1 &
  _minima_pid=$!
  echo "$_minima_pid" > "$PINET_HOME/minima.pid"

  log_info "Waiting for Minima RPC to become available on port $PINET_MINIMA_RPC_PORT..."
  if wait_for_port "$PINET_MINIMA_RPC_PORT" 120; then
    log_ok "Minima node started (PID: $_minima_pid)"
    return 0
  else
    log_warn "Minima RPC not responding yet — it may still be starting up"
    return 0
  fi
}

start_cpip_sidecar() {
  if [ -z "${CPIP_SERVER_PATH:-}" ]; then
    CPIP_SERVER_PATH="/opt/cpip/server.py"
  fi
  if [ ! -f "$CPIP_SERVER_PATH" ]; then
    log_warn "CPIP server not found at $CPIP_SERVER_PATH — security sidecar skipped"
    return 0
  fi
  _cpip_port="${CPIP_PORT:-4180}"
  # Check if CPIP is already running on the port
  if ss -tlnp 2>/dev/null | grep -q ":${_cpip_port} "; then
    log_ok "CPIP security sidecar already running on port $_cpip_port"
    return 0
  fi
  log_info "Starting CPIP security sidecar (port $_cpip_port)..."
  CPIP_PORT="$_cpip_port" \
  CPIP_DEFENSE_ENABLED="${CPIP_DEFENSE_ENABLED:-1}" \
  CPIP_COVERT_KEY="${CPIP_COVERT_KEY:-}" \
  CPIP_FIPS="${CPIP_FIPS:-0}" \
  python3 "$CPIP_SERVER_PATH" > "$PINET_LOG_DIR/cpip.log" 2>&1 &
  _cpip_pid=$!
  echo "$_cpip_pid" > "$PINET_HOME/cpip.pid"
  # Wait and check with both HTTP and HTTPS
  _elapsed=0
  while [ "$_elapsed" -lt 30 ]; do
    if curl -skf "https://127.0.0.1:$_cpip_port/" >/dev/null 2>&1 || \
       curl -sf "http://127.0.0.1:$_cpip_port/" >/dev/null 2>&1 || \
       (echo > "/dev/tcp/127.0.0.1/$_cpip_port") 2>/dev/null; then
      log_ok "CPIP security sidecar started (PID: $_cpip_pid, port $_cpip_port)"
      return 0
    fi
    sleep 1
    _elapsed=$((_elapsed + 1))
  done
  log_warn "CPIP sidecar not responding — continuing without it"
}

stop_cpip_sidecar() {
  if [ -f "$PINET_HOME/cpip.pid" ]; then
    _cpip_pid=$(cat "$PINET_HOME/cpip.pid" 2>/dev/null)
    if [ -n "$_cpip_pid" ] && kill -0 "$_cpip_pid" 2>/dev/null; then
      kill "$_cpip_pid" 2>/dev/null
      log_info "CPIP security sidecar stopped (PID: $_cpip_pid)"
    fi
    rm -f "$PINET_HOME/cpip.pid"
  fi
}

start_desktop() {
  if [ $# -gt 0 ] && [ -n "${1:-}" ]; then
    _desktop_dir="$1"
  elif [ -n "${PINET_DESKTOP_ROOT:-}" ]; then
    _desktop_dir="$PINET_DESKTOP_ROOT"
  elif [ -n "${PINET_PROJECT_DIR:-}" ]; then
    _desktop_dir="$PINET_PROJECT_DIR"
  else
    _desktop_dir="$(pwd)"
  fi
  log_info "Starting web desktop on port $PINET_DESKTOP_PORT..."

  cd "$_desktop_dir" 2>/dev/null || {
    log_error "Desktop directory not found: $_desktop_dir"
    return 1
  }

  PINET_MINIMA_RPC_URL="$PINET_MINIMA_RPC_URL" \
  PINET_HOME="$PINET_HOME" \
  PINET_DESKTOP_PORT="$PINET_DESKTOP_PORT" \
  python3 run.py > "$PINET_LOG_DIR/desktop.log" 2>&1 &
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
      _w=0
      while [ "$_w" -lt 10 ] && kill -0 "$_pid" 2>/dev/null; do
        sleep 1
        _w=$((_w + 1))
      done
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
  stop_cpip_sidecar
  rm -f "$PINET_PID_FILE"
  log_ok "All PiNet-OS services stopped."
}

# ─── Status ───────────────────────────────────────────────────────────────────

show_status() {
  printf "\n${WHITE}╔══════════════════════════════════════════════╗${NC}\n"
  printf "${WHITE}║       PiNet-OS v%s Status               ║${NC}\n" "$PINET_VERSION"
  printf "${WHITE}╚══════════════════════════════════════════════╝${NC}\n\n"

  _node_id=$(read_config_value "nodeId")
  _role=$(read_config_value "role")
  printf "  ${CYAN}Node ID:${NC}    %s\n" "${_node_id:-unknown}"
  printf "  ${CYAN}Role:${NC}       %s\n" "${_role:-unknown}"
  printf "  ${CYAN}Platform:${NC}   %s %s\n" "$(uname -s)" "$(uname -m)"

  if [ -f "$PINET_HOME/minima.pid" ] && kill -0 "$(cat "$PINET_HOME/minima.pid" 2>/dev/null)" 2>/dev/null; then
    printf "  ${GREEN}Minima:${NC}     ● Running (P2P %s / RPC %s)\n" "$PINET_MINIMA_P2P_PORT" "$PINET_MINIMA_RPC_PORT"
  else
    printf "  ${RED}Minima:${NC}     ○ Stopped\n"
  fi

  if [ -f "$PINET_HOME/desktop.pid" ] && kill -0 "$(cat "$PINET_HOME/desktop.pid" 2>/dev/null)" 2>/dev/null; then
    printf "  ${GREEN}Desktop:${NC}    ● Running (port %s)\n" "$PINET_DESKTOP_PORT"
  else
    printf "  ${RED}Desktop:${NC}    ○ Stopped\n"
  fi

  if [ -f "$PINET_STATE_DIR/cluster.json" ]; then
    printf "  ${CYAN}Cluster:${NC}    State file present\n"
  else
    printf "  ${YELLOW}Cluster:${NC}    Not joined\n"
  fi

  printf "\n"
}

# ─── Minima RPC Helpers ──────────────────────────────────────────────────────

minima_rpc() {
  _cmd="$1"
  _encoded_cmd=$(printf '%s' "$_cmd" | sed 's/ /%20/g; s/:/%3A/g')
  curl -sf "$PINET_MINIMA_RPC_URL/$_encoded_cmd" 2>/dev/null
}

maxima_send() {
  _to="$1"
  _app="$2"
  _data="$3"
  minima_rpc "maxima action:send to:$_to application:$_app data:$_data"
}

maxima_contacts() {
  minima_rpc "maxcontacts action:list"
}