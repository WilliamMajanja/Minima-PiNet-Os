# Minima-PiNet-OS

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Architecture](https://img.shields.io/badge/arch-ARM64-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![Security](https://img.shields.io/badge/security-Zero--Trust-red)

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
| **Minimalist OS Footprint** | Absolute resource conservation. | Headless-optimized, Debian Bookworm ARM64 base, stripped kernel modules. |
| **Edge AI Ready** | Hardware-accelerated neural processing. | Pre-configured bindings for TensorFlow Lite, ONNX, and local inference. |
| **Zero-Trust Security** | Cryptographically verified execution. | Default-deny firewall, WireGuard mesh, SSH key-only auth, and TPM 2.0 readiness. |
| **Home Lab Compute** | Lightweight container orchestration. | Integrated **k3s** for deploying AI workloads, IoT services, and containerized apps. |
| **Decentralized Storage** | Distributed file system integration. | Native **IPFS** support with blockchain anchoring and node replication. |
| **Web3 & Blockchain** | Layer 1 decentralized protocol. | Embedded **Minima** blockchain node and **MiniDAPP** runtime environment. |

---

## PiNetOS Enterprise Architecture

Transform your Raspberry Pi into a full-fledged decentralized edge node. The system stack is layered as follows:

1. **Hardware:** Raspberry Pi 4 / 400 / Compute Module 4 / Pi 5
2. **Bootloader & Kernel:** Secure Boot, Linux Kernel (ARM64)
3. **Init System:** systemd
4. **PiNet Services:** Cluster Manager (libp2p, WireGuard), Edge Compute (k3s), Distributed Storage (IPFS)
5. **Blockchain Layer:** Minima Node (`/opt/minima`)
6. **Application Layer:** MiniDAPP Runtime (`/pinet/dapps/`)

### Key Community Features
* **Real-Time Hypervisor Switching:** The OS features a fully functional, real-time hypervisor switch that seamlessly transitions between the slick PiNet Web3 OS graphical interface and the underlying host OS (Raspbian/Debian) using native `systemctl` commands.
* **Native Terminal Integration:** The built-in terminal provides direct access to the host system's shell, allowing execution of real commands, including a custom `pinet` CLI for managing applications, cluster nodes, and the Minima blockchain.
* **PiNet Cluster Manager:** Easily link multiple Raspberry Pis together! Handles node discovery, mesh networking, and workload scheduling across your Pi cluster.
* **MiniDAPP Platform:** Includes built-in decentralized applications such as a Wallet, IoT Data Market, and Device Identity manager.
* **Automated Build System:** A complete suite of scripts (`build-rootfs.sh`, `build-kernel.sh`, `build-image.sh`) to generate bootable `PiNetOS.img` artifacts from scratch using `debootstrap`.

---

## Hardware Requirements

Tailored specifically for modern ARM-based Raspberry Pi boards.

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Platform** | Raspberry Pi 4 Model B (4GB) | Raspberry Pi 5 (8GB) or CM4 |
| **Architecture** | ARM64 (aarch64) | ARM64 (aarch64) |
| **Storage** | 16GB High-Endurance MicroSD | 64GB NVMe SSD (via PCIe HAT) |
| **Network** | Gigabit Ethernet or Wi-Fi | Gigabit Ethernet + WireGuard Mesh |

---

## Installation & Provisioning

### Method 1: Raspberry Pi Imager (Easiest)
1. Download the latest `PiNetOS.img` release.
2. Open **Raspberry Pi Imager**.
3. Under "Choose OS", select **Use custom** and select the downloaded `.img` file.
4. Under "Choose Storage", select your MicroSD card or NVMe drive.
5. Click the **Settings (Gear) Icon** to pre-configure your Wi-Fi and enable SSH (highly recommended).
6. Click **Write**.

### Method 2: Automated Installer (For existing Raspbian installs)
For a fully automated setup of the entire PiNetOS stack (including k3s, IPFS, and Minima) on top of an existing Debian/Raspbian Bookworm install:

```bash
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os/scripts
sudo ./install-pinet.sh
```

### Method 3: Manual CLI Flashing (For Linux/Mac Power Users)
Download the latest `PiNetOS.img` and flash it to your target media using `dd`. 
*(Note: Replace `/dev/sdX` with your actual target drive. **Double-check the drive letter to avoid data loss.**)*

```bash
# Unmount the drive if auto-mounted
sudo umount /dev/sdX*

# Flash the image with block size optimization and sync
sudo dd if=Minima-PiNet-Os.img of=/dev/sdX bs=4M status=progress
sudo sync
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