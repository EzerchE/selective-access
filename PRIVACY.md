# Privacy policy — Automatic Access

Updated: 12 November 2026 · Version 4.18.2

[Türkçe](PRIVACY_TR.md)

Automatic Access observes Chrome connection failures and routes explicitly listed hostnames through a proxy chosen by the user. The developer operates no telemetry, analytics, advertising, traffic relay or remote logging server.

## Local processing and storage

Chrome supplies request URLs, errors, types and tab/frame identifiers. The extension derives hostnames; it does not persist full URLs, paths, queries, fragments, credentials, cookies, forms or page content. Affected iframe URLs may be inspected in the page DOM to retry an embedded frame. History and cookie permissions are not requested.

Local storage holds enabled state, proxy type/address/port, learned and ignored hosts, route provenance/health and recent status results. Session storage keeps bounded recovery state until the browser session ends. Debug starts off; if enabled, at most 150 local events contain hostnames, error classes, request types, timings and routing decisions. Clear them in Advanced settings.

Rules match exact listed hostnames. Main-page learning also records the conventional www/non-www alias; this never enables wildcard routing. Ignored targets and their subdomains stay direct. Automatic routes can be removed by bounded direct recovery; manual routes are preserved.

Recent routed-resource warnings retain only hostname, request type, error and time, up to 32 per tab in session storage. Temporary request-route and completion bookkeeping is bounded in process memory and excludes paths, queries and payloads. Navigation or tab closure clears obsolete tab context. A popup can display the failed resource's hostname; an external status check for it still requires your explicit click.

## Requests and recipients

For routed SOCKS connections, the optional helper coalesces identical in-flight DNS queries and keeps up to 256 positive answers only in process memory, bounded by remaining DNS TTL and a 30-second cap. It retains no failed answers or persistent DNS history. Network changes clear answers and existing-provider preference. No additional DNS recipient is introduced.

- Destination servers receive sanitized origin-root checks without cookies or credentials. They see the source IP and normal request metadata. Paths, queries, fragments and user information are removed before checks.
- Your selected proxy receives routed destination hostnames/IPs, ports, source connection information and traffic needed to provide the connection. Its operator may read HTTP content. HTTPS/WSS content remains protected by end-to-end TLS; certificate validation is never disabled. HTTP/SOCKS proxy transport does not encrypt connection metadata. HTTPS proxy transport encrypts the hop to the proxy, whose operator still sees destinations. Choose an operator you trust; its retention/privacy terms apply. Settings stay local; username/password proxy login is not supported.
- The bundled gateway/backend listen on loopback. Optional LAN sharing adds a separate relay on a selected private IPv4 interface, port 1082, limited to that subnet and the Windows Private firewall profile. Sharing starts off after install/update and is controlled by the host's helper/share.cmd menu. The host and other permitted LAN devices can observe connection metadata and unencrypted traffic; HTTPS/WSS content remains encrypted. The relay stores no traffic/client log. Runtime peer IPs are used only for access control. Routed hostname queries go sequentially to Cloudflare and/or Google over HTTPS, falling back to the system resolver if no usable answer is returned. Resolvers receive the hostname and host connection IP under their own terms. DNS does not include page paths, cookies or content. Normal traffic retains existing DNS settings. The helper does not decrypt HTTPS or replace certificates.
- Globalping receives the hostname only when you click Check global status, for external measurements from three continents. Its infrastructure and probe operators receive the target and measurement request. Do not submit private service names. Literal private/local targets are rejected; the extension cannot recognize every private service behind a public hostname. No automatic global check runs.
- GitHub and the optional Buy Me a Coffee link open only on a click under those websites' privacy terms. No remote payment script is loaded.

Browsing data is not sent to the developer, sold, used for ads, credit scoring or unrelated profiling. The developer cannot access your local settings or logs during normal operation. Diagnostic sharing for support is your explicit choice; remove sensitive targets before sharing.

## Retention and removal

Local settings remain until removed by you, cleared by Chrome or the extension is uninstalled. Session data ends with the browser session. Remove targets using row actions and clear logs in Advanced settings. A user-selected proxy is not installed or removed by the extension.

Use helper/share.cmd → OFF to remove the dedicated LAN service/firewall rule while keeping the loopback helper. If you installed the bundled Windows services, separately run helper/uninstall.cmd as administrator to remove all helper services and the LAN rule. Removing the extension does not remove Windows services. The uninstaller does not change adapter DNS or unrelated network settings.

## Permissions

- `webRequest` and HTTP/HTTPS/WS/WSS host access observe connection outcomes across sites.
- `proxy` applies selective PAC routing.
- `storage` keeps local settings and diagnostics.
- `activeTab` shows the current target.
- `scripting` retries affected embedded frames, including open shadow roots.
- `notifications` shows setup, bounded waiting/learning notices and requested status results.

## Limited Use and contact

Our use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only for the disclosed selective-routing functionality and related troubleshooting. Human access to user-shared diagnostics is limited to explicit support consent, security investigation or legal obligations.

For privacy questions use GitHub Issues without private browsing logs. For confidential security reports use Security → Report a vulnerability as described in SECURITY.md.
