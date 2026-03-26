#!/usr/bin/env bash
# =============================================================================
# PiNetOS Package Manager (pinet-pkg)
# A lightweight package management wrapper for PiNetOS
#
# Usage: pinet-pkg <command> [options] [packages...]
# Commands: install, remove, update, upgrade, search, list, info
# =============================================================================
set -euo pipefail

VERSION="1.0.0"
PINET_PKG_DIR="/var/lib/pinet-pkg"
PINET_PKG_CACHE="/var/cache/pinet-pkg"
PINET_PKG_DB="${PINET_PKG_DIR}/installed.json"
PINET_PKG_REPOS="/etc/pinet-pkg/repos.conf"
LOG_FILE="/var/log/pinet-pkg.log"

# ---- Colour helpers ---------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[pinet-pkg]${NC} $*" | tee -a "${LOG_FILE}"; }
warn()    { echo -e "${YELLOW}[pinet-pkg]${NC} $*" | tee -a "${LOG_FILE}"; }
error()   { echo -e "${RED}[pinet-pkg]${NC} $*" >&2; exit 1; }

# ---- Initialise -------------------------------------------------------------
init_pkg_system() {
    mkdir -p "${PINET_PKG_DIR}" "${PINET_PKG_CACHE}"
    if [[ ! -f "${PINET_PKG_DB}" ]]; then
        echo '{"installed":{},"version":"1.0.0"}' > "${PINET_PKG_DB}"
    fi
    mkdir -p "$(dirname "${LOG_FILE}")"
    touch "${LOG_FILE}"
}

# ---- Usage ------------------------------------------------------------------
usage() {
    cat << EOF
${BOLD}pinet-pkg ${VERSION}${NC} — PiNetOS Package Manager

${BOLD}USAGE:${NC}
  pinet-pkg <command> [options] [package...]

${BOLD}COMMANDS:${NC}
  install  <pkg...>    Install packages
  remove   <pkg...>    Remove packages
  update               Refresh package repository index
  upgrade  [pkg...]    Upgrade installed packages (all if no args)
  search   <query>     Search for packages
  list     [--installed] List packages
  info     <pkg>       Show package information
  clean                Clean package cache

${BOLD}OPTIONS:${NC}
  --yes, -y        Auto-confirm prompts
  --dry-run        Show what would be done without making changes
  --verbose, -v    Verbose output
  --help, -h       Show this help

${BOLD}EXAMPLES:${NC}
  pinet-pkg install vim git
  pinet-pkg remove nodejs
  pinet-pkg update && pinet-pkg upgrade
  pinet-pkg search tensorflow
  pinet-pkg list --installed

${BOLD}NOTES:${NC}
  pinet-pkg is a wrapper around apt-get that also manages PiNetOS-specific
  packages from the PiNetOS package repository (packages.pinetos.io).
EOF
    exit 0
}

# ---- apt-get wrapper --------------------------------------------------------
apt_install() {
    local packages=("$@")
    info "Installing via apt: ${packages[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        --no-install-recommends "${packages[@]}"
}

apt_remove() {
    local packages=("$@")
    info "Removing via apt: ${packages[*]}"
    apt-get remove -y "${packages[@]}"
    apt-get autoremove -y
}

# ---- PiNetOS custom package repository --------------------------------------
PINET_REPO_URL="${PINET_REPO_URL:-https://packages.pinetos.io}"

