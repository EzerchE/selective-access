# Automatic Access 4.18.1 — Routed connection performance

Stable release; manifest version 4.18.1.

- Combine concurrent encrypted-DNS lookups per routed hostname and retain positive answers only within remaining TTL, capped at 30 seconds and 256 entries. Missing/zero TTL, failures and target-connection failures do not leave a reusable stale answer.
- Try the last successful existing resolver first for uncached routed names. Network changes reset preference and cached/in-flight results; old-network completion cannot restore old state.
- Preserve direct traffic, system DNS settings, exact-host routing, learning thresholds, TLS validation and independent caller cancellation.
- Local controlled measurement: eight requests required one lookup instead of eight. In a live reserved-domain comparison, the second uncached hostname completed in about 0.42 seconds versus 2.17 seconds on the previous helper; subsequent sampled requests averaged 0.29 seconds versus 2.22 seconds. This is one network sample, not a universal page-load guarantee; the initial cold connection still took about 2.2 seconds.

Validation: 28 resolution checks, 286 LAN assertions, extension/popup/migration/localization/preview regressions, privacy/history audit and package integrity checks. Live installed-helper health and LAN requests succeeded. Full browser rendering speed and a computer reboot were not measured for this update.

Update the bundled Windows helper to receive the resolver optimization; updating the extension alone does not replace the installed helper. Run helper/install.cmd as administrator. Helper installation disables LAN sharing; enable it again with helper/share.cmd if needed. Clients using another computer's shared proxy do not need a local helper. User-supplied proxies are unchanged. To remove the helper, switch the extension off or select another proxy, then run helper/uninstall.cmd as administrator.

Downloads: automatic-access-4.18.1.zip (extension), selective-access-helper-4.18.1.zip (Windows helper), automatic-access-store-materials-4.18.1.zip (documents/base-interface graphics), SHA256SUMS.txt.

# Automatic Access 4.18.0 — Private LAN sharing

Stable release; manifest version 4.18.0.

- Host: update the helper with install.cmd as administrator, then open helper/share.cmd. 1 enables sharing, 2 disables it, 3 shows status. Changes request administrator approval.
- Clients: Custom proxy → SOCKS5, displayed host IP, port 1082. No client helper/admin rights are required.
- Sharing starts OFF after every helper install/update. It uses a separate LocalService relay; the 1080 local gateway remains available.
- Firewall scope: selected private IPv4 interface, exact subnet, executable, service and TCP port; Private profile only, no edge traversal. Application checks reject out-of-subnet/public/IPv6 sources.
- The relay enables its service SID before startup, allowing the service-scoped firewall rule to match inbound LAN connections without broadening the rule or changing the LocalService account.
- Stopping tolerates Windows already-stopping/already-stopped races only after verifying the stopped state. Access denial and timeout still fail cleanup.
- Public/Domain/mixed profiles, disabled firewalls and excluded interfaces are refused. Address/profile changes stop active connections. Resolved private/loopback/link-local destinations are blocked.
- OFF removes only the LAN service/rule. uninstall.cmd removes all project services and the LAN rule. DNS and firewall-profile settings are not changed.
- Any trusted device in the allowed subnet can use the unauthenticated proxy. Do not forward port 1082 from your router.

Validation: 286 LAN policy/relay assertions, real loopback TCP forwarding and cancellation, extension/migration/localization/preview tests and repository/history audit. Native administrator installation, ON/OFF cleanup, repeated startup, service-scoped firewall matching, mixed-profile refusal and shutdown on Public profile were verified. A second physical computer confirmed TCP reachability and browser access through the LAN proxy. Local gateway health remained HTTP 204 while sharing was disabled. Automatic-start configuration was checked; a full computer reboot was not performed. See tests/LAN_VALIDATION.md for scope and limitations.

Downloads: automatic-access-4.18.0.zip (extension), selective-access-helper-4.18.0.zip (Windows helper), automatic-access-store-materials-4.18.0.zip (documents/base-interface graphics), SHA256SUMS.txt.

# Previous: Automatic Access 4.17.1

- Based on 4.17.0, preserving existing settings and setup gates.
- Repeated top-level transport failures can now trigger automatic provisional proxy routing even when a small direct-origin check responds. Single transient failures and successful navigations remain direct.
- Successful navigation clears accumulated failure evidence, including pending checks. Existing exact-host exclusions, bounded retries, certificate validation and external-outage holds remain in effect.
- Updated the reachable-origin diagnosis in English and Turkish to explain automatic recovery.

The extension ZIP is available on GitHub. Chrome Web Store publication is separate. The optional Windows helper is unchanged from 4.17.0; existing installations do not need to reinstall it for this fix.

# Automatic Access 4.17.0

- Visible first-run setup: choose your own proxy or install the optional ready-to-use Windows ByeDPI helper from GitHub.
- Explicit consent and recipient disclosure before saving proxy preferences; English and Turkish privacy policies linked from the interface.
- Clear saved/ready/unavailable states, recheck action and setup completion button.
- Local-helper install/removal instructions in the interface and helper README; removing the Chrome extension alone does not remove Windows services.
- Exact-host routing with ignored-target precedence; no implicit wildcard from a www alias pair.
- Shorter bounded recovery delays, provisional-route settling protection and waiting notifications.
- Updated store graphics, listing text, permission reasons and reviewer instructions.

## Downloads

- automatic-access-4.17.0.zip: extension-only package for Chrome Web Store upload or unpacked testing.
- selective-access-helper-4.17.0.zip: optional Windows helper; extract everything and run helper/install.cmd as administrator. Remove with helper/uninstall.cmd as administrator.
- automatic-access-store-materials-4.17.0.zip: listing text, policies and store graphics; do not upload this as the extension.
- SHA256SUMS.txt: release asset integrity hashes.

Checks: runtime syntax, background, popup and helper-migration tests, repository/history audit, store archive inspection, and browser preview flows passed. The helper executable/service configuration is unchanged from the prior published release; no fresh system installation/removal was performed on the user's machine. Store approval and testing on every network are not claimed. Developer Dashboard account declarations and final store submission remain publisher actions.
