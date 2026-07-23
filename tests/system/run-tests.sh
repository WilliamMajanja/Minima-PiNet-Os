#!/usr/bin/env bash
# =============================================================================
# PiNetOS System Test Runner
# Tests hardware, services, networking, and HAL on all Raspberry Pi models
# (Pi 5, Pi 4, Pi 3, Pi 2, Pi 1, Pi Zero/Zero 2 W, Compute Module)
#
# Usage: ./tests/system/run-tests.sh [--suite SUITE] [--verbose]
# Suites: all, hardware, services, networking, hal, security
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${RESULTS_DIR:-/tmp/pinetos-test-results}"
VERBOSE="${VERBOSE:-false}"
SUITE="${SUITE:-all}"
PASS=0; FAIL=0; SKIP=0

# ---- Parse arguments --------------------------------------------------------
for arg in "$@"; do
    case "${arg}" in
        --verbose|-v) VERBOSE=true ;;
        --suite=*) SUITE="${arg#--suite=}" ;;
        --suite)
            shift 2>/dev/null || true
            SUITE="${1:-all}"
            ;;
    esac
done

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}✔${NC} $*"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✘${NC} $*"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}─${NC} $* (skipped)"; SKIP=$((SKIP + 1)); }
section() { echo -e "\n${BLUE}${BOLD}▶ $*${NC}"; }

mkdir -p "${RESULTS_DIR}"
LOG="${RESULTS_DIR}/test-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "${LOG}") 2>&1

# ---- Detect Pi Model --------------------------------------------------------
detect_pi_model() {
    local model=""
    if [ -f /proc/device-tree/model ]; then
        model=$(tr -d '\0' < /proc/device-tree/model)
    fi
    local model_lower=$(echo "$model" | tr '[:upper:]' '[:lower:]')

    if echo "$model_lower" | grep -q "pi 5\|bcm2712"; then
        echo "pi5"
    elif echo "$model_lower" | grep -q "pi 4\|bcm2711"; then
        echo "pi4"
    elif echo "$model_lower" | grep -q "pi 3\|bcm2837"; then
        echo "pi3"
    elif echo "$model_lower" | grep -q "pi 2\|bcm2836"; then
        echo "pi2"
    elif echo "$model_lower" | grep -q "zero 2\|zero2"; then
        echo "zero2w"
    elif echo "$model_lower" | grep -q "zero"; then
        echo "zero"
    elif echo "$model_lower" | grep -q "compute module 4\|cm4"; then
        echo "cm4"
    elif echo "$model_lower" | grep -q "compute module 3\|cm3"; then
        echo "cm3"
    elif echo "$model_lower" | grep -q "compute module"; then
        echo "cm"
    elif echo "$model_lower" | grep -q "pi 1\|model a\|model b"; then
        echo "pi1"
    elif [ -n "$model_lower" ]; then
        echo "pi"
    else
        echo "generic"
    fi
}

PI_MODEL=$(detect_pi_model)
PI_LABEL=""
case "$PI_MODEL" in
    pi5)     PI_LABEL="Raspberry Pi 5 (BCM2712 / ARM64)" ;;
    pi4)     PI_LABEL="Raspberry Pi 4 (BCM2711 / ARM64)" ;;
    pi3)     PI_LABEL="Raspberry Pi 3 (BCM2837 / ARM64)" ;;
    pi2)     PI_LABEL="Raspberry Pi 2 (BCM2836 / ARM32)" ;;
    pi1)     PI_LABEL="Raspberry Pi 1 (BCM2835 / ARM6)" ;;
    zero)    PI_LABEL="Raspberry Pi Zero (BCM2835 / ARM6)" ;;
    zero2w)  PI_LABEL="Raspberry Pi Zero 2 W (BCM2837 / ARM64)" ;;
    cm4)     PI_LABEL="Compute Module 4 (BCM2711 / ARM64)" ;;
    cm3)     PI_LABEL="Compute Module 3 (BCM2837 / ARM64)" ;;
    cm)      PI_LABEL="Compute Module" ;;
    pi)      PI_LABEL="Raspberry Pi (unknown model)" ;;
    *)       PI_LABEL="Generic Linux System" ;;
esac

MINIMA_P2P_PORT="${PINET_MINIMA_P2P_PORT:-9001}"
MINIMA_RPC_PORT="${PINET_MINIMA_RPC_PORT:-$((MINIMA_P2P_PORT + 4))}"

