# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `065D28EF9BA5F2EEC79CC0CA74964577B2260C8BCACFC6D9A41FD5E4AB0C8350`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, prefers authenticated encrypted DNS only for SOCKS-routed hostnames, gives every provider an independent deadline before trying the next one, falls back to system DNS only when encrypted resolution returns no usable address, leaves literal IP requests unchanged, and forwards resolved target IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
