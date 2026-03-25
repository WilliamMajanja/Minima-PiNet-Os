Minima-PiNet-Os
Minima-PiNet-Os is an ultra-minimalist, AI-ready operating system built specifically for the Raspberry Pi community. It empowers makers to run decentralized edge computing, neural networks, and blockchain nodes directly from their desks with a zero-bloat, zero-trust architecture.

🚀 Key Features
Minima Philosophy: A bare-bones base installation to maximize compute, memory, and thermal resources.

Physics-Informed Neural Networks (PiNet): Pre-configured support for AI architectures including TensorFlow Lite, ONNX, and local LLMs.

Enterprise Virtualization: Kernel-level LXC isolation with GPU/NPU passthrough and CPU pinning.

Web3 Native: Embedded Minima blockchain node and MiniDAPP runtime environment.

Hardware Acceleration: Native support for Hailo-8L NPU (13 TOPS) and ARM-optimized GGUF quantization.

Zero-Trust Security: Remote attestation via Minima ledger and encrypted WireGuard veth tunnels.

💻 Local Installation Instructions
You can set up Minima-PiNet-Os either by flashing a pre-built image or by building a custom enterprise version locally.

1. Prerequisites
Hardware: Raspberry Pi 5 (8GB Recommended) or Raspberry Pi 4B (4GB Minimum).

Storage: 16GB High-Endurance MicroSD or 128GB NVMe SSD (via PCIe Gen 3).

Software: .

2. Method A: Quick Start (Flashing the Image)
This is the fastest way to get a node up and running.

Download: Navigate to the  page and download the latest PiNetOS-Enterprise.img.

Prepare: Open the Raspberry Pi Imager.

Flash: * Click Choose OS -> Use custom.

Select the downloaded .img file.

Choose your SD card or NVMe drive.

Click Write.

Boot: Insert the media into your Pi and power it on. The system will perform an automatic Zero-Trust integrity check on the first boot.

3. Method B: Local Development Setup
To contribute to the project or run the build system locally:

Clone the Repository:

Install Dependencies:
Ensure you have Node.js and npm installed for the Electron-based dashboard and build tools.

Run the Desktop Dashboard:
To launch the PiNet-OS management interface locally:

4. Method C: Custom Enterprise Build
If you need to generate a custom hardware-verified image with specific cluster secrets:

Open the Pi Imager Portal within your local PiNet Dashboard (npm run dev).

Select your configuration parameters.

Click Execute Enterprise Build.

Once the build completes, flash the generated .img file using the Raspberry Pi Imager.

⚙️ Hardware Compatibility Matrix
🤝 Contributing
This project is architected by William Majanja. Contributions are welcome! Whether it's optimizing the ARM64 kernel, improving AI inference latency, or expanding Web3 integrations, please feel free to fork and submit a PR.
