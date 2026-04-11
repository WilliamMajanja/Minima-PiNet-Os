# K3s Cluster Guide — PiNet 3-Node Cluster

This guide walks through deploying the full PiNet K3s stack on a 3-node
Raspberry Pi 5 cluster and bringing up all services with a single command.

## Cluster Architecture

| Node | Hostname | IP | Role | Key Hardware | K3s Labels |
|------|----------|-----|------|-------------|-----------|
| pinet-alpha | `pinet-alpha` | 192.168.1.10 | Control Plane | NVMe SSD | `storage=nvme` |
| pinet-beta | `pinet-beta` | 192.168.1.11 | Worker | NVMe SSD | `storage=nvme` |
| pinet-sigma | `pinet-sigma` | 192.168.1.12 | AI Worker | Hailo-10H NPU | `accelerator=hailo-10h` |

### Service Distribution

| Service | Preferred Node | Namespace | Port |
|---------|---------------|-----------|------|
| Minima Blockchain | All (DaemonSet) | pinet-system | 9001 |
| PiNet Desktop | pinet-alpha | pinet-system | 3000 (NodePort 30300) |
| InfluxDB | pinet-alpha | zedd-weather | 8086 |
| Grafana | pinet-alpha | zedd-weather | 3001 |
| Open WebUI | pinet-beta | zedd-weather | 8080 |
| Ollama LLM | pinet-sigma | zedd-weather | 11434 |
| Zedd Weather Sensor | pinet-rho* | zedd-weather | 9200 |

*\*pinet-rho is an optional 4th Sense HAT node for edge sensor data collection.*

## Prerequisites

- Raspberry Pi OS Bookworm (64-bit) on each node
- Static IP addresses or mDNS (`pinet-alpha.local`, etc.)
- SSH key-based access from your workstation to each node
- Internet access on each node for initial installation

## 1. Bootstrap the Control Plane (pinet-alpha)

```bash
ssh pinet-alpha
sudo bash PiNetOS/scripts/k3s-bootstrap.sh server
```

After the server is ready, note the join token:

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

## 2. Join Worker Nodes

On **pinet-beta** and **pinet-sigma**, run:

```bash
# Replace <SERVER_IP> and <JOIN_TOKEN> with the values from step 1
sudo bash PiNetOS/scripts/k3s-bootstrap.sh agent <SERVER_IP> <JOIN_TOKEN>
```

## 3. Label All Nodes

From pinet-alpha (where `kubectl` is available):

```bash
# Label all nodes at once
sudo bash PiNetOS/scripts/k3s-node-label.sh --all

# Or label individually
sudo bash PiNetOS/scripts/k3s-node-label.sh --node pinet-alpha
sudo bash PiNetOS/scripts/k3s-node-label.sh --node pinet-beta
sudo bash PiNetOS/scripts/k3s-node-label.sh --node pinet-sigma
```

Verify labels:

```bash
kubectl get nodes --show-labels
```

Expected output:
```
NAME           STATUS   ROLES                  AGE   VERSION   LABELS
pinet-alpha    Ready    control-plane,master   5m    v1.29.x   storage=nvme,...
pinet-beta     Ready    <none>                 3m    v1.29.x   storage=nvme,...
pinet-sigma    Ready    <none>                 3m    v1.29.x   accelerator=hailo-10h,...
```

## 4. Apply Security Hardening

On each node:

```bash
# Control plane
sudo bash PiNetOS/scripts/k3s-security-hardening.sh server   # on pinet-alpha

# Worker nodes
sudo bash PiNetOS/scripts/k3s-security-hardening.sh agent    # on pinet-beta and pinet-sigma
```

## 5. Enable Health Monitoring

On each node:

```bash
sudo cp PiNetOS/services/pinet-k3s-health.service /etc/systemd/system/
sudo cp PiNetOS/scripts/k3s-health-monitor.sh /opt/pinet/scripts/
sudo systemctl daemon-reload
sudo systemctl enable --now pinet-k3s-health
```

## 6. Create Secrets

Before deploying workloads, create the required secrets:

```bash
# Create namespace
kubectl create namespace zedd-weather

# InfluxDB secret
kubectl create secret generic influxdb-secret \
  --namespace zedd-weather \
  --from-literal=admin-token=$(openssl rand -hex 16) \
  --from-literal=admin-password=$(openssl rand -base64 24)

# Open WebUI secret
kubectl create secret generic open-webui-secret \
  --namespace zedd-weather \
  --from-literal=secret-key=$(openssl rand -hex 16)
```

## 7. Deploy the Full Stack

From pinet-alpha, deploy everything with a single command using Kustomize:

```bash
kubectl apply -k k3s/
```

