const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const listeners = {};
const storage = {};
const reloads = [];
const badgeTexts = [];
const badgeColors = [];
const actionTitles = [];
const notifications = [];
const scriptExecutions = [];
const scriptExecutionResults = [0, 1];
let proxyConfig = null;
let clearCount = 0;
let measurementShouldBeDown = false;
let notificationPermission = "granted";
let notificationCreateError = null;
const directlyReachableHosts = new Set();
const directProbeUrls = [];
const delayedProbeHosts = new Set();
const tabUrls = new Map();
let activeDirectProbes = 0;
let maxActiveDirectProbes = 0;
const testMessages = JSON.parse(fs.readFileSync(
  path.join(__dirname, "..", "_locales", "tr", "messages.json"),
  "utf8"
));

function getMessage(key, substitutions = []) {
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return (testMessages[key]?.message || "").replace(/\$(\d+)/g, (_match, index) =>
    String(values[Number(index) - 1] ?? ""));
}

const chrome = {
  i18n: {
    getMessage,
    getUILanguage() { return "tr-TR"; }
  },
  storage: {
    local: {
      async get(keysOrDefaults) {
        if (keysOrDefaults === null) return { ...storage };
        if (Array.isArray(keysOrDefaults)) {
          return Object.fromEntries(keysOrDefaults
            .filter((key) => Object.hasOwn(storage, key))
            .map((key) => [key, storage[key]]));
        }
        return { ...keysOrDefaults, ...storage };
      },
      async set(values) {
        Object.assign(storage, values);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
      }
    }
  },
  action: {
    async setBadgeText(details) { badgeTexts.push(details); },
    async setBadgeBackgroundColor(details) { badgeColors.push(details); },
    async setTitle(details) { actionTitles.push(details); }
  },
  notifications: {
    async getPermissionLevel() { return notificationPermission; },
    async clear() { return true; },
    async create(id, options) {
      if (notificationCreateError) throw new Error(notificationCreateError);
      notifications.push({ id, options });
      return id;
    }
  },
  proxy: {
    settings: {
      async get() {
        return {
          levelOfControl: "controlled_by_this_extension",
          value: proxyConfig || { mode: "system" }
        };
      },
      async set({ value }) {
        proxyConfig = value;
      },
      async clear() {
        proxyConfig = null;
        clearCount += 1;
      }
    },
    onProxyError: {
      addListener(listener) {
        listeners.proxyError = listener;
      }
    }
  },
  tabs: {
    async get(tabId) {
      return { id: tabId, url: tabUrls.get(tabId) || "chrome://newtab/" };
    },
    async reload(tabId, options) {
      reloads.push({ tabId, options });
    },
    onActivated: {
      addListener(listener) {
        listeners.tabActivated = listener;
      }
    },
    onUpdated: {
      addListener(listener) {
        listeners.tabUpdated = listener;
      }
    },
    onRemoved: {
      addListener(listener) {
        listeners.tabRemoved = listener;
      }
    }
  },
  scripting: {
    async executeScript(details) {
      scriptExecutions.push(details);
      return [{ result: scriptExecutionResults.length ? scriptExecutionResults.shift() : 1 }];
    }
  },
  webRequest: {
    onErrorOccurred: {
      addListener(listener, filter) {
        listeners.requestError = listener;
        listeners.requestFilter = filter;
      }
    },
    onCompleted: {
      addListener(listener, filter) {
        listeners.requestCompleted = listener;
        listeners.completedFilter = filter;
      }
    },
    onBeforeRequest: {
      addListener(listener, filter) {
        listeners.beforeRequest = listener;
        listeners.beforeRequestFilter = filter;
      }
    }
  },
  runtime: {
    onInstalled: {
      addListener(listener) {
        listeners.installed = listener;
      }
    },
    onStartup: {
      addListener(listener) {
        listeners.startup = listener;
      }
    },
    onMessage: {
      addListener(listener) {
        listeners.message = listener;
      }
    },
    getManifest() {
      return { version: "3.1.0" };
    }
  }
};

