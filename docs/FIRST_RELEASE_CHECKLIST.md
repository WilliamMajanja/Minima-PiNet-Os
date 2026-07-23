# PiNetOS First Release Checklist

This checklist defines the minimum release bar to ship PiNetOS as a cohesive product across runtime, control API, and UX layers.

## 1) Product Layers and Contracts

- [ ] Runtime/Cluster layer (`bin/`, `lib/`, `PiNetOS/pinet`) has stable role lifecycle semantics (`master`, `worker`, `join`).
- [ ] Control API layer (`server.ts` endpoints) is validated for runtime health, minima status, cluster state, and auth flows.
- [ ] Desktop UX/UI layer (`components/`, `services/`) surfaces operational state and degraded-mode behavior clearly.
- [ ] Shared type contracts (`types/`) remain the source of truth for app/service interfaces.

## 2) Raspberry Pi Boot Chain Readiness

- [x] `boot/config.txt`, `boot/cmdline.txt`, and `boot/uboot/uboot.env` are present.
- [x] Release pipeline validates required Pi boot settings before image generation.
- [ ] Boot profile is smoke-tested on target Raspberry Pi hardware.
- [ ] Fallback boot sequence (SD → USB/NVMe → PXE) is verified on real hardware.

## 3) CLI and Operator Experience

- [x] `pinet status --json` exists for automation and CI integration.
- [ ] CLI command outcomes use stable exit codes for success/failure classes.
- [ ] Setup and start flows are idempotent and safe to rerun.
- [ ] Troubleshooting path (`pinet logs`, `pinet status`) is documented in release notes.

## 4) Clustering and Coordination

- [ ] Node join flow validates role and coordinator reachability.
- [ ] Heartbeat timing and offline transitions match configured defaults.
- [ ] Cluster state recovery after restart is validated.
- [ ] Split-brain/dual-master handling is explicitly tested and documented.

## 5) Packaging and Release Artifacts

- [x] Release workflow generates source archives, Raspberry Pi image, and package zips.
- [x] `scripts/generate-release-packages.js` runs in release pipeline.
- [x] SHA256 checksums are generated and published with release artifacts.
- [ ] Artifact install/flash instructions are validated end-to-end.

## 6) CI/CD Gates

- [x] Baseline quality gate includes install, typecheck lint, and production build.
- [x] Boot config validation gate runs in release workflow.
- [ ] Cluster and CLI smoke tests are automated in CI.
- [ ] Release candidate tagging flow (`vX.Y.Z-rcN`) is defined before stable tag cut.

## 7) Security and Stability

- [ ] API input validation and rate limits are validated on exposed endpoints.
- [ ] Release branch passes code review and security scanning before tag.
- [ ] Build and release scripts avoid unsafe shell execution patterns.
- [ ] Known risks and mitigations are tracked in release notes.
- [ ] CPIP FIPS power-on self-tests pass (AES-256-GCM, HMAC-SHA256, HKDF, ECDSA P-256, ECDH P-256).
- [ ] Release artifacts are ECDSA P-256 signed via CPIP (per POLICY.md §4).
- [ ] CPIP ITF Defense verified: probe blocking returns HTTP 418, IP blacklisting works.
