// Development support for the ?preview= view opened as a normal web page.
// A real chrome API exists inside the extension, so this file changes nothing
// there and must stay inert.
if (!globalThis.chrome?.runtime && new URLSearchParams(location.search).has("preview")) {
  // The popup reads every label through chrome.i18n, so the preview needs a
  // real catalogue rather than a stub that returns keys. It is fetched before
  // anything renders and exposed through globalThis.__i18nReady.
  let messages = {};
  let uiLanguage = "en";

  // Not localized on purpose: localization is exactly what failed here.
  function reportCatalogueFailure(detail) {
    const banner = document.createElement("p");
    banner.id = "previewCatalogueError";
    banner.textContent =
      "Preview could not load the message catalogue, so every label below is a raw " +
      "message key. Serve the extension folder over HTTP rather than opening the " +
      "file directly. (" + detail + ")";
    banner.style.cssText =
      "margin:0;padding:10px 12px;background:#b91c1c;color:#fff;" +
      "font:12px/1.5 system-ui,sans-serif";
    document.body.prepend(banner);
  }

  globalThis.__i18nReady = (async () => {
    const preferred = String(navigator.language || "en").toLowerCase().startsWith("tr")
      ? "tr"
      : "en";
    let lastDetail = "no locale was tried";
    for (const locale of [...new Set([preferred, "en"])]) {
      try {
        const response = await fetch(`_locales/${locale}/messages.json`);
        if (!response.ok) {
          lastDetail = `${locale}: HTTP ${response.status}`;
          continue;
        }
        messages = await response.json();
        uiLanguage = locale;
        return;
      } catch (error) {
        lastDetail = `${locale}: ${error.message}`;
      }
    }
    reportCatalogueFailure(lastDetail);
  })();

  let previewState = {
    schemaVersion: 8,
    enabled: true,
    learnedDomains: ["media-cdn.example", "blocked-service.example"],
    ignoredDomains: ["ignored.example"],
    lastDetectedDomain: "blocked-service.example",
    proxyPort: 1080,
    lastProxyError: null,
    lastIssueType: null,
    lastIssueDomain: null,
    lastGlobalCheck: null,
    debugEnabled: false,
    debugLog: [],
    levelOfControl: "controlled_by_this_extension"
  };

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => uiLanguage,
      getMessage(key, substitutions) {
        const template = messages[key]?.message;
        if (typeof template !== "string") return "";
        const values = substitutions === undefined
          ? []
          : Array.isArray(substitutions) ? substitutions : [substitutions];
        return template.replace(/\$(\d)/g, (match, index) =>
          String(values[Number(index) - 1] ?? match));
      }
    },
    runtime: {
      getManifest: () => ({ version: "0.0.0-preview" }),
      async sendMessage(message) {
        if (message?.type === "saveSettings") {
          previewState = { ...previewState, ...(message.patch || {}) };
          return { ok: true, state: { ...previewState, applyResult: { ok: true } } };
        }
        if (message?.type === "getState") return { ok: true, state: previewState };
        if (message?.type === "reapply") {
          return { ok: true, result: { ok: true }, state: previewState };
        }
        if (message?.type === "testNotification") {
          return { ok: true, result: { ok: true, id: "preview-test" } };
        }
        if (message?.type === "clearDebugLog") {
          previewState = { ...previewState, debugLog: [] };
          return { ok: true };
        }
        return { ok: false, error: t("previewUnsupported") };
      }
    },
    tabs: {
      async query() {
        return [{ id: 1, url: "https://portal.example/" }];
      }
    }
  };
}
