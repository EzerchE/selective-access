# Reviewer test instructions — 4.18.3

Upload: automatic-access-4.18.3.zip. No product account, subscription, credential or license key is required. A working proxy is needed to test traffic routing; no developer-operated public test proxy is provided.

## Copy-ready reviewer instructions

1. Install in a fresh desktop browser profile. The switch starts ON; setup explains that routing remains inactive until the user chooses a proxy. Closing setup does not install native software or silently choose an endpoint.
2. To review without native installation, select Custom proxy and an unauthenticated SOCKS5, SOCKS4, HTTP or HTTPS endpoint under your control. Save its server/port. Saved means configuration accepted, not connectivity verified; the first routed request tests it. No helper or administrator permission is needed for this path.
3. Use authorized test destinations and your controlled proxy's log. On one target select Route now, then reload. Only that exact listed hostname should use the proxy; an unrelated hostname and an unlisted subdomain remain DIRECT. Ignore keeps the target/subdomains direct and prevents relearning. Remove only deletes the current route.
4. To exercise learning, make an authorized target fail directly with a supported DNS/connection error while keeping it reachable through the proxy. Observe bounded detection/retry. Main-page learning can add a conventional www alias, never a wildcard route. Generic cancellations or content-blocker errors alone must not learn unrelated sites. Restore the test environment afterward.
5. Watch toolbar/popup status. A completed tab clears an old slow warning. A pending routed resource identifies its hostname in that tab. Main-document success must not hide a failed resource/socket handshake; recovery matches hostname and request type. Another tab's success must not clear this warning. Navigation clears obsolete context.
6. Switch OFF and verify this extension's proxy setting is cleared. With no proxy configured, setup remains required. A competing extension's proxy control is reported rather than successful application.
7. Global status measurements occur only after clicking Check global status. A resource diagnostic checks the hostname shown in its card. Do not submit private service names. Enable debug, reproduce an authorized failure, inspect/clear its bounded local metadata. Paths, queries, cookies, credentials and payloads must not appear.
8. Use Test notification. Operating-system settings may hide an accepted notification. Permission refusal is handled, and the popup remains an alternative explanation.
9. Optional Windows path: download/extract the complete helper archive from the latest release. Run helper/install.cmd as administrator. Select Bundled local gateway and Check again. A healthy loopback endpoint returns HTTP 204 and setup can finish. This native installation is separate from, and excluded from, the store ZIP.
10. Optional LAN path: on the helper host run helper/share.cmd, choose ON and approve elevation. Only eligible trusted Private IPv4 Ethernet/Wi-Fi networks with an enabled firewall are accepted. Another same-subnet computer selects Custom proxy → SOCKS5 with the displayed host and port 1082; it needs no local helper. Keep the host running. OFF removes the dedicated relay/rule while retaining the loopback helper. Public/Domain/mixed profiles are refused; profile/address changes stop the relay. Do not configure router port forwarding.
11. To remove the helper, switch the extension off or select another proxy, then run helper/uninstall.cmd as administrator. Removing the extension alone does not remove Windows services. If the folder was deleted, download/extract the helper again to obtain the uninstaller. Independently chosen proxies are not installed or removed by the extension.

## Publisher notes

Use only authorized test infrastructure. No real browsing history, private host, client address or proxy credential is supplied here. A full reboot and every possible network/security configuration have not been validated. Historical native tests are recorded in tests/LAN_VALIDATION.md; resolver measurements are in tests/GATEWAY_PERFORMANCE.md. These records are not store approval.

Project/helper downloads: https://github.com/EzerchE/selective-access/releases/latest
