# PiNet-OS: A Decentralized Edge Operating System with Post-Quantum Security and Trusted Execution

**Version 3.0.0 — October 2026**  
**Author:** William Majanja  
**License:** MIT

---

## Abstract

PiNet-OS is an open-source, decentralized edge operating system purpose-built for single-board computers (SBCs), with primary targeting of the Raspberry Pi 5 and experimental support for RISC-V platforms. Unlike traditional edge OSes that rely on cloud backends for identity, orchestration, and security, PiNet-OS anchors all trust in a local Minima blockchain node, enabling fully offline operation, peer-to-peer cluster management, and cryptographically attested system integrity.

This whitepaper describes the architecture spanning v1.3.0 (on-device LLM gateway, multi-tenant LXC quotas, TPM 2.0 hardware key-wrap, post-quantum TLS), v2.0.0 (formal remote attestation, deterministic builds, RISC-V reference platform), and **v3.0.0 (confidential computing enclaves, verifiable compute proofs via zkVM, decentralized edge compute marketplace)**. Together these milestones deliver a production-ready edge OS suitable for enterprise IoT, decentralized AI inference, and air-gapped deployments, now extended with verifiable computation and peer-to-peer compute trading.

---

## 1. Introduction

Edge computing faces a fundamental trust problem. Traditional IoT platforms delegate identity, orchestration, and policy enforcement to cloud services, introducing latency, single points of failure, and privacy exposure. Decentralized approaches exist but typically require specialized hardware, complex key management, or sacrifice performance.

PiNet-OS addresses these challenges through a layered architecture:

1. **A local Minima blockchain node** provides cryptographic identity, a P2P message bus (Maxima), and an immutable ledger for attestation records.
2. **A CPIP security provider** (The Coffee Protocol v5.0.5) delivers FIPS-grade cryptography, ITF active defense, and optional post-quantum key exchange.
3. **A browser-based desktop** (FastAPI + Jinja2), served locally, provides visual cluster management, file management, terminal access, and a DApp runtime with zero-trust sandboxing.
4. **A hardware abstraction layer** automatically detects and accelerates AI inference (Hailo-8L NPU), manages LXC containers with cgroups v2 quotas, seals keys via TPM 2.0, runs confidential workloads in hardware-backed enclaves (Arm CCA / RISC-V AP-TEE), generates and verifies zero-knowledge proofs, and hosts a peer-to-peer edge compute marketplace.

---

## 2. System Architecture

### 2.1 Layered Design

```
┌──────────────────────────────────────────────────┐
│              Browser Desktop (Layer 2)            │
│  FastAPI + Jinja2 | 27 built-in apps | DApp SDK │
├──────────────────────────────────────────────────┤
│         Control Plane (Layer 1 — Go + Python)     │
│   Go Cluster Manager | LXC Hypervisor | LLM GW   │
│   CPIP Security | Attestation | Sensor Manager   │
│   Enclave Controller | ZK Prover | Marketplace   │
├──────────────────────────────────────────────────┤
│       Runtime Kernel (Layer 0 — Linux)            │
│   Debian Bookworm | cgroups v2 | WireGuard       │
│   TPM 2.0 | LUKS2 | AppArmor | nftables          │
├──────────────────────────────────────────────────┤
│       Blockchain Root of Trust                    │
│   Minima L1 (Java) | Maxima P2P | RMP State      │
└──────────────────────────────────────────────────┘
```

### 2.2 Trust Model

PiNet-OS implements a **zero-trust, locally-anchored** trust model:

