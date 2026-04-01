# Security

PiNet OS implements a **zero-trust security architecture** — every component assumes the network is hostile and verifies all interactions.

---

## Zero-Trust Architecture Overview

```
┌─────────────────────────────────────────────┐
│               PiNet OS Node                  │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ LXC      │  │ AppArmor │  │ UFW      │  │
│  │ Isolation │  │ MAC      │  │ Firewall │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ WireGuard│  │ LUKS     │  │ fail2ban │  │
│  │ Mesh VPN │  │ Encrypt  │  │ Intrusion│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ DApp     │  │ ed25519  │  │ TPM 2.0  │  │
│  │ Sandbox  │  │ SSH Keys │  │ Attestn  │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Minima Blockchain (identity + trust)  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Key principles:
- **Never trust, always verify** — all requests authenticated and authorized
- **Least privilege** — components get only the permissions they need
- **Defense in depth** — multiple overlapping security layers
- **Blockchain-anchored identity** — Minima provides cryptographic identity

---

## Security Controls

### 1. LXC Container Isolation

Workloads execute in lightweight LXC containers with:
- Separate PID, network, and mount namespaces
- cgroups v2 resource limits (CPU, memory, I/O)
- No host filesystem access by default
- Dropped Linux capabilities

### 2. Hardware Attestation

Boot integrity verification:
- Measured boot chain validates firmware → bootloader → kernel → init
- Remote attestation protocol for cluster node verification
- TPM 2.0 integration where hardware supports it

### 3. WireGuard Mesh VPN

All inter-node cluster traffic encrypted:
- ChaCha20-Poly1305 encryption
- Curve25519 key exchange
- Automatic peer discovery via Maxima protocol
- PersistentKeepalive for NAT traversal

### 4. Resource Pinning

Deterministic performance through CPU isolation:
- AI workloads pinned to cores 2–3 via `cpuset` cgroups
- Prevents interference between system tasks and inference
- Configurable per workload type

### 5. ed25519 SSH Keys

Enforced SSH hardening:
- Only ed25519 keys accepted (strongest elliptic curve)
- Password authentication disabled after initial setup
- Rate-limited connection attempts
- `PermitRootLogin no` enforced

### 6. UFW Firewall

Default-deny firewall policy:

```
Default: deny incoming, allow outgoing

Allow:
  22/tcp     SSH
  3000/tcp   Desktop / API
  9001/tcp   Minima RPC
  9090/tcp   Cluster API
  51820/udp  WireGuard
```

All other ports blocked by default.

### 7. AppArmor Mandatory Access Control

Application-level MAC profiles:
- Minima node confined to its data directory
- DApps restricted to their sandbox directories
- System services have per-service profiles
- Enforcing mode by default (not complain)

### 8. MiniDApp Sandboxing

DApps run in sandboxed iframes:
- `sandbox="allow-scripts"` — no DOM access to host
- Permission-gated bridge API
- Content Security Policy headers
- Origin isolation per DApp
- Maximum upload size (50 MB) and install count (50)

### 9. fail2ban Intrusion Prevention

Automated brute-force protection:
- SSH: 5 failed attempts → 10 minute ban
- API: Rate limiting per IP (varies by endpoint)
- Configurable ban duration and thresholds

### 10. LUKS Full Disk Encryption

Optional full disk encryption:
- LUKS2 with AES-256-XTS
- Unlock via password, USB key, or TPM
- Encrypts all user data and blockchain state

### 11. TPM 2.0 Secure Boot

Where hardware supports it (Raspberry Pi 5 with TPM HAT):
- Measured boot with PCR values
- Sealed LUKS keys (auto-unlock with verified boot)
- Remote attestation for cluster trust

### 12. Input Validation

All API inputs sanitized:
- File paths validated against allowlists
- Shell commands use `execFile` with argument arrays (no shell interpolation)
- Request body size limits enforced
- SQL/command injection prevention

### 13. Rate Limiting

Per-IP rate limiting on sensitive endpoints:
- Cluster operations: 10 req/min
- Minima RPC: 20 req/min
- File deletion: 10 req/min
- DApp management: 5 req/min
- OS switching: 3 req/min

### 14. Audit Logging

Comprehensive security audit trail:
- All authentication attempts logged
- Privilege escalation tracked
- File system changes recorded
- Cluster join/leave events logged
- Optional on-chain provenance anchoring

---

## Security API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/security/dashboard` | Security overview and score |
| GET | `/api/security/policies` | Active security policies |
| GET | `/api/security/audit` | Security audit log |
| GET | `/api/security/profiles` | AppArmor/MAC profiles |
| GET | `/api/security/integrity` | File integrity check results |
| GET | `/api/security/threats` | Threat detection alerts |

---

## Out-of-Scope Threats

The following are explicitly **not** mitigated by PiNet OS:

| Threat | Reason |
|---|---|
| Physical device theft | Hardware security is the user's responsibility |
| Supply chain attacks on RPi firmware | Upstream firmware is trusted |
| Side-channel attacks on BCM2712 | Requires hardware-level mitigation |
| Nation-state level adversaries | Exceeds scope of edge device security |

---

## Incident Response

1. **Detect** — Security Center alerts and fail2ban notifications
2. **Contain** — Isolate affected node from cluster (`pinet stop`)
3. **Investigate** — Review audit logs (`/api/security/audit`)
4. **Remediate** — Apply fixes, rotate keys, update system
5. **Report** — Document incident and notify affected parties

---

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the maintainers
3. Include: description, reproduction steps, impact assessment
4. Allow 90 days for remediation before public disclosure

See [SECURITY.md](https://github.com/WilliamMajanja/Minima-PiNet-Os/blob/main/SECURITY.md) for full policy.

---

## Supported Versions

| Version | Security Updates |
|---|---|
| 3.x (current) | ✅ Active support |
| 2.x | ⚠️ Critical fixes only |
| 1.x | ❌ End of life |

---

## See Also

- [Networking](Networking) — Firewall and WireGuard configuration
- [Cluster Management](Cluster-Management) — Cluster security
- [DApp Development](DApp-Development) — DApp sandbox model
- [Contributing](Contributing) — Security best practices for contributors
