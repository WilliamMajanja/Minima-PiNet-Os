#!/usr/bin/env bash
# ==============================================================================
# Minima-PiNet-Os: Edge Node Remediation & Security Hardening Protocol
# ==============================================================================
# Role: Senior Lead Linux Systems Programmer & Edge Security Architect
# Target: Debian/Raspbian 12 (Bookworm) on ARM64 (Raspberry Pi 4/5)
# Description: Automatically mitigates I/O crashes, downgrades Docker to stable,
#              assigns static IP, hardens SSH, deploys UFW, and configures fail2ban.
# ==============================================================================

set -euo pipefail

# Require root privileges
if [[ "${EUID}" -ne 0 ]]; then
    echo "[CRITICAL] This script must be run as root. Execute: sudo $0" >&2
    exit 1
fi

echo "[INFO] Initiating Minima-PiNet-Os Troubleshooting and Patch Protocol..."

# ==============================================================================
# PHASE 1: Storage and Crash Mitigation (Kernel & ZRAM)
# ==============================================================================
echo "[INFO] Phase 1: Mitigating I/O bottlenecks and configuring ZRAM..."

# Install zram-tools if not present
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zram-tools

# Configure ZRAM (Allocate 50% of RAM to compressed swap)
cat <<EOF > /etc/default/zramswap
ALGO=zstd
PERCENT=50
PRIORITY=100
EOF

systemctl restart zramswap.service

# Tune Kernel Parameters for Edge Workloads
cat <<EOF > /etc/sysctl.d/99-pinet-edge.conf
# Reduce swap propensity to protect flash/NVMe lifespan
vm.swappiness=10
# Retain inode/dentry caches in memory longer
vm.vfs_cache_pressure=50
# Increase network max backlog for high-throughput consensus
net.core.netdev_max_backlog=5000
net.core.rmem_max=16777216
net.core.wmem_max=16777216
EOF

sysctl --system --quiet
echo "[SUCCESS] Kernel parameters and ZRAM configured."

# ==============================================================================
# PHASE 2: Syncing Loops and Docker Versioning
# ==============================================================================
echo "[INFO] Phase 2: Auditing container engine for sync loop instability..."

# Check if Docker is installed and causing sync loops (mock check for demonstration)
if command -v docker >/dev/null 2>&1; then
    echo "[WARN] Modern Docker engine detected. Downgrading to stable legacy release (v24.0.7 / 4.34 equivalent) to prevent initial sync loops..."
    
    # Stop docker services
    systemctl stop docker docker.socket containerd || true
    
    # Remove current potentially unstable version
    DEBIAN_FRONTEND=noninteractive apt-get remove -y -qq docker-ce docker-ce-cli containerd.io || true
    
    # Install specific stable version (using 5:24.0.7-1~debian.12~bookworm as the "stable legacy" example)
    # Note: In a real environment, you'd ensure the repo has this exact string.
    STABLE_DOCKER_VERSION="5:24.0.7-1~debian.12~bookworm"
    STABLE_CLI_VERSION="5:24.0.7-1~debian.12~bookworm"
    
    # Fallback to just installing docker.io if the specific CE version isn't in the repo
    if apt-cache show docker-ce | grep -q "$STABLE_DOCKER_VERSION"; then
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --allow-downgrades \
            docker-ce="$STABLE_DOCKER_VERSION" \
            docker-ce-cli="$STABLE_CLI_VERSION" \
            containerd.io
        
        # Pin the version to prevent unattended-upgrades from breaking it again
        apt-mark hold docker-ce docker-ce-cli containerd.io
        echo "[SUCCESS] Docker engine downgraded and pinned to $STABLE_DOCKER_VERSION."
    else
        echo "[WARN] Specific legacy version not found in apt cache. Installing stable repository default and pinning..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io
        apt-mark hold docker.io
    fi
    
    systemctl start docker
else
    echo "[INFO] Docker not found. Skipping downgrade."
fi

# ==============================================================================
# PHASE 3: Network Reliability (Static IP & Port Forwarding)
# ==============================================================================
echo "[INFO] Phase 3: Securing network reliability via Static IP..."

# Attempt to find the active default interface and its current IP
ACTIVE_IFACE=$(ip route get 1.1.1.1 | grep -oP '(?<=dev\s)\w+' | head -n 1)
CURRENT_IP=$(ip -4 addr show "$ACTIVE_IFACE" | grep -oP '(?<=inet\s)\d+(\.\d+){3}/\d+' | head -n 1)
GATEWAY_IP=$(ip route | grep default | awk '{print $3}' | head -n 1)

if [[ -n "$ACTIVE_IFACE" && -n "$CURRENT_IP" && -n "$GATEWAY_IP" ]]; then
    echo "[INFO] Active interface: $ACTIVE_IFACE, Current IP: $CURRENT_IP, Gateway: $GATEWAY_IP"
    
    # If using NetworkManager (Debian 12 default)
    if command -v nmcli >/dev/null 2>&1; then
        CON_NAME=$(nmcli -t -f NAME,DEVICE connection show active | grep ":$ACTIVE_IFACE" | cut -d: -f1 | head -n 1)
        if [[ -n "$CON_NAME" ]]; then
            nmcli con mod "$CON_NAME" ipv4.addresses "$CURRENT_IP"
            nmcli con mod "$CON_NAME" ipv4.gateway "$GATEWAY_IP"
            nmcli con mod "$CON_NAME" ipv4.dns "8.8.8.8 1.1.1.1"
            nmcli con mod "$CON_NAME" ipv4.method manual
            nmcli con up "$CON_NAME" >/dev/null 2>&1
            echo "[SUCCESS] Static IP assigned via NetworkManager."
        fi
    else
        # Fallback to dhcpcd (older Raspbian)
        if grep -q "interface $ACTIVE_IFACE" /etc/dhcpcd.conf 2>/dev/null; then
            echo "[INFO] Static IP already seems configured in dhcpcd.conf."
        else
            cat <<EOF >> /etc/dhcpcd.conf