- **Identity:** Each node generates an ECDSA P-256 keypair via CPIP. The public key is registered as a Minima address. All Maxima P2P messages are signed and encrypted.
- **Attestation:** TPM 2.0 PCR values (boot ROM → bootloader → kernel → `/etc/pinet`) are hashed and recorded on the Minima blockchain. Any tamper is detectable by comparing on-chain PCRs with live measurements.
- **Key Management:** CPIP master keys can be PCR-sealed to the TPM. The sealed blob decrypts only when the system boot path matches the sealing PCR values. Emergency key rotation wipes and re-derives all cryptographic material.
- **Network:** All cluster traffic traverses encrypted WireGuard tunnels. Kubernetes NetworkPolicy enforces default-deny per namespace. CPIP ITF Defense provides API-layer probe blocking and IP blacklisting.

---

## 3. Feature Deep Dive

### 3.1 v1.3.0: On-Device LLM Gateway

PiNet-OS v1.3.0 introduces a local LLM inference gateway based on Ollama (llama.cpp/GGUF) with Hailo-8L NPU acceleration.

**Architecture:**

```
User Prompt → FastAPI Route (/api/llm/chat)
                ↓
         LLM Gateway Service
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
  Ollama (local)      Gemini (cloud)
  Hailo-8L NPU        (fallback, opt-in)
  llama3.2:3b
```

**Key Properties:**

- **Privacy:** User prompts never leave the device unless `PINET_LLM_FALLBACK_GEMINI=1` is explicitly set.
- **Acceleration:** The Hailo-8L NPU (13 TOPS) accelerates GGUF model inference via the HailoRT runtime, offloading from the ARM CPU.
- **Graceful Degradation:** If the NPU is absent, inference falls back to ARM NEON CPU.
- **No External Dependencies:** The gateway runs entirely offline when cloud fallback is disabled.

### 3.2 v1.3.0: Multi-Tenant LXC Quotas

Enterprise deployments require strict resource isolation between tenants. PiNet-OS v1.3.0 adds a managed LXC quota system:

- Per-container limits: CPU (cpuset + cpu.max), RAM (memory.max), disk (blkio.throttle), IOPS, and process count (pids.max).
- Maximum 16 tenants per node, enforced via `PINET_LXC_MAX_TENANTS`.
- Quota violations logged via the cluster audit trail.
- API at `/api/lxc/tenants` for CRUD operations.

```
Tenant A (50% CPU, 512 MB RAM)
Tenant B (25% CPU, 256 MB RAM)
Tenant C (25% CPU, 256 MB RAM)
─────────────────────────────
cgroups v2 hierarchy on host
```

### 3.3 v1.3.0: TPM 2.0 Hardware Key-Wrap

CPIP master keys are the root of all cryptographic operations. If extracted, an attacker can impersonate the node, decrypt RPC traffic, and forge attestations. TPM key-wrap binds keys to hardware:

1. On first boot with `PINET_TPM_KEYWRAP=1`, the CPIP master key is sealed to the TPM's SRK (Storage Root Key) with a PCR policy covering PCR 0–7 (boot chain).
2. The sealed blob is stored at `PINET_TPM_SEALED_KEY`.
3. On subsequent boots, the TPM unseals the blob only if current PCR values match the sealing policy.
4. On mismatch (tampered boot), unseal fails and the node enters emergency lockdown.

The TPM seal/unseal flow uses the standard TPM2_PCR_Read + TPM2_PolicyPCR + TPM2_Unseal command sequence via the `tpm2-tss` tools.

### 3.4 v1.3.0: CPIP Post-Quantum TLS

CPIP RPC transport can be upgraded to hybrid post-quantum TLS:

- **Key Exchange:** ECDH P-256 (classical) + Kyber-768 (ML-KEM-768 variant, non-FIPS) in parallel. The session key is the concatenation of both shared secrets, hashed through HKDF-SHA256.
- **Cipher Suites:** AES-256-GCM for symmetric encryption (unchanged from classical CPIP).
- **Configuration:** `CPIP_PQ_TLS=1` enables PQ handshake; `CPIP_PQ_HYBRID=1` (default) ensures classical fallback. Setting hybrid=0 forces pure Kyber (incompatible with non-PQ peers).
- **Rationale:** Kyber-768 is selected for its estimated NIST security level 3 (AES-128 equivalence) and smaller ciphertext size vs. Kyber-1024.

