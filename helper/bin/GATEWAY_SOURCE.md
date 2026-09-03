# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `8E11072874BCC97EB023B1A521412B414959FFF2E0189FCD995893716F580F5D`
- License: repository root `LICENSE` (MIT)

The gateway is built from repository source. It listens only on `127.0.0.1:1080`, resolves only SOCKS-routed hostnames, authenticates encrypted-DNS TLS endpoints, and forwards resolved IP connections to the local ByeDPI backend on `127.0.0.1:1081`.
