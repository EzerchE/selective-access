# Routing latency and direct rechecks — 4.19.0

Validated with the controlled background/PAC harness, 2026-11-18. No real browsing history or production target is included. These are local automated results, not a live multi-device network benchmark.

- A definitive main-navigation DNS-resolution failure commits a provisional route without a duplicate root fetch. The controlled harness measured about 1ms processing overhead and zero duplicate probes. The old branch allowed an additional 1500ms probe timeout and a fixed 250ms route reload delay. Browser/OS time to produce the initial DNS/error event is unchanged.
- Other supported main-navigation checks use a 1000ms timeout. Error thresholds, negative-evidence gates and certificate validation remain enabled.
- Eligible aged automatic HTTPS document routes are checked after completed-tab activity, not before initial rendering. Parallel checks coalesce. The harness verifies two fresh root requests see a DIRECT PAC decision, while unrelated learned routes remain proxied and ordinary hosts remain direct.
- Tests cover unreachable targets, HTTP 403, incomplete provenance, manual route retention, concurrent user/resource-error races, persisted cooldown after worker restart, and expired PAC leases without worker cleanup. Unchecked aliases stay routed.
- A successful HTTP root is not WebSocket evidence. Socket-only and observed mixed-socket routes are preserved across worker restart. Embedded/API-only routes are not proactively removed using this root-only check.
- No live browser extension reload, client restart, internet speedup or universal restriction removal is claimed by this fixture. Native helpers are unchanged from 4.18.5 and need no reinstall for these extension changes.
