# Chrome Web Store preparation — 4.18.3

Prepared 12 November 2026. Submission materials are prepared; publisher-account actions and store review have not been completed by this work. No store approval is claimed.

## Submission bundle

- Upload only dist/automatic-access-4.18.3.zip, not the repository or helper archive.
- STORE_LISTING.md: English/Turkish descriptions, public links and assets.
- STORE_SUBMISSION.md: single purpose, permission reasons, remote-code answer, conservative data-use declarations and owner-only account fields.
- STORE_REVIEWER_GUIDE.md: copy-ready tests, proxy/helper prerequisites and removal.
- PRIVACY.md / PRIVACY_TR.md: public recipients, retention and Limited Use notices.
- automatic-access-store-materials-4.18.3.zip: documents, screenshots, promo tile and icon, separate from the runtime ZIP.

## Included behavior

- Manifest V3 with packaged JavaScript; no downloaded executable extension code.
- Permissions: `activeTab`, `notifications`, `proxy`, `scripting`, `storage`, `webRequest`; HTTP/HTTPS/WS/WSS host access supports the disclosed cross-site feature.
- Switch starts ON, but routing awaits an explicit proxy choice. Setup distinguishes bundled-helper health from a merely saved custom endpoint.
- Exact-host PAC rules, conventional main-page www alias, ignored-target precedence and local/private exclusions. Normal unlisted traffic stays DIRECT.
- A compatible user-supplied proxy works without native installation. The optional Windows helper needs administrator permission to install/remove, as disclosed.
- Debug starts off; global measurements require a click. Per-tab diagnostics do not mask resource errors with main-page success.
- Optional LAN sharing starts OFF after helper installation/update. A separate relay and Private-profile firewall/application checks restrict it to one selected private IPv4 interface/subnet. OFF retains the loopback helper; uninstall removes the helper services and dedicated rule. The helper changes no DNS setting or firewall profile.
- First-attempt delays, transport limits, lack of anonymity/access guarantees and absence of a developer-operated remote proxy are disclosed.

## Verification and limits

Runtime behavior is unchanged from 4.18.2. Lifecycle/race/restart, popup, migration, localization and preview coverage is retained. Resolver tests contain 28 checks and LAN tests contain 286 assertions. Release checks include syntax, required regressions, repository/history privacy audit, store-document version/filename checks, ZIP/manifest integrity and graphic dimensions.

Historical live validation on 2026-11-12 covered administrator installation, scoped firewall matching, ON/OFF cleanup, Public-profile shutdown and second-computer browser/TCP access. Installed-helper health and routed resolution were checked. The computer was not rebooted; automatic-start configuration was verified. These are earlier live results, not new validation of every network. See tests/LAN_VALIDATION.md and tests/GATEWAY_PERFORMANCE.md.

Graphics show the actual base interface with reserved demonstration data. They contain no real target, account, client identifier or browsing history.

## Release gates

Run runtime syntax and background, popup, migration, resolver, LAN, localization and preview tests. Run scripts/repository-audit.cjs --history and scripts/build-store-zip.cjs. Verify release files against SHA256SUMS.txt. Document checks must reject old upload filenames and superseded validation claims.

## Publisher-only Dashboard actions

Enter verified contact details, complete account security, choose the applicable legal/trader declarations and distribution regions, and select a category available in the current Dashboard. Review the prepared data-category mapping against the form, add the public privacy URL, upload automatic-access-4.18.3.zip and graphics, and submit for review. Local hostname processing is still data handling; do not certify that no data is handled. Personal/legal account facts are not inferred or stored in the repository.

No Dashboard submission is performed by release scripts. Signing the optional native helper is recommended for publisher trust but is not represented as a universal extension-store requirement.

## Official references

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/webstore/publish
