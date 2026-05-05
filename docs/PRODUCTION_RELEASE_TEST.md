# Production Stable Release Test

Use this checklist before promoting a PiNet-OS build to a stable production test release.

## 1. Repository and Release Artifact Validation

- Install release dependencies with `npm ci --legacy-peer-deps`.
- Install Python backend dependencies with `python -m pip install -r requirements.txt`.
- Compile the desktop/backend with `python -m compileall run.py backend`.
- Validate Raspberry Pi boot configuration with `npm run release:validate-boot`.
- Smoke test the CLI and desktop startup path with `npm run release:smoke-cli`.
- Build the release image with `npm run release:img -- <version>`.
- Package release bundles with `node scripts/package-img-release.js <version>` and `npm run release:packages`.
- Generate checksums and RMPE-2 provenance with `sha256sum ... > SHA256SUMS.txt` and `npm run release:provenance -- <version>`.

## 2. Kubernetes Control-Plane Readiness

- Confirm the first master boots, obtains network, and starts `pinet-desktop`, `minima`, and k3s services.
- Confirm `kubectl get nodes -o wide` shows the master as `Ready`.
- Join at least two workers and confirm all nodes become `Ready`.
- Confirm system pods are healthy with `kubectl get pods -A`.
- Confirm default-deny NetworkPolicy coverage for application namespaces.
- Confirm node-to-node control messages use the Maxima P2P path and do not require a central cloud API.

## 3. Cluster Orchestrator Readiness

- Confirm `/api/cluster/state` returns live manager status or an explicit unavailable reason.
- Confirm `/api/cluster/nodes` lists configured nodes.
- Run discovery with `/api/cluster/discover` and verify node reachability and metrics.
- Submit a safe cluster exec request and verify it appears in `/api/cluster/events`.
- Provision a test node and verify the node transitions to `provisioning` without leaking command errors.

## 4. RMPE-2 Provenance Readiness

- Record a test runtime event with `POST /api/provenance/record`.
- Confirm `GET /api/cluster/provenance` returns records with `schemaVersion`, `provenanceId`, `rmpeHash`, and `previousHash`.
- Verify `RMPE-2-PROVENANCE.json` covers source archives, image artifacts, package zips, and `SHA256SUMS.txt`.
- Verify `RMPE-2-PROVENANCE.json.sha256` matches the manifest.
- Verify the GitHub release includes a build-provenance attestation for the RMPE-2 manifest.

## 5. Production Safety Gates

- Rotate default credentials before exposing a node outside a lab network.
- Confirm SSH root login remains disabled.
- Confirm fail2ban, firewall rules, and WireGuard mesh are enabled where required.
- Confirm no secrets are present in release artifacts or provenance manifests.
- Confirm recovery access through serial console or local keyboard before remote-only testing.
