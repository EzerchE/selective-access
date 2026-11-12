# Selective Access Gateway build record

- Source: `helper/source/SelectiveAccessGateway.cs`
- Build command: `helper/source/build-gateway.cmd`
- Target: Windows .NET Framework 4.6 or later, x64-compatible AnyCPU executable; live validation used a current Windows runtime
- SHA-256: `B7E4D7E799EB34498B37E095365E28D75C50949D014DD396E8D6B418BC511C59`
- License: repository root `LICENSE` (MIT)

The gateway listens only on `127.0.0.1:1080`, prefers authenticated encrypted DNS for routed hostnames and gives each provider an independent deadline before system fallback. Only public destination IPs are forwarded to the loopback ByeDPI backend; literal and DNS-resolved private, loopback, link-local and reserved targets are rejected. The optional LAN relay is a separate binary documented in LAN_SHARE_SOURCE.md.

Concurrent lookups for the same routed hostname share one operation. Positive answers are retained only in bounded process memory for at most 30 seconds, the shortest record TTL minus HTTP Age if shorter; missing/zero TTL and failed answers are not cached. Network address changes clear cached/pending answers and provider preference. Target-connection failure invalidates the cached hostname. The last successful existing encrypted-DNS provider is tried first for subsequent uncached names. Each caller keeps its own cancellation budget.
