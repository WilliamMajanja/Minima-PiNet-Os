# Security Policy for Minima-PiNet-Os

**Document Classification:** PUBLIC / SECURITY POLICY  
**Applies To:** Minima-PiNet-Os Core, Edge Node Infrastructure, PiNet Neural Framework, PiNet Cluster Manager, k3s Edge Compute, IPFS Storage, MiniDAPP Runtime, CPIP Security Provider (The Coffee Protocol)

This document outlines the security policies, vulnerability reporting procedures, and the zero-trust threat model governing the Minima-PiNet-Os stack. For the authoritative and current version, see the root [SECURITY.md](../SECURITY.md).

## Supported Versions

We maintain a strict rolling-release security model. Only the latest stable release and the immediate prior LTS (Long Term Support) release receive active security patches.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **3.0.x (Current)** | ✅ Yes | Confidential enclaves, verifiable compute proofs, edge compute marketplace. |
| **1.3.x (LTS)** | ✅ Yes | On-device LLM gateway, multi-tenant LXC quotas, TPM key-wrap, CPIP PQ-TLS. |
| **1.2.x (LTS)** | ⚠️ Critical only | CPIP security provider, signed OTA updates. |
| **< 1.2.x** | ❌ No | End of Life. |

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
*   **CPIP Security Provider (The Coffee Protocol v5.0.5):** All Minima nodes and PiNet-OS services use CPIP as the primary cryptographic security provider. CPIP provides CoffeeCipher v5 (AES-256-GCM, FIPS 197) with HKDF-SHA256 key derivation for data at rest and in transit, ECDSA/ECDH P-256 (FIPS 186-4) for node identity and challenge-response authentication, RSA-KEM-2048 (FIPS 186-4 / SP 800-56B) for key encapsulation, HMAC-SHA256 for RPC token authentication, and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange. FIPS 140-2/3 mode is available via `CPIP_FIPS=1`.
*   **CPIP ITF Defense:** Active network defense at the API ingress layer. Probe blocking (HTTP 418), pentest tool fingerprinting (Burp Suite, Nmap, SQLMap, Nikto, etc.), IP blacklisting with rate-limited exponential ban duration, and runtime-toggleable defense policy groups (Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality).
*   **CPIP Post-Quantum TLS (v1.3.0):** CPIP RPC transport supports hybrid post-quantum TLS combining ECDH P-256 with Kyber-768 (ML-KEM-768) key exchange. Enabled via `CPIP_PQ_TLS=1` and `CPIP_PQ_HYBRID=1`.
*   **CPIP TPM Key-Wrap (v1.3.0):** CPIP master keys can be hardware-sealed to the TPM 2.0, bound to the node's measured boot PCR state. Unsealing requires the sealed key to match the current PCR values.
*   **CPIP Node Identity:** Each node receives a CPIP-signed ECDSA P-256 identity with challenge-response authentication. Cluster join uses `AUTH_CHALLENGE`/`AUTH_RESPONSE` message types.
*   **CPIP RPC Token Authentication:** Minima RPC calls are authenticated with HMAC-SHA256 time-bounded tokens (`Authorization: CPIP <token>` header). mTLS support via `CPIP_MTLS_CERT`/`CPIP_MTLS_KEY`/`CPIP_MTLS_CA`.
*   **CPIP Sidecar (K3s):** The Minima DaemonSet runs a CPIP sidecar container (`cpip:5.0.5`) on port 4180, with defense API, health probes, and Prometheus metrics.
*   **CPIP Emergency Mode:** Instant key rotation, secure memory wipe, peer notification, and stealth activation via `POST /cpip/emergency`.
*   **Enterprise Hypervisor (LXC):** Workloads isolated in LXC containers with kernel-level namespace separation.
*   **LXC Resource Quotas (v1.3.0):** Per-container cgroups v2 limits enforcing CPU, RAM, disk, IO, and process counts (up to 16 tenants per node).
*   **Blockchain-Backed Remote Attestation:** System integrity verified by hashing `/boot/firmware` and `/etc/pinet`, attested against the immutable Minima ledger.
*   **Formal Attestation (v2.0.0):** TPM 2.0 PCR-based attestation anchored to the Minima blockchain. Attestation reports signed with the CPIP ECDSA P-256 node identity.
*   **Zero-Exposure Networking:** All container traffic routed through encrypted WireGuard veth pairs.
*   **Deterministic Resource Pinning:** `cpuset` pinning (Cores 2–3) for AI inference isolation.
*   **Cryptographic Authentication:** SSH strictly limited to `ed25519` key-based authentication.
*   **Network Perimeter:** UFW default-deny ingress. Only ports `22` (SSH), `9001` (Minima P2P), `9005` (Minima RPC), `4180` (CPIP Security), `51820` (WireGuard), and `6443` (k3s API) are exposed.
*   **Pod Security Hardening:** Non-root pods, dropped Linux capabilities, no privilege escalation. ResourceQuota and LimitRange per namespace.
*   **MiniDAPP Sandboxing:** DApps run in sandboxed iframes with permission-gated bridge API.
*   **Brute-Force Mitigation:** `fail2ban` with permanent IP bans (`bantime = -1`) for SSH. CPIP ITF Defense provides complementary API-layer mitigation.
*   **Privilege Escalation:** The default `pi` user is locked, expired, and removed from the `sudo` group.
*   **Data at Rest:** LUKS full-disk encryption. CPIP CoffeeCipher v5 (AES-256-GCM) for application-layer encryption.
*   **Boot Integrity:** Secure Boot and Measured Boot (via TPM 2.0 PCR sealing).
*   **SSL/TLS with mkcert (v3.0.0):** Production-grade TLS termination via mkcert (local CA) or OpenSSL (self-signed fallback). Certificates auto-generated on first boot and stored at `~/.local/share/pinet/ssl/`. Server binds with `ssl_certfile` and `ssl_keyfile` for HTTPS by default.
*   **HTTP Strict Transport Security (v3.0.0):** HSTS middleware sends `Strict-Transport-Security` header on all HTTPS responses with configurable `max-age` (default 31536000 = 1 year), `includeSubDomains`, and `preload` directives.
*   **Security Response Headers (v3.0.0):** 11 additional security headers on every response: CSP, Permissions-Policy, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, COEP, COOP, CORP.

### Out of Scope
*   **Physical Access Attacks:** Unless the attack bypasses TPM 2.0 LUKS decryption sealing.
*   **Upstream Debian Vulnerabilities:** Report to the Debian Security Team.
*   **Upstream Docker/Containerd Vulnerabilities:** Report directly to Docker/Moby.
*   **Denial of Service (DoS):** Volumetric network DoS against public ports must be mitigated at the network edge.

## Incident Response Process

1. **Triage:** The security team will verify the vulnerability and determine its CVSS score.
2. **Patch Development:** A patch will be developed and tested against the A/B partition OTA rollback system.
3. **Release & Disclosure:** An OTA update will be pushed to all active nodes. A CVE will be requested (if applicable), and a public security advisory will be published on GitHub.

---

*Securing the Decentralized Edge. Architected by William Majanja.*
