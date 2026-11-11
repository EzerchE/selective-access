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