echo "=============================================="
echo " PiNetOS System Test Suite"
echo " Suite: ${SUITE}"
echo " Date:  $(date)"
echo " Host:  $(uname -n)"
echo " Arch:  $(uname -m)"
echo " Model: ${PI_LABEL}"
echo " Minima P2P: ${MINIMA_P2P_PORT}  RPC: ${MINIMA_RPC_PORT}"
echo "=============================================="

# =============================================================================
# SUITE: Hardware
# =============================================================================
test_hardware() {
    section "Hardware Tests (${PI_LABEL})"

    # CPU detection — supports all Pi SoCs
    if grep -q "Cortex-A76\|BCM2712" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2712 (Cortex-A76) — Raspberry Pi 5"
    elif grep -q "Cortex-A72\|BCM2711" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2711 (Cortex-A72) — Raspberry Pi 4 / CM4"
    elif grep -q "Cortex-A53\|BCM2837" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2837 (Cortex-A53) — Raspberry Pi 3 / Zero 2 W / CM3"
    elif grep -q "Cortex-A7\|BCM2836" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2836 (Cortex-A7) — Raspberry Pi 2"
    elif grep -q "ARMv6\|BCM2835" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2835 (ARMv6) — Raspberry Pi 1 / Zero / Zero W"
    elif [ -f /proc/device-tree/model ]; then
        local _m; _m=$(tr -d '\0' < /proc/device-tree/model)
        pass "CPU: ${_m} detected via device tree"
    else
        skip "CPU: Pi SoC not detected (may be running in VM/simulation)"
    fi

    # Memory — minimum depends on Pi model
    local mem_kb; mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
    local mem_gb; mem_gb=$(( mem_kb / 1024 / 1024 ))
    local min_mem_gb=1
    case "$PI_MODEL" in
        pi5|pi4) min_mem_gb=4 ;;
        pi3|zero2w|cm4) min_mem_gb=1 ;;
        pi2) min_mem_gb=1 ;;
        pi1|zero|cm3) min_mem_gb=0 ;;
    esac
    if [ "$min_mem_gb" -gt 0 ] && [ "$mem_gb" -ge "$min_mem_gb" ]; then
        pass "RAM: ${mem_gb} GB (≥ ${min_mem_gb} GB required for ${PI_MODEL})"
    elif [ "$min_mem_gb" -eq 0 ]; then
        pass "RAM: ${mem_gb} GB (no minimum for ${PI_MODEL})"
    else
        fail "RAM: Only ${mem_gb} GB detected (minimum ${min_mem_gb} GB for ${PI_MODEL})"
    fi

    # GPIO sysfs
    if [[ -d /sys/class/gpio ]]; then
        pass "GPIO: /sys/class/gpio exists"
    else
        skip "GPIO: sysfs interface not available"
    fi

    # I2C — bus 1 on all Pi models, bus 0 on Pi 5
    if ls /dev/i2c-* &>/dev/null; then
        pass "I2C: $(ls /dev/i2c-* | wc -l) bus(es) found"
    else
        skip "I2C: No /dev/i2c-* devices (load i2c-dev or check dtparam=i2c_arm=on)"
    fi

    # SPI
    if ls /dev/spidev* &>/dev/null; then
        pass "SPI: $(ls /dev/spidev* | wc -l) device(s) found"
    else
        skip "SPI: No /dev/spidev* devices (check dtparam=spi=on)"
    fi

    # CPU temperature
    if [[ -f /sys/class/thermal/thermal_zone0/temp ]]; then
        local temp_mc; temp_mc="$(cat /sys/class/thermal/thermal_zone0/temp)"
        local temp_c; temp_c=$(( temp_mc / 1000 ))
        local thermal_limit=85
        case "$PI_MODEL" in
            pi5) thermal_limit=80 ;;
            pi4) thermal_limit=80 ;;
            pi3) thermal_limit=85 ;;
            zero2w) thermal_limit=80 ;;
            *) thermal_limit=85 ;;
        esac
        if [[ ${temp_c} -lt ${thermal_limit} ]]; then
            pass "Thermal: CPU temperature ${temp_c}°C (limit: ${thermal_limit}°C for ${PI_MODEL})"
        else
            fail "Thermal: CPU temperature ${temp_c}°C (limit: ${thermal_limit}°C for ${PI_MODEL})"
        fi
    else
        skip "Thermal: Temperature sensor not accessible"
    fi

    # NVMe / PCIe (Pi 5 and CM4 only)
    case "$PI_MODEL" in
        pi5|cm4)
            if ls /dev/nvme* &>/dev/null; then
                pass "NVMe: $(ls /dev/nvme* | wc -l) NVMe device(s) found"
            else
                skip "NVMe: No NVMe devices found (optional on ${PI_MODEL})"
            fi
            ;;
        *)
            skip "NVMe: Not applicable for ${PI_MODEL}"
            ;;
    esac

    # Minima RPC connectivity check
    if curl -sf "http://127.0.0.1:${MINIMA_RPC_PORT}/status" >/dev/null 2>&1; then
        pass "Minima: RPC reachable on port ${MINIMA_RPC_PORT}"
    else
        skip "Minima: RPC not reachable on port ${MINIMA_RPC_PORT} (may not be running)"
    fi
}

