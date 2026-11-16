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

## Follow-up — 2026-11-16

The existing optional LAN service was stopped while the loopback gateway remained running. After an administrator restarted the sharing service on the unchanged eligible Private binding, the LAN SOCKS endpoint accepted connections. A host-origin HTTPS request through that bound LAN endpoint returned HTTP 200 with certificate validation enabled. The user then confirmed successful browser access from the second physical computer. This is a fresh host/client access check, not a reboot test. New service creation uses delayed automatic startup; it reduces startup races but does not prove every stop was caused by boot timing. Network safety stops still require explicit re-enabling on an eligible Private network.

## Automatic readiness and helper lifecycle — 4.18.5, 2026-11-16

- Code inspection identified two permanent-stop paths: an unavailable startup binding threw immediately; a later unsafe network transition cancelled the process-wide stop token. Event logs recorded service error 1, but did not preserve which eligibility check failed in each earlier incident.
- Compiled production-supervisor tests cover waiting at boot without an eligible binding, automatic activation, unsafe-session cancellation, recovery to the same binding, explicit stop with no resurrection, and transient bind failure after a fresh service lifetime. LAN policy/relay suite: 294 assertions.
- Administrator native checks passed uninstall, repeated uninstall, install and install-over-existing. Sharing was explicitly restored after the update.
- A known concurrent STOP transition returned Windows error 1061; verified STOPPED state was required before restart, matching the controller's existing race handling. Native stop/start, OFF (no service/listener resurrection), and ON passed.
- With only the dedicated service configured to an absent private binding, the production supervisor remained Running without opening the LAN listener. Restoring the original service binding and starting it restored the listener. Host network/firewall profiles were not weakened or disabled for this test.
- Installed native binary hash and unchanged DNS settings were verified. The final service configuration uses normal automatic startup: the new supervisor safely waits for network readiness without a delayed-start grace period. The host was left with sharing ON on its original binding.
- A full Windows reboot was not performed. The native startup-with-missing-binding test and automated same-lifetime recovery tests are distinct evidence; they do not establish every hardware/network startup scenario.