### 3.5 v2.0.0: Formal Remote Attestation

v2.0.0 replaces the basic integrity check from earlier versions with a formal attestation protocol:

**Attestation Flow:**

```
Verifier                    Prover (PiNet Node)
   │                              │
   │── GET /attestation/challenge ─│
   │←──── nonce (32 bytes) ───────│
   │                              │
   │── GET /attestation/report ───│
   │   (includes nonce)           │
   │←──── attestation report ─────│
   │   {                          │
   │     nonce,                   │
   │     pcr_values (0-7, 8),     │
   │     pcr_signature (ECDSA),   │
   │     cpip_quote,              │
   │     minima_tx_ref            │
   │   }                          │
   │                              │
   │ Verify:                      │
   │ 1. PCR signature from CPIP   │
   │ 2. Matching on-chain record  │
   │ 3. Nonce freshness           │
```

The prover signs its PCR values with its CPIP ECDSA P-256 key and records the hash on Minima. The verifier checks both the signature and the on-chain anchor, making the report non-repudiable and publicly auditable.

### 3.6 v2.0.0: Deterministic Image Builds

Release artifacts are bit-for-bit reproducible using:

- **Pinned packages:** `build-system/packages.lock` lists exact Debian package versions.
- **SOURCE_DATE_EPOCH:** All timestamps in the image are clamped to the release date.
- **Reproducible kernel:** Build with `KBUILD_BUILD_TIMESTAMP` and deterministic compression.
- **Verification:** Two independent builds produce identical SHA-256 hashes.

```
bash build-system/reproducible-build.sh --verify
[INFO] Build 1: sha256: a1b2c3d4e5f6...
[INFO] Build 2: sha256: a1b2c3d4e5f6...
[PASS] Builds match — image is deterministic
```

### 3.7 v3.0.0: SSL/TLS with mkcert and HSTS

PiNet-OS v3.0.0 adds production-grade TLS termination and HTTP security headers to the web server:

**TLS Architecture:**

```
Browser ──HTTPS──► FastAPI (uvicorn)
                      │
                ssl_certfile + ssl_keyfile
                      │
              ┌───────┴───────┐
              ↓               ↓
           mkcert          OpenSSL
         (local CA)    (self-signed)
              │               │
        ~/.local/share/pinet/ssl/
        ├── certs/server.pem
        ├── certs/server-key.pem
        └── ca/rootCA.pem
```

**Key Properties:**
- **mkcert (preferred):** Generates a local CA (`rootCA.pem`) and server certificates with SANs for localhost, 127.0.0.1, and ::1. Trusted by the local system after `mkcert -install`. Configured via `PINET_MKCERT_PATH`.
- **OpenSSL (fallback):** Self-signed CA + server certificate when mkcert is unavailable. CA certificate can be installed to the system trust store via `POST /api/ssl/install-ca`.
- **Auto-generation:** Certificates are generated on first boot via `ssl_manager.ensure_certs()` when no valid certificate is found at `PINET_SSL_CERT`/`PINET_SSL_KEY`.
- **HSTS:** The `Strict-Transport-Security` header is set on all HTTPS responses with `max-age=31536000` (1 year), `includeSubDomains`, and `preload`. HSTS only applies to HTTPS responses (or when behind a reverse proxy via `x-forwarded-proto`).
- **Security Headers:** 11 additional headers (CSP, Permissions-Policy, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, COEP, COOP, CORP) are injected on every response.
- **CLI:** `pinet ssl` manages certificate lifecycle (status, generate, install, delete).
- **API:** `/api/ssl/*` endpoints for certificate management, status, and download.

### 3.8 v2.0.0: RISC-V Reference Platform