const fetch = async (url, options = {}) => {
  if (options.method === "GET" && options.headers?.Range === "bytes=0-0") {
    directProbeUrls.push(String(url));
    const host = new URL(url).hostname;
    activeDirectProbes += 1;
    maxActiveDirectProbes = Math.max(maxActiveDirectProbes, activeDirectProbes);
    try {
      if (delayedProbeHosts.has(host)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (directlyReachableHosts.has(host)) return { ok: true, status: 204 };
      throw new Error("direct probe failed");
    } finally {
      activeDirectProbes -= 1;
    }
  }
  if (options.method === "POST") {
    const request = JSON.parse(options.body);
    assert.equal(request.type, "http");
    assert.deepEqual(request.locations.map((location) => location.continent), ["EU", "NA", "AS"]);
    return { ok: true, status: 202, async json() { return { id: "test-measurement" }; } };
  }
  assert.match(String(url), /test-measurement$/);
  return {
    ok: true,
    status: 200,
    async json() {
      if (measurementShouldBeDown) {
        return {
          status: "finished",
          results: [
            { probe: { country: "DE", city: "Berlin" }, result: { status: "failed", failureSource: "target" } },
            { probe: { country: "US", city: "Dallas" }, result: { status: "failed", failureSource: "target" } },
            { probe: { country: "JP", city: "Tokyo" }, result: { status: "failed", failureSource: "target" } }
          ]
        };
      }
      return {
        status: "finished",
        results: [
          { probe: { country: "DE", city: "Berlin" }, result: { status: "finished", statusCode: 200 } },
          { probe: { country: "US", city: "Dallas" }, result: { status: "finished", statusCode: 403 } },
          { probe: { country: "JP", city: "Tokyo" }, result: { status: "failed", failureSource: "target" } }
        ]
      };
    }
  };
};

const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
vm.runInNewContext(source, {
  chrome, console, URL, Date, Map, Set, Promise, JSON, fetch,
  AbortController, setTimeout, clearTimeout
});

function send(message) {
  return new Promise((resolve) => {
    const keepChannelOpen = listeners.message(message, {}, resolve);
    assert.equal(keepChannelOpen, true);
  });
}

function evaluatePac(data) {
  const pac = {
    isPlainHostName: (host) => !host.includes("."),
    shExpMatch: (host, pattern) => {
      const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      return host.startsWith(prefix);
    },
    dnsDomainIs: (host, suffix) => host.endsWith(suffix)
  };
  vm.runInNewContext(data, pac);
  return pac.FindProxyForURL;
}

function assertBadge(details, tabId, text) {
  assert.equal(details?.tabId, tabId);
  assert.equal(details?.text, text);
}

function lastForTab(items, tabId) {
  return [...items].reverse().find((details) => details?.tabId === tabId);
}

async function waitForDebugFlush() {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

(async () => {
  await listeners.installed();
  assert.equal(storage.enabled, false);
  assert.equal(storage.schemaVersion, 8);
  assert.equal(storage.debugEnabled, false);
  assert.deepEqual([...storage.learnedDomains], []);
  assert.deepEqual([...storage.ignoredDomains], []);
  assert.equal(Object.hasOwn(storage, "dnsFallbackDomains"), false);
  assert.deepEqual(
    [...listeners.requestFilter.urls],
    ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  );

  const enabled = await send({
    type: "saveSettings",
    patch: {
      enabled: true,
      debugEnabled: true,
      proxyPort: 1080,
      learnedDomains: ["https://Example.com/path", "example.com"]
    }
  });

  assert.equal(enabled.ok, true);
  assert.deepEqual([...enabled.state.learnedDomains], ["example.com"]);
  assert.equal(proxyConfig.mode, "pac_script");
  const findProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(findProxy("https://cdn.example.com/video", "cdn.example.com"), "DIRECT");
  assert.equal(findProxy("https://portal.example/article", "portal.example"), "DIRECT");
  assert.equal(findProxy("chrome-extension://abc/popup.html", "abc"), "DIRECT");
  const private172Host = [172, 20, 1, 2].join(".");
  assert.equal(findProxy(`http://${private172Host}/`, private172Host), "DIRECT");
  assert.equal(findProxy("http://169.254.1.2/", "169.254.1.2"), "DIRECT");
  assert.equal(findProxy("http://[fd00::1]/", "[fd00::1]"), "DIRECT");
  assert.equal(findProxy("http://printer.local/", "printer.local"), "DIRECT");

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  await listeners.requestError({
    tabId: 42,
    frameId: 9,
    parentFrameId: 0,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://media-cdn.example/embed/video"
  });
  await new Promise((resolve) => setTimeout(resolve, 2_100));

  assert.deepEqual([...storage.learnedDomains], ["media-cdn.example"]);
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].id, /^learned:\d+$/);
  assert.match(notifications[0].options.message, /media-cdn\.example/);
  assert.equal(notifications[0].options.priority, 1);
  assert.equal(notifications[0].options.requireInteraction, undefined);
  assert.equal(storage.lastNotificationStatus, "created");
  assert.equal(reloads.length, 0);
  assert.equal(scriptExecutions.length, 2);
  assert.equal(scriptExecutions[0].args[0], "media-cdn.example");
  assert.deepEqual([...scriptExecutions[0].target.frameIds], [0]);
  assert.deepEqual([...scriptExecutions[1].target.frameIds], [9]);
  assert.equal(scriptExecutions[1].args[0], "https://media-cdn.example/embed/video");

  const ignored = await send({
    type: "saveSettings",
    patch: { learnedDomains: [], ignoredDomains: ["media-cdn.example"] }
  });
  assert.deepEqual([...ignored.state.learnedDomains], []);
  assert.deepEqual([...ignored.state.ignoredDomains], ["media-cdn.example"]);
  await listeners.requestError({
    tabId: 42,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://media-cdn.example/embed/again"
  });
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  assert.deepEqual([...storage.learnedDomains], []);
  assert.equal(notifications.length, 1);

  await send({ type: "saveSettings", patch: { ignoredDomains: [] } });
  await listeners.requestError({
    tabId: 42,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://media-cdn.example/embed/restored"
  });
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  assert.deepEqual([...storage.learnedDomains], ["media-cdn.example"]);
  assert.equal(notifications.length, 2);
  assert.match(notifications[1].id, /^learned:\d+$/);
  assert.notEqual(notifications[1].id, notifications[0].id);

  directlyReachableHosts.add("normal-available.example");
  await listeners.requestError({
    tabId: 54,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://normal-available.example/embed/content?token=test-value#fragment"
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.learnedDomains.includes("normal-available.example"), false);
  assert.equal(notifications.length, 2);
  const sanitizedProbe = new URL(directProbeUrls.at(-1));
  assert.equal(sanitizedProbe.protocol, "https:");
  assert.equal(sanitizedProbe.hostname, "normal-available.example");
  assert.equal(sanitizedProbe.pathname, "/");
  assert.equal(sanitizedProbe.search, "");
  assert.equal(sanitizedProbe.hash, "");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await listeners.requestError({
      tabId: 55,
      type: "main_frame",
      error: "net::ERR_CONNECTION_RESET",
      url: "https://normal-available.example/"
    });
    if (attempt === 0) {
      assertBadge(lastForTab(badgeTexts, 55), 55, "?");
      assert.equal(lastForTab(badgeColors, 55)?.color, "#d97706");
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.learnedDomains.includes("normal-available.example"), true);
  assert.equal(storage.learnedDomains.includes("www.normal-available.example"), true);
  assert.equal(storage.lastIssueType, "route_learned");
  assertBadge(lastForTab(badgeTexts, 55), 55, "+");
  assert.equal(notifications.length, 2);
  await listeners.requestCompleted({
    tabId: 55,
    type: "main_frame",
    url: "https://normal-available.example/",
    statusCode: 200,
    fromCache: false
  });
  assertBadge(lastForTab(badgeTexts, 55), 55, "↗");
  assert.equal(lastForTab(badgeColors, 55)?.color, "#2563eb");
  assert.match(lastForTab(actionTitles, 55)?.title, /yerel geçid/i);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await listeners.requestError({
      tabId: 56,
      type: "main_frame",
      error: "net::ERR_TIMED_OUT",
      url: "https://slow-but-valid.example/"
    });
  }
  assert.equal(storage.learnedDomains.includes("slow-but-valid.example"), false);
  assert.equal(storage.lastIssueType, "transient_unverified");
  await listeners.requestCompleted({
    tabId: 56,
    type: "main_frame",
    url: "https://slow-but-valid.example/"
  });
  assert.equal(storage.lastIssueType, null);

  const learnedBeforeResolutionError = [...storage.learnedDomains];
  await listeners.requestError({
    tabId: 7,
    type: "main_frame",
    error: "net::ERR_NAME_NOT_RESOLVED",
    url: "https://resolution-error.example/"
  });
  assert.equal(storage.learnedDomains.includes("resolution-error.example"), true);
  assert.equal(storage.learnedDomains.includes("www.resolution-error.example"), true);
  assert.equal(storage.lastIssueType, "route_learned");
  assert.equal(storage.lastIssueDomain, "resolution-error.example");
  assertBadge(lastForTab(badgeTexts, 7), 7, "+");
  assert.equal(lastForTab(badgeColors, 7)?.color, "#0891b2");
  assert.match(lastForTab(actionTitles, 7)?.title, /öğrenildi/i);

  const globalStatus = await send({
    type: "checkGlobalStatus",
    domain: "resolution-error.example",
    tabId: 7
  });
  assert.equal(globalStatus.ok, true);
  assert.equal(globalStatus.result.status, "online");
  assert.equal(globalStatus.result.reachable, 2);
  assert.equal(storage.learnedDomains.includes("resolution-error.example"), true);
  assert.equal(storage.lastIssueType, null);
  await new Promise((resolve) => setTimeout(resolve, 2_100));
  assert.equal(notifications.length, 3);
  assert.match(notifications[2].id, /^learned:\d+$/);
  assert.equal(reloads.length, 1);
  assert.equal(storage.debugLog.some((entry) =>
    entry.event === "reload-cancelled" && entry.tabId === 55 && entry.reason === "main-completed"), true);
  assert.equal(listeners.completedFilter.types, undefined);
  assert.deepEqual([...listeners.beforeRequestFilter.types], ["main_frame"]);

  measurementShouldBeDown = true;
  const lastDetectedBeforeGlobalDown = storage.lastDetectedDomain;
  const lastDetectedAtBeforeGlobalDown = storage.lastDetectedAt;
  await send({
    type: "saveSettings",
    patch: {
      learnedDomains: [
        ...learnedBeforeResolutionError,
        "globally-down.example",
        "www.globally-down.example"
      ]
    }
  });
  storage.lastDetectedDomain = "globally-down.example";
  storage.lastDetectedAt = new Date().toISOString();
  const downStatus = await send({
    type: "checkGlobalStatus",
    domain: "globally-down.example",
    tabId: 33
  });
  assert.equal(downStatus.result.status, "likely_down");
  assertBadge(badgeTexts.at(-1), 33, "!");
  assert.equal(notifications.length, 4);
  assert.equal(notifications[3].id, "outage:globally-down.example");
  assert.equal(notifications[3].options.title, "Genel kesinti olası");
  assert.match(notifications[3].options.message, /birden fazla dış noktadan/);
  assert.deepEqual([...storage.learnedDomains], learnedBeforeResolutionError);
  assert.equal(storage.lastDetectedDomain, null);
  assert.equal(storage.lastDetectedAt, null);
  assert.equal(storage.lastGlobalCheck.domain, "globally-down.example");
  assert.equal(storage.lastGlobalCheck.status, "likely_down");
  storage.lastDetectedDomain = lastDetectedBeforeGlobalDown;
  storage.lastDetectedAt = lastDetectedAtBeforeGlobalDown;

  tabUrls.set(44, "https://direct.example/");
  await listeners.requestCompleted({
    tabId: 44,
    type: "main_frame",
    statusCode: 200,
    url: "https://direct.example/"
  });
  listeners.tabActivated({ tabId: 44 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 44, "");
  assert.equal(badgeColors.at(-1)?.color, "#15803d");
  assert.match(actionTitles.at(-1)?.title, /doğrudan/i);
  await listeners.requestCompleted({
    tabId: 44,
    type: "image",
    statusCode: 200,
    url: "https://media-cdn.example/asset"
  });
  assertBadge(lastForTab(badgeTexts, 44), 44, "↗");
  assert.equal(lastForTab(badgeColors, 44)?.color, "#2563eb");
  assert.match(lastForTab(actionTitles, 44)?.title, /yerel geçid/i);
  listeners.tabActivated({ tabId: 45 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 45, "");
  assert.equal(badgeColors.at(-1)?.color, "#64748b");
  assert.match(actionTitles.at(-1)?.title, /kullanılamaz/i);
  listeners.tabActivated({ tabId: 33 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 33, "!");

  listeners.beforeRequest({ tabId: 33, type: "main_frame", url: "https://other.example/" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 33, "");
  assert.match(actionTitles.at(-1)?.title, /bekleniyor/i);
  tabUrls.set(33, "chrome://settings/");
  listeners.tabUpdated(33, { url: "chrome://settings/" }, { url: "chrome://settings/" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(lastForTab(badgeTexts, 33), 33, "");

  await listeners.requestCompleted({
    tabId: 55,
    type: "main_frame",
    url: "https://normal-available.example/"
  });
  assert.equal(storage.lastIssueType, null);
  assert.equal(storage.lastGlobalCheck.status, "likely_down");
  assert.equal(storage.lastDetectedDomain, "resolution-error.example");
  assert.equal(reloads.length, 1);
  const learnedProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(learnedProxy("https://media-cdn.example/embed/video", "media-cdn.example"), "SOCKS5 127.0.0.1:1080");
  assert.equal(learnedProxy("https://portal.example/", "portal.example"), "DIRECT");

  await listeners.requestError({
    tabId: 88,
    type: "main_frame",
    error: "net::ERR_NAME_NOT_RESOLVED",
    url: "https://another-resolution-error.example/"
  });
  assert.equal(storage.learnedDomains.includes("another-resolution-error.example"), true);
  await listeners.requestCompleted({
    tabId: 88,
    type: "main_frame",
    url: "https://another-resolution-error.example/"
  });
  await send({ type: "saveSettings", patch: { learnedDomains: learnedBeforeResolutionError } });

  await new Promise((resolve) => setTimeout(resolve, 0));
  const requestErrorCountBeforeIgnored = storage.debugLog.filter((entry) =>
    entry.event === "request-error").length;
  await listeners.requestError({
    tabId: 42,
    type: "image",
    error: "net::ERR_BLOCKED_BY_CLIENT",
    url: "https://ads.example.net/banner.png"
  });
  await listeners.requestError({
    tabId: 42,
    type: "xmlhttprequest",
    error: "net::ERR_ABORTED",
    url: "https://cancelled.example.net/request"
  });
  await listeners.requestError({
    tabId: 42,
    type: "image",
    error: "net::ERR_BLOCKED_BY_ORB",
    url: "https://browser-filter.example.net/image"
  });
  await listeners.requestError({
    tabId: 42,
    type: "font",
    error: "net::ERR_CACHE_MISS",
    url: "https://cache-event.example.net/font"
  });
  await listeners.requestError({
    tabId: -1,
    type: "xmlhttprequest",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://probe.example.net/check"
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual([...storage.learnedDomains], learnedBeforeResolutionError);
  assert.equal(storage.debugLog.filter((entry) =>
    entry.event === "request-error").length, requestErrorCountBeforeIgnored);

  await listeners.requestError({
    tabId: 42,
    type: "script",
    error: "net::ERR_BLOCKED_BY_CLIENT",
    url: "https://app-shell.example/assets/app.js",
    initiator: "https://app-shell.example/"
  });
  assert.equal(storage.lastIssueType, "client_filter_blocked");
  assert.equal(storage.lastIssueDomain, "app-shell.example");
  assert.deepEqual([...storage.learnedDomains], learnedBeforeResolutionError);
  await waitForDebugFlush();
  assert.equal(storage.debugLog.some((entry) =>
    entry.event === "client-filter-blocked-critical" &&
    entry.tabId === 42 && entry.requestType === "script"), true);
  assertBadge(badgeTexts.at(-1), 42, "?");

  await listeners.requestCompleted({
    tabId: 42,
    type: "main_frame",
    statusCode: 200,
    fromCache: true,
    url: "https://app-shell.example/"
  });
  assert.equal(storage.lastIssueType, "client_filter_blocked");
  assertBadge(badgeTexts.at(-1), 42, "?");

  const reloadCountBeforeFilterRecovery = reloads.length;
  const filterRecovery = await send({ type: "reloadTabBypassCache", tabId: 42 });
  assert.equal(filterRecovery.ok, true);
  assert.equal(storage.lastIssueType, null);
  assert.equal(reloads.length, reloadCountBeforeFilterRecovery + 1);
  assert.equal(reloads.at(-1).tabId, 42);
  assert.equal(reloads.at(-1).options.bypassCache, true);

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  await listeners.requestError({
    tabId: 42,
    type: "websocket",
    error: "net::ERR_CONNECTION_RESET",
    url: "wss://realtime.example/socket",
    initiator: "https://portal.example/"
  });
  assert.deepEqual([...storage.learnedDomains], ["realtime.example"]);
  await waitForDebugFlush();
  assert.equal(storage.debugLog.some((entry) =>
    entry.event === "learned" &&
    entry.host === "realtime.example" &&
    entry.requestType === "websocket"), true);

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  directlyReachableHosts.add("socket-api.example");
  await listeners.requestError({
    tabId: 42,
    type: "websocket",
    error: "net::ERR_FAILED",
    url: "wss://socket-api.example/connect",
    initiator: "https://portal.example/"
  });
  assert.deepEqual([...storage.learnedDomains], []);
  await listeners.requestError({
    tabId: 42,
    type: "websocket",
    error: "net::ERR_FAILED",
    url: "wss://socket-api.example/connect",
    initiator: "https://portal.example/"
  });
  assert.deepEqual([...storage.learnedDomains], ["socket-api.example"]);
  directlyReachableHosts.delete("socket-api.example");

  await listeners.requestError({
    tabId: 42,
    type: "xmlhttprequest",
    error: "net::ERR_NAME_NOT_RESOLVED",
    url: "https://tracker.resolution-error.example/pixel"
  });
  assert.deepEqual([...storage.learnedDomains], ["socket-api.example"]);

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  const reloadCountBeforeApp = reloads.length;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await listeners.requestError({
      tabId: 77,
      type: "main_frame",
      error: "net::ERR_CONNECTION_RESET",
      url: "https://app-suite.example/"
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 1_600));
  assert.deepEqual([...storage.learnedDomains], ["app-suite.example", "www.app-suite.example"]);
  assert.equal(reloads.length, reloadCountBeforeApp + 1);

  await listeners.requestError({
    tabId: 77,
    frameId: 0,
    type: "xmlhttprequest",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://api.app-suite.example/v1/config",
    initiator: "https://www.app-suite.example"
  });
  await listeners.requestError({
    tabId: 77,
    frameId: 0,
    type: "image",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://assets.app-suite.example/bootstrap.png",
    initiator: "https://app-suite.example/"
  });
  await listeners.requestCompleted({
    tabId: 77,
    type: "main_frame",
    url: "https://app-suite.example/",
    statusCode: 200,
    fromCache: false
  });
  await new Promise((resolve) => setTimeout(resolve, 1_600));
  assert.deepEqual(
    [...storage.learnedDomains],
    [
      "api.app-suite.example",
      "app-suite.example",
      "assets.app-suite.example",
      "www.app-suite.example"
    ]
  );
  assert.equal(reloads.length, reloadCountBeforeApp + 2);
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(notifications.length, 5);
  assert.match(notifications.at(-1).options.title, /hedef/);
  assert.equal(notifications.at(-1).options.requireInteraction, undefined);
  assert.equal(storage.debugLog.some((entry) => entry.event === "learned"), true);
  assert.equal(storage.debugLog.some((entry) => entry.event === "reload-fired"), true);
  assert.equal(storage.debugLog.some((entry) =>
    entry.event === "reload-rescheduled" &&
    entry.scheduleReason === "dependency-settled"), true);
  assert.equal(storage.debugLog.some((entry) => entry.event === "main-completed"), true);

  await send({ type: "saveSettings", patch: { learnedDomains: ["frame.example"] } });
  const scriptCountBeforeDependency = scriptExecutions.length;
  await listeners.requestError({
    tabId: 88,
    frameId: 12,
    parentFrameId: 0,
    type: "image",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://api.frame.example/media/preview",
    initiator: "https://frame.example"
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.deepEqual([...storage.learnedDomains], ["api.frame.example", "frame.example"]);
  assert.equal(scriptExecutions.length, scriptCountBeforeDependency + 1);
  assert.equal(scriptExecutions.at(-1).args[0], "frame.example");
  assert.deepEqual([...scriptExecutions.at(-1).target.frameIds], [0]);
  assert.equal(
    storage.debugLog.some((entry) => entry.event === "iframe-retry-scheduled"),
    true
  );

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  directlyReachableHosts.add("intermittent-media.example");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await listeners.requestError({
      tabId: 91,
      frameId: 4,
      parentFrameId: 0,
      type: "image",
      error: "net::ERR_CONNECTION_RESET",
      url: "https://intermittent-media.example/asset"
    });
  }
  assert.deepEqual([...storage.learnedDomains], ["intermittent-media.example"]);
  await waitForDebugFlush();
  assert.equal(storage.debugLog.some((entry) =>
    entry.event === "direct-check" &&
    entry.host === "intermittent-media.example" &&
    entry.overriddenByRepeatedReset === true), true);

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  await listeners.requestError({
    tabId: 92,
    type: "stylesheet",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://static-assets.example/site.css",
    initiator: "https://different-origin.example/"
  });
  assert.deepEqual([...storage.learnedDomains], []);
  await listeners.requestError({
    tabId: 92,
    type: "script",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://application-shell.example/app.js",
    initiator: "https://application-shell.example/"
  });
  assert.deepEqual([...storage.learnedDomains], ["application-shell.example"]);
  await new Promise((resolve) => setTimeout(resolve, 2_100));

  await send({
    type: "saveSettings",
    patch: {
      learnedDomains: [
        "dependency.example",
        "restored.example",
        "www.restored.example"
      ]
    }
  });
  directlyReachableHosts.add("restored.example");
  const notificationsBeforeRecovery = notifications.length;
  const probesBeforeCompletedRoute = directProbeUrls.length;
  await listeners.requestCompleted({
    tabId: 93,
    type: "main_frame",
    url: "https://restored.example/account?private=value#section",
    statusCode: 200,
    fromCache: false
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(
    [...storage.learnedDomains],
    ["dependency.example", "restored.example", "www.restored.example"]
  );
  assertBadge(lastForTab(badgeTexts, 93), 93, "↗");
  assert.equal(lastForTab(badgeColors, 93)?.color, "#2563eb");
  assert.equal(notifications.length, notificationsBeforeRecovery);
  assert.equal(directProbeUrls.length, probesBeforeCompletedRoute);
  const recoveredProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(
    recoveredProxy("https://restored.example/", "restored.example"),
    "SOCKS5 127.0.0.1:1080"
  );
  assert.equal(
    recoveredProxy("https://dependency.example/", "dependency.example"),
    "SOCKS5 127.0.0.1:1080"
  );
  directlyReachableHosts.delete("restored.example");

  await send({
    type: "saveSettings",
    patch: { learnedDomains: ["dependency.example", "still-routed.example"] }
  });
  const notificationsBeforeFailedRecovery = notifications.length;
  await listeners.requestCompleted({
    tabId: 94,
    type: "main_frame",
    url: "https://still-routed.example/private/path?token=value",
    statusCode: 200,
    fromCache: false
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(
    [...storage.learnedDomains],
    ["dependency.example", "still-routed.example"]
  );
  assert.equal(notifications.length, notificationsBeforeFailedRecovery);
  assertBadge(lastForTab(badgeTexts, 94), 94, "↗");
  const retainedProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(
    retainedProxy("https://still-routed.example/", "still-routed.example"),
    "SOCKS5 127.0.0.1:1080"
  );

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  const parallelHosts = ["one.example", "two.example", "three.example", "four.example"];
  parallelHosts.forEach((host) => delayedProbeHosts.add(host));
  maxActiveDirectProbes = 0;
  const parallelStartedAt = Date.now();
  await Promise.all(parallelHosts.map((host, index) => listeners.requestError({
    tabId: 100 + index,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: `https://${host}/resource`
  })));
  const parallelElapsedMs = Date.now() - parallelStartedAt;
  assert.equal(maxActiveDirectProbes, 3);
  assert.equal(parallelElapsedMs < 350, true);
  assert.deepEqual([...storage.learnedDomains], [...parallelHosts].sort());

  await send({
    type: "saveSettings",
    patch: { learnedDomains: ["gateway-startup.example"] }
  });
  tabUrls.set(120, "https://gateway-startup.example/");
  const reloadCountBeforeGatewayRecovery = reloads.length;
  await listeners.requestError({
    tabId: 120,
    type: "main_frame",
    error: "net::ERR_PROXY_CONNECTION_FAILED",
    url: "https://gateway-startup.example/"
  });
  assert.equal(storage.lastIssueType, "gateway_recovering");
  assert.equal(storage.lastProxyError, "ERR_PROXY_CONNECTION_FAILED");
  assertBadge(lastForTab(badgeTexts, 120), 120, "?");
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(reloads.length, reloadCountBeforeGatewayRecovery + 1);
  assert.equal(reloads.at(-1).tabId, 120);
  assert.equal(reloads.at(-1).options.bypassCache, true);

  await listeners.requestCompleted({
    tabId: 120,
    type: "main_frame",
    url: "https://gateway-startup.example/",
    statusCode: 200,
    fromCache: false
  });
  assert.equal(storage.lastProxyError, null);
  assert.equal(storage.lastIssueType, null);
  assertBadge(lastForTab(badgeTexts, 120), 120, "↗");

  tabUrls.set(121, "https://direct-page.example/");
  await listeners.requestCompleted({
    tabId: 121,
    type: "main_frame",
    url: "https://direct-page.example/",
    statusCode: 200,
    fromCache: false
  });
  await listeners.proxyError({ error: "net::ERR_PROXY_CONNECTION_FAILED" });
  assertBadge(lastForTab(badgeTexts, 120), 120, "!");
  assertBadge(lastForTab(badgeTexts, 121), 121, "");
  assert.equal(lastForTab(badgeColors, 121)?.color, "#15803d");
  await listeners.requestCompleted({
    tabId: 120,
    type: "main_frame",
    url: "https://gateway-startup.example/",
    statusCode: 200,
    fromCache: false
  });
  assert.equal(storage.lastProxyError, null);

  const clearedDebugLog = await send({ type: "clearDebugLog" });
  assert.equal(clearedDebugLog.ok, true);
  assert.deepEqual([...storage.debugLog], []);

  const disabled = await send({ type: "saveSettings", patch: { enabled: false } });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.state.enabled, false);
  assert.equal(proxyConfig, null);
  assert.ok(clearCount >= 2);

  const notificationTest = await send({ type: "testNotification" });
  assert.equal(notificationTest.ok, true);
  assert.equal(notificationTest.result.ok, true);
  assert.match(notificationTest.result.warning, /Windows genel bildirimleri/i);
  assert.equal(notifications.at(-1).options.title, "Otomatik Erişim bildirim testi");
  notificationCreateError = "notification backend failed";
  const failedNotificationTest = await send({ type: "testNotification" });
  assert.equal(failedNotificationTest.result.ok, false);
  assert.equal(storage.lastNotificationStatus, "failed");
  assert.match(storage.lastNotificationError, /backend failed/);
  notificationCreateError = null;
  notificationPermission = "denied";
  const deniedNotificationTest = await send({ type: "testNotification" });
  assert.equal(deniedNotificationTest.result.ok, false);
  assert.match(deniedNotificationTest.result.error, /bildirim izni kapalı/i);

  process.stdout.write("background tests passed\n");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