Or deploy individual components:

```bash
# Core PiNet services
kubectl apply -f k3s/minima.yaml           # Minima blockchain on all nodes
kubectl apply -f k3s/pinet-desktop.yaml     # Web desktop UI

# Zedd Weather / AI stack
kubectl apply -f k3s/influxdb.yaml          # Time-series database
kubectl apply -f k3s/grafana.yaml           # Visualization dashboard
kubectl apply -f k3s/ollama.yaml            # LLM inference engine (on sigma)
kubectl apply -f k3s/open-webui.yaml        # AI chat interface

# Networking & security
kubectl apply -f k3s/ingress.yaml           # HTTP ingress routes
kubectl apply -f k3s/network-policy.yaml    # Zero-trust network policies
```

Verify all pods are running:

```bash
kubectl get pods -A
```

Expected output:
```
NAMESPACE       NAME                             READY   STATUS    RESTARTS   AGE
pinet-system    minima-xxxxx                     1/1     Running   0          2m    (on each node)
pinet-system    pinet-desktop-xxxxx              1/1     Running   0          2m
zedd-weather    influxdb-xxxxx                   1/1     Running   0          2m
zedd-weather    grafana-xxxxx                    1/1     Running   0          2m
zedd-weather    ollama-xxxxx                     1/1     Running   0          2m
zedd-weather    open-webui-xxxxx                 1/1     Running   0          2m
```

## 8. Access the Dashboards

### Via NodePort (direct)

| Service | URL | Notes |
|---------|-----|-------|
| PiNet Desktop | `http://pinet-alpha:30300` | Full web desktop OS |
| Minima RPC | `http://<any-node>:30901` | Blockchain RPC on every node |

### Via Ingress (requires DNS or /etc/hosts)

Add to your `/etc/hosts` (or configure DNS):
```
192.168.1.10  pinet.local grafana.pinet.local ai.pinet.local influxdb.pinet.local
```

| Service | URL | Notes |
|---------|-----|-------|
| PiNet Desktop | `http://pinet.local` | Web desktop |
| Grafana | `http://grafana.pinet.local` | Telemetry dashboards |
| Open WebUI | `http://ai.pinet.local` | AI chat (connects to Ollama on sigma) |
| InfluxDB | `http://influxdb.pinet.local` | Time-series API |

## 9. Building Container Images

### PiNet Desktop

```bash
# From the repository root
docker buildx build \
  --platform linux/arm64 \
  -t ghcr.io/<your-org>/pinet-desktop:latest \
  --push .
```

### Zedd Weather Sensor

```bash
cd zedd-weather
docker buildx build \
  --platform linux/arm64 \
  -t ghcr.io/<your-org>/zedd-weather:latest \
  --push .
```

Update the `image:` fields in the respective manifests with your registry path.

## K3s Manifest Packages

The `PiNetOS-K3s-Manifests.zip` release artifact contains all manifests needed
to deploy the full PiNet stack on a K3s cluster. Download it from the
[latest release](https://github.com/WilliamMajanja/Minima-PiNet-Os/releases/latest)
and apply:

```bash
unzip PiNetOS-K3s-Manifests.zip
kubectl apply -k k3s/
```

## Troubleshooting

### Nodes stuck in `NotReady`

Check cgroup configuration:
```bash
grep -c cgroup /boot/firmware/cmdline.txt
# Should be non-zero; if 0 run k3s-bootstrap.sh again and reboot
```

### Pods pending due to node selector

Verify labels are applied:
```bash
kubectl get nodes --show-labels | grep -E 'storage|accelerator'
```

If missing, re-run:
```bash
sudo bash PiNetOS/scripts/k3s-node-label.sh --all
```

### Ollama not starting on pinet-sigma

Check that the taint toleration is correct:
```bash
kubectl describe node pinet-sigma | grep Taints
```

The Ollama deployment tolerates `accelerator=hailo-10h:NoSchedule`.

### InfluxDB token errors

Regenerate the secret and restart pods:
```bash
kubectl delete secret influxdb-secret -n zedd-weather
kubectl create secret generic influxdb-secret \
  --namespace zedd-weather \
  --from-literal=admin-token=$(openssl rand -hex 16) \
  --from-literal=admin-password=$(openssl rand -base64 24)
kubectl rollout restart deployment -n zedd-weather
```

### Sense HAT not detected (optional pinet-rho node)

Verify I2C is enabled on pinet-rho:
```bash
i2cdetect -y 1
# Should show device at 0x46 (Sense HAT)
```

Check the container can access the device:
```bash
kubectl exec -n zedd-weather deploy/zedd-weather -- ls /dev/i2c-*
```
