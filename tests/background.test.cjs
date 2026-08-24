const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const listeners = {};
const storage = {};
const reloads = [];
const badgeTexts = [];
const notifications = [];
let proxyConfig = null;
let clearCount = 0;
let measurementShouldBeDown = false;
let notificationPermission = "granted";
const directlyReachableHosts = new Set();

const chrome = {
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
      }
    }
  },
  action: {
    async setBadgeText(details) { badgeTexts.push(details); },
    async setBadgeBackgroundColor() {},
    async setTitle() {}
  },
  notifications: {
    async getPermissionLevel() { return notificationPermission; },
    async clear() { return true; },
    async create(id, options) {
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
    async reload(tabId, options) {
      reloads.push({ tabId, options });
    },
    onActivated: {
      addListener(listener) {
        listeners.tabActivated = listener;
      }
    },
    onRemoved: {
      addListener(listener) {
        listeners.tabRemoved = listener;
      }
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
    const host = new URL(url).hostname;
    if (directlyReachableHosts.has(host)) return { ok: true, status: 204 };
    throw new Error("direct probe failed");
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
    shExpMatch: (host, pattern) => host.startsWith(pattern.replace("*", "")),
    dnsDomainIs: (host, suffix) => host.endsWith(suffix)
  };
  vm.runInNewContext(data, pac);
  return pac.FindProxyForURL;
}

function assertBadge(details, tabId, text) {
  assert.equal(details?.tabId, tabId);
  assert.equal(details?.text, text);
}

(async () => {
  await listeners.installed();
  assert.equal(storage.enabled, false);
  assert.equal(storage.schemaVersion, 5);
  assert.deepEqual([...storage.learnedDomains], []);
  assert.deepEqual([...storage.ignoredDomains], []);
  assert.deepEqual([...listeners.requestFilter.urls], ["http://*/*", "https://*/*"]);

  const enabled = await send({
    type: "saveSettings",
    patch: {
      enabled: true,
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

  await send({ type: "saveSettings", patch: { learnedDomains: [] } });
  await listeners.requestError({
    tabId: 42,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://media-cdn.example/embed/video"
  });
  await new Promise((resolve) => setTimeout(resolve, 550));

  assert.deepEqual([...storage.learnedDomains], ["media-cdn.example"]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].id, "learned:media-cdn.example");
  assert.match(notifications[0].options.message, /media-cdn\.example/);
  assert.equal(notifications[0].options.priority, 2);
  assert.equal(notifications[0].options.requireInteraction, true);
  assert.equal(storage.lastNotificationStatus, "created");
  assert.equal(reloads.length, 0);

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
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual([...storage.learnedDomains], []);
  assert.equal(notifications.length, 1);

  await send({ type: "saveSettings", patch: { ignoredDomains: [] } });
  await listeners.requestError({
    tabId: 42,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://media-cdn.example/embed/restored"
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual([...storage.learnedDomains], ["media-cdn.example"]);
  assert.equal(notifications.length, 2);

  directlyReachableHosts.add("normal-available.example");
  await listeners.requestError({
    tabId: 54,
    type: "sub_frame",
    error: "net::ERR_CONNECTION_RESET",
    url: "https://normal-available.example/embed/content"
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.learnedDomains.includes("normal-available.example"), false);
  assert.equal(notifications.length, 2);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await listeners.requestError({
      tabId: 55,
      type: "main_frame",
      error: "net::ERR_CONNECTION_RESET",
      url: "https://normal-available.example/"
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(storage.learnedDomains.includes("normal-available.example"), false);
  assert.equal(storage.lastIssueType, "transient_reachable");
  assert.equal(notifications.length, 2);

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

  await listeners.requestError({
    tabId: 7,
    type: "main_frame",
    error: "net::ERR_ADDRESS_INVALID",
    url: "https://blocked-by-dns.example/"
  });
  assert.equal(storage.lastIssueType, "dns_filtered");
  assert.equal(storage.lastIssueDomain, "blocked-by-dns.example");
  assertBadge(badgeTexts.at(-1), 7, "DNS");
  assert.deepEqual([...storage.learnedDomains], ["media-cdn.example"]);

  const globalStatus = await send({
    type: "checkGlobalStatus",
    domain: "blocked-by-dns.example",
    tabId: 7
  });
  assert.equal(globalStatus.ok, true);
  assert.equal(globalStatus.result.status, "online");
  assert.equal(globalStatus.result.reachable, 2);
  assert.deepEqual([...storage.learnedDomains], ["blocked-by-dns.example", "media-cdn.example"]);
  assert.equal(storage.lastIssueType, "route_learned");
  assert.equal(notifications.length, 3);
  assert.equal(notifications[2].id, "learned:blocked-by-dns.example");
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(reloads.at(-1).tabId, 7);
  const dnsLearnedProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(dnsLearnedProxy("https://blocked-by-dns.example/", "blocked-by-dns.example"), "SOCKS5 127.0.0.1:1080");
  assert.deepEqual([...listeners.completedFilter.types], ["main_frame"]);
  assert.deepEqual([...listeners.beforeRequestFilter.types], ["main_frame"]);

  measurementShouldBeDown = true;
  const downStatus = await send({
    type: "checkGlobalStatus",
    domain: "globally-down.example",
    tabId: 33
  });
  assert.equal(downStatus.result.status, "likely_down");
  assertBadge(badgeTexts.at(-1), 33, "DOWN");
  assert.equal(notifications.length, 4);
  assert.equal(notifications[3].id, "outage:globally-down.example");
  assert.equal(notifications[3].options.title, "Genel kesinti olası");
  assert.match(notifications[3].options.message, /birden fazla dış noktadan/);
  assert.deepEqual([...storage.learnedDomains], ["blocked-by-dns.example", "media-cdn.example"]);

  listeners.tabActivated({ tabId: 44 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 44, "AUTO");
  listeners.tabActivated({ tabId: 33 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 33, "DOWN");

  listeners.beforeRequest({ tabId: 33, type: "main_frame", url: "https://other.example/" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertBadge(badgeTexts.at(-1), 33, "AUTO");

  await listeners.requestCompleted({
    tabId: 7,
    type: "main_frame",
    url: "https://blocked-by-dns.example/"
  });
  assert.equal(storage.lastIssueType, null);
  assert.equal(storage.lastGlobalCheck, null);
  assert.equal(storage.lastDetectedDomain, "blocked-by-dns.example");
  assert.equal(reloads.length, 1);
  assert.equal(reloads[0].tabId, 7);
  const learnedProxy = evaluatePac(proxyConfig.pacScript.data);
  assert.equal(learnedProxy("https://media-cdn.example/embed/video", "media-cdn.example"), "SOCKS5 127.0.0.1:1080");
  assert.equal(learnedProxy("https://portal.example/", "portal.example"), "DIRECT");

  await listeners.requestError({
    tabId: 42,
    type: "image",
    error: "net::ERR_BLOCKED_BY_CLIENT",
    url: "https://ads.example.net/banner.png"
  });
  assert.deepEqual([...storage.learnedDomains], ["blocked-by-dns.example", "media-cdn.example"]);

  await listeners.requestError({
    tabId: 42,
    type: "xmlhttprequest",
    error: "net::ERR_NAME_NOT_RESOLVED",
    url: "https://tracker.dns-filtered.example/pixel"
  });
  assert.deepEqual([...storage.learnedDomains], ["blocked-by-dns.example", "media-cdn.example"]);

  const disabled = await send({ type: "saveSettings", patch: { enabled: false } });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.state.enabled, false);
  assert.equal(proxyConfig, null);
  assert.ok(clearCount >= 2);

  const notificationTest = await send({ type: "testNotification" });
  assert.equal(notificationTest.ok, true);
  assert.equal(notificationTest.result.ok, true);
  assert.equal(notifications.at(-1).options.title, "Otomatik Erişim bildirim testi");
  notificationPermission = "denied";
  const deniedNotificationTest = await send({ type: "testNotification" });
  assert.equal(deniedNotificationTest.result.ok, false);
  assert.match(deniedNotificationTest.result.error, /bildirim izni kapalı/i);

  process.stdout.write("background tests passed\n");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