fetch_pinet_package() {
    local pkg_name="$1"
    local pkg_url="${PINET_REPO_URL}/pool/${pkg_name}.tar.gz"
    local pkg_cache="${PINET_PKG_CACHE}/${pkg_name}.tar.gz"

    info "Downloading ${pkg_name} from PiNetOS repository..."
    curl --silent --fail --max-time 120 --output "${pkg_cache}" "${pkg_url}" || {
        warn "Package ${pkg_name} not found in PiNetOS repo. Trying apt..."
        apt_install "${pkg_name}"
        return
    }

    # Verify hash if manifest exists
    local manifest_url="${PINET_REPO_URL}/pool/${pkg_name}.json"
    local manifest_cache="${PINET_PKG_CACHE}/${pkg_name}.json"
    if curl --silent --fail --output "${manifest_cache}" "${manifest_url}" 2>/dev/null; then
        local expected_hash; expected_hash="$(python3 - "${manifest_cache}" << 'PYEOF'
import json, sys
d = json.load(open(sys.argv[1]))
print(d.get("sha256", ""))
PYEOF
)"
        if [[ -n "${expected_hash}" ]]; then
            local actual_hash; actual_hash="$(sha256sum "${pkg_cache}" | awk '{print $1}')"
            [[ "${actual_hash}" == "${expected_hash}" ]] || error "Hash mismatch for ${pkg_name}!"
            info "Checksum verified."
        fi
    fi

    info "Installing ${pkg_name}..."
    local install_dir="/opt/pinet-packages/${pkg_name}"
    mkdir -p "${install_dir}"
    tar xzf "${pkg_cache}" -C "${install_dir}"

    # Run install script if present
    if [[ -x "${install_dir}/install.sh" ]]; then
        bash "${install_dir}/install.sh"
    fi

    # Record in DB
    python3 - "${PINET_PKG_DB}" "${pkg_name}" << 'PYEOF'
import json, time, sys
db_path = sys.argv[1]
pkg = sys.argv[2]
db = json.load(open(db_path))
db["installed"][pkg] = {"source": "pinet", "installed_at": time.time()}
with open(db_path, "w") as f:
    json.dump(db, f, indent=2)
PYEOF
    info "${pkg_name} installed successfully."
}

# ---- Commands ---------------------------------------------------------------
cmd_install() {
    [[ $# -gt 0 ]] || error "Usage: pinet-pkg install <package...>"
    for pkg in "$@"; do
        # Check if it's a known PiNetOS-specific package
        case "${pkg}" in
            minima-node|pinet-hal|pinet-cluster|pinet-ota)
                fetch_pinet_package "${pkg}" ;;
            *)
                apt_install "${pkg}" ;;
        esac
    done
}

cmd_remove() {
    [[ $# -gt 0 ]] || error "Usage: pinet-pkg remove <package...>"
    apt_remove "$@"
}

cmd_update() {
    info "Refreshing package index..."
    apt-get update -qq
    info "PiNetOS repository index updated."
}

cmd_upgrade() {
    info "Upgrading installed packages..."
    if [[ $# -gt 0 ]]; then
        apt_install "$@"
    else
        DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
    fi
    info "Upgrade complete."
}

cmd_search() {
    local query="${1:-}"
    [[ -n "${query}" ]] || error "Usage: pinet-pkg search <query>"
    info "Searching apt for '${query}'..."
    apt-cache search "${query}"
}

cmd_list() {
    if [[ "${1:-}" == "--installed" ]]; then
        info "Installed packages:"
        dpkg --get-selections | grep -v deinstall
    else
        apt-cache pkgnames | sort
    fi
}

cmd_info() {
    local pkg="${1:-}"
    [[ -n "${pkg}" ]] || error "Usage: pinet-pkg info <package>"
    apt-cache show "${pkg}" 2>/dev/null || \
        error "Package '${pkg}' not found."
}

cmd_clean() {
    info "Cleaning package caches..."
    apt-get clean
    rm -rf "${PINET_PKG_CACHE:?}"/*
    info "Cache cleaned."
}

# ---- Argument parsing & dispatch --------------------------------------------
COMMAND="${1:-}"
shift || true

case "${COMMAND}" in
    install)  init_pkg_system; cmd_install "$@" ;;
    remove)   init_pkg_system; cmd_remove  "$@" ;;
    update)   init_pkg_system; cmd_update       ;;
    upgrade)  init_pkg_system; cmd_upgrade "$@" ;;
    search)   init_pkg_system; cmd_search  "$@" ;;
    list)     init_pkg_system; cmd_list    "$@" ;;
    info)     init_pkg_system; cmd_info    "$@" ;;
    clean)    init_pkg_system; cmd_clean        ;;
    --help|-h|help|"") usage ;;
    *) error "Unknown command: '${COMMAND}'. Run 'pinet-pkg --help' for usage." ;;
esac
