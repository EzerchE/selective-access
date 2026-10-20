# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `0413A61B46FA02B98CAFD406169A59C4B1244BD5CCF425820B19EB9BE71A49B1`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, prefers authenticated encrypted DNS only for SOCKS-routed hostnames, falls back to system DNS only when encrypted resolution returns no usable address, leaves literal IP requests unchanged, and forwards resolved target IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
