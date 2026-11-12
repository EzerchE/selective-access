# Automatic Access 4.18.0-rc.1 — Private LAN sharing preview

Prerelease; manifest version 4.18.0. Stable release remains 4.17.1.

- Host: update the helper with install.cmd as administrator, then open helper/share.cmd. 1 enables sharing, 2 disables it, 3 shows status. Changes request administrator approval.
- Clients: Custom proxy → SOCKS5, displayed host IP, port 1082. No client helper/admin rights are required.
- Sharing starts OFF after every helper install/update. It uses a separate LocalService relay; the 1080 local gateway remains available.
- Firewall scope: selected private IPv4 interface, exact subnet, executable, service and TCP port; Private profile only, no edge traversal. Application checks reject out-of-subnet/public/IPv6 sources.
- Public/Domain/mixed profiles, disabled firewalls and excluded interfaces are refused. Address/profile changes stop active connections. Resolved private/loopback/link-local destinations are blocked.
- OFF removes only the LAN service/rule. uninstall.cmd removes all project services and the LAN rule. DNS and firewall-profile settings are not changed.
- Any trusted device in the allowed subnet can use the unauthenticated proxy. Do not forward port 1082 from your router.

Validation: 281 LAN policy/relay assertions, real loopback TCP forwarding and cancellation, extension/migration/localization/preview tests and repository/history audit. Native Windows service/firewall ON/OFF, reboot/profile-change lifecycle and a second physical LAN client remain unverified because this development shell is not elevated. No live host services/firewall rules were enabled. This prerelease must pass that remaining gate before stable/store submission.

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
