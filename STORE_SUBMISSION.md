# Chrome Web Store application fields — 4.18.3

Prepared 12 November 2026 for automatic-access-4.18.3.zip. Copy these English field texts; use STORE_LISTING.md for localized listings and STORE_REVIEWER_GUIDE.md for testing. This is a prepared declaration based on shipped behavior, not a completed Dashboard submission. The owner must compare the actual form wording and certify the answers personally.

## Single purpose — English

Identify supported browser connection failures and selectively route explicitly listed destinations through a user-selected proxy while leaving other browsing on its direct connection.

## Tek amaç — Türkçe

Desteklenen tarayıcı bağlantı hatalarını belirleyip yalnız açıkça listelenen hedefleri kullanıcının seçtiği proxy üzerinden yönlendirirken diğer gezintiyi doğrudan bağlantıda tutmak.

## Permission justifications — copy into corresponding fields

### proxy

Apply a PAC script selecting the user's proxy only for exact listed hostnames, with ignored and private/local destinations kept direct. Clear this extension's proxy setting when disabled. This is the core selective-routing function, not general traffic collection.

### webRequest

Observe connection outcomes, request types and bounded timing needed to identify supported failures and recover the affected target. Match recovery to its tab, hostname and request type. Do not collect request bodies, cookies, form values or response contents for analytics.

### Host permissions — HTTP/HTTPS/WS/WSS

Destinations are chosen by the user and discovered on newly visited or embedded hosts; a fixed advance list cannot provide automatic detection. Host access observes connection outcomes, performs sanitized origin-root checks without credentials and retries affected frames with packaged code. Unlisted traffic remains DIRECT. No history or cookies permission is requested.

### activeTab

Show the active tab's target and provide user-triggered route, remove and ignore actions. The popup identifies that tab's relevant connection warning.

### scripting

Run packaged functions to locate and retry an affected iframe, including in open shadow roots, after selective routing. Inspect frame URL hostnames as needed for that retry, avoiding unnecessary whole-page reloads. No downloaded script is evaluated.

### storage

Store proxy preferences, route/ignore lists, route provenance/health and bounded diagnostics locally. Session storage holds temporary recovery and warning context. Debug defaults off, is capped at 150 events and can be cleared. No sync storage or developer cloud settings database is used.

### notifications

Explain proxy setup and bounded connection/learning progress, or report explicitly requested status results. Refused notification permission is handled; the popup remains an alternative when operating-system settings hide notifications.

## Remote code

Selection: No, the extension does not execute remotely hosted code.

Explanation: All executable extension logic is packaged. Network services return measurement/DNS data, not executable code. The optional native Windows helper is a separate user-installed program, disclosed in setup and excluded from the store ZIP. The extension does not download, evaluate or silently install it.

## Data-use selections

This conservative scope includes local handling and the optional helper, not just developer-server collection. Do not certify that no user data is handled.

| Dashboard category | Prepared selection | Scope |
| --- | --- | --- |
| Web history / browsing activity | Yes | Hostnames and connection timestamps for selective routing, local lists and optional diagnostics; no browser-history API or full URL history database. |
| User activity | Yes, network monitoring only | Connection outcomes/types and bounded timing/tab/frame metadata; no keystroke, pointer or scroll tracking. |
| Website content | Yes, limited resource information | Embedded-frame URL hostname inspection for retries; no page text, image, audio, video, message or form-content dataset. |
| Location, where the category includes IP addresses | Yes, connection-IP information only | Network connections and optional native LAN access controls handle IP information; recipients see source IPs. No GPS, physical-location profiling or developer IP database. |
| Personally identifiable information | No intentional identity collection | No product account or collection of names, contact details or identity documents. External support/donation websites open only on a click. |
| Health information | No | No health-information extraction, profiling or storage. |
| Financial/payment information | No | No payment form or payment-data access inside the extension; donation is external. |
| Authentication information | No intentional credential collection | No proxy login storage, cookie permission or credential extraction. Probes omit credentials. The proxy is still a transport and may inspect HTTP content; do not claim all relayed traffic lacks sensitive data. |
| Personal communications | No intentional communications collection | No message/email/chat-content dataset or inspection for profiling. HTTPS/WSS transport stays encrypted. |

### Data-use explanation — copy-ready

Destination hostnames, connection outcomes, request types and bounded timing/tab/frame metadata are processed only for selective routing and visible diagnostics. Limited iframe URL inspection supports affected-frame retries. IP information is handled for networking and optional native LAN access control, not location profiling. Settings and opt-in debug logs stay local; debug starts off. The selected proxy receives routed destinations and connection metadata. The optional helper uses disclosed encrypted-DNS recipients and system fallback. External global measurements require an explicit click. The developer operates no analytics, traffic relay, remote logging or browsing-history server. Data is not sold or used for advertising, credit decisions or unrelated profiling. Credentials, communications, identity, health and financial data are not extracted into datasets. A selected proxy remains a transport and can inspect HTTP content; HTTPS/WSS certificate validation stays enabled.

### Retention and deletion — copy-ready

Local settings/lists remain until the user removes them, clears extension data or uninstalls the extension. Debug holds at most 150 local events and can be cleared. Recovery/warnings use session storage. Temporary request-route metadata and positive DNS answers are bounded in process memory; no persistent DNS history is created. Removing the extension does not remove optional Windows services; the included helper uninstaller removes them and the sharing rule. An independently chosen proxy's privacy/retention terms apply.

## Limited Use certifications

Prepared position: Yes for the certifications, subject to the owner's final comparison with the upload and PRIVACY.md. Data is used/transferred only for the disclosed routing purpose; it is not sold for unrelated use, used for unrelated advertising/profiling, or used for creditworthiness/lending. Proxy, DNS and measurement recipients serve the disclosed feature, not developer analytics. Human access to voluntarily shared diagnostics is restricted as stated in the privacy policy. Preparing this file does not make the owner's attestations.

## URLs and other fields

- Privacy URL: https://github.com/EzerchE/selective-access/blob/main/PRIVACY.md
- Support URL: https://github.com/EzerchE/selective-access/issues
- Homepage: https://github.com/EzerchE/selective-access
- Test instructions: copy STORE_REVIEWER_GUIDE.md, excluding publisher notes.
- Review credentials: Not applicable. No account/subscription is required. Routing requires a working reviewer-controlled compatible proxy or the optional Windows helper. No public test proxy is operated.
- Category proposal: closest networking/tools utility category available in the current Dashboard; choose the actual available label.
- Pricing: Free; optional donations unlock no feature.
- Distribution proposal: Public; owner confirms supported regions.
- Default language: English; also provide the Turkish localized listing.
- Promotional video and marquee image: not supplied; optional.

## Owner-only account facts

The owner must enter verified contact details, complete required account security, and select the applicable legal/trader and distribution declarations in the publisher account. These facts are not fabricated, inferred or committed here. No Developer Dashboard submission has been made.

## Preparation references

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions

The category mapping is the project's conservative interpretation of shipped behavior. Official guidance requires accurate disclosures but does not constitute approval of this mapping.
