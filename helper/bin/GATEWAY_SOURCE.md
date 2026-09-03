# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `F1BD2BCE77901B3FE5F2FB040EF864B8BE7EFB4FE93F466D709A6E4194E66C93`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, resolves only SOCKS-routed hostnames, authenticates encrypted-DNS TLS endpoints, and forwards resolved IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
