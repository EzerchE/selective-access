const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const messages = JSON.parse(fs.readFileSync(
  path.join(root, "_locales", "en", "messages.json"),
  "utf8"
));

// A small DOM stand-in covering exactly what popup.js touches. Element ids come
// from popup.html, so a control renamed there fails this file too.
class FakeClassList {
  constructor(element) { this.element = element; }
  names() { return new Set(String(this.element.className).split(" ").filter(Boolean)); }
  add(name) {
    const names = this.names();
    names.add(name);
    this.element.className = [...names].join(" ");
  }
  toggle(name, force) {
    if (force) {
      this.add(name);
      return;
    }
    const names = this.names();
    names.delete(name);
    this.element.className = [...names].join(" ");
  }
  contains(name) { return this.names().has(name); }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.title = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.type = "";
    this.style = {};
    this.classList = new FakeClassList(this);
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }
  dispatch(type) {
    for (const handler of this.listeners[type] || []) handler({ type });
  }
}

function buildDocument() {
  const byId = new Map();
  for (const match of popupHtml.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)) {
    byId.set(match[1], new FakeElement("div"));
  }
  return {
    documentElement: new FakeElement("html"),
    body: new FakeElement("body"),
    byId,
    querySelector(selector) {
      assert.match(selector, /^#/, `unexpected selector: ${selector}`);
      const element = byId.get(selector.slice(1));
      assert.ok(element, `popup.html has no element for ${selector}`);
      return element;
    },
    querySelectorAll() { return []; },
    createElement(tagName) { return new FakeElement(tagName); }
  };
}

function createContext(options = {}) {
  const search = options.search || "";
  const tabUrl = options.tabUrl === undefined ? "https://portal.example/page?q=1" : options.tabUrl;
  const document = buildDocument();
  const sent = [];
  let currentState = options.state;

  const chrome = {
    i18n: {
      getMessage(key, substitutions) {
        const template = messages[key] && messages[key].message;
        if (typeof template !== "string") return "";
        const values = substitutions === undefined
          ? []
          : Array.isArray(substitutions) ? substitutions : [substitutions];
        return template.replace(/\$(\d)/g, (match, index) =>
          String(values[Number(index) - 1] ?? match));
      },
      getUILanguage: () => "en-US"
    },
    runtime: {
      getManifest: () => ({ version: "4.11.9" }),
      async sendMessage(message) {
        sent.push(message);
        if (message.type === "saveSettings") {
          currentState = { ...currentState, ...message.patch, applyResult: { ok: true } };
          if (options.staleAfterSave) currentState = { ...currentState, schemaVersion: 7 };
          return { ok: true, state: currentState };
        }
        if (message.type === "getState") return { ok: true, state: currentState };
        if (message.type === "reapply") {
          return { ok: true, result: { ok: true }, state: currentState };
        }
        if (message.type === "clearDebugLog") return { ok: true };
        return { ok: false, error: "unsupported" };
      }
    },
    tabs: {
      async query() { return [{ id: 7, url: tabUrl }]; }
    }
  };

  const context = {
    document,
    chrome,
    console,
    URL,
    URLSearchParams,
    JSON,
    Promise,
    Array,
    Number,
    Boolean,
    String,
    Set,
    Date,
    setTimeout,
    clearTimeout,
    navigator: { language: "en-US", clipboard: { async writeText() {} } },
    location: { search },
    window: { close() {} }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "i18n.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "popup.js"), "utf8"), context);
  return { context, document, sent };
}

// Runs popup-preview.js on its own. It backs chrome.i18n when the popup is
// opened as a plain web page, so a silent failure there leaves every label
// rendering as a raw message key.
async function loadPreviewShim(responses, language = "tr-TR") {
  const document = buildDocument();
  const requested = [];
  const context = {
    document,
    console,
    URL,
    URLSearchParams,
    JSON,
    Promise,
    Array,
    Set,
    String,
    Number,
    Boolean,
    setTimeout,
    clearTimeout,
    navigator: { language },
    location: { search: "?preview=1" },
    async fetch(url) {
      const key = String(url);
      requested.push(key);
      const responder = responses[key];
      if (!responder) return { ok: false, status: 404 };
      if (responder instanceof Error) throw responder;
      return { ok: true, status: 200, async json() { return responder; } };
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "popup-preview.js"), "utf8"), context);
  await context.__i18nReady;
  return { context, document, requested };
}

