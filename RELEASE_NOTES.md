# Automatic Access 4.17.1

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
