# PiNetOS v2

PiNetOS is a decentralized edge cloud operating system designed specifically for Raspberry Pi clusters. It features autonomous cluster formation, distributed AI inference, decentralized storage, and blockchain-verified workloads.

## Local Testing Guide

This guide will help you set up and test PiNetOS v2 on your local development machine (Linux/macOS/macOS ARM).

### Prerequisites

Before you begin, ensure you have the following installed:
- **Go 1.22+**: For building the PiNet CLI and agent.
- **Docker & Docker Compose**: For running the local infrastructure (IPFS, Ollama, Minima).
- **Raspberry Pi Connect (Optional for local dev)**: `rpi-connect` is used for remote hypervisor orchestration. If testing on a non-Pi machine, the CLI will output a warning but continue.

### 1. Build the PiNet CLI

First, download the dependencies and build the `pinet` binary:

```bash
# Navigate to the project root
cd /path/to/pinetos-v2

# Download Go modules
go mod tidy

# Build the CLI
go build -o pinet ./cmd/pinet
```

### 2. Start Local Infrastructure

PiNetOS relies on several decentralized services. You can spin these up locally using the provided Docker Compose file:

```bash
# Start IPFS, Ollama, and Minima nodes in the background
docker-compose -f deployments/docker-compose.yml up -d

# Verify the services are running
docker-compose -f deployments/docker-compose.yml ps
```

### 3. Test Cluster Initialization (Master Node)

In a new terminal window, initialize the first node (Controller/Master):

```bash
./pinet cluster init
```
*Expected Output:* You should see the mDNS discovery start, Raspberry Pi Connect status, and the node waiting for peers.

### 4. Test Cluster Join (Worker Node)

To simulate a second node joining the cluster, open another terminal window and run:

```bash
./pinet cluster join my-secure-token
```
*Expected Output:* The node will start mDNS discovery on a different port (4002) and attempt to find the master node initialized in Step 3.

### 5. Test Decentralized Storage (IPFS)

Ensure your local IPFS node is running via Docker Compose, then create a test file and upload it:

```bash
echo "Hello PiNetOS Decentralized Storage" > test.txt
./pinet storage upload test.txt
```
*Expected Output:* The CLI will return the IPFS CID (Content Identifier) for the uploaded file.

### 6. Test AI Inference (Ollama)

Ensure the Ollama container is running. You may need to pull a model into your local Ollama instance first:

```bash
# Pull a lightweight model (e.g., tinyllama or phi)
docker exec -it <ollama-container-id> ollama pull tinyllama

# Run the inference via PiNet CLI
./pinet ai run tinyllama
```
*Expected Output:* The CLI will send a system check prompt to the local Ollama API and return a success message.

### 7. Test Web Dashboard API

You can run the dashboard API standalone to verify the endpoints:

```bash
# You can create a quick runner for the API or integrate it into the main CLI
# For now, the API is defined in internal/api/dashboard.go
```

## Project Structure

- `cmd/pinet/`: CLI entrypoint.
- `internal/agent/`: Cluster initialization and joining logic.
- `internal/ai/`: Local LLM inference via Ollama.
- `internal/api/`: Gin-gonic REST API for the dashboard.
- `internal/blockchain/`: Minima node verification.
- `internal/discovery/`: libp2p mDNS peer discovery.
- `internal/rpic/`: Raspberry Pi Connect integration.
- `internal/scheduler/`: Workload scheduling based on node roles.
- `internal/security/`: Workload cryptographic signing.
- `internal/storage/`: IPFS integration.
- `deployments/`: Docker Compose configurations.
- `scripts/`: Installation scripts for Raspberry Pi OS.
