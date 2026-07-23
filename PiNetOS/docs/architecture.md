# PiNetOS Architecture

## System Layers
1. **Hardware**: Raspberry Pi 4 / 5
2. **Bootloader**: U-Boot / Raspberry Pi EEPROM
3. **Linux Kernel**: Custom compiled Linux Kernel for ARM64
4. **systemd**: Init system managing PiNet Services
5. **PiNet Services**: Cluster Manager, Edge Runtime, Storage
6. **Minima Blockchain Node**: Decentralized node
7. **MiniDAPP Runtime**: Execution environment for decentralized applications

## Service Dependencies
- `minima.service` depends on network availability.
- `pinet-cluster-manager.service` depends on `minima.service` and `wireguard`.
- `pinet-edge-runtime.service` depends on `k3s`.
- `pinet-storage.service` depends on `ipfs`.

## Runtime Process Tree
```
systemd
 ├── minima
 ├── pinet-cluster-manager
 ├── k3s-server
 │    └── containerd
 └── ipfs daemon
```

## Network Architecture
- **Mesh Networking**: WireGuard based VPN for secure node-to-node communication.
- **Service Discovery**: libp2p.
- **Blockchain P2P**: Minima protocol on port 9001.

## Security Model
- **Device Identity**: TPM-backed cryptographic identity + CPIP ECDSA P-256 node identity.
- **Secure Node Registration**: Challenge-response over WireGuard with CPIP `AUTH_CHALLENGE`/`AUTH_RESPONSE`.
- **Encrypted Networking**: All inter-node traffic is encrypted via WireGuard. CPIP CoffeeCipher v3 (AES-256-GCM) for application-layer encryption.
- **CPIP Security Provider**: The Coffee Protocol v4.0.2 — AES-256-GCM, ECDSA P-256, RSA-KEM-2048, HMAC-SHA256, optional Kyber PQ KEM, ITF Defense, FIPS self-tests.
