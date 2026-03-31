# PiNet 3.0 Project Policies

This document outlines the operational, security, and ethical policies governing the **PiNet 3.0 Enterprise** project.

---

## 1. Security & Attestation Policy
*   **Remote Attestation:** All PiNet 3.0 nodes must support remote attestation. System integrity is verified by hashing `/boot/firmware` and `/etc/pinet` against the Minima blockchain.
*   **Zero Trust:** No service is trusted by default. All inter-container communication must occur over encrypted WireGuard veth pairs.
*   **LXC Isolation:** Enterprise workloads must run within LXC containers. Direct host access is restricted to the `pinet-admin` group.

## 2. Data Privacy Policy
*   **Decentralized-First:** PiNet 3.0 prioritizes decentralized storage (IPFS) and communication (Maxima). Personal data should never be stored in centralized cloud environments.
*   **Encryption at Rest:** All sensitive cluster secrets and blockchain keys are encrypted using hardware-backed keys where available (TPM 2.0 or Secure Boot).
*   **Telemetry:** PiNet 3.0 does not collect telemetry. System logs remain local to the node unless explicitly shared by the user for debugging.

## 3. Hardware Support Policy
*   **Primary Target:** Raspberry Pi 5 (8GB) is the reference platform for all PiNet 3.0 development.
*   **Backward Compatibility:** PiNet 3.0 maintains "Best Effort" support for Raspberry Pi 4 (4GB+). Features requiring NPU acceleration (Hailo-8L) will fall back to ARM NEON CPU inference on older hardware.
*   **Storage:** NVMe SSDs via PCIe Gen 3 are strictly recommended for Enterprise workloads to prevent I/O bottlenecks.

## 4. Release & Artifact Policy
*   **Verified Builds:** Only images generated via the **Enterprise Imager Utility** and passing the `pinet-health-check.sh` suite are considered "Official Releases."
*   **GitHub Distribution:** All official artifacts must be cryptographically signed and pushed to the GitHub Release repository.
*   **Rolling Updates:** PiNet 3.0 follows a rolling-release model for the Web3 UI, while the underlying LXC hypervisor receives quarterly stability patches.

## 5. Ethical AI Usage
*   **Local Inference:** PiNet 3.0 promotes local AI inference to protect user privacy and reduce reliance on proprietary black-box models.
*   **Transparency:** All AI models deployed via the DePAi Executor must include a model card detailing training data and bias considerations.

## 6. Community & Support Policy
*   **Open Source:** PiNet 3.0 is and will always remain open source under the MIT License.
*   **Support:** Technical support is provided via the official GitHub Issues and Community Discord. Enterprise-tier support is available for commercial deployments.
*   **Code of Conduct:** All community interactions must adhere to the Contributor Covenant.

---

*Last Updated: March 25, 2026*
*Architect: William Majanja*
