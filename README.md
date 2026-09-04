**English** | [Türkçe](README_TR.md)

# Automatic Access

A Manifest V3 Chrome extension that learns targets experiencing connection errors and routes only those exact domains through a local SOCKS5 compatibility gateway.

Current version: **4.11.9**

<img src="assets/screenshots/popup-v4-8-en.png" alt="Automatic Access extension popup in English" width="307">

## Core behavior

- Connections that work normally remain direct.
- A single temporary error does not automatically route a target.
- Main pages and external frames affected by DNS resolution errors can be learned. The local gateway resolves only routed hostnames and can use encrypted DNS when the system resolver fails.
- A timed-out main page is learned and retried only when a sanitized direct-origin probe also fails; a slow but reachable page remains direct.
- Once a page is routed, dependencies initiated by that page that fail DNS resolution or time out can also be learned after a failed direct-origin probe; unrelated pages cannot cause this broader dependency handling.
- Verification does not repeat the full address. User information, path, query, and fragment are removed, and only the origin root is tested without cookies.
- Checks are isolated by domain. A slow target does not block other domains, and no more than three validations run concurrently.
- During main-target recovery, late page dependencies are collected in a bounded settling window even if the main document has already completed. A limited additional reload may be attempted without creating a reload loop.
- Repeated real-time connection failures use their bounded failure threshold directly instead of waiting for an unrelated HTTP probe.
- Local gateway setup attempts are time-bounded, and successful pages keep a stable proxy configuration while their remaining resources load.
- Learned rules apply only to the exact hostname that produced the error.
- A successful routed page keeps its learned route until the user removes or ignores it, avoiding disruptive browser-wide proxy changes during page loading.
- Private, local, and link-local IPv4/IPv6 addresses are excluded from routing.
- Learned and ignored domains are stored only in `chrome.storage.local`.
- The extension and helper do not change the browser, adapter, system, or router DNS configuration.
- The toolbar icon stays unobstructed after a successful direct connection. It shows a blue `↗` when the local gateway is used, cyan `+` for a newly learned route, amber `?` while an issue is being checked, red `!` for an access or gateway failure, and gray `×` when disabled. These compact marks reflect both the main-page result and routed dependencies used by the tab.

This tool is not a VPN. It does not change your IP address or country. Use it only for targets you are authorized to access and in accordance with applicable rules.

## Installation

> Windows and Google Chrome are currently supported.

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**, select **Load unpacked**, and choose the project folder.
4. Right-click `helper/install.cmd`, choose **Run as administrator**, and run it once.
5. Select the reload icon on the extension card, then enable the switch in the popup.

Administrator permission is required only to install or remove the Windows service. Reloading the extension or changing its settings does not start PowerShell, a command window, or a UAC prompt.

## Updating

1. Update the repository files.
2. Select the reload icon on the extension card at `chrome://extensions`.
3. If the contents of `helper/` changed, run `helper/install.cmd` again as administrator. The installer safely removes obsolete project-owned network components before updating the current service.

## Uninstalling

1. Remove the extension from Chrome.
2. Run `helper/uninstall.cmd` as administrator.

The uninstaller removes only this project's local components. It does not change adapter DNS or other network settings, and it reports an error instead of success when removal cannot be verified.

## Permissions

- `webRequest` and HTTP/HTTPS/WS/WSS access: detect supported connection errors and successful main-page responses.
- `proxy`: apply local PAC/SOCKS5 routing only to learned domains.
- `storage`: keep settings, learned and ignored domains, and optional diagnostic records on the device.
- `activeTab`: show the active tab's domain and associate user actions with that tab.
- `notifications`: report newly learned targets and user-requested status-check results.
- `scripting`: retry only an automatically learned external iframe without reloading the top-level page.

The extension does not execute remote JavaScript, collect page content, decrypt HTTPS, or install a private certificate.

## Local helper

The public local gateway listens only on `127.0.0.1:1080`. That port is fixed by the installed Windows service, so the popup reports it instead of offering an edit that would silently break every learned route. It first tries the existing system resolver and supplements the result through an authenticated encrypted-DNS connection when necessary. Resolved IP addresses are passed to the ByeDPI backend on `127.0.0.1:1081`; TLS remains end-to-end between Chrome and the destination. Both Windows services run under the restricted `LocalService` account with automatic startup, dependency ordering, and controlled restart policies. Only hostnames explicitly routed by the extension reach this resolver path. If the gateway is still starting, routed main pages are retried briefly with a fixed limit. The installer:

- verifies both bundled binaries' SHA-256 values before and after copying them;
- restricts the installation directory to SYSTEM, administrators, and the service account;
- never creates DNS/NRPT rules, registry entries, or scheduled tasks;
- removes only precisely identified remnants created by obsolete DNS-based releases, then verifies their removal before continuing.

Source, build, version, hash, and license information is recorded in `helper/bin/SOURCE.md`, `helper/bin/GATEWAY_SOURCE.md`, and `THIRD_PARTY_NOTICES.md`.

## Diagnostics and global status checks

Debug logging is disabled by default. When enabled, the most recent 150 limited events remain on the device and are written in batches. Records do not contain full URLs, queries, cookies, form data, or page content.

**Check global status** is bounded: each request is limited to what is left of the overall budget, including reading its response body, so a provider that stops responding ends the check instead of leaving it pending. It runs only when the user selects the button. The checked domain is then sent to the [Globalping](https://globalping.io) API; no automatic external measurement is performed.
When multiple external probes confirm that a target is unavailable, any matching learned route is removed instead of repeatedly sending an offline target through the local gateway.

## Privacy and security

- There is no developer telemetry, analytics server, advertising, or affiliate code.
- Browsing data is not sold or used for advertising.
- Disabling the main switch clears the Chrome proxy setting.
- The extension does not override a proxy controlled by another extension or administrator.
- If Chrome accepts a notification but it is not visible, operating-system notification and do-not-disturb settings still apply.

Details: `PRIVACY.md`, `SECURITY.md`, and `RESPONSIBLE_USE.md`.

## Development checks

```text
node --check background.js
node --check i18n.js
node --check popup-preview.js
node --check popup.js
node tests/background.test.cjs
node tests/popup.test.cjs
node tests/helper-migration.test.cjs
node scripts/repository-audit.cjs
node scripts/repository-audit.cjs --history
node scripts/build-store-zip.cjs
```

`scripts/build-store-zip.cjs` writes the Chrome Web Store archive to `dist/`, containing only the runtime files and distribution documents. It removes the development-only preview script from the packaged popup and refuses to write an archive that reaches a helper binary, test, development script, or repository document.

The audit checks permission/documentation alignment, sensitive data, public target names, prohibited DNS/PowerShell behavior, constrained legacy migration, binary hashes, the service account, dynamic code use, localization completeness, and Git history.

## Limitations

- Only Chrome traffic is covered.
- It cannot repair a real server outage or loss of internet connectivity.
- The local compatibility profile may need updates as network behavior changes.
- The source is not customized for a specific user, device, network, or real target list.

## License

Original project code is licensed under the MIT License. Bundled third-party components remain subject to their own licenses.

<p align="center">
  <a href="https://buymeacoffee.com/ezerche">
    <img src="assets/support-button.svg" alt="Buy me a coffee" width="220">
  </a>
</p>
