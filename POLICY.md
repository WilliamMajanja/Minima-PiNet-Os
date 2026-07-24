# Minima-PiNet-Os Project Policies

This document outlines the operational, security, and ethical policies governing the **Minima-PiNet-Os** project.

---

## 1. Security & Attestation Policy
*   **Remote Attestation:** All Minima-PiNet-Os nodes must support remote attestation. System integrity is verified by hashing `/boot/firmware` and `/etc/pinet` against the Minima blockchain (v2.0.0+).
*   **Zero Trust:** No service is trusted by default. All inter-container communication must occur over encrypted WireGuard veth pairs. Kubernetes NetworkPolicy enforces default-deny ingress and egress per namespace with explicit allowlists.
*   **CPIP Security Provider:** All nodes must use The Coffee Protocol (CPIP v5.1.1) as the primary cryptographic security provider. CPIP provides AES-256-GCM (FIPS 197), ECDSA/ECDH P-256 (FIPS 186-4), RSA-KEM-2048 (SP 800-56B), HMAC-SHA256 (FIPS 180-4), and optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange. FIPS 140-2/3 mode (`CPIP_FIPS=1`) is mandatory for regulated deployments.
*   **CPIP ITF Defense:** Active probe blocking, pentest tool detection, and IP blacklisting must be enabled (`CPIP_DEFENSE_ENABLED=1`) on all production nodes. Runtime defense policy groups (Anti-ISP, Anti-Stingray, Anti-Surveillance, Net-Neutrality) are individually toggleable via API without restart.
*   **CPIP Node Identity:** Node identity is established via CPIP-signed ECDSA P-256 keypairs with challenge-response authentication. The legacy MAC-derived node ID is deprecated. Cluster join requires `AUTH_CHALLENGE`/`AUTH_RESPONSE` message exchange.
*   **CPIP RPC Authentication:** Minima RPC calls must use HMAC-SHA256 token authentication (`CPIP_RPC_AUTH=1`). Basic Auth is deprecated. mTLS is recommended for external RPC exposure. Post-quantum TLS (`CPIP_PQ_TLS=1`, v1.3.0+) is recommended for future-proofed deployments, providing hybrid ECDH P-256 + Kyber-768 (ML-KEM-768) key exchange.
*   **CPIP Key Rotation:** Emergency key rotation is available via `POST /cpip/emergency {"action":"rotate_keys"}`. Regular key rotation is recommended every 90 days for production deployments. The CPIP master key can be TPM 2.0-hardware-sealed (v1.3.0+) to bind key access to the node's measured boot state.
*   **LXC Isolation:** Enterprise workloads must run within LXC containers. Direct host access is restricted to the `pinet-admin` group. Starting with v1.3.0, multi-tenant LXC quotas enforce per-container CPU, RAM, disk, IO, and process limits via cgroups v2 (up to 16 tenants per node).
*   **Confidential Computing Enclaves (v3.0.0):** Enclaves must be cryptographically measured on creation. Enclave measurement must be attested and anchored to the Minima blockchain. Only attested enclaves may process sensitive workloads. Enclave runtime images must be signed and verified before deployment.
*   **Verifiable Compute Proofs (v3.0.0):** All zkVM proofs generated for external consumption must use a trusted prover backend (RISC Zero or SP1). Proof verification must include on-chain anchoring for non-repudiability. Proofs for compliance or audit purposes must be archived with full public input disclosure.
*   **Decentralized Marketplace (v3.0.0):** All marketplace listings must reference a valid enclave attestation (`attestationRef`). Orders must use Minima escrow transactions for settlement. Rating manipulation is prohibited — all ratings are anchored on-chain and are non-repudiable.
*   **SSL/TLS Termination (v3.0.0):** All production PiNet-OS web services must terminate TLS via mkcert-generated certificates (preferred) or OpenSSL self-signed certificates (fallback). Certificates must include SANs for all served hosts. The web server starts with `ssl_certfile` and `ssl_keyfile` parameters. Configuration via `PINET_SSL_ENABLED=1` and `PINET_SSL_HOSTS`.
*   **HTTP Strict Transport Security (v3.0.0):** HSTS must be enabled on all HTTPS-serving nodes (`PINET_HSTS_ENABLED=1`). The `Strict-Transport-Security` header must be set with `max-age` of at least 31536000 (1 year), `includeSubDomains`, and `preload`. HSTS headers are only applied to HTTPS responses.
*   **Security Response Headers (v3.0.0):** All HTTP responses must include: `Content-Security-Policy` (default-src 'self'), `Permissions-Policy` (deny camera/microphone/geolocation/payment/USB), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: no-referrer`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`. These headers are enforced by the CPIP security middleware.
*   **Pod Security:** All K3s workloads must run as non-root, drop all Linux capabilities, and disable privilege escalation. ResourceQuota and LimitRange are enforced per namespace to prevent resource exhaustion.

