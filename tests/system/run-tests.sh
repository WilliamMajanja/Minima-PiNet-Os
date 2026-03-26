#!/usr/bin/env bash
# =============================================================================
# PiNetOS System Test Runner
# Tests hardware, services, networking, and HAL on a live Raspberry Pi 5
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

echo "=============================================="
echo " PiNetOS System Test Suite"
echo " Suite: ${SUITE}"
echo " Date:  $(date)"
echo " Host:  $(uname -n)"
echo " Arch:  $(uname -m)"
echo "=============================================="

# =============================================================================
# SUITE: Hardware
# =============================================================================
test_hardware() {
    section "Hardware Tests"

    # BCM2712 CPU detection
    if grep -q "Cortex-A76\|BCM2712" /proc/cpuinfo 2>/dev/null; then
        pass "CPU: BCM2712 (Cortex-A76) detected"
    elif grep -q "Raspberry Pi 5" /proc/device-tree/model 2>/dev/null; then
        pass "CPU: Raspberry Pi 5 detected via device tree"
    else
        skip "CPU: BCM2712 not detected (may be running in VM/simulation)"
    fi

    # Memory
    local mem_kb; mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
    local mem_gb; mem_gb=$(( mem_kb / 1024 / 1024 ))
    if [[ ${mem_kb} -gt $((4 * 1024 * 1024)) ]]; then
        pass "RAM: ${mem_gb} GB (≥ 4 GB required)"
    else
        fail "RAM: Only ${mem_gb} GB detected (minimum 4 GB recommended)"
    fi

    # GPIO sysfs
    if [[ -d /sys/class/gpio ]]; then
        pass "GPIO: /sys/class/gpio exists"
    else
        skip "GPIO: sysfs interface not available"
    fi

    # I2C
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
        if [[ ${temp_c} -lt 85 ]]; then
            pass "Thermal: CPU temperature ${temp_c}°C (normal)"
        else
            fail "Thermal: CPU temperature ${temp_c}°C (throttle threshold approaching!)"
        fi
    else
        skip "Thermal: Temperature sensor not accessible"
    fi

    # NVMe / PCIe
    if ls /dev/nvme* &>/dev/null; then
        pass "NVMe: $(ls /dev/nvme* | wc -l) NVMe device(s) found"
    else
        skip "NVMe: No NVMe devices found"
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

    # Ethernet interface
    if ip link show eth0 &>/dev/null; then
        pass "Ethernet: eth0 found"
        if ip addr show eth0 | grep -q 'inet '; then
            pass "Ethernet: eth0 has IPv4 address"
        else
            fail "Ethernet: eth0 has no IPv4 address"
        fi
    else
        skip "Ethernet: eth0 not found"
    fi

    # WiFi interface
    if ip link show wlan0 &>/dev/null; then
        pass "WiFi: wlan0 found"
    else
        skip "WiFi: wlan0 not found"
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
        fail "Node.js: not installed"
    fi

    # vcgencmd (VideoCore firmware tool)
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
echo " Test Results"
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
