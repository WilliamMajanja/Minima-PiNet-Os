# Minima-PiNet-Os

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Architecture](https://img.shields.io/badge/arch-ARM64-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![Security](https://img.shields.io/badge/security-Zero--Trust-red)

> **An ultra-minimalist, physics-informed neural network (PiNet) operating system tailored for edge computing, bio-informatics, and non-scedastic data analysis.**

## Executive Summary

**Minima-PiNet-Os** is a specialized, headless Linux distribution engineered for ARM64 microcomputers. It strips away the bloat of traditional operating systems to provide a mathematically optimized, zero-trust environment. Designed from the ground up to support advanced machine learning workloads at the edge, this OS serves as a foundational substrate for researchers, DevOps engineers, and data scientists operating in highly complex, multidimensional computational spaces.

---

## The Architect

This system was conceptualized and architected by **William Majanja**—an Open Source Bio-Informaticist, Data Segmentation Specialist, Non-Scedastic Analyst, Sound Engineer, and Cybersecurity Professional. As a recognized practitioner in the Tech Industrial Complex, Majanja's multidisciplinary expertise bridges the gap between biological systems, acoustic engineering, and hardened distributed computing. **Minima-PiNet-Os** is the direct manifestation of this cross-domain philosophy.

---

## Theoretical Framework

### The "Minima" Paradigm
At its core, this OS adheres strictly to a **zero-bloat philosophy**. Users are provided with a bare-bones base installation, strictly advising the addition of only mission-critical packages to conserve compute, memory, and thermal resources. 

Conceptually and mathematically, the *Minima* environment is optimized to navigate complex multidimensional spaces—such as **morphospace** or **transcriptional space**. By eliminating background noise and OS-level stochasticity, the system ensures that optimization algorithms and gradient descent paths avoid getting trapped in *local minima*, allowing for true global optimization in computational biology and data segmentation tasks.

### The "PiNet" Framework
Traditional data-driven learning models often struggle with edge-case generalization. **PiNet** (Physics-Informed Neural Networks) integration fundamentally alters this dynamic. The OS natively supports and accelerates PiNet architectures, which improve upon standard empirical learning by actively incorporating:
*   **Physical Laws:** Constraining neural network outputs to obey known differential equations.
*   **Heuristic Strategies:** Embedding domain-specific rules to guide the learning phase.
*   **Empirical Observations & Expert Knowledge:** Fusing raw data streams with established scientific priors.

---

## Core Architecture

The system operates on a **Tripartite Synergy**, balancing performance, intelligence, and security:

| Architectural Pillar | Description | Implementation Details |
| :--- | :--- | :--- |
| **Minimalist OS Footprint** | Absolute resource conservation. | Headless-only, systemd-optimized, Debian Bookworm ARM64 base, stripped kernel modules. |
| **Advanced PiNet ML** | Hardware-accelerated neural processing. | Pre-configured bindings for TensorFlow Lite, ONNX, and custom PiNet solvers. |
| **Zero-Trust Cybersecurity** | Cryptographically verified execution. | Default-deny firewall, WireGuard mesh, SSH key-only auth, immutable rootfs overlays, and TPM 2.0 readiness. |
| **Enterprise Edge Compute** | Lightweight container orchestration. | Integrated **k3s** for deploying AI workloads, IoT services, and containerized apps. |
| **Decentralized Storage** | Distributed file system integration. | Native **IPFS** support with blockchain anchoring and node replication. |
| **Web3 & Blockchain** | Layer 1 decentralized protocol. | Embedded **Minima** blockchain node and **MiniDAPP** runtime environment. |

---

## PiNetOS Enterprise Architecture

The latest release introduces the **PiNetOS Enterprise Stack**, transforming the Raspberry Pi into a full-fledged decentralized edge node. The system stack is layered as follows:

1. **Hardware:** Raspberry Pi 4 / 5
2. **Bootloader & Kernel:** Secure Boot, Linux Kernel (ARM64)
3. **Init System:** systemd
4. **PiNet Services:** Cluster Manager (libp2p, WireGuard), Edge Compute (k3s), Distributed Storage (IPFS)
5. **Blockchain Layer:** Minima Node (`/opt/minima`)
6. **Application Layer:** MiniDAPP Runtime (`/pinet/dapps/`)

### Key Enterprise Features
* **Real-Time Hypervisor Switching:** The OS features a fully functional, real-time hypervisor switch that seamlessly transitions between the PiNet Web3 OS graphical interface and the underlying host OS (Raspbian/Debian) using native `systemctl` commands, complete with boot sequence animations.
* **Native Terminal Integration:** The built-in terminal provides direct, unsimulated access to the host system's shell, allowing execution of real commands, including a custom `pinet` CLI for managing applications, cluster nodes, and the Minima blockchain.
* **PiNet Cluster Manager:** Handles node discovery, mesh networking, blockchain node registration, and workload scheduling.
* **MiniDAPP Platform:** Includes built-in decentralized applications such as a Wallet, IoT Data Market, and Device Identity manager.
* **Automated Build System:** A complete suite of scripts (`build-rootfs.sh`, `build-kernel.sh`, `build-image.sh`) to generate bootable `PiNetOS.img` artifacts from scratch using `debootstrap`.

---

## Hardware Requirements

Tailored specifically for modern ARM-based microcomputers running headless environments.

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Platform** | Raspberry Pi 4 Model B (4GB) | Raspberry Pi 5 (8GB) |
| **Architecture** | ARM64 (aarch64) | ARM64 (aarch64) |
| **Storage** | 16GB High-Endurance MicroSD | 64GB NVMe SSD (via PCIe HAT) |
| **Network** | Gigabit Ethernet | Gigabit Ethernet + WireGuard Mesh |
| **Peripherals** | None (Headless) | None (Headless) |

---

## Installation & Provisioning

This guide is designed for both beginners taking their first steps into headless provisioning, and senior DevOps engineers requiring low-level CLI control.

### Automated Enterprise Installer (Recommended)

For a fully automated setup of the entire PiNetOS Enterprise stack (including k3s, IPFS, and Minima), use the master installer script:

```bash
git clone https://github.com/WilliamMajanja/Minima-PiNet-Os.git
cd Minima-PiNet-Os/scripts
sudo ./install-pinet.sh
```
This script will build the OS, configure the node, enable all systemd services, and start the blockchain node.

### 1. Securely Flashing the OS (Manual)
Download the latest `PiNetOS.img` (or build it via `/build-system/build-image.sh`) and flash it to your target media using `dd`. 
*(Note: Replace `/dev/sdX` with your actual target drive. **Double-check the drive letter to avoid data loss.**)*

```bash
# Unmount the drive if auto-mounted
sudo umount /dev/sdX*

# Flash the image with block size optimization and sync
sudo dd if=Minima-PiNet-Os.img of=/dev/sdX bs=4M status=progress
sudo sync
```

### 2. Headless Injection (Networking & SSH)
Before booting the Raspberry Pi, you must inject your SSH keys and network configuration directly into the `boot` partition to maintain the zero-trust posture.

```bash
# Mount the boot partition
sudo mkdir -p /mnt/pinet-boot
sudo mount /dev/sdX1 /mnt/pinet-boot

# Enable SSH daemon on first boot
sudo touch /mnt/pinet-boot/ssh

# Inject initial user credentials (Username: minima)
# Generate a hashed password using: echo 'mypassword' | openssl passwd -6 -stdin
echo "minima:\$6\$YOUR_HASHED_PASSWORD_HERE" | sudo tee /mnt/pinet-boot/userconf.txt

# (Optional) Inject Wi-Fi configuration if not using Ethernet
cat <<EOF | sudo tee /mnt/pinet-boot/wpa_supplicant.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
    ssid="YOUR_SSID"
    psk="YOUR_WIFI_PASSWORD"
    key_mgmt=WPA-PSK
}
EOF

# Unmount safely
sudo umount /mnt/pinet-boot
```

### 3. Initial Access
Insert the media into the Raspberry Pi, connect to your network, and power it on.

```bash
# Connect via SSH using the injected credentials
ssh minima@<raspberry-pi-ip>
```

---

## Use Cases

**Minima-PiNet-Os** is purpose-built for highly specialized computational domains:

*   🧬 **Bio-Informatics & Morphospace Mapping:** 
    Provides a stable, jitter-free environment for running complex genomic sequencing and evolutionary morphology simulations. The PiNet framework ensures biological constraints are mathematically enforced during data modeling.
*   📊 **Non-Scedastic Data Visualization:** 
    Optimized for processing datasets with varying variance (heteroscedasticity). The minimal OS overhead allows for real-time, high-throughput statistical rendering without kernel-level interruptions.
*   🌐 **Decentralized Edge Computing:** 
    Acts as a secure, lightweight node in a distributed mesh network. Ideal for deploying containerized AI workloads directly to the edge, processing IoT sensor data locally before transmitting aggregated insights.

---

## Contribution Guidelines

We welcome contributions from AI researchers, systems engineers, and open-source enthusiasts. 

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/advanced-pinet-solver`).
3. Commit your changes (`git commit -m 'Add new PiNet heuristic solver'`).
4. Push to the branch (`git push origin feature/advanced-pinet-solver`).
5. Open a Pull Request detailing the mathematical and architectural implications of your code.

Please ensure all code adheres to the zero-bloat philosophy. Submissions introducing unnecessary dependencies will be rejected.

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details. 

---
*Designed for the future of edge intelligence. Architected by William Majanja.*