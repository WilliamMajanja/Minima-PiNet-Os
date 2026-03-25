# Minima-PiNet-OS

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Architecture](https://img.shields.io/badge/arch-ARM64-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-2.0.0--enterprise-blueviolet)
![Security](https://img.shields.io/badge/security-Zero--Trust--Attestation-red)
![Virtualization](https://img.shields.io/badge/virt-LXC--Enterprise-blue)

> **An ultra-minimalist, AI-ready operating system built specifically for the Raspberry Pi community, empowering makers to run decentralized edge computing and neural networks right from their desks.**

## Executive Summary

**Minima-PiNet-OS** is a specialized, lightweight Linux distribution engineered for Raspberry Pi ARM64 boards. It strips away the bloat of traditional operating systems to provide a highly optimized, zero-trust environment. Whether you're a maker building a home AI lab, a developer deploying decentralized Web3 nodes, or a hobbyist experimenting with edge computing, this OS serves as the perfect foundational layer for your next big Pi project.

---

## The Architect

This system was conceptualized and architected by **William Majanja**—an Open Source Bio-Informaticist, Data Segmentation Specialist, and Cybersecurity Professional. Majanja's goal is to bridge the gap between advanced distributed computing and the maker movement, bringing enterprise-grade edge AI and decentralized infrastructure directly to the Raspberry Pi ecosystem.

---

## Why PiNet-OS?

### The "Minima" Philosophy
At its core, this OS adheres strictly to a **zero-bloat philosophy**. You get a bare-bones base installation, ensuring your Pi's compute, memory, and thermal resources are saved for what actually matters: your workloads. By eliminating background noise and unnecessary OS services, your Pi runs cooler and faster.

### The "PiNet" Framework
Traditional data-driven learning models often struggle on edge devices. **PiNet** (Physics-Informed Neural Networks) integration changes the game. The OS is pre-configured to support and accelerate AI architectures, making it easier to run TensorFlow Lite, ONNX models, and local LLMs directly on your Raspberry Pi without melting the CPU.

---

## Core Architecture

The system operates on a perfect balance of performance, intelligence, and security:

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Enterprise Virtualization** | Kernel-level LXC isolation. | Isolated `pinet-enterprise-env` with GPU/NPU passthrough and CPU pinning. |
| **AI Acceleration Engine** | Hardware-accelerated neural processing. | Native Hailo-8L NPU support (13 TOPS) + ARM-optimized GGUF 4-bit quantization. |
| **Zero-Trust Attestation** | Blockchain-verified system integrity. | Remote attestation via Minima ledger; SHA-256 hashing of /boot and /etc/pinet. |
| **Zero-Exposure Networking** | Private WireGuard veth tunnels. | All container traffic routed through encrypted veth pairs; Host IP remains hidden. |
| **Enterprise Build System** | Pi Imager compatible .img generation. | Automated pipeline for generating flashable, hardware-verified system images. |
| **Decentralized Storage** | Distributed file system integration. | Native **IPFS** support with blockchain anchoring and node replication. |
| **Web3 & Blockchain** | Layer 1 decentralized protocol. | Embedded **Minima** blockchain node and **MiniDAPP** runtime environment. |

---

## PiNet 2.0 Enterprise Architecture

Transform your Raspberry Pi into a hardened, hardware-verified edge node. The PiNet 2.0 stack introduces enterprise-grade virtualization and security:

1. **Hardware Layer:** Raspberry Pi 5 (Optimized for Cortex-A76 & PCIe Gen 3).
2. **Hypervisor Layer:** LXC (Linux Containers) providing kernel-level namespace isolation.
3. **Resource Management:** `cpuset` pinning (Cores 2-3) via cgroups v2 for deterministic AI latency.
4. **AI Engine:** Hailo-8L NPU driver integration + ARM NEON/SIMD optimized GGUF inference.
5. **Security Layer:** Zero Trust Remote Attestation anchored to the Minima Blockchain.
6. **Networking:** WireGuard veth pairs for zero-exposure container communication.

### Key Enterprise Features
* **LXC Isolation:** Run your Web3 and AI workloads in a secure, isolated container while maintaining direct access to hardware accelerators (GPU/NPU).
* **Remote Attestation:** The system automatically hashes critical firmware and configuration paths, attesting them against the immutable Minima ledger to detect unauthorized tampering.
* **Deterministic AI Performance:** By pinning AI workloads to specific CPU cores and using dedicated NPU hardware, PiNet 2.0 eliminates context-switching jitter.
* **Enterprise Imager Utility:** A built-in portal to build, verify, and release flashable `.img` artifacts that are 100% compatible with the official Raspberry Pi Imager.

---

## Hardware Requirements

Tailored specifically for modern ARM-based Raspberry Pi boards.

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Platform** | Raspberry Pi 4 Model B (4GB) | **Raspberry Pi 5 (8GB)** |
| **AI Accelerator** | ARM NEON (CPU) | **Hailo-8L NPU (13 TOPS)** |
| **Architecture** | ARM64 (aarch64) | ARM64 (aarch64) |
| **Storage** | 16GB High-Endurance MicroSD | 128GB NVMe SSD (via PCIe Gen 3) |
| **Network** | Gigabit Ethernet or Wi-Fi | Gigabit Ethernet + WireGuard Mesh |

---

## Installation & Provisioning

### Method 1: Enterprise Build & Flash (Recommended)
1. Access the **Pi Imager Portal** within the PiNet 2.0 Dashboard.
2. Click **Execute Enterprise Build** to generate a hardware-verified `.img` artifact.
3. Once the build is complete, download the image or use the **Push to GitHub Release** feature.
4. Flash the resulting image using the official **Raspberry Pi Imager** (select "Use custom").

### Method 2: Manual CLI Provisioning
For power users on Linux/macOS:
```bash
# Flash the verified Enterprise image
sudo dd if=PiNetOS-Enterprise-v2.0-LTS.img of=/dev/sdX bs=4M status=progress conv=fsync
```

---

## Awesome Raspberry Pi Use Cases

**Minima-PiNet-OS** is purpose-built for taking your Pi projects to the next level:

*   🤖 **Personal Edge AI Node:** 
    Run local LLMs, image recognition, or voice assistants without relying on cloud APIs. The minimal OS overhead ensures your Pi's RAM is dedicated entirely to your AI models.
*   🌐 **Decentralized Home Automation:** 
    Use the integrated k3s (lightweight Kubernetes) to deploy Home Assistant, Node-RED, and IoT sensor aggregators in a secure, containerized environment.
*   ⛓️ **Personal Web3 & Crypto Node:** 
    Run a full Minima blockchain node natively. Participate in decentralized networks, host your own wallet, and anchor your data to the blockchain using the built-in IPFS integration.
*   🖥️ **Pi Cluster Computing:** 
    Have a stack of Raspberry Pis? Use the PiNet Cluster Manager to link them together via WireGuard mesh networking, creating your own mini supercomputer.

---

## Contribution Guidelines

We welcome contributions from makers, AI researchers, systems engineers, and open-source enthusiasts!

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/cool-new-idea`).
3. Commit your changes (`git commit -m 'Add support for new Pi HAT'`).
4. Push to the branch (`git push origin feature/cool-new-idea`).
5. Open a Pull Request!

Please ensure all code adheres to the zero-bloat philosophy. Let's keep the Pi fast and efficient!

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details. 

---
*Empowering the Raspberry Pi Community. Architected by William Majanja.*