# LAN validation — 4.18.0

Validated on Windows, 2026-11-12. This record contains no client addresses, browsing history or traffic content.

## Native tests

- Administrator installation of the bundled helper succeeded; sharing started disabled.
- ON created the dedicated LocalService relay, service SID and exact Private-profile firewall rule, with one interface/address, subnet and TCP 1082.
- A second physical computer in the same subnet reported a successful TCP connection and the user confirmed browser access through the selected SOCKS5 proxy.
- OFF removed the LAN listener, dedicated service and rule. Loopback gateway health remained HTTP 204.
- ON restored the listener and automatic-start service configuration.
- Switching the host interface to Public stopped the listener. The approved Private profile was restored and sharing was enabled again.
- Mixed unsafe profiles were refused before mutation; test service/rule cleanup was verified.

Two defects found in native testing were fixed: missing service SID prevented service-specific firewall matching; concurrent STOP_PENDING/STOPPED transitions could abort cleanup. Stop-state race handling still requires verified STOPPED status and preserves access-denial/timeout failures.

## Automated coverage

`node tests/lan-share.test.cjs` compiles the production C# sources and runs 286 assertions, including subnet restrictions, public destinations, scoped firewall generation, TCP forwarding/cancellation, and stop-state races. Additional guards check that the service SID is configured before firewall setup and that installer/binary hashes match.

## Limits

The host was not rebooted: automatic-start configuration and explicit service restart were verified, not a full boot. Live tests used one host/client pair on a trusted IPv4 Ethernet subnet. They do not establish compatibility with every router, endpoint security policy or Wi-Fi isolation mode. The LAN proxy is unauthenticated within its permitted subnet; TLS validation remains end to end. Site-selected routing can be used with a completed filter page, but security software on the client may still inspect proxy traffic.
