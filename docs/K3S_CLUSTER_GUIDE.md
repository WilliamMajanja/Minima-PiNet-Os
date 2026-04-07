# K3s Cluster Guide — PiNet Zedd Weather

This guide walks through deploying a 3-node K3s cluster on Raspberry Pi 5 hardware
and bringing up the full Zedd Weather stack.

## Cluster Architecture

| Node | Hostname | Role | Key Hardware | K3s Label |
|------|----------|------|-------------|-----------|
| pinet-alpha | `pinet-alpha` | Control Plane | NVMe SSD | `storage=nvme` |
| pinet-sigma | `pinet-sigma` | AI Worker | Hailo-10H NPU | `accelerator=hailo-10h` |
| pinet-rho | `pinet-rho` | Sensor Worker | Sense HAT (I2C) | `sensor=sense-hat` |

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

On **pinet-sigma** and **pinet-rho**, run:

```bash
# Replace <SERVER_IP> and <JOIN_TOKEN> with the values from step 1
sudo bash PiNetOS/scripts/k3s-bootstrap.sh agent <SERVER_IP> <JOIN_TOKEN>
```

## 3. Label the Worker Nodes

From pinet-alpha (where `kubectl` is available):

```bash
# Label the AI worker
sudo bash PiNetOS/scripts/k3s-node-label.sh --node pinet-sigma

# Label the sensor worker
sudo bash PiNetOS/scripts/k3s-node-label.sh --node pinet-rho
```

Verify labels:

```bash
kubectl get nodes --show-labels
```

Expected output:
```
NAME           STATUS   ROLES                  AGE   VERSION   LABELS
pinet-alpha    Ready    control-plane,master   5m    v1.29.x   storage=nvme,...
pinet-sigma    Ready    <none>                 3m    v1.29.x   accelerator=hailo-10h,...
pinet-rho      Ready    <none>                 3m    v1.29.x   sensor=sense-hat,...
```

## 4. Apply Security Hardening

On each node:

```bash
# Control plane
sudo bash PiNetOS/scripts/k3s-security-hardening.sh server   # on pinet-alpha

# Worker nodes
sudo bash PiNetOS/scripts/k3s-security-hardening.sh agent    # on pinet-sigma and pinet-rho
```

## 5. Enable Health Monitoring

On each node:

```bash
sudo cp PiNetOS/services/pinet-k3s-health.service /etc/systemd/system/
sudo cp PiNetOS/scripts/k3s-health-monitor.sh /opt/pinet/scripts/
sudo systemctl daemon-reload
sudo systemctl enable --now pinet-k3s-health
```

## 6. Deploy the Zedd Weather Stack

From pinet-alpha, with `kubectl` in your PATH:

```bash
# Create namespace and core services
kubectl apply -f k8s/influxdb.yaml
kubectl apply -f k8s/grafana.yaml
kubectl apply -f k8s/open-webui.yaml

# Deploy the edge sensor app (runs exclusively on pinet-rho)
kubectl apply -f zedd-weather/zedd-weather-deployment.yaml
```

Verify all pods are running:

```bash
kubectl get pods -n zedd-weather
```

## 7. Access the Dashboards

| Service | URL | Notes |
|---------|-----|-------|
| Grafana | `http://pinet-alpha:3001` | admin / password from secret |
| InfluxDB | `http://pinet-alpha:8086` | Direct API access |
| Open WebUI | `http://pinet-alpha:8080` | Connects to Ollama on pinet-sigma |

To expose services externally use `kubectl port-forward` or configure an ingress.

## 8. Building the Zedd Weather Image

```bash
cd zedd-weather

# Build for arm64 (requires Docker Buildx and QEMU)
docker buildx build \
  --platform linux/arm64 \
  -t ghcr.io/<your-org>/zedd-weather:latest \
  --push .
```

Update the `image:` field in `zedd-weather/zedd-weather-deployment.yaml` with your
registry path, then re-apply the manifest.

## Troubleshooting

### Nodes stuck in `NotReady`

Check cgroup configuration:
```bash
grep -c cgroup /boot/firmware/cmdline.txt
# Should be non-zero; if 0 run k3s-bootstrap.sh again and reboot
```

### Sense HAT not detected

Verify I2C is enabled on pinet-rho:
```bash
i2cdetect -y 1
# Should show device at 0x46 (Sense HAT)
```

Check the container can access the device:
```bash
kubectl exec -n zedd-weather deploy/zedd-weather -- ls /dev/i2c-*
```

### InfluxDB token errors

Regenerate the secret and restart pods:
```bash
kubectl delete secret influxdb-secret -n zedd-weather
kubectl apply -f k8s/influxdb.yaml   # recreates with default values; update before apply
kubectl rollout restart deployment -n zedd-weather
```
