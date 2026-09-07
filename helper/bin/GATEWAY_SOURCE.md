# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `2B097F54150D03D2FE46A6BD281BA86962AE4C808E45AB3F87CB7CA394BC3EE1`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, resolves only SOCKS-routed hostnames, authenticates encrypted-DNS TLS endpoints over a separately bounded direct connection, and forwards resolved target IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
