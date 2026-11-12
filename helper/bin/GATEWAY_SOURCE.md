# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.x, x64-compatible AnyCPU executable
- SHA-256: `B09C66E8E9F10A59DB2B01D7090B98232A7F0CA8D629E0589B72FA45E252E226`
- License: repository root `LICENSE` (MIT)

The gateway listens only on `127.0.0.1:1080`, prefers authenticated encrypted DNS for routed hostnames and gives each provider an independent deadline before system fallback. Only public destination IPs are forwarded to the loopback ByeDPI backend; literal and DNS-resolved private, loopback, link-local and reserved targets are rejected. The optional LAN relay is a separate binary documented in LAN_SHARE_SOURCE.md.
