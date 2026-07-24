# Security Policy for Minima-PiNet-Os

**Document Classification:** PUBLIC / SECURITY POLICY  
**Applies To:** Minima-PiNet-Os Core, Edge Node Infrastructure, PiNet Neural Framework, PiNet Cluster Manager, k3s Edge Compute, IPFS Storage, MiniDAPP Runtime, CPIP Security Provider (The Coffee Protocol)

This document outlines the security policies, vulnerability reporting procedures, and the zero-trust threat model governing the Minima-PiNet-Os stack.

## Supported Versions

We maintain a strict rolling-release security model. Only the latest stable release and the immediate prior LTS (Long Term Support) release receive active security patches.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **3.0.x (Current)** | ✅ Yes | Confidential enclaves, verifiable compute proofs, edge compute marketplace. |
| **1.3.x (LTS)** | ✅ Yes | On-device LLM gateway, multi-tenant LXC quotas, TPM key-wrap, CPIP PQ-TLS. |
| **1.2.x (LTS)** | ⚠️ Critical only | CPIP security provider, signed OTA updates, Hailo-8L pipelines. |
| **1.1.x (Legacy)** | ❌ No | End of Life. |

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
*   **CPIP Security Provider (The Coffee Protocol v5.0.5):** All Minima nodes and PiNet-OS services use CPIP as the primary cryptographic security provider. CPIP provides CoffeeCipher v5 (AES-256-GCM, FIPS 197) with HKDF-SHA256 key derivation for data at rest and in transit, ECDSA/ECDH P-256 (FIPS 186-4) for node identity and challenge-response authentication, RSA-KEM-2048 (FIPS 186-4 / SP 800-56B) for key encapsulation, HMAC-SHA256 for RPC token authentication, and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange. FIPS 140-2/3 mode is available via `CPIP_FIPS=1`. See [CPIP SECURITY.md](https://github.com/WilliamMajanja/CPIP-/blob/main/SECURITY.md) for full cryptographic details.
*   **CPIP ITF Defense:** Active network defense at the API ingress layer. Probe blocking (HTTP 418), pentest tool fingerprinting (Burp Suite, Nmap, SQLMap, Nikto, etc.), IP blacklisting with rate-limited exponential ban duration, and runtime-toggleable defense policy groups (Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality).
*   **CPIP Post-Quantum TLS (v1.3.0):** CPIP RPC transport supports hybrid post-quantum TLS combining ECDH P-256 with Kyber-768 (ML-KEM-768) key exchange. Enabled via `CPIP_PQ_TLS=1` and `CPIP_PQ_HYBRID=1`. Provides forward secrecy against quantum cryptanalytic adversaries.
*   **CPIP TPM Key-Wrap (v1.3.0):** CPIP master keys can be hardware-sealed to the TPM 2.0, bound to the node's measured boot PCR state. Unsealing requires the sealed key to match the current PCR values, preventing key extraction on a tampered system. Enabled via `PINET_TPM_KEYWRAP=1`.
*   **CPIP Node Identity:** Each node receives a CPIP-signed ECDSA P-256 identity with challenge-response authentication, replacing the legacy MAC-derived node ID. Node identities are carried in `ClusterNode.cpipIdentity` and `ClusterNode.cpipPublicKey` model fields. Cluster join uses `AUTH_CHALLENGE`/`AUTH_RESPONSE` message types.
*   **CPIP RPC Token Authentication:** Minima RPC calls are authenticated with HMAC-SHA256 time-bounded tokens (`Authorization: CPIP <token>` header), replacing Basic Auth. Token TTL is configurable via `CPIP_TOKEN_TTL` (default 300s). mTLS support via `CPIP_MTLS_CERT`/`CPIP_MTLS_KEY`/`CPIP_MTLS_CA`.
*   **CPIP Sidecar (K3s):** The Minima DaemonSet runs a CPIP sidecar container (`cpip:5.0.5`) on port 4180, providing defense API, health probes (`/health`, `/ready`), and Prometheus metrics (`/cpip/metrics`). NetworkPolicy restricts CPIP port access to Desktop and Minima pods.
*   **CPIP Sidecar (Systemd):** A dedicated `cpip.service` systemd unit runs the CPIP provider daemon with `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, and `CapabilityBoundingSet=` hardening. The `minima.service` unit depends on `cpip.service` via `After=cpip.service`.
*   **CPIP Emergency Mode:** Instant key rotation, secure memory wipe, peer notification, and stealth activation via `POST /cpip/emergency {"action":"activate"|"rotate_keys"|"wipe"|"deactivate"}`.
*   **Enterprise Hypervisor (LXC):** Workloads are isolated in LXC containers (`pinet-enterprise-env`) with kernel-level namespace separation, preventing container escapes from impacting the host OS.
*   **LXC Resource Quotas (v1.3.0):** Per-container cgroups v2 limits enforce CPU, RAM, disk, IO, and process counts (up to 16 tenants per node). Prevents noisy-neighbor DoS across tenants.
*   **Blockchain-Backed Remote Attestation:** System integrity is verified by hashing `/boot/firmware` and `/etc/pinet`, attested against the immutable Minima ledger. Any unauthorized tampering triggers an immediate security lockdown.
*   **Formal Attestation (v2.0.0):** TPM 2.0 PCR-based attestation anchored to the Minima blockchain. Boot integrity (PCR 0–7) and configuration integrity (PCR 8, `/etc/pinet`) are hashed and recorded on-ledger. Attestation reports are signed with the CPIP ECDSA P-256 node identity.
*   **Zero-Exposure Networking:** All container traffic is routed through encrypted WireGuard veth pairs, ensuring the host IP is never exposed to the external network.
*   **Deterministic Resource Pinning:** `cpuset` pinning (Cores 2-3) ensures that AI inference is isolated from other system processes, preventing side-channel timing attacks.
*   **Cryptographic Authentication:** SSH is strictly limited to `ed25519` key-based authentication.
*   **Network Perimeter:** UFW (Uncomplicated Firewall) is configured to default-deny all ingress traffic. Only ports `22` (SSH), `9001` (Minima P2P), `9005` (Minima RPC), `4180` (CPIP Security), `51820` (WireGuard), and `6443` (k3s API) are exposed.
*   **Cluster Mesh Networking:** All inter-node communication is encrypted via WireGuard tunnels managed by the PiNet Cluster Manager.
*   **Container Isolation:** k3s workloads are isolated using strict AppArmor profiles, rootless container execution where possible, and Kubernetes NetworkPolicy egress/ingress lockdowns enforced per-namespace.
*   **Pod Security Hardening:** All production workloads run with `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem` where feasible, and `capabilities: drop: [ALL]`. ResourceQuota and LimitRange policies prevent resource exhaustion.
*   **MiniDAPP Sandboxing:** Decentralized applications run in a restricted runtime environment with limited access to the host filesystem and network.
*   **Real-Time Hypervisor & Terminal Security:** The native terminal integration and real-time hypervisor switching are executed with strict privilege separation, ensuring that Web3 UI interactions cannot arbitrarily escalate privileges on the host OS.
*   **Brute-Force Mitigation:** `fail2ban` is actively monitoring auth logs and will permanently drop IPs (`bantime = -1`) attempting SSH brute-force attacks. CPIP ITF Defense provides a complementary API-layer brute-force mitigation with HTTP 418 responses and IP blacklisting.
*   **Privilege Escalation:** The default `pi` user is locked, expired, and removed from the `sudo` group.
*   **Data at Rest:** Root and data partitions are encrypted via LUKS. IPFS storage is anchored to the Minima blockchain for integrity verification. CPIP CoffeeCipher v5 (AES-256-GCM) provides application-layer encryption with HKDF-SHA256 domain-separated key derivation.
*   **Boot Integrity:** Secure Boot and Measured Boot (via TPM 2.0 PCR sealing) ensure the chain of trust from the Boot ROM to the OS kernel.
*   **Confidential Computing Enclaves (v3.0.0):** Arm CCA / RISC-V AP-TEE hardware-backed enclaves with cryptographically measured runtime, TEE-signed attestation tokens anchored to the Minima blockchain.
*   **Verifiable Compute Proofs (v3.0.0):** RISC Zero zkVM integration for zero-knowledge proof generation and verification with on-chain anchoring.
*   **Decentralized Marketplace (v3.0.0):** Peer-to-peer edge compute marketplace with Minima escrow settlements and on-chain reputation.
*   **SSL/TLS with mkcert (v3.0.0):** Production-grade TLS termination via mkcert (local CA) or OpenSSL (self-signed fallback). Certificates auto-generated on first boot and stored at `~/.local/share/pinet/ssl/`. Server binds with `ssl_certfile` and `ssl_keyfile` for HTTPS by default. Certificates include SANs for localhost, 127.0.0.1, and ::1. Configuration via `PINET_SSL_ENABLED`, `PINET_SSL_CERT`, `PINET_SSL_KEY`, `PINET_SSL_HOSTS`, and `PINET_MKCERT_PATH`.
*   **HTTP Strict Transport Security (v3.0.0):** HSTS middleware sends `Strict-Transport-Security` header on all HTTPS responses with configurable `max-age` (default 31536000 = 1 year), `includeSubDomains`, and `preload` directives. HSTS is only applied to HTTPS responses (or when behind a reverse proxy via `x-forwarded-proto`/`x-forwarded-ssl` headers). Configuration via `PINET_HSTS_ENABLED`, `PINET_HSTS_MAX_AGE`, `PINET_HSTS_INCLUDE_SUBDOMAINS`, `PINET_HSTS_PRELOAD`.
*   **Security Response Headers (v3.0.0):** The HSTS middleware injects 11 additional security headers on every response: `Content-Security-Policy` (default-src 'self', frame-ancestors 'none', base-uri 'self', form-action 'self'), `Permissions-Policy` (camera, microphone, geolocation, payment, USB all denied), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: no-referrer`, `X-Permitted-Cross-Domain-Policies: none`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.

### CPIP Cryptographic Architecture

| Primitive | Algorithm | Standard | Usage |
| :--- | :--- | :--- | :--- |
| Symmetric AEAD | AES-256-GCM | FIPS 197 | Data at rest, RPC payload encryption |
| Key Derivation | HKDF-SHA256 | SP 800-56C | Domain-separated key derivation (recipe: "minima") |
| Digital Signatures | ECDSA P-256 | FIPS 186-4 | Node identity, message signing |
| Key Exchange | ECDH P-256 | FIPS 186-4 / SP 800-56A | Hybrid KEM classical component |
| Key Encapsulation | RSA-KEM-2048 OAEP | FIPS 186-4 / SP 800-56B | KEM-DEM hybrid encryption |
| Post-Quantum KEM | 1nf1D3L Kyber (ML-KEM-768, non-FIPS) | Non-FIPS (η=3, custom domain) | Optional PQ hybrid key exchange |
| Message Auth | HMAC-SHA256 | FIPS 180-4 | RPC tokens, mesh heartbeat auth |
| Hashing | SHA-256 | FIPS 180-4 | Identity, audit chain, RMP proofs |
| FIPS Mode | `CPIP_FIPS=1` | FIPS 140-2/3 self-tests | Power-on KATs (AES-GCM, HMAC, HKDF, ECDSA, ECDH) |
| HSM Support | PKCS#11 | — | Optional hardware-backed key storage |

**Note:** 1nf1D3L's Kyber is NOT FIPS 203 validated — it is a non-FIPS ML-KEM-768 variant with wider noise (η=3), custom domain tags, and NTT perturbation. Use for research, red-teaming, and survival scenarios. For FIPS-required deployments, use classical primitives only (set `CPIP_FIPS=1` and do not use Kyber).

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
