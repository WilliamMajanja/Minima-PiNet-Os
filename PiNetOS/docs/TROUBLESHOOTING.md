# Minima-PiNet-Os: Troubleshooting and Patch Protocol

**Document Classification:** HIGHLY CONFIDENTIAL / PRODUCTION-CRITICAL  
**Role:** Senior Lead Linux Systems Programmer & Edge Security Architect  
**Target Architecture:** ARM64 (Raspberry Pi 4/5)  

This protocol outlines the architectural remediation steps required to stabilize, secure, and optimize Minima-PiNet-Os edge nodes. Standard SBC (Single Board Computer) deployments suffer from inherent I/O bottlenecks, container engine desynchronization, and permissive default security postures. This document, paired with the `os_node_patch.sh` execution script, systematically eliminates these vectors.

---

## 1. Storage I/O Bottlenecks and Crash Mitigation

Periodic node crashes in Raspberry Pi clusters are almost exclusively tied to I/O wait states (iowait) saturating the CPU when operating on standard MicroSD cards. The Minima blockchain and PiNet neural workloads require high-throughput, low-latency storage.

*   **NVMe Migration Protocol:**
    *   **Hardware:** A PCIe NVMe HAT (e.g., Pineberry Pi or official Raspberry Pi M.2 HAT) populated with a high-endurance NVMe SSD is mandatory for production.
    *   **Firmware Update:** The Pi EEPROM must be updated to prioritize NVMe boot.
        ```bash
        sudo rpi-eeprom-update -a
        sudo rpi-eeprom-config --edit
        # Change BOOT_ORDER to 0xf416 (NVMe -> USB -> SD)
        ```
*   **Kernel Parameter Tuning:**
    *   We must reduce the kernel's propensity to swap to disk, which destroys flash memory and blocks consensus threads.
    *   `vm.swappiness` is reduced to `10` (only swap to avoid OOM).
    *   `vm.vfs_cache_pressure` is reduced to `50` to retain inode/dentry caches in RAM, drastically reducing filesystem metadata reads.
*   **ZRAM Implementation:**
    *   Instead of a disk-based swapfile, we implement `zram` (compressed RAM block devices). This intercepts swap pages, compresses them (using `lz4` or `zstd`), and stores them in RAM, entirely bypassing the storage controller.

## 2. Blockchain Sync Loops and Container Engine Instability

A known edge-case in decentralized node deployments is the "Initial Sync Loop," where the node repeatedly drops peers and restarts the chain synchronization. This is frequently caused by modern container engines (e.g., latest Docker releases) mishandling high-frequency UDP/TCP packet bursts via `iptables` NAT routing.

*   **Engine Downgrade & Pinning:**
    *   The patch script detects sync loop signatures in the container logs.
    *   It automatically downgrades the Docker Engine to a known-stable legacy release (e.g., `v24.0.7` / conceptual `v4.34` stable branch).
    *   The package manager (`apt`) is then instructed to place a `hold` on the Docker packages, preventing unattended upgrades from reintroducing the instability.

## 3. Network Reliability and Peer Connectivity

Decentralized consensus requires deterministic network routing. DHCP leases that expire and assign new IPs will silently break port-forwarding rules, isolating the node from the network.

*   **Static IP Assignment:**
    *   The patch script interfaces with `NetworkManager` (`nmcli`) to convert the current dynamic DHCP lease into a hardcoded static IP configuration.
*   **Port-Forwarding Mandate:**
    *   The script generates a critical log file (`/var/log/pinet_network_routing.log`) detailing the exact TCP/UDP ports (typically `9001` for Minima P2P and `9005` for Minima RPC) that the network administrator *must* forward at the perimeter router/firewall.

## 4. Zero-Trust Security Hardening

Edge nodes are inherently exposed. The default security posture of Debian/Raspbian is unacceptably permissive for a financial/AI node.

*   **Eradication of the Default User:**
    *   The default `pi` user is a universal attack vector. The script locks the account, expires it, and removes it from the `sudo` group.
*   **Cryptographic SSH Hardening:**
    *   Password authentication is entirely disabled.
    *   The SSH daemon is reconfigured to *only* accept `ed25519` elliptic curve cryptographic keys. RSA and ECDSA are deprecated.
*   **UFW (Uncomplicated Firewall) Default-Deny:**
    *   A strict `default-deny` policy is enforced for all ingress traffic.
    *   Exceptions are surgically punched only for SSH (Port 22) and the Minima/PiNet consensus ports.
*   **Fail2Ban Deployment:**
    *   `fail2ban` is deployed to monitor `/var/log/auth.log`.
    *   Any IP address attempting to brute-force the SSH daemon is permanently dropped at the `iptables` level (bantime = -1).
*   **CPIP Security Provider (The Coffee Protocol v5.0.5):**
    *   ITF Defense: API-layer probe blocking (HTTP 418), pentest tool fingerprinting, IP blacklisting with exponential ban duration.
    *   CoffeeCipher v5 (AES-256-GCM, FIPS 197) with HKDF-SHA256 key derivation for data at rest.
    *   ECDSA P-256 (FIPS 186-4) node identity with challenge-response authentication.
    *   HMAC-SHA256 RPC token authentication replaces Basic Auth for Minima RPC calls.
    *   CPIP sidecar runs on port 4180 (`cpip.service` systemd unit). FIPS 140-2/3 self-tests via `CPIP_FIPS=1`.
