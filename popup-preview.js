// Normal web sayfasında açılan ?preview= görünümü için geliştirme desteği.
// Chrome eklenti ortamında gerçek API bulunduğundan bu dosya hiçbir şeyi değiştirmez.
if (!globalThis.chrome?.runtime && new URLSearchParams(location.search).has("preview")) {
  let previewState = {
    schemaVersion: 5,
    enabled: true,
    learnedDomains: ["media-cdn.example", "blocked-service.example"],
    ignoredDomains: ["ignored.example"],
    lastDetectedDomain: "blocked-service.example",
    proxyPort: 1080,
    lastProxyError: null,
    lastIssueType: null,
    lastIssueDomain: null,
    lastGlobalCheck: null,
    levelOfControl: "controlled_by_this_extension"
  };

  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: "4.3.2" }),
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
        return { ok: false, error: "Önizlemede desteklenmeyen istek." };
      }
    },
    tabs: {
      async query() {
        return [{ id: 1, url: "https://portal.example/" }];
      }
    }
  };
}