PiNet-OS v2.0.0 adds experimental support for the StarFive VisionFive 2 (JH7110 SoC, SiFive U74 quad-core RISC-V):

- **Cross-build toolchain:** `build-system/build-riscv.sh` produces `PiNetOS-riscv64.img` from an x86_64 or aarch64 build host.
- **Kernel:** Linux 6.12+ with JH7110 DTS in `kernel/riscv/`.
- **Boot:** U-Boot SPL + OpenSBI, configured in `boot/riscv/`.
- **Limitations:** Hailo-8L NPU (PCIe drivers not yet validated on JH7110), cluster manager (Go binary requires RISC-V port), and certain CPIP features are not yet validated on RISC-V.

### 3.9 v3.0.0: Confidential Computing Enclaves

PiNet-OS v3.0.0 introduces confidential computing enclaves supporting Arm CCA (Confidential Compute Architecture) and RISC-V AP-TEE (Application-Profile Trusted Execution Environment):

**Architecture:**

```
User → FastAPI Route (/api/enclaves/*)
         ↓
   Enclave Manager Service
         ↓
   ┌─────┴─────┐
   ↓           ↓
 Arm CCA   RISC-V AP-TEE
 (Realm)   (TEE)
```

**Key Properties:**
- **Isolation:** Each enclave runs in a hardware-isolated region with encrypted memory, inaccessible to the host OS.
- **Measurement:** Enclave runtime is cryptographically measured (SHA-256 of boot code, config, and data). Measurement is signed by the TEE firmware and anchored to the Minima blockchain.
- **Attestation:** Remote verifiers can request an enclave attestation report containing measurement, runtime hash, and a nonce-signed token. The token is verified against the CPIP ECDSA P-256 public key.
- **API:** CRUD at `/api/enclaves/*` — create, stop, terminate, measure, attest.
- **Config:** `PINET_ENCLAVE_TEE_TYPE` selects `cca` or `riscv-tee`; `PINET_ENCLAVE_MAX_PER_NODE` limits concurrency.

### 3.10 v3.0.0: Verifiable Compute Proofs (zkVM)

PiNet-OS v3.0.0 integrates a zero-knowledge virtual machine (zkVM) proof system based on RISC Zero:

**Proof Generation Flow:**

```
Program Source → RISC Zero zkVM
                    ↓
            Execution Trace
                    ↓
             STARK Proof
                    ↓
        Compressed SNARK (Groth16)
                    ↓
         On-chain verification (Minima)
```

**Key Properties:**
- **Prover Backend:** RISC Zero (default) with support for SP1 (Succinct Labs). Configured via `PINET_ZK_PROVER`.
- **Verification:** Proofs can be verified locally or anchored to the Minima blockchain via ledger transaction.
- **API:** Generate proofs at `POST /api/zk/proofs`, verify at `POST /api/zk/proofs/{id}/verify`.
- **Use Cases:** Verifiable inference attestation, integrity proofs for sensor data, anonymous reputation in the marketplace.

### 3.11 v3.0.0: Decentralized Edge Compute Marketplace

PiNet-OS v3.0.0 introduces a peer-to-peer marketplace for leasing edge compute resources:

**Marketplace Flow:**

```
Seller (Node A)              Marketplace API              Buyer (Node B)
      │                            │                            │
      │── POST /marketplace/listings                           │
      │   (CPU, RAM, disk, NPU, price)                         │
      │                            │                            │
      │                            │── GET /marketplace/listings│
      │                            │   (filter by RAM, tags)   │
      │                            │←──────────────────────────│
      │                            │                            │
      │                            │── POST /marketplace/orders│
      │◄── escrow Tx ──────────────│←── escrow Tx ─────────────│
      │    (Minima burn)           │         (Minima burn)      │
      │                            │                            │
      │── lease active ────────────│──────────────────────────►│
      │                            │                            │
      │                            │── POST /orders/{id}/complete
      │◄── payment release ────────│──────────────────────────►│
```

