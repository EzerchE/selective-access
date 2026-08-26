**English** | [Türkçe](README_TR.md)

# Automatic Access

A Manifest V3 Chrome extension that learns targets experiencing connection errors and routes only those exact domains through a local SOCKS5 compatibility gateway.

Current version: **4.10.0**

The extension UI follows Chrome's interface language: Turkish for Turkish browsers and English for every other language.

<img src="assets/screenshots/popup-v4-8-en.png" alt="Automatic Access extension popup in English" width="307">

The project mark depicts an alternate route bending around a blocked direct path.

## Core behavior

- Connections that work normally remain direct.
- A single temporary error does not automatically route a target.
- Verification does not repeat the full address. User information, path, query, and fragment are removed, and only the origin root is tested without cookies.
- Checks are isolated by domain. A slow target does not block other domains, and no more than three validations run concurrently.
- During main-target recovery, newly learned page dependencies are collected in a short settling window. A limited additional reload may be attempted without creating a reload loop.
- Learned rules apply only to the exact hostname that produced the error.
- After a routed main page loads, the extension occasionally verifies the origin root twice without the gateway. When both checks respond, the matching hostname aliases are removed from routing and the user is notified.
- Private, local, and link-local IPv4/IPv6 addresses are excluded from routing.
- Learned and ignored domains are stored only in `chrome.storage.local`.
- The extension and helper do not change DNS providers, system DNS settings, or router configuration.
- The toolbar badge reports the current tab state: green `DIR` for the direct path, blue `VIA` for the local gateway, cyan `NEW` for a newly learned target, amber `?` while checking or when an issue continues, red `DOWN` or `!` for an outage or gateway error, gray `OFF` when disabled, and gray `N/A` on browser-internal pages.

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
3. If the contents of `helper/` changed, run `helper/install.cmd` again as administrator.

## Uninstalling

1. Remove the extension from Chrome.
2. Run `helper/uninstall.cmd` as administrator.

The uninstaller removes only this project's local service and installation directory. It does not alter DNS or other network settings, and it reports an error instead of success when removal cannot be verified.

## Permissions

- `webRequest` and HTTP/HTTPS/WS/WSS access: detect supported connection errors and successful main-page responses.
- `proxy`: apply local PAC/SOCKS5 routing only to learned domains.
- `storage`: keep settings, learned and ignored domains, and optional diagnostic records on the device.
- `activeTab`: show the active tab's domain and associate user actions with that tab.
- `notifications`: report newly learned targets, restored direct access, and user-requested status-check results.
- `scripting`: retry only an automatically learned external iframe without reloading the top-level page.

The extension does not execute remote JavaScript, collect page content, decrypt HTTPS, or install a private certificate.

## Local helper

The local gateway listens only on `127.0.0.1:1080`. Its Windows service runs under the restricted `LocalService` account with delayed automatic startup and a controlled restart policy. The installer:

- verifies the bundled binary's SHA-256 before and after copying it;
- restricts the installation directory to SYSTEM, administrators, and the service account;
- does not create or modify DNS rules, NRPT rules, registry entries, or scheduled tasks.

Source, version, hash, and license information for the third-party binary is recorded in `helper/bin/SOURCE.md` and `THIRD_PARTY_NOTICES.md`.

## Diagnostics and global status checks

Debug logging is disabled by default. When enabled, the most recent 150 limited events remain on the device and are written in batches. Records do not contain full URLs, queries, cookies, form data, or page content.

**Check global status** runs only when the user selects the button. The checked domain is then sent to the [Globalping](https://globalping.io) API; no automatic external measurement is performed.

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
node --check popup.js
node tests/background.test.cjs
node scripts/repository-audit.cjs
node scripts/repository-audit.cjs --history
```

The audit checks permission/documentation alignment, sensitive data, public target names, prohibited DNS/PowerShell components, binary hashes, the service account, dynamic code use, localization completeness, and Git history.

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
