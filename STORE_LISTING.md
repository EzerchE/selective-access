# Chrome Web Store submission materials — 4.18.2

## Listing (English)

Name: Automatic Access

Short description: Detect connection failures and selectively route affected sites through a proxy you choose.

Detailed description:

Automatic Access keeps ordinary Chrome browsing direct and routes explicitly selected or learned destinations through your chosen proxy. It observes connection errors, applies bounded checks and remembers affected hostnames. You can remove a route, ignore a target permanently, and manage proxy preferences from the popup.

Choose your own unauthenticated SOCKS5, SOCKS4, HTTP or HTTPS proxy, or install the optional Windows local gateway from GitHub. A working proxy is required for routing. The extension does not provide a free remote proxy service. The optional Windows gateway requires administrator permission to install/remove its services; the extension itself does not.

The setup screen explains the selected connection method and checks the bundled helper's local health. A saved custom proxy configuration is verified by the first routed connection, not by saving alone. Normal traffic stays direct; exact listed hosts use the selected proxy. Ignored and private/local targets are excluded.

Hostnames and connection errors are processed on your device. Routed destinations are shared with the selected proxy. The optional local helper uses Cloudflare/Google encrypted DNS with system fallback. A Globalping check sends a hostname to external measurement probes only when requested. There is no developer analytics or browsing-history server. Debug logs are opt-in and local.

HTTPS certificate validation remains enabled. The bundled gateway does not change your public exit IP; a remote proxy can. Some network restrictions or site outages cannot be repaired. Repeated failures can still take time to confirm.

Optional Buy Me a Coffee link opens only when clicked and is not required to use the extension.

Privacy: https://github.com/EzerchE/selective-access/blob/main/PRIVACY.md
Homepage: https://github.com/EzerchE/selective-access
Support: https://github.com/EzerchE/selective-access/issues

## Mağaza metni (Türkçe)

Ad: Otomatik Erişim

Kısa açıklama: Bağlantı hatalarını algılar ve etkilenen siteleri seçtiğiniz proxy üzerinden seçici yönlendirir.

Açıklama: Normal Chrome bağlantıları doğrudan kalırken yalnız listelenen hedefler seçtiğiniz proxy'yi kullanır. Bağlantı hataları sınırlı kontrollerle değerlendirilir; hedefi kaldırabilir veya yoksayabilirsiniz. Kendi SOCKS5/SOCKS4/HTTP/HTTPS proxy'nizi seçin ya da GitHub'daki isteğe bağlı Windows yerel geçidini kurun. Yönlendirme için çalışan proxy gerekir; ücretsiz uzak proxy hizmeti sunulmaz. Yerel Windows hizmetlerinin kurulması/kaldırılması yönetici izni ister. Alan adları seçilen proxy'ye, yerel yardımcı kullanıldığında şifreli DNS sağlayıcılarına ulaşır. Globalping yalnız kullanıcı kontrol istediğinde kullanılır. Geliştirici telemetrisi yoktur; debug kapalı başlar ve cihazda kalır. HTTPS doğrulaması atlanmaz. Yerel geçit çıkış IP'sini değiştirmez; uzak proxy değiştirebilir. Her ağ engelinin veya kesintinin giderileceği garanti edilmez.

Gizlilik: https://github.com/EzerchE/selective-access/blob/main/PRIVACY_TR.md

## Single purpose

Automatically identify supported Chrome connection failures and selectively route affected, explicitly listed hostnames through a user-selected proxy while preserving direct routing for other traffic.

## Permission justifications

- proxy: configure the PAC selection between DIRECT and the user's chosen endpoint.
- webRequest: observe connection outcomes and request types to decide whether a route needs checking/recovery.
- HTTP/HTTPS/WS/WSS host access: support automatic failure detection on arbitrary sites and retry the corresponding origin/frame; a fixed hostname list would defeat the disclosed feature. No history or cookie permission is requested.
- activeTab: display the active target and apply user-triggered route actions.
- scripting: retry an affected embedded frame in its parent document without reloading the entire page; packaged function bodies only.
- storage: local settings, host lists, route provenance and bounded opt-in diagnostics.
- notifications: setup and bounded connection/learning progress or user-requested outcomes.