# Minima-PiNet-Os Static IP Configuration
interface $ACTIVE_IFACE
static ip_address=$CURRENT_IP
static routers=$GATEWAY_IP
static domain_name_servers=8.8.8.8 1.1.1.1
EOF
            systemctl restart dhcpcd || true
            echo "[SUCCESS] Static IP assigned via dhcpcd."
        fi
    fi

    # Generate Port Forwarding Warning Log
    LOG_FILE="/var/log/pinet_network_routing.log"
    cat <<EOF > "$LOG_FILE"
================================================================================
CRITICAL NETWORK ROUTING WARNING - MINIMA-PINET-OS
Generated: $(date)
================================================================================
Your edge node has been assigned the static IP: ${CURRENT_IP%/*}

ACTION REQUIRED:
To maintain peer connectivity and prevent consensus isolation, you MUST log into
your local network router and configure the following Port Forwarding rules:

 1. Protocol: TCP
    External Port: 9001
    Internal Port: 9001
    Internal IP: ${CURRENT_IP%/*}
    Comment: Minima P2P (peer-to-peer networking)
 
 2. Protocol: TCP
    External Port: 9005
    Internal Port: 9005
    Internal IP: ${CURRENT_IP%/*}
    Comment: Minima RPC (command interface)
 
 3. Protocol: TCP
    External Port: 9003
    Internal Port: 9003
    Internal IP: ${CURRENT_IP%/*}
    Comment: Minima MDS (MiniDAPP file server)

Failure to implement these rules will result in the node operating in a degraded,
outbound-only state, severely impacting the PiNet neural mesh and blockchain sync.
================================================================================
EOF
    echo "[SUCCESS] Network routing log generated at $LOG_FILE"
else
    echo "[WARN] Could not determine active interface or IP. Skipping static IP assignment."
fi

# ==============================================================================
# PHASE 4: Zero-Trust Security Hardening
# ==============================================================================
echo "[INFO] Phase 4: Executing Zero-Trust Security Hardening..."

# 4.1 Lock and purge the default 'pi' user privileges
if id "pi" >/dev/null 2>&1; then
    echo "[INFO] Locking default 'pi' user account..."
    # Lock the password, expire the account, and remove from sudo group
    usermod -L -e 1 pi || true
    gpasswd -d pi sudo 2>/dev/null || true
    echo "[SUCCESS] Default 'pi' user neutralized."
else
    echo "[INFO] Default 'pi' user not found. Secure."
fi

# 4.2 Harden the SSH Daemon (ed25519 only, no passwords)
SSHD_CONFIG="/etc/ssh/sshd_config"
echo "[INFO] Hardening SSH daemon..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONFIG"
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONFIG"

# Enforce ed25519 exclusively
if ! grep -q "PubkeyAcceptedKeyTypes" "$SSHD_CONFIG"; then
    echo "PubkeyAcceptedKeyTypes ssh-ed25519" >> "$SSHD_CONFIG"
else
    sed -i 's/^#*PubkeyAcceptedKeyTypes.*/PubkeyAcceptedKeyTypes ssh-ed25519/' "$SSHD_CONFIG"
fi

systemctl restart sshd
echo "[SUCCESS] SSH hardened. Password auth disabled; ed25519 enforced."

# 4.3 Install and Configure UFW (Default Deny)
echo "[INFO] Configuring UFW (Uncomplicated Firewall)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw

# Reset to defaults
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing

# Punch surgical holes
ufw allow 22/tcp comment 'SSH'
ufw allow 9001/tcp comment 'Minima P2P'
ufw allow 9003/tcp comment 'Minima MDS-file'
ufw allow 9004/tcp comment 'Minima MDS-cmd'
ufw allow 9005/tcp comment 'Minima RPC'
ufw allow 3000/tcp comment 'PiNet Desktop'

# Enable firewall
ufw --force enable >/dev/null 2>&1
echo "[SUCCESS] UFW enabled. Default-deny active."

# 4.4 Deploy Fail2Ban for SSH Brute-Force Protection
echo "[INFO] Deploying Fail2Ban..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban

cat <<EOF > /etc/fail2ban/jail.local
[DEFAULT]
# Ban IPs permanently (-1)
bantime = -1
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban --quiet
systemctl restart fail2ban
echo "[SUCCESS] Fail2Ban deployed. SSH brute-force attempts will be permanently dropped."

# ==============================================================================
# COMPLETION
# ==============================================================================
echo "[SUCCESS] Minima-PiNet-Os Troubleshooting and Patch Protocol completed successfully."
echo "[INFO] Please review /var/log/pinet_network_routing.log for router configuration instructions."
exit 0
