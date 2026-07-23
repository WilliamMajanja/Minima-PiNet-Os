# PiNetOS Security Model

## Device Identity
Each Raspberry Pi generates a unique cryptographic identity upon first boot. If a TPM (Trusted Platform Module) is available, keys are stored securely in hardware. CPIP provides ECDSA P-256 (FIPS 186-4) node identity with challenge-response authentication.

## Secure Node Registration
Nodes joining the PiNet cluster must authenticate using public key cryptography. The cluster manager verifies the node's identity before issuing a WireGuard configuration. CPIP node identity uses `AUTH_CHALLENGE`/`AUTH_RESPONSE` message types with ECDSA P-256 signatures.

## Encrypted Networking
All internal cluster communication is routed through a WireGuard mesh VPN, ensuring end-to-end encryption and preventing eavesdropping on the local network. CPIP CoffeeCipher v3 (AES-256-GCM + HKDF-SHA256) provides application-layer encryption for data at rest and RPC payload encryption.

## CPIP Security Provider
The Coffee Protocol (CPIP v4.0.2) provides:
- AES-256-GCM (FIPS 197) with HKDF-SHA256 key derivation
- ECDSA/ECDH P-256 (FIPS 186-4) for node identity and key exchange
- RSA-KEM-2048 (SP 800-56B) for key encapsulation
- HMAC-SHA256 (FIPS 180-4) for RPC token authentication
- Optional 1nf1D3L Kyber (non-FIPS ML-KEM-768) for post-quantum key exchange
- ITF Defense: probe blocking, pentest tool detection, IP blacklisting
- FIPS 140-2/3 power-on self-tests (`CPIP_FIPS=1`)