function previewBanner(document) {
  return document.body.children.find((child) => child.id === "previewCatalogueError")
    || document.body.children.find((child) => child.attributes?.id === "previewCatalogueError")
    || document.body.children[0];
}

function baseState(overrides = {}) {
  return {
    schemaVersion: 8,
    enabled: true,
    learnedDomains: ["blocked.example", "portal.example"],
    ignoredDomains: ["ignored.example"],
    lastDetectedDomain: "blocked.example",
    proxyPort: 1080,
    lastProxyError: null,
    lastIssueType: null,
    lastIssueDomain: null,
    lastGlobalCheck: null,
    lastNotificationStatus: null,
    debugEnabled: false,
    debugLog: [],
    levelOfControl: "controlled_by_this_extension",
    ...overrides
  };
}

// Yields until the popup's asynchronous bootstrap has rendered.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// The patch is built inside the vm realm, so its arrays fail a strict deep
// comparison against host arrays. Copying it back gives plain host values.
function lastSavePatch(sent) {
  const saves = sent.filter((message) => message.type === "saveSettings");
  assert.ok(saves.length > 0, "expected a saveSettings message");
  const patch = saves[saves.length - 1].patch;
  return Object.fromEntries(Object.entries(patch)
    .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
}

(async () => {
  // popup.html and popup.js must agree on every control the popup drives.
  {
    const { document } = createContext({ state: baseState() });
    await settle();
    assert.equal(document.byId.has("proxyPort"), true);
  }

  // A matching schema renders both lists and leaves the controls usable.
  {
    const { document } = createContext({ state: baseState() });
    await settle();
    assert.equal(document.querySelector("#domainCount").textContent, "2");
    assert.equal(document.querySelector("#ignoredCount").textContent, "1");
    assert.equal(document.querySelector("#save").disabled, false);
    assert.equal(document.querySelector("#enabled").disabled, false);
    assert.equal(document.querySelector("#enabled").checked, true);
    assert.equal(document.querySelector("#currentDomain").textContent, "portal.example");
    assert.equal(document.querySelector("#statusCard").className, "status-card is-on");
    const rows = document.querySelector("#domainList").children;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].children[0].textContent, "blocked.example");
  }

  // A stale background schema locks every control and keeps it locked on save.
  {
    const { document } = createContext({ state: baseState({ schemaVersion: 7 }) });
    await settle();
    assert.equal(document.querySelector("#save").disabled, true);
    assert.equal(document.querySelector("#enabled").disabled, true);
    assert.equal(document.querySelector("#retry").disabled, true);
    assert.equal(document.querySelector("#siteAction").disabled, true);
    assert.equal(
      document.querySelector("#notice").textContent,
      messages.backgroundOutdated.message
    );

    // Saving is refused outright while the schema is known to be stale.
    document.querySelector("#save").dispatch("click");
    await settle();
    assert.equal(document.querySelector("#save").disabled, true);
    assert.equal(
      document.querySelector("#notice").textContent,
      messages.refreshBeforeContinue.message
    );
  }

  // Regression: a save that starts healthy but reads back a stale schema used to
  // leave the save button enabled, because the handler re-enabled it in finally.
  {
    const { document } = createContext({ state: baseState(), staleAfterSave: true });
    await settle();
    assert.equal(document.querySelector("#save").disabled, false);
    document.querySelector("#save").dispatch("click");
    await settle();
    assert.equal(document.querySelector("#save").disabled, true);
    assert.equal(document.querySelector("#enabled").disabled, true);
  }

  // The gateway port is fixed by the local service: shown, never sent back.
  {
    const { document, sent } = createContext({ state: baseState() });
    await settle();
    assert.equal(document.querySelector("#proxyPort").value, "1080");
    document.querySelector("#save").dispatch("click");
    await settle();
    assert.equal("proxyPort" in lastSavePatch(sent), false);
  }

  // The open tab is already routed, so the site action offers removal.
  {
    const { document, sent } = createContext({ state: baseState() });
    await settle();
    const siteAction = document.querySelector("#siteAction");
    assert.equal(siteAction.dataset.mode, "remove");
    assert.equal(siteAction.textContent, messages.removeFromList.message);
    siteAction.dispatch("click");
    await settle();
    assert.deepEqual(lastSavePatch(sent).learnedDomains, ["blocked.example"]);
  }

  // An unrouted tab offers to route it.
  {
    const { document, sent } = createContext({
      state: baseState({ learnedDomains: ["blocked.example"] })
    });
    await settle();
    assert.equal(document.querySelector("#siteAction").dataset.mode, "add");
    document.querySelector("#siteAction").dispatch("click");
    await settle();
    assert.deepEqual(
      lastSavePatch(sent).learnedDomains,
      ["blocked.example", "portal.example"]
    );
  }

  // An ignored tab offers to restore it instead.
  {
    const { document } = createContext({
      state: baseState({ learnedDomains: [], ignoredDomains: ["portal.example"] })
    });
    await settle();
    assert.equal(document.querySelector("#siteAction").dataset.mode, "unignore");
    assert.equal(document.querySelector("#siteAction").textContent, messages.stopIgnoring.message);
  }

  // Ignoring a learned row moves only that row between the two lists.
  {
    const { document, sent } = createContext({ state: baseState() });
    await settle();
    const row = document.querySelector("#domainList").children[0];
    const [name, actions] = row.children;
    assert.equal(name.textContent, "blocked.example");
    actions.children[0].dispatch("click");
    await settle();
    const patch = lastSavePatch(sent);
    assert.deepEqual(patch.learnedDomains, ["portal.example"]);
    assert.deepEqual(patch.ignoredDomains, ["blocked.example", "ignored.example"]);
  }

  // A non-web tab leaves the site action unavailable rather than guessing a host.
  {
    const { document } = createContext({ state: baseState(), tabUrl: "chrome://extensions/" });
    await settle();
    assert.equal(document.querySelector("#siteAction").disabled, true);
    assert.equal(
      document.querySelector("#currentDomain").textContent,
      messages.pageUnavailable.message
    );
  }

  // A gateway error surfaces only when the open tab actually uses the gateway.
  {
    const { document } = createContext({
      state: baseState({ lastProxyError: "net::ERR_PROXY_CONNECTION_FAILED" })
    });
    await settle();
    assert.equal(document.querySelector("#statusCard").className, "status-card is-error");
    assert.equal(
      document.querySelector("#statusTitle").textContent,
      messages.gatewayUnavailable.message
    );
  }
  {
    const { document } = createContext({
      state: baseState({
        learnedDomains: ["blocked.example"],
        lastProxyError: "net::ERR_PROXY_CONNECTION_FAILED"
      })
    });
    await settle();
    assert.equal(document.querySelector("#statusCard").className, "status-card is-on");
  }

  // The diagnostic card stays hidden unless the issue belongs to the open tab.
  {
    const { document } = createContext({
      state: baseState({ lastIssueType: "route_failed", lastIssueDomain: "other.example" })
    });
    await settle();
    assert.equal(document.querySelector("#diagnosticCard").hidden, true);
  }
  {
    const { document } = createContext({
      state: baseState({ lastIssueType: "gateway_recovering", lastIssueDomain: "portal.example" })
    });
    await settle();
    assert.equal(document.querySelector("#diagnosticCard").hidden, false);
    assert.equal(document.querySelector("#checkStatus").hidden, true);
    assert.equal(
      document.querySelector("#diagnosticTitle").textContent,
      messages.gatewayRecoveringTitle.message
    );
  }

  // The debug panel follows the stored flag and renders stored entries.
  {
    const { document } = createContext({
      state: baseState({
        debugEnabled: true,
        debugLog: [{ at: "2026-01-01T00:00:00.000Z", event: "learned" }]
      })
    });
    await settle();
    assert.equal(document.querySelector("#debugControls").hidden, false);
    assert.equal(document.querySelector("#debugEnabled").checked, true);
    assert.match(document.querySelector("#debugLog").textContent, /"event":"learned"/);
  }

  // Preview mode renders a healthy popup instead of the stale-schema error.
  {
    const { document } = createContext({ search: "?preview=1", state: baseState() });
    await settle();
    assert.equal(document.querySelector("#statusCard").className, "status-card is-on");
    assert.equal(document.querySelector("#save").disabled, false);
    assert.equal(document.querySelector("#currentDomain").textContent, "portal.example");
  }

  // The legacy preview deliberately exercises the stale-schema path.
  {
    const { document } = createContext({ search: "?preview=legacy", state: baseState() });
    await settle();
    assert.equal(document.querySelector("#statusCard").className, "status-card is-error");
    assert.equal(
      document.querySelector("#statusTitle").textContent,
      messages.reloadRequired.message
    );
  }

  // The preview catalogue loader resolves real messages, not keys.
  {
    const turkish = JSON.parse(fs.readFileSync(
      path.join(root, "_locales", "tr", "messages.json"),
      "utf8"
    ));
    const { context, requested } = await loadPreviewShim({
      "_locales/tr/messages.json": turkish
    });
    assert.deepEqual(requested, ["_locales/tr/messages.json"]);
    assert.equal(context.chrome.i18n.getUILanguage(), "tr");
    assert.equal(context.chrome.i18n.getMessage("routeNow"), turkish.routeNow.message);
    assert.equal(
      context.chrome.i18n.getMessage("learnedSummary", ["3", "portal.example"]),
      turkish.learnedSummary.message.replace("$1", "3").replace("$2", "portal.example")
    );
  }

  // A missing preferred locale falls back to English.
  {
    const { context, requested } = await loadPreviewShim({
      "_locales/en/messages.json": messages
    });
    assert.deepEqual(requested, ["_locales/tr/messages.json", "_locales/en/messages.json"]);
    assert.equal(context.chrome.i18n.getUILanguage(), "en");
    assert.equal(context.chrome.i18n.getMessage("routeNow"), messages.routeNow.message);
  }

  // An English UI language asks for English only.
  {
    const { requested } = await loadPreviewShim({ "_locales/en/messages.json": messages }, "en-US");
    assert.deepEqual(requested, ["_locales/en/messages.json"]);
  }

  // When no catalogue loads at all the preview says so, rather than quietly
  // rendering raw message keys.
  {
    const { context, document } = await loadPreviewShim({});
    assert.equal(context.chrome.i18n.getMessage("routeNow"), "");
    const banner = previewBanner(document);
    assert.ok(banner, "the preview must report a catalogue it could not load");
    assert.match(banner.textContent, /could not load the message catalogue/i);
    assert.match(banner.textContent, /HTTP 404/);
  }

  // A network failure is reported the same way, with its own detail.
  {
    const { document } = await loadPreviewShim({
      "_locales/tr/messages.json": new Error("Failed to fetch"),
      "_locales/en/messages.json": new Error("Failed to fetch")
    });
    const banner = previewBanner(document);
    assert.ok(banner);
    assert.match(banner.textContent, /Failed to fetch/);
  }

  console.log("popup tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