# =============================================================================
# SUITE: Services
# =============================================================================
test_services() {
    section "System Services Tests"

    local services=(
        "systemd"
        "NetworkManager"
        "ssh"
        "chrony"
        "avahi-daemon"
    )
    local pinet_services=(
        "pinet-desktop"
        "pinet-hal"
        "minima"
    )

    for svc in "${services[@]}"; do
        if systemctl is-active --quiet "${svc}" 2>/dev/null; then
            pass "Service ${svc}: active"
        elif systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
            fail "Service ${svc}: enabled but not running"
        else
            skip "Service ${svc}: not installed"
        fi
    done

    for svc in "${pinet_services[@]}"; do
        if systemctl is-active --quiet "${svc}" 2>/dev/null; then
            pass "PiNetOS service ${svc}: active"
        elif systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
            fail "PiNetOS service ${svc}: enabled but not running"
        else
            skip "PiNetOS service ${svc}: not installed (expected on Pi only)"
        fi
    done

    # OTA timer
    if systemctl is-enabled --quiet pinet-ota.timer 2>/dev/null; then
        pass "OTA timer: enabled"
    else
        skip "OTA timer: not installed"
    fi
}

# =============================================================================
# SUITE: Networking
# =============================================================================
test_networking() {
    section "Networking Tests"

    # Ethernet interface (eth0 on most Pi models, could be end0 on some)
    local eth_iface=""
    for iface in eth0 end0 enp0s1; do
        if ip link show "$iface" &>/dev/null; then
            eth_iface="$iface"
            break
        fi
    done

    if [ -n "$eth_iface" ]; then
        pass "Ethernet: ${eth_iface} found"
        if ip addr show "$eth_iface" | grep -q 'inet '; then
            pass "Ethernet: ${eth_iface} has IPv4 address"
        else
            fail "Ethernet: ${eth_iface} has no IPv4 address"
        fi
    else
        skip "Ethernet: no wired interface found"
    fi

    # WiFi interface (wlan0 on Pi 3/4/5/Zero W)
    if ip link show wlan0 &>/dev/null; then
        pass "WiFi: wlan0 found"
    else
        skip "WiFi: wlan0 not found (not all Pi models have WiFi)"
    fi

    # DNS resolution
    if host google.com &>/dev/null 2>&1 || \
       nslookup google.com &>/dev/null 2>&1 || \
       getent hosts google.com &>/dev/null; then
        pass "DNS: resolution works"
    else
        fail "DNS: cannot resolve hostnames"
    fi

    # Internet connectivity
    if ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
        pass "Internet: connectivity confirmed (ping 8.8.8.8)"
    else
        fail "Internet: cannot reach 8.8.8.8"
    fi

    # WireGuard module
    if modinfo wireguard &>/dev/null 2>&1; then
        pass "WireGuard: kernel module available"
    else
        skip "WireGuard: module not found"
    fi

    # SSH daemon
    if ss -tlnp | grep -q ':22 '; then
        pass "SSH: sshd listening on port 22"
    else
        skip "SSH: sshd not listening"
    fi
}

