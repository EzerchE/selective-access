# Routed resolution validation — 4.18.1

Measured on 2026-11-12. No real browsing targets, client identifiers or raw diagnostics are included in this record. Only reserved demonstration domains were used for live measurements.

## Change and scope

The helper shares concurrent lookups per routed hostname and retains positive encrypted-DNS answers in bounded process memory. Expiry respects the shortest record TTL and HTTP Age, capped at 30 seconds; failures and unknown/zero TTL are not retained. Backend connection failures invalidate the hostname. Network changes discard cached and pending answers and reset provider preference; stale completion cannot reintroduce old-network state.

The last successful existing resolver is tried first for subsequent uncached names. No provider is added. Exact-host PAC rules, direct connections, system DNS settings, learning evidence, TLS checks and user exclusions are unchanged. The browser's first direct attempt can still take time before reporting a failure; it is not interrupted speculatively.

## Measurements

| Sample | Previous helper | Candidate helper |
| --- | ---: | ---: |
| First cold target | 2.21 s | 2.24 s |
| Second, previously uncached target | 2.17 s | 0.42 s |
| Mean of the four requests after the first cold target | 2.22 s | 0.29 s |

This is a small sequential same-network sample, not a universal speed guarantee. It measures HTTPS requests through a SOCKS gateway, not complete interactive page rendering. Earlier diagnostic runs showed the first resolver repeatedly reaching its deadline; the candidate encountered that deadline once and reused a successful resolver afterward.

A controlled test with identical synthetic upstream delay reduced eight sequential lookups to one (about 250 ms to 32 ms). Thirty-two concurrent requests shared one lookup.

After applying the final binary to the installed helper, LAN-address requests returned HTTP 200: 2.39 s cold, 0.47 s for the next new target, and 0.23 s warm. Direct HTTPS also returned HTTP 200. Gateway health was HTTP 204 and LAN sharing was restored. A second physical client's complete browser page-load time has not been measured for this change.

## Regression coverage

- 28 production-source resolution checks: provider fallback/preference, reset during an in-flight answer, TTL/Age, expiry, invalidation, negative/missing-TTL behavior, concurrent coalescing, independent caller cancellation, independent host progress, and bounded cache eviction.
- 286 existing LAN policy/relay assertions.
- Background routing/recovery, popup, helper migration/hash integrity, localization and preview tests.
- Repository/history privacy audit and extension package checks.

The live helper backup is local-only and is not part of the repository or packages.
