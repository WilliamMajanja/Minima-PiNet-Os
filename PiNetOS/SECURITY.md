# Security Policy for Minima-PiNet-Os

**Document Classification:** PUBLIC / SECURITY POLICY  
**Applies To:** Minima-PiNet-Os Core, Edge Node Infrastructure, PiNet Neural Framework, CPIP Security Provider (The Coffee Protocol)

This document outlines the security policies, vulnerability reporting procedures, and the zero-trust threat model governing the Minima-PiNet-Os stack. For the authoritative and current version, see the root [SECURITY.md](../SECURITY.md).

## Supported Versions

We maintain a strict rolling-release security model. Only the latest stable release and the immediate prior LTS (Long Term Support) release receive active security patches.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **1.0.x (Current)** | ✅ Yes | Active development and critical security patches. |
| **0.9.x (Beta)** | ❌ No | Deprecated. Upgrade to 1.0.x immediately. |
| **< 0.9.x** | ❌ No | End of Life. |

*Note: Upstream components (Debian Bookworm, Docker, Minima Node) are subject to their respective maintainers' security lifecycles. Our OTA (Over-The-Air) update mechanism will push upstream patches as they are verified against our stack.*

## Reporting a Vulnerability

We take the security of our edge computing and blockchain infrastructure extremely seriously. If you discover a vulnerability in the Minima-PiNet-Os stack, please report it immediately.

**Do not open a public GitHub issue for undisclosed security vulnerabilities.**

1. **Email:** Send a detailed report to `WilliamMajanja@gmail.com`.
2. **Details Required:** 
   - A description of the vulnerability and its impact.
   - The specific version of Minima-PiNet-Os and hardware (e.g., Pi 4 or Pi 5) tested.
   - A Proof of Concept (PoC) or detailed steps to reproduce the exploit.
   - Any suggested mitigations.
3. **Response Time:** We aim to acknowledge receipt of your vulnerability report within **48 hours** and provide a preliminary assessment within **5 business days**.

## Security Architecture & Threat Model

Minima-PiNet-Os is engineered under a **Zero-Trust** paradigm. When auditing or reporting vulnerabilities, please consider our established threat model and hardening baselines:

### In-Scope Security Controls
*   **CPIP Security Provider (The Coffee Protocol v4.0.2):** All nodes use CPIP for AES-256-GCM (FIPS 197) encryption, ECDSA/ECDH P-256 (FIPS 186-4) node identity, RSA-KEM-2048 (SP 800-56B) key encapsulation, HMAC-SHA256 RPC token auth, and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) PQ key exchange. FIPS 140-2/3 mode via `CPIP_FIPS=1`.
*   **CPIP ITF Defense:** Active probe blocking (HTTP 418), pentest tool fingerprinting, IP blacklisting. Defense policy groups: Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality.
*   **Cryptographic Authentication:** SSH is strictly limited to `ed25519` key-based authentication. Password authentication and legacy algorithms (RSA/ECDSA) are disabled by default. CPIP node identity uses ECDSA P-256 (FIPS 186-4) for challenge-response — this is distinct from SSH key algorithms.
*   **Network Perimeter:** UFW (Uncomplicated Firewall) is configured to default-deny all ingress traffic. Only ports `22` (SSH), `9001` (Minima P2P), `9005` (Minima RPC), `4180` (CPIP Security), and `51820` (WireGuard) are exposed.
*   **Brute-Force Mitigation:** `fail2ban` is actively monitoring auth logs and will permanently drop IPs (`bantime = -1`) attempting SSH brute-force attacks. CPIP ITF Defense provides complementary API-layer brute-force mitigation with HTTP 418 responses and IP blacklisting.
*   **Privilege Escalation:** The default `pi` user is locked, expired, and removed from the `sudo` group.
*   **Data at Rest:** Root and data partitions are encrypted via LUKS. CPIP CoffeeCipher v3 (AES-256-GCM) provides application-layer encryption with HKDF-SHA256 key derivation.
*   **Boot Integrity:** Secure Boot and Measured Boot (via TPM 2.0 PCR sealing) ensure the chain of trust from the Boot ROM to the OS kernel.

### Out of Scope
The following are generally considered out of scope for our bug bounty and security patching process, unless they demonstrate a novel bypass of our specific configurations:
*   **Physical Access Attacks:** Unless the attack successfully bypasses the TPM 2.0 LUKS decryption sealing.
*   **Upstream Debian Vulnerabilities:** Please report standard Debian packages (e.g., `systemd`, `apt`) directly to the Debian Security Team.
*   **Upstream Docker/Containerd Vulnerabilities:** Report directly to Docker/Moby unless the vulnerability is a direct result of our specific version pinning (e.g., `v24.0.7`).
*   **Denial of Service (DoS):** Volumetric network DoS attacks against the public Minima ports, as these must be mitigated at the network edge/router level.

## Incident Response Process

1. **Triage:** The security team will verify the vulnerability and determine its CVSS score.
2. **Patch Development:** A patch will be developed and tested against the A/B partition OTA rollback system to ensure it does not brick edge nodes.
3. **Release & Disclosure:** An OTA update will be pushed to all active nodes. A CVE will be requested (if applicable), and a public security advisory will be published on GitHub detailing the vulnerability and the fix.

---
*Securing the Decentralized Edge. Architected by William Majanja.*