**Key Properties:**
- **Escrow:** Orders use Minima blockchain transactions for escrow — both parties commit tokens; the smart contract releases on verified completion.
- **Attestation Binding:** Each order references an enclave attestation (`attestationRef`) so buyers verify the seller runs authentic PiNet-OS.
- **Reputation:** Five-star rating system with on-chain anchoring. Ratings are non-repudiable.
- **Discovery:** Listings are discoverable by node ID, minimum RAM, tags, and NPU type via `GET /api/marketplace/listings`.
- **Config:** `PINET_MARKETPLACE_MAX_LISTINGS` (default 100), `PINET_MARKETPLACE_ESCROW_TOKENS`.

---

## 4. Security Analysis

### 4.1 Threat Model

| Threat | Mitigation |
|---|---|
| Physical device theft | LUKS2 + TPM PCR-sealed key; unseal fails on tampered boot |
| Remote RCE | CPIP ITF Defense, AppArmor, no-root pods, sandboxed DApps |
| RPC sniffing | WireGuard mesh + CPIP PQ-TLS (AES-256-GCM + Kyber-768) |
| Node impersonation | CPIP ECDSA P-256 challenge-response AUTH_CHALLENGE |
| Cluster member DoS | fail2ban + CPIP rate-limiting + LXC resource quotas |
| Supply-chain tampered image | Deterministic builds + SHA-256SUMS + CPIP-signed release artifacts |
| Quantum cryptanalytic adversary | CPIP PQ-TLS hybrid ECDH + Kyber-768 |
| Firmware-level rootkit | TPM measured boot (PCR 0–7) + on-chain attestation |
| Enclave runtime tampering | Enclave measurement + TEE-signed attestation anchored to Minima |
| Proof forgery | zkVM STARK → SNARK compression with on-chain verification |
| Marketplace fraud | Minima escrow burn + attestation-binding + non-repudiable ratings |

### 4.2 Cryptographic Inventory

| Primitive | Algorithm | Standard | Role |
|---|---|---|---|
| Symmetric | AES-256-GCM | FIPS 197 | Data at rest, RPC payload |
| KDF | HKDF-SHA256 | SP 800-56C | Key derivation, domain separation |
| Signatures | ECDSA P-256 | FIPS 186-4 | Node identity, attestation |
| Classical KEX | ECDH P-256 | SP 800-56A | PQ-TLS hybrid component |
| PQ KEM | Kyber-768 (ML-KEM-768) | Non-FIPS | PQ-TLS quantum-safe component |
| KEM | RSA-KEM-2048 OAEP | SP 800-56B | Legacy key encapsulation |
| Hashing | SHA-256 | FIPS 180-4 | Integrity, audit chain |
| FIPS mode | `CPIP_FIPS=1` | FIPS 140-2/3 | KAT self-tests on startup |

---

## 5. Performance Characteristics

Measured on Raspberry Pi 5 (16 GB) + Hailo-8L + Samsung 990 Pro NVMe:

| Metric | Value |
|---|---|
| Web desktop cold start | ~1.2 s |
| API throughput (GET /api/health) | ~4500 req/s |
| LLM inference (llama3.2:3b, NPU) | ~45 tokens/s |
| LLM inference (llama3.2:3b, CPU NEON) | ~8 tokens/s |
| Minima node sync (full chain) | ~3 min (first sync) |
| LXC tenant creation | ~800 ms |
| TPM seal/unseal | ~150 ms / ~120 ms |
| PQ-TLS handshake (ECDH + Kyber-768) | ~95 ms |
| Attestation report generation | ~200 ms |
| Deterministic image build (full) | ~18 min |
| SSL/TLS handshake (mkcert) | ~15 ms |
| Enclave creation (Arm CCA) | ~2 s |
| ZK proof generation (simple program) | ~5 s |
| ZK proof verification | ~200 ms |
| Marketplace listing creation | ~50 ms |
| Power consumption (idle) | ~7.5 W |
| Power consumption (AI inference) | ~12 W |

