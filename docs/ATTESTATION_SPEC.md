# PiNet-OS Formal Remote Attestation Specification (v2.0.0)

**Status:** Released  
**Version:** 2.0.0  
**Date:** 2027-01-15  
**Authors:** William Majanja  

---

## 1. Overview

PiNet-OS v2.0.0 introduces **formal remote attestation** — a cryptographically
verifiable chain of trust from TPM 2.0 hardware, through boot integrity, to
the immutable Minima blockchain ledger.

This specification defines the attestation protocol, data structures, and
verification procedures that enable a remote verifier to confirm that a
PiNet-OS node is running unmodified, trusted software.

### Goals

1. **Boot integrity verification** — verify that the boot chain (firmware,
   kernel, initramfs) has not been tampered with.
2. **Configuration integrity** — verify that `/etc/pinet` configuration
   matches a known-good golden state.
3. **Ledger anchoring** — anchor attestation records to the Minima blockchain
   for tamper-evident, publicly verifiable provenance.
4. **Zero-trust compliance** — enable remote verifiers to reject nodes
   that fail attestation before granting network access.

---

## 2. Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  TPM 2.0    │────▶│  Attestation │────▶│   Minima    │────▶│  Verifier    │
│  PCRs       │     │  Manager     │     │   Ledger    │     │  (remote)    │
│  (sha256)   │     │  (Python)    │     │  (burn tx)  │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                           │                                        │
                           ▼                                        ▼
                    ┌──────────────┐                        ┌──────────────┐
                    │  Boot Hash    │                        │  Golden      │
                    │  Config Hash  │                        │  Values      │
                    └──────────────┘                        └──────────────┘
```

### Components

| Component | Role |
|---|---|
| **TPM 2.0** | Hardware root of trust; stores PCR values reflecting boot state |
| **AttestationManager** | Collects PCRs, hashes boot/config, creates records |
| **Minima Ledger** | Immutable blockchain for anchoring attestation hashes |
| **Remote Verifier** | Compares attestation records against golden values |

---

## 3. Data Structures

### 3.1 AttestationRecord

```json
{
  "attestationId": "a1b2c3d4e5f67890",
  "nodeId": "pinet-alpha",
  "pcrBank": "sha256",
  "pcrValues": {
    "0": "a1b2c3...",
    "1": "d4e5f6...",
    "2": "..."
  },
  "bootHash": "sha256-of-/boot/firmware-contents",
  "configHash": "sha256-of-/etc/pinet-contents",
  "timestamp": "2027-01-15T12:00:00Z",
  "verified": false,
  "ledgerTxid": ""
}
```

### 3.2 AttestationVerifyResult

```json
{
  "attestationId": "a1b2c3d4e5f67890",
  "valid": true,
  "pcrMismatch": [],
  "bootHashMismatch": false,
  "configHashMismatch": false,
  "timestamp": "2027-01-15T12:00:05Z"
}
```

---

## 4. Protocol

### 4.1 Attestation Creation

1. **Collect PCRs** — Read all PCR values from the TPM 2.0 (sha256 bank):
   - PCR 0: Firmware ROM hash
   - PCR 1: Firmware configuration
   - PCR 2-3: Bootloader and U-Boot
   - PCR 4-5: Kernel and initramfs
   - PCR 6: Platform configuration
   - PCR 7: Secure Boot policy

2. **Hash boot partition** — Recursively hash all files in `/boot/firmware`:
   ```
   boot_hash = SHA-256(file_path || file_contents for each file in /boot/firmware)
   ```

3. **Hash config directory** — Recursively hash all files in `/etc/pinet`:
   ```
   config_hash = SHA-256(file_path || file_contents for each file in /etc/pinet)
   ```

4. **Create record** — Generate an attestation ID (16-char truncated SHA-256
   of `nodeId:timestamp:bootHash:configHash`) and assemble the record.

### 4.2 Ledger Anchoring

5. **Anchor to Minima** — Burn a small amount of Minima tokens with the
   attestation hash as the transaction payload:
   ```
   txid = minima.burn(amount=0.001, data=SHA-256(attestation_record))
   ```

6. **Store txid** — Record the ledger transaction ID in the attestation
   record for later verification.

### 4.3 Verification

7. **Retrieve record** — The remote verifier fetches the attestation record
   from the node's API (`GET /api/attestation/{id}`).

8. **Compare against golden values** — The verifier compares:
   - PCR values against the expected golden PCR values
   - Boot hash against the expected golden boot hash
   - Config hash against the expected golden config hash

9. **Verify ledger anchor** — The verifier checks that the attestation hash
   appears in the Minima blockchain at the recorded `ledgerTxid`.

10. **Decision** — If all checks pass, `valid: true` is returned and the
    verifier grants network access. Otherwise, the node is rejected.

---

## 5. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/attestation/status` | Attestation manager status |
| `POST` | `/api/attestation/create` | Create a new attestation record |
| `GET` | `/api/attestation` | List all attestation records |
| `GET` | `/api/attestation/{id}` | Get a specific attestation record |
| `POST` | `/api/attestation/{id}/verify` | Verify an attestation against golden values |
| `POST` | `/api/attestation/{id}/anchor` | Anchor an attestation to the Minima ledger |

---

## 6. Security Considerations

- **PCR Selection** — The default PCR selection (0-7) covers the full boot
  chain. Custom PCR policies can be configured via `PINET_ATTESTATION_PCR_BANK`.
- **Replay Attacks** — Attestation records include a timestamp and are
  anchored to the immutable Minima ledger, preventing replay attacks.
- **Golden Value Management** — Golden PCR/hash values must be stored on a
  separate, trusted system. Compromise of golden values defeats attestation.
- **TPM Sealing** — The CPIP master key is sealed against the same PCR values
  (see TPM Key-Wrap, v1.3.0), ensuring keys cannot be unsealed on a
  tampered node.

---

## 7. Implementation

The attestation manager is implemented in `backend/attestation.py` with
API routes in `backend/routes/attestation.py`. The TPM PCR collection
leverages the `tpm2_pcrread` CLI from `tpm2-tools`.

On hosts without a TPM, all operations return empty PCR values and simulated
hashes, allowing the API to be tested in CI environments.