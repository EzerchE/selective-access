# Automatic Access 4.19.0 — Faster recovery and smart direct access

[Install for Chrome](https://chromewebstore.google.com/detail/automatic-access/odfkihlhaeapopopacolhihdjdjbddeh) · [Install for Edge](https://microsoftedge.microsoft.com/addons/detail/inlkjdjejdkmegncbjbfdgibghpbkhpf)

Choose a working proxy once in the setup tab. The optional Windows gateway is available in the helper archive below.

Stable release; manifest version 4.19.0. Native helper binaries are unchanged from 4.18.5.

- Remove the duplicate direct-origin check after definitive main-navigation DNS-resolution failure. Apply the route before scheduling an immediate retry; cap other main-page origin checks at one second without changing learning thresholds or TLS validation.
- After page completion, eligible automatic HTTPS main-page routes older than 15 minutes can receive two bounded direct-root checks. Remove only the exact checked hostname when both succeed; preserve unchecked aliases, manual choices, fresh routes, denied/failed checks and non-document protocol evidence.
- Expire temporary exact-host DIRECT leases inside the PAC script. Coalesce concurrent checks, persist the check interval across worker restarts, and let concurrent user settings win.
- Preserve routes when a resource fails during the check or provenance is incomplete. Update EN/TR documentation, privacy disclosures and reviewer instructions.
- Do not use HTTP-root success to remove WebSocket-specific or observed mixed-socket routes. Existing request-type-matched failure recovery is unchanged. No page refresh, global measurement request, new permission, helper reinstall or site-specific rule is introduced.

Release packages: automatic-access-4.19.0.zip, selective-access-helper-4.19.0.zip and automatic-access-store-materials-4.19.0.zip. No helper reinstall is needed for these extension changes.

# Automatic Access 4.18.5 — Safe automatic LAN readiness

- Keep an enabled LAN supervisor running while its original trusted Private network is unavailable at boot or after a transition. No port is opened until the original interface/address/subnet and firewall guards pass; restore sharing automatically when they return.
- Cancel listener and active sessions on unsafe transitions without permanently cancelling the supervisor. Explicit OFF/uninstall removes the service and prevents automatic resumption. Permanent address changes require explicit rebinding.
- Start the supervisor automatically without the delayed-start grace period: its safe waiting loop handles network readiness. Add bounded service crash recovery, waiting-state status text and lifecycle tests for network absence, recovery, cancellation and binding races.
- Harden install/uninstall service-removal checks: only service-not-found is successful absence; permission and query failures cannot masquerade as completed cleanup.

Runtime upload: automatic-access-4.18.5.zip. Optional helper: selective-access-helper-4.18.5.zip. Update the helper on its host and explicitly enable sharing once after update; subsequent restarts need no manual start when the original trusted binding is available. No destination-specific logic or DNS changes.

# Automatic Access 4.18.4 — Proxy endpoint diagnosis

- Distinguish a failed connection to the selected proxy from a destination failure. Do not start direct-route trials or repeat bundled-helper startup retries when a custom proxy endpoint is unavailable.
- Keep custom-proxy health unknown when it cannot be measured; do not report a configured endpoint as verified healthy.
- Create optional LAN sharing services with delayed automatic startup to reduce boot-time network readiness races. Private-network, interface and subnet restrictions remain unchanged; unsafe network changes still stop sharing.
- Add regression coverage for offline custom proxies and retain routes without reload loops. Update documentation and submission package references.

Store upload: automatic-access-4.18.4.zip. Optional helper: selective-access-helper-4.18.4.zip. After updating the helper, LAN sharing starts OFF; enable it explicitly with helper/share.cmd. Existing hosts can restart sharing on an eligible Private network without reinstalling the loopback gateway.

# Automatic Access 4.18.3 — Store submission materials

Stable documentation/metadata release; manifest version 4.18.3. Connection handling and helper binaries are unchanged from 4.18.2.

- Replace obsolete upload filenames and superseded LAN-validation claims with current submission instructions and explicitly dated evidence.
- Supply complete English/Turkish listings, matching packaged short descriptions, single-purpose/permission explanations, a conservative data-use draft, retention/deletion text and reviewer instructions.
- Keep publisher identity, verified contact details, legal/trader declarations and actual Dashboard certification as owner-only account facts. No store submission or approval is claimed.
- Include every submission document in the separate store-materials archive. Add release-version and upload-filename checks to prevent stale application material from recurring.
- Refresh graphics from the actual base interface using reserved demonstration data; remove outdated release labels. No real test target, account or browsing history is included.

Store upload: automatic-access-4.18.3.zip only. Separate downloads: selective-access-helper-4.18.3.zip, automatic-access-store-materials-4.18.3.zip and SHA256SUMS.txt. Existing helper installations need no reinstall for this release.

# Automatic Access 4.18.2 — Accurate connection diagnostics

Stable release; manifest version 4.18.2.

- Clear slow-loading warnings when the tab completes, including an old warning discovered after worker restart or popup reopening.
- Show unresolved routed-resource warnings in the owning tab's popup. Match recovery by tab, hostname and request type; HTML success cannot hide a failed resource or socket handshake. Popup diagnostics refresh when session state changes.
- Ignore errors observed from requests started before their route was installed, stale navigation results, and queued failures superseded by a matching success. Existing bounded initial-recovery retries are reused; no broader routes or new automatic reload policy is added.
- Keep a real unresolved warning visible with its explanation. Optional global checks target the resource shown in that card only after an explicit click. Disabled routing has no active dependency warning.
- Preserve exact-host PAC routing, ordinary direct traffic, learning thresholds, TLS validation and manual proxy settings. No target-specific rules or real browsing examples are added.

Validation: background lifecycle/race/restart tests, popup diagnostics and explicit-check targeting, localization, preview, helper migration, 28 resolver checks, 286 LAN assertions, privacy/history audit and package integrity checks.

Update/reload the extension. The helper binaries are unchanged from 4.18.1, so an already updated helper does not need reinstalling for this release. Included helper installation still disables LAN sharing until explicitly enabled again; uninstall.cmd remains the removal method.

Downloads: automatic-access-4.18.2.zip (extension), selective-access-helper-4.18.2.zip (unchanged helper), automatic-access-store-materials-4.18.2.zip, SHA256SUMS.txt.

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
