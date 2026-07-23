# Minima-PiNet-Os Project Policies

This document outlines the operational, security, and ethical policies governing the **Minima-PiNet-Os** project.

---

## 1. Security & Attestation Policy
*   **Remote Attestation:** All Minima-PiNet-Os nodes must support remote attestation. System integrity is verified by hashing `/boot/firmware` and `/etc/pinet` against the Minima blockchain.
*   **Zero Trust:** No service is trusted by default. All inter-container communication must occur over encrypted WireGuard veth pairs. Kubernetes NetworkPolicy enforces default-deny ingress and egress per namespace with explicit allowlists.
*   **CPIP Security Provider:** All nodes must use The Coffee Protocol (CPIP v4.0.2) as the primary cryptographic security provider. CPIP provides AES-256-GCM (FIPS 197), ECDSA/ECDH P-256 (FIPS 186-4), RSA-KEM-2048 (SP 800-56B), HMAC-SHA256 (FIPS 180-4), and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange. FIPS 140-2/3 mode (`CPIP_FIPS=1`) is mandatory for regulated deployments.
*   **CPIP ITF Defense:** Active probe blocking, pentest tool detection, and IP blacklisting must be enabled (`CPIP_DEFENSE_ENABLED=1`) on all production nodes. Runtime defense policy groups (Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality) are individually toggleable via API without restart.
*   **CPIP Node Identity:** Node identity is established via CPIP-signed ECDSA P-256 keypairs with challenge-response authentication. The legacy MAC-derived node ID is deprecated. Cluster join requires `AUTH_CHALLENGE`/`AUTH_RESPONSE` message exchange.
*   **CPIP RPC Authentication:** Minima RPC calls must use HMAC-SHA256 token authentication (`CPIP_RPC_AUTH=1`). Basic Auth is deprecated. mTLS is recommended for external RPC exposure.
*   **CPIP Key Rotation:** Emergency key rotation is available via `POST /cpip/emergency {"action":"rotate_keys"}`. Regular key rotation is recommended every 90 days for production deployments.
*   **LXC Isolation:** Enterprise workloads must run within LXC containers. Direct host access is restricted to the `pinet-admin` group.
*   **Pod Security:** All K3s workloads must run as non-root, drop all Linux capabilities, and disable privilege escalation. ResourceQuota and LimitRange are enforced per namespace to prevent resource exhaustion.

## 2. Data Privacy Policy
*   **Decentralized-First:** Minima-PiNet-Os prioritizes decentralized storage (IPFS) and communication (Maxima). Personal data should never be stored in centralized cloud environments.
*   **Encryption at Rest:** All sensitive cluster secrets and blockchain keys are encrypted using hardware-backed keys where available (TPM 2.0 or Secure Boot). CPIP CoffeeCipher v3 (AES-256-GCM with HKDF-SHA256) provides application-layer encryption with domain-separated key derivation (recipe: "minima"). Encrypted persistence uses v3 format with HMAC integrity verification.
*   **Telemetry:** Minima-PiNet-Os does not collect telemetry. System logs remain local to the node unless explicitly shared by the user for debugging. CPIP audit logs (SHA-256 tamper-evident chain) are stored locally.

## 3. Hardware Support Policy
*   **Primary Target:** Raspberry Pi 5 (16GB) is the reference platform for all Minima-PiNet-Os development.
*   **Backward Compatibility:** Minima-PiNet-Os maintains "Best Effort" support for Raspberry Pi 4 (4GB+). Features requiring NPU acceleration (Hailo-8L) will fall back to ARM NEON CPU inference on older hardware.
*   **Storage:** NVMe SSDs via PCIe Gen 3 are strictly recommended for Enterprise workloads to prevent I/O bottlenecks.

## 4. Release & Artifact Policy
*   **Verified Builds:** Only images generated via the **Enterprise Imager Utility** and passing the `pinet-health-check.sh` suite are considered "Official Releases."
*   **CPIP FIPS Self-Test:** All release artifacts must pass CPIP FIPS power-on self-tests (AES-256-GCM, HMAC-SHA256, HKDF-SHA256, ECDSA P-256, ECDH P-256) before publication. In FIPS mode (`CPIP_FIPS=1`), self-test failure blocks startup.
*   **GitHub Distribution:** All official artifacts must be cryptographically signed (ECDSA P-256 via CPIP) and pushed to the GitHub Release repository.
*   **Rolling Updates:** Minima-PiNet-Os follows a rolling-release model for the Web3 UI, while the underlying LXC hypervisor receives quarterly stability patches.

## 5. Ethical AI Usage
*   **Local Inference:** Minima-PiNet-Os promotes local AI inference to protect user privacy and reduce reliance on proprietary black-box models.
*   **Transparency:** All AI models deployed via the DePAi Executor must include a model card detailing training data and bias considerations.

## 6. Community & Support Policy
*   **Open Source:** Minima-PiNet-Os is and will always remain open source under the MIT License.
*   **Support:** Technical support is provided via the official GitHub Issues and Community Discord. Enterprise-tier support is available for commercial deployments.
*   **Code of Conduct:** All community interactions must adhere to the Contributor Covenant.

---

*Last Updated: April 9, 2026*
*Architect: William Majanja*
