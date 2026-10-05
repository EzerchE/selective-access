# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `7899D868ABC39053FA50D112EA68B813004F56AF572AC8F2790B7C76FCD8BE4A`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, prefers authenticated encrypted DNS only for SOCKS-routed hostnames, falls back to system DNS only when encrypted resolution returns no usable address, leaves literal IP requests unchanged, and forwards resolved target IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
