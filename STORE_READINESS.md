# Chrome Web Store preparation — 4.18.0

Prepared 12 November 2026. This document records submission materials, not Google approval.

## Included

- Manifest V3; local packaged JavaScript only.
- Permissions: `activeTab`, `notifications`, `proxy`, `scripting`, `storage`, `webRequest` and HTTP/HTTPS/WS/WSS host access; per-permission reasons are in STORE_LISTING.md.
- The switch starts on. First install uses proxyMode=unset; automatic routing waits for the user's explicit choice.
- Exact-host PAC routing with ignored-target precedence and local/private address exclusions. A www alias is listed separately, never inferred as a wildcard.
- English/Turkish UI, privacy notices, visible proxy recipient disclosure before Save proxy, and a privacy-policy link.
- Bundled Windows gateway is optional. Users can instead select their own unauthenticated SOCKS5/SOCKS4/HTTP/HTTPS proxy.
- Setup differentiates saved settings from local helper health; custom endpoint connectivity is not falsely claimed as verified.
- Install/remove links; removing Chrome alone does not remove the optional Windows services.
- Runtime-only store ZIP, current 1280×800 screenshots, 440×280 promo image and 128px icon.
- STORE_LISTING.md supplies listing text, permission reasons, data-flow declarations and reviewer steps.
- No public target-specific routing rules or real browsing history in public examples.

## Required verification gates

Run node --check on runtime files; background, popup and helper-migration tests; repository-audit.cjs --history; build-store-zip.cjs. Verify ZIP manifest and assets and review screenshots in both themes. These checks do not prove success on every network or constitute a Google review.

## Publisher-only actions in Developer Dashboard

The account owner must provide verified contact details, enable two-step verification, choose applicable account/trader declarations, supply the public privacy/support URLs, review the actual data-use form, and upload the store ZIP and listing graphics. Do not certify that the product handles no user data: hostnames and connection metadata are processed locally and sent to selected recipients as described in PRIVACY.md.

Upload only automatic-access-4.18.0.zip, not the repository source or Windows-helper archive. No developer account or dashboard submission is performed by the release scripts.

## Official references

- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/publish

Code signing the optional Windows helper is recommended for distribution trust but is not represented here as a universal Chrome Extensions policy requirement. The product must be independently reviewable with a user-supplied proxy; reviewer instructions disclose all optional native dependencies.

## Private-LAN sharing

Version 4.18.0 includes optional LAN sharing. Run helper/share.cmd on the host: ON / OFF / Status. Changes require Windows administrator approval. The separate LocalService relay binds one selected private IPv4 interface on TCP 1082. Firewall and application peer rules limit access to that exact subnet and Windows Private profile. Public/Domain/mixed profiles, excluded firewall interfaces and disabled firewalls are refused. Address/profile changes stop the relay. Private/loopback resolved destinations are blocked. No wildcard listeners or router changes are made. Any trusted device in that subnet can use the unauthenticated proxy; LAN SOCKS metadata is unencrypted.

Clients select Custom proxy → SOCKS5 and the displayed server IP/1082. They need no helper or administrator permission. OFF removes only the sharing service/rule; uninstall removes all helper services and the rule. The host's loopback gateway remains separate. Every helper install/update disables sharing.

Native validation passed on 2026-11-12: administrator installation, service-specific firewall scope, physical-client browser/TCP access, full running-service OFF/ON cleanup and Public-profile listener shutdown. The service SID omission and stop-state races found during validation were corrected. Sharing was restored on the approved Private network. Automatic-start configuration was checked without rebooting the computer; that limitation remains explicit in tests/LAN_VALIDATION.md. Existing 4.17 graphics illustrate the base popup; LAN instructions are in README.
