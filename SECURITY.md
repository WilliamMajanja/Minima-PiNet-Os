# Security Policy for Minima-PiNet-Os

**Document Classification:** PUBLIC / SECURITY POLICY  
**Applies To:** Minima-PiNet-Os Core, Edge Node Infrastructure, PiNet Neural Framework, PiNet Cluster Manager, k3s Edge Compute, IPFS Storage, MiniDAPP Runtime, CPIP Security Provider (The Coffee Protocol)

This document outlines the security policies, vulnerability reporting procedures, and the zero-trust threat model governing the Minima-PiNet-Os stack.

## Supported Versions

We maintain a strict rolling-release security model. Only the latest stable release and the immediate prior LTS (Long Term Support) release receive active security patches.

| Version | Supported | Notes |
| :--- | :--- | :--- |
| **1.2.x (Current)** | ✅ Yes | K3s cluster, zero-trust NetworkPolicy, PodSecurity hardening, CPIP security provider. |
| **1.1.x (LTS)** | ✅ Yes | FastAPI desktop, security hardening baseline. |
| **1.0.x (Legacy)** | ⚠️ Critical only | Critical security patches only. |
| **< 1.0.x** | ❌ No | End of Life. |

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
*   **CPIP Security Provider (The Coffee Protocol v4.0.2):** All Minima nodes and PiNet-OS services use CPIP as the primary cryptographic security provider. CPIP provides CoffeeCipher v3 (AES-256-GCM, FIPS 197) with HKDF-SHA256 key derivation for data at rest and in transit, ECDSA/ECDH P-256 (FIPS 186-4) for node identity and challenge-response authentication, RSA-KEM-2048 (FIPS 186-4 / SP 800-56B) for key encapsulation, HMAC-SHA256 for RPC token authentication, and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange. FIPS 140-2/3 mode is available via `CPIP_FIPS=1`. See [CPIP SECURITY.md](https://github.com/WilliamMajanja/CPIP-/blob/main/SECURITY.md) for full cryptographic details.
*   **CPIP ITF Defense:** Active network defense at the API ingress layer. Probe blocking (HTTP 418), pentest tool fingerprinting (Burp Suite, Nmap, SQLMap, Nikto, etc.), IP blacklisting with rate-limited exponential ban duration, and runtime-toggleable defense policy groups (Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality).
*   **CPIP Node Identity:** Each node receives a CPIP-signed ECDSA P-256 identity with challenge-response authentication, replacing the legacy MAC-derived node ID. Node identities are carried in `ClusterNode.cpipIdentity` and `ClusterNode.cpipPublicKey` model fields. Cluster join uses `AUTH_CHALLENGE`/`AUTH_RESPONSE` message types.
*   **CPIP RPC Token Authentication:** Minima RPC calls are authenticated with HMAC-SHA256 time-bounded tokens (`Authorization: CPIP <token>` header), replacing Basic Auth. Token TTL is configurable via `CPIP_TOKEN_TTL` (default 300s). mTLS support via `CPIP_MTLS_CERT`/`CPIP_MTLS_KEY`/`CPIP_MTLS_CA`.
*   **CPIP Sidecar (K3s):** The Minima DaemonSet runs a CPIP sidecar container (`cpip:4.0.2`) on port 4180, providing defense API, health probes (`/health`, `/ready`), and Prometheus metrics (`/cpip/metrics`). NetworkPolicy restricts CPIP port access to Desktop and Minima pods.
*   **CPIP Sidecar (Systemd):** A dedicated `cpip.service` systemd unit runs the CPIP provider daemon with `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, and `CapabilityBoundingSet=` hardening. The `minima.service` unit depends on `cpip.service` via `After=cpip.service`.
*   **CPIP Emergency Mode:** Instant key rotation, secure memory wipe, peer notification, and stealth activation via `POST /cpip/emergency {"action":"activate"|"rotate_keys"|"wipe"|"deactivate"}`.
*   **Enterprise Hypervisor (LXC):** Workloads are isolated in LXC containers (`pinet-enterprise-env`) with kernel-level namespace separation, preventing container escapes from impacting the host OS.
*   **Blockchain-Backed Remote Attestation:** System integrity is verified by hashing `/boot/firmware` and `/etc/pinet`, attested against the immutable Minima ledger. Any unauthorized tampering triggers an immediate security lockdown.
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
*   **Data at Rest:** Root and data partitions are encrypted via LUKS. IPFS storage is anchored to the Minima blockchain for integrity verification. CPIP CoffeeCipher v3 (AES-256-GCM) provides application-layer encryption with HKDF-SHA256 domain-separated key derivation.
*   **Boot Integrity:** Secure Boot and Measured Boot (via TPM 2.0 PCR sealing) ensure the chain of trust from the Boot ROM to the OS kernel.

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