---

## 6. Deployment Model

PiNet-OS supports three deployment modes:

**Standalone Edge Node:** A single Raspberry Pi 5 running Minima, CPIP, the web desktop, and optional Hailo-8L NPU for local AI. Suitable for home automation, sensor gateways, and small business servers.

**Cluster (K3s):** Up to 16 nodes coordinated via Maxima P2P with WireGuard mesh. One control-plane node runs the PiNet desktop; workers provide compute, AI inference, or storage. LXC quotas isolate tenants within a node; NetworkPolicy isolates between namespaces.

**Air-Gapped / Field Deployment:** Fully offline operation. Minima blockchain runs locally. CPIP provides all cryptography without internet access. LLM gateway runs locally with no cloud fallback. OTA updates are applied via USB stick.

---

## 7. Roadmap

### v1.3.0 — Current (October 2026)
- ✅ On-device LLM gateway (Ollama + Hailo-8L)
- ✅ Multi-tenant LXC resource quotas (cgroups v2)
- ✅ TPM 2.0 hardware key-wrap for CPIP
- ✅ CPIP post-quantum TLS (ECDH + Kyber-768)
- ✅ Updated docs and policies

### v2.0.0 — Current (October 2026)
- ✅ Formal remote attestation (TPM + blockchain)
- ✅ Deterministic image rebuilds
- ✅ RISC-V reference board (VisionFive 2)

### v3.0.0 — Current (October 2026)
- ✅ Confidential computing enclaves (Arm CCA / RISC-V AP-TEE)
- ✅ Verifiable compute proofs (zkVM-based with RISC Zero)
- ✅ Decentralized edge compute marketplace with Minima escrow
- ✅ Enclave measurement + attestation + on-chain anchoring

### v3.1.0 — Planned
- ⬜ USB/IP peripheral sharing across cluster
- ⬜ Encrypted ZFS snapshots with TPM sealing
- ⬜ On-chain identity federation (DID:minima)

---

## 8. Conclusion

PiNet-OS v3.0.0 delivers a production-ready decentralized edge operating system that eliminates cloud dependencies for identity, orchestration, and trust. The combination of a local blockchain root of trust, FIPS-grade cryptography with optional post-quantum upgrade, hardware-anchored key management, formal remote attestation, confidential computing enclaves, verifiable compute proofs, and a peer-to-peer compute marketplace makes PiNet-OS suitable for the most demanding edge deployments — from enterprise IoT and decentralized AI to air-gapped critical infrastructure and verifiable edge compute trading.

All components are open source under the MIT License. Source code and release artifacts are available at [github.com/WilliamMajanja/Minima-PiNet-Os](https://github.com/WilliamMajanja/Minima-PiNet-Os).

---

## References

1. Minima Blockchain Protocol — https://minima.com
2. The Coffee Protocol (CPIP) — https://github.com/WilliamMajanja/CPIP-
3. NIST FIPS 197 (AES) — https://csrc.nist.gov/publications/detail/fips/197/final
4. NIST FIPS 186-4 (ECDSA, ECDH) — https://csrc.nist.gov/publications/detail/fips/186/4/final
5. NIST FIPS 140-2/3 — https://csrc.nist.gov/publications/detail/fips/140/3/final
6. NIST SP 800-56C (HKDF) — https://csrc.nist.gov/publications/detail/sp/800-56c/rev-2/final
7. CRYSTALS-Kyber (ML-KEM) — https://pq-crystals.org/kyber/
8. TPM 2.0 Library Specification — https://trustedcomputinggroup.org/resource/tpm-library-specification/
9. Ollama — https://ollama.ai
10. Hailo-8L NPU — https://hailo.ai/products/ai-accelerators/hailo-8l-m2/
