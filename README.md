
# 🚀 PiNet Web3 OS by Minima

> **The ultimate decentralized operating system for Raspberry Pi 5 clusters. Powered by Minima and optimized for Agentic AI orchestration.**

---

<p align="center">
  <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&auto=format&fit=crop" alt="PiNet OS Architecture" width="800" style="border-radius: 20px; box-shadow: 0 20px 50px rgba(197, 26, 74, 0.3);">
  <br>
  <i>Hardware Cluster topology visualized by <b>Nano Banana Pro</b> (Gemini 3 Pro Image).</i>
</p>

## ✨ High-Level Vision
**PiNet Web3 OS** transforms standard Raspberry Pi hardware into a sovereign decentralized compute unit. By combining the **Minima Protocol** for core decentralization with a hybrid AI stack (**Google Gemini + Local AirLLM**), we provide a "One-Click" solution for the emerging DePIN (Decentralized Physical Infrastructure) economy.

## 🔥 Key Intelligence Features

### 🧠 Hybrid AI Strategy
PiNet intelligently routes requests between cloud and local providers:
- **Cloud (Gemini 3 Pro):** Leverages `gemini-3-pro-preview` for complex reasoning, visual diagnostics, and 4K media synthesis.
- **Local (AirLLM):** Executes "Free Llama" models locally. Inference is sharded across your Raspberry Pi cluster nodes for 100% private, zero-cost processing.

### 🌬️ Neural Thinking Mode
- Advanced architectural reasoning with a **32,768 token thinking budget**.
- Autonomous generation of **M.402 Agentic Payment** contracts.
- Real-time troubleshooting of P2P network topology.

### 📍 Grounding & Search
- Integrated `googleMaps` and `googleSearch` tools for real-time geographic and news-based awareness.

## 🛠️ Operating System Architecture

| Feature | Specification |
| :--- | :--- |
| **Node Alpha** | **NVMe Storage Hub & Orchestrator:** High-IOPS persistence for cluster sharding. |
| **Node Beta** | **Intelligence Hub (Hailo-8 NPU):** The dedicated Agentic Inference Gateway. |
| **Node Gamma** | **Sensory Node (Sense HAT):** Environmental grounding and real-time telemetry. |
| **Protocol** | Native Minima Layer 1 (Ultra-Decentralized) |
| **Messaging** | Maxima Secure Information Transport |
| **Payments** | M.402 Agentic Micro-Payment Streams |

## 🚀 DePAI Marketplace
Deploy specialized agents to your cluster to monetize hardware or automate maintenance:
- **AirLLM Worker:** Contributes compute to the local LLM pool.
- **Env Observer:** Uses Sense HAT data for proactive thermal management.
- **Data Sharder:** Distributes encrypted data across Node Alpha's NVMe array.

---

### 📥 Deployment on Raspberry Pi (NVMe Hat)

The application is optimized for the **Raspberry Pi 5 with NVMe Base**.

#### Option 1: Quick Start (Dev Mode)
Run this directly on your Pi to start the OS interface:
```bash
git clone https://github.com/minima-global/pinet-os.git
cd pinet-os
npm install
npm run dev
```
Access the OS at `http://<your-pi-ip>:3000`.

#### Option 2: Docker Container (Production)
For a persistent "Kiosk" style deployment optimized for Raspberry Pi (ARM64):

1. **Build the Docker Image**:
   ```bash
   # Build the container locally on your Pi
   docker build -t web3pios .
   ```

2. **Run the Container**:
   ```bash
   # Run in detached mode, exposing port 3000
   docker run -d \
     --name pinet-os \
     --restart unless-stopped \
     -p 3000:3000 \
     web3pios
   ```

3. **Verify Deployment**:
   Access `http://localhost:3000` or `http://<pi-ip-address>:3000` from your network.

*Note: The included Dockerfile uses a multi-stage build process with Alpine Linux to ensure a lightweight footprint suitable for embedded usage.*

#### Option 3: Flash to SD/NVMe
1. Open **Pi Imager Utility** inside the app.
2. Select **"Web3PiOS v1.0.35"**.
3. Flash to your NVMe drive for maximum IOPS.

---

<p align="center">
  <b>Decentralize your Hardware. Own your Intelligence.</b><br/>
  <i>Built for the Raspberry Pi Grant Competition 2024.</i>
</p>