## 2. Data Privacy Policy
*   **Decentralized-First:** Minima-PiNet-Os prioritizes decentralized storage (IPFS) and communication (Maxima). Personal data should never be stored in centralized cloud environments.
*   **Encryption at Rest:** All sensitive cluster secrets and blockchain keys are encrypted using hardware-backed keys where available (TPM 2.0 or Secure Boot). CPIP CoffeeCipher v5 (AES-256-GCM with HKDF-SHA256) provides application-layer encryption with domain-separated key derivation (recipe: "minima"). Encrypted persistence uses v3 format with HMAC integrity verification.
*   **Telemetry:** Minima-PiNet-Os does not collect telemetry. System logs remain local to the node unless explicitly shared by the user for debugging. CPIP audit logs (SHA-256 tamper-evident chain) are stored locally.
*   **On-Device LLM (v1.3.0):** User prompts sent to the LLM Gateway are processed locally on-device via Ollama (llama.cpp/GGUF) with Hailo-8L NPU acceleration. Prompts are forwarded to Gemini cloud only when explicitly falling back (`PINET_LLM_FALLBACK_GEMINI=1`). No prompt data is stored or logged by the gateway.

## 3. Hardware Support Policy
*   **Primary Target:** Raspberry Pi 5 (16GB) is the reference platform for all Minima-PiNet-Os development.
*   **Backward Compatibility:** Minima-PiNet-Os maintains "Best Effort" support for Raspberry Pi 4 (4GB+). Features requiring NPU acceleration (Hailo-8L) will fall back to ARM NEON CPU inference on older hardware.
*   **Custom Sensors (v1.3.0):** Pi Zero 2 W is supported as a low-power custom sensor node (max 4 sensors, 15s minimum poll interval). I2C, GPIO, SPI, 1-Wire, ADC, and UART sensor buses are supported. See the Sensor Manager API at `/api/sensors/*`.
*   **RISC-V (v2.0.0):** StarFive VisionFive 2 (JH7110, SiFive U74 quad-core) is the reference RISC-V board. Cross-build tooling is provided in `build-system/build-riscv.sh`. Support is experimental; not all PiNet-OS features are validated on RISC-V.
*   **Storage:** NVMe SSDs via PCIe Gen 3 are strictly recommended for Enterprise workloads to prevent I/O bottlenecks.

## 4. Release & Artifact Policy
*   **Verified Builds:** Only images generated via the **Enterprise Imager Utility** and passing the `pinet-health-check.sh` suite are considered "Official Releases." Starting with v2.0.0, builds are deterministic (`build-system/reproducible-build.sh`) using pinned package versions (`build-system/packages.lock`) and `SOURCE_DATE_EPOCH` for bit-for-bit reproducibility.
*   **CPIP FIPS Self-Test:** All release artifacts must pass CPIP FIPS power-on self-tests (AES-256-GCM, HMAC-SHA256, HKDF-SHA256, ECDSA P-256, ECDH P-256) before publication. In FIPS mode (`CPIP_FIPS=1`), self-test failure blocks startup.
*   **GitHub Distribution:** All official artifacts must be cryptographically signed (ECDSA P-256 via CPIP) and pushed to the GitHub Release repository.
*   **Rolling Updates:** Minima-PiNet-Os follows a rolling-release model for the Web3 UI, while the underlying LXC hypervisor receives quarterly stability patches.

## 5. Ethical AI Usage
*   **Local Inference:** Minima-PiNet-Os promotes local AI inference to protect user privacy and reduce reliance on proprietary black-box models. The LLM Gateway (v1.3.0) prioritizes local inference via Ollama over cloud fallback.
*   **Transparency:** All AI models deployed via the DePAi Executor or LLM Gateway must include a model card detailing training data and bias considerations. Cloud fallback (Gemini) is opt-in and disabled by default.
*   **On-Device Processing:** User data for LLM inference is processed locally by default. Cloud fallback only activates when explicitly configured.

## 6. Community & Support Policy
*   **Open Source:** Minima-PiNet-Os is and will always remain open source under the MIT License.
*   **Support:** Technical support is provided via the official GitHub Issues and Community Discord. Enterprise-tier support is available for commercial deployments.
*   **Code of Conduct:** All community interactions must adhere to the Contributor Covenant.

---

*Last Updated: October 2026*
*Architect: William Majanja*