Remote code: No. All executable extension logic is packaged. Globalping returns measurement data. The optional Windows helper is a separate user-installed program, excluded from the store ZIP; no downloaded JavaScript is evaluated.

## Data-use form preparation

Review the current Dashboard questions before certifying. Hostnames and network activity are handled for the visible routing feature, even when retained only locally. Declare web browsing activity where applicable; describe local diagnostics, selected-proxy destination sharing, DNS providers and optional Globalping measurements. The extension does not intentionally collect identity, health, finance, authentication information, personal communications or precise location. As a transport, a user-selected proxy can observe HTTP content; disclose this distinction rather than claiming the entire proxy path sees no data.

Confirm Limited Use commitments only after reviewing PRIVACY.md against the upload. Do not substitute this document for the publisher's actual answers.

## Reviewer instructions

1. Use a fresh desktop Chrome profile and install the uploaded package. The setup tab opens once; switch on, proxy unconfigured. No domain should route before explicit selection.
2. To review without native software, configure an unauthenticated HTTP/HTTPS/SOCKS proxy under your control. Observe its request log. Saving reports configuration saved, not connectivity verified.
3. Navigate to an authorized test hostname. In the popup select Route now. Verify only that exact hostname goes through the proxy; another hostname and an unlisted subdomain remain direct. Add Ignore and verify direct routing takes precedence.
4. Simulate a connection/DNS failure on an authorized test host, keeping it reachable through your proxy. Verify the candidate/provisional route and bounded retry. HTTP 200 must not confirm a WebSocket route.
5. For optional Windows-helper review, download the matching GitHub source/helper package, run helper/install.cmd as administrator, select Bundled local gateway, and Check again. A 204 response at the loopback health endpoint produces the ready state. Stop the service only in the isolated test environment and verify unavailable, not success.
6. No proxy running: show setup or unavailable status. Switch off: Chrome proxy setting is cleared. A competing extension's proxy control is reported.
7. Globalping runs only when the button is clicked. Enable debug logging, reproduce an error, check only bounded metadata is recorded, and clear it. No path/query/credential should appear in logs.
8. Test notifications with the built-in test button. OS do-not-disturb may hide accepted notifications; popup/setup remains available.
9. Remove a learned target and test Ignore/restore. Remove the extension. If the helper was installed, separately run helper/uninstall.cmd as administrator; verify the project services are removed and unrelated network settings remain unchanged.

No account is required. No credentials, private target names or real browsing logs should be included in review examples.

## Upload assets

- dist/automatic-access-4.18.0.zip
- assets/store/screenshot-routing.png (1280×800)
- assets/store/screenshot-setup.png (1280×800)
- assets/store/promo-small.png (440×280)
- assets/icon-128.png

Screenshots show the actual UI with reserved .example demonstration targets. They do not claim successful access to a particular public service.

## Private-LAN sharing preview

Version 4.18.0-rc.1 is a prerelease. Run helper/share.cmd on the host: ON / OFF / Status. Changes require Windows administrator approval. The separate LocalService relay binds one selected private IPv4 interface on TCP 1082. Firewall and application peer rules limit access to that exact subnet and Windows Private profile. Public/Domain/mixed profiles, excluded firewall interfaces and disabled firewalls are refused. Address/profile changes stop the relay. Private/loopback resolved destinations are blocked. No wildcard listeners or router changes are made. Any trusted device in that subnet can use the unauthenticated proxy; LAN SOCKS metadata is unencrypted.

Clients select Custom proxy → SOCKS5 and the displayed server IP/1082. They need no helper or administrator permission. OFF removes only the sharing service/rule; uninstall removes all helper services and the rule. The host's loopback gateway remains separate. Every helper install/update disables sharing.

Remaining release gate: native Windows service/firewall ON/OFF, reboot/profile-change behavior and a second physical LAN client were not verified because this development shell is not elevated. Keep the release prerelease until an isolated administrator environment verifies the lifecycle. Do not submit this candidate as fully validated. Existing 4.17 graphics illustrate the base popup; LAN instructions are in README.