# =============================================================================
# SUITE: HAL (Hardware Abstraction Layer)
# =============================================================================
test_hal() {
    section "HAL Tests"

    # HAL TypeScript files
    local hal_root
    hal_root="$(cd "${SCRIPT_DIR}/../../hal" 2>/dev/null && pwd || echo "")"
    if [[ -n "${hal_root}" ]] && [[ -f "${hal_root}/index.ts" ]]; then
        pass "HAL: index.ts exists"
        [[ -f "${hal_root}/gpio.ts" ]]   && pass "HAL: gpio.ts exists"    || fail "HAL: gpio.ts missing"
        [[ -f "${hal_root}/i2c.ts" ]]    && pass "HAL: i2c.ts exists"     || fail "HAL: i2c.ts missing"
        [[ -f "${hal_root}/spi.ts" ]]    && pass "HAL: spi.ts exists"     || fail "HAL: spi.ts missing"
        [[ -f "${hal_root}/thermal.ts" ]] && pass "HAL: thermal.ts exists" || fail "HAL: thermal.ts missing"
        [[ -f "${hal_root}/storage.ts" ]] && pass "HAL: storage.ts exists" || fail "HAL: storage.ts missing"
    else
        fail "HAL: source directory not found"
    fi

    # Node.js / TypeScript runtime
    if command -v node &>/dev/null; then
        local node_version; node_version="$(node --version)"
        pass "Node.js: ${node_version}"
    else
        # On Pi Zero/1, Node.js may not be installed due to ARM6 limitations
        if [ "$PI_MODEL" = "pi1" ] || [ "$PI_MODEL" = "zero" ]; then
            skip "Node.js: not installed (not required on ${PI_MODEL})"
        else
            fail "Node.js: not installed"
        fi
    fi

    # vcgencmd (VideoCore firmware tool — Pi only)
    if command -v vcgencmd &>/dev/null; then
        local temp; temp="$(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"
        pass "vcgencmd: available (${temp})"
    else
        skip "vcgencmd: not available (Pi hardware only)"
    fi
}

# =============================================================================
# SUITE: Security
# =============================================================================
test_security() {
    section "Security Tests"

    # SSH: root login disabled
    if grep -qE '^PermitRootLogin\s+(no|prohibit-password)' /etc/ssh/sshd_config 2>/dev/null; then
        pass "SSH: root login disabled"
    else
        fail "SSH: root login may be permitted — check /etc/ssh/sshd_config"
    fi

    # Firewall
    if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
        pass "UFW: firewall active"
    else
        skip "UFW: firewall not active (consider enabling: sudo ufw enable)"
    fi

    # AppArmor / SELinux
    if command -v aa-status &>/dev/null && aa-status --enabled 2>/dev/null; then
        pass "AppArmor: enabled"
    elif command -v sestatus &>/dev/null && sestatus | grep -q "enabled"; then
        pass "SELinux: enabled"
    else
        skip "AppArmor/SELinux: not active"
    fi

    # Automatic security updates
    if [[ -f /etc/apt/apt.conf.d/20auto-upgrades ]]; then
        pass "Unattended upgrades: configured"
    else
        skip "Unattended upgrades: not configured"
    fi

    # Check for known-dangerous SUID binaries
    local dangerous_suid=()
    for bin in /usr/bin/python3 /usr/bin/perl /usr/bin/ruby; do
        if [[ -u "${bin}" ]] 2>/dev/null; then
            dangerous_suid+=("${bin}")
        fi
    done
    if [[ ${#dangerous_suid[@]} -eq 0 ]]; then
        pass "SUID: no dangerous SUID binaries found"
    else
        fail "SUID: dangerous SUID binaries: ${dangerous_suid[*]}"
    fi
}

# =============================================================================
# Run selected suites
# =============================================================================
case "${SUITE}" in
    hardware)   test_hardware ;;
    services)   test_services ;;
    networking) test_networking ;;
    hal)        test_hal ;;
    security)   test_security ;;
    all)
        test_hardware
        test_services
        test_networking
        test_hal
        test_security
        ;;
    *)
        echo -e "${RED}Unknown suite: ${SUITE}${NC}"
        echo "Available suites: all, hardware, services, networking, hal, security"
        exit 1
        ;;
esac

# =============================================================================
# Summary
# =============================================================================
TOTAL=$((PASS + FAIL + SKIP))
echo
echo "=============================================="
echo " Test Results (${PI_LABEL})"
echo "=============================================="
echo -e "  ${GREEN}PASS: ${PASS}${NC}"
echo -e "  ${RED}FAIL: ${FAIL}${NC}"
echo -e "  ${YELLOW}SKIP: ${SKIP}${NC}"
echo "  TOTAL: ${TOTAL}"
echo "  Log: ${LOG}"
echo "=============================================="

if [[ ${FAIL} -gt 0 ]]; then
    echo -e "\n${RED}${BOLD}${FAIL} test(s) FAILED.${NC}"
    exit 1
else
    echo -e "\n${GREEN}${BOLD}All tests passed!${NC}"
    exit 0
fi