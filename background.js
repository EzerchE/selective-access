const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 7,
  enabled: false,
  learnedDomains: [],
  ignoredDomains: [],
  proxyHost: "127.0.0.1",
  proxyPort: 1080,
  lastDetectedDomain: null,
  lastDetectedAt: null,
  lastProxyError: null,
  lastIssueType: null,
  lastIssueDomain: null,
  lastIssueError: null,
  lastIssueAt: null,
  lastGlobalCheck: null,
  lastNotificationStatus: null,
  lastNotificationDomain: null,
  lastNotificationAt: null,
  lastNotificationError: null,
  debugEnabled: false,
  debugLog: []
});

const RETRYABLE_ERRORS = Object.freeze([
  "ERR_CONNECTION_RESET",
  "ERR_CONNECTION_CLOSED",
  "ERR_CONNECTION_TIMED_OUT",
  "ERR_TIMED_OUT",
  "ERR_EMPTY_RESPONSE",
  "ERR_SSL_PROTOCOL_ERROR"
]);

const RETRYABLE_TYPES = new Set([
  "main_frame",
  "sub_frame",
  "media",
  "image",
  "xmlhttprequest",
  "websocket",
  "other"
]);

const retryCooldowns = new Map();
const tabIssues = new Map();
const detectionCandidates = new Map();
const reloadTimers = new Map();
const iframeRetryTimers = new Map();
const pendingLearnedNotifications = new Set();
let learnedNotificationTimer = null;
let learningQueue = Promise.resolve();

const AUTO_LEARN_ERROR_THRESHOLDS = Object.freeze({
  ERR_CONNECTION_RESET: { main: 2, embedded: 1 },
  ERR_CONNECTION_CLOSED: { main: 2, embedded: 1 },
  ERR_EMPTY_RESPONSE: { main: 3, embedded: 2 }
});
const NON_ACTIONABLE_REQUEST_ERRORS = new Set([
  "net::ERR_ABORTED",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_BLOCKED_BY_ORB",
  "net::ERR_CACHE_MISS"
]);
const CANDIDATE_WINDOW_MS = 30_000;
const DEBUG_LOG_LIMIT = 150;
let debugQueue = Promise.resolve();

function appendDebug(event, data = {}) {
  debugQueue = debugQueue.then(async () => {
    const { debugEnabled = false, debugLog = [] } = await chrome.storage.local.get({
      debugEnabled: false,
      debugLog: []
    });
    if (!debugEnabled) return;
    const entry = { at: new Date().toISOString(), event, ...data };
    await chrome.storage.local.set({
      debugLog: [...(Array.isArray(debugLog) ? debugLog : []), entry].slice(-DEBUG_LOG_LIMIT)
    });
  }).catch((error) => console.debug("Otomatik Erişim debug kaydı yazılamadı", error));
  return debugQueue;
}

function actionTarget(tabId, values) {
  return Number.isInteger(tabId) && tabId >= 0 ? { ...values, tabId } : values;
}

function normalizeDomain(value) {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (!candidate) return null;

  try {
    const withScheme = candidate.includes("://") ? candidate : `https://${candidate}`;
    const hostname = new URL(withScheme).hostname.replace(/^\.+|\.+$/g, "");
    if (!hostname || hostname === "localhost" || hostname.includes(" ")) return null;
    return hostname;
  } catch {
    return null;
  }
}

function normalizeDomains(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(normalizeDomain)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : DEFAULT_SETTINGS.proxyPort;
}

function isCovered(host, domains) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isLearned(host, domains) {
  return domains.includes(host);
}

function mainHostAliases(host, requestType = "main_frame") {
  if (requestType !== "main_frame") return [host];
  return host.startsWith("www.")
    ? [host, host.slice(4)]
    : [host, `www.${host}`];
}

function isLocalHost(host) {
  return host === "localhost" ||
    host === "::1" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.");
}

async function getSettings() {
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const ignoredDomains = normalizeDomains(saved.ignoredDomains);
  const learnedDomains = normalizeDomains(saved.learnedDomains)
    .filter((domain) => !isCovered(domain, ignoredDomains));
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    enabled: Boolean(saved.enabled),
    debugEnabled: Boolean(saved.debugEnabled),
    learnedDomains,
    ignoredDomains,
    proxyHost: DEFAULT_SETTINGS.proxyHost,
    proxyPort: normalizePort(saved.proxyPort)
  };
}

function buildPacScript(settings) {
  const learnedDomains = JSON.stringify(settings.learnedDomains);
  const proxy = `SOCKS5 ${settings.proxyHost}:${settings.proxyPort}`;

  return `
function FindProxyForURL(url, host) {
  host = host.toLowerCase().replace(/\\.$/, "");
  var learnedDomains = ${learnedDomains};

  if (isPlainHostName(host) ||
      host === "localhost" ||
      host === "::1" ||
      shExpMatch(host, "127.*") ||
      shExpMatch(host, "10.*") ||
      shExpMatch(host, "192.168.*")) {
    return "DIRECT";
  }

  for (var i = 0; i < learnedDomains.length; i++) {
    var domain = learnedDomains[i];
    if (host === domain) {
      return "${proxy}";
    }
  }

  return "DIRECT";
}`.trim();
}

async function setBadge(enabled, hasError = false, learned = false, tabId = null) {
  await chrome.action.setBadgeText(actionTarget(tabId, {
    text: hasError ? "!" : learned ? "NEW" : enabled ? "AUTO" : ""
  }));
  await chrome.action.setBadgeBackgroundColor(actionTarget(tabId, {
    color: hasError ? "#dc2626" : learned ? "#2563eb" : "#0f766e"
  }));
  await chrome.action.setTitle(actionTarget(tabId, {
    title: hasError
      ? "Otomatik Erişim — yerel geçit hatası"
      : learned
        ? "Otomatik Erişim — yeni engelli hedef öğrenildi"
        : enabled
          ? "Otomatik Erişim — engel algılama etkin"
          : "Otomatik Erişim — kapalı"
  }));
}

async function setIssueBadge(enabled, issueType, tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabIssues.set(tabId, issueType);
  const isDown = issueType === "globally_down";
  await chrome.action.setBadgeText({ tabId, text: isDown ? "DOWN" : "?" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: isDown ? "#dc2626" : "#d97706" });
  await chrome.action.setTitle({
    tabId,
    title: isDown
      ? "Otomatik Erişim — genel kesinti olası"
      : enabled
        ? "Otomatik Erişim — bağlantı sorunu sürüyor"
        : "Otomatik Erişim — kapalı"
  });
}

async function clearTabIssue(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabIssues.delete(tabId);
  const settings = await getSettings();
  await setBadge(settings.enabled, Boolean(settings.lastProxyError), false, tabId);
}

async function refreshTabBadge(tabId) {
  const issueType = tabIssues.get(tabId);
  const settings = await getSettings();
  if (issueType) await setIssueBadge(settings.enabled, issueType, tabId);
  else await setBadge(settings.enabled, Boolean(settings.lastProxyError), false, tabId);
}

async function applyProxy() {
  const settings = await getSettings();

  if (!settings.enabled || settings.learnedDomains.length === 0) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    await setBadge(settings.enabled);
    return { ok: true, enabled: settings.enabled };
  }

  const current = await chrome.proxy.settings.get({ incognito: false });
  if (["not_controllable", "controlled_by_other_extensions"].includes(current.levelOfControl)) {
    const message = "Chrome proxy ayarı başka bir eklenti veya yönetici tarafından kontrol ediliyor.";
    await chrome.storage.local.set({ lastProxyError: message });
    await setBadge(true, true);
    return { ok: false, enabled: true, error: message };
  }

  const config = {
    mode: "pac_script",
    pacScript: {
      data: buildPacScript(settings),
      mandatory: true
    }
  };

  await chrome.proxy.settings.set({ value: config, scope: "regular" });
  await chrome.storage.local.set({ lastProxyError: null });
  await setBadge(true);
  return { ok: true, enabled: true };
}

async function saveSettings(patch) {
  const current = await getSettings();
  const ignoredDomains = patch.ignoredDomains === undefined
    ? current.ignoredDomains
    : normalizeDomains(patch.ignoredDomains);
  const learnedDomains = (patch.learnedDomains === undefined
    ? current.learnedDomains
    : normalizeDomains(patch.learnedDomains))
    .filter((domain) => !isCovered(domain, ignoredDomains));
  const next = {
    ...current,
    ...patch,
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    enabled: patch.enabled === undefined ? current.enabled : Boolean(patch.enabled),
    debugEnabled: patch.debugEnabled === undefined
      ? current.debugEnabled
      : Boolean(patch.debugEnabled),
    learnedDomains,
    ignoredDomains,
    proxyHost: DEFAULT_SETTINGS.proxyHost,
    proxyPort: patch.proxyPort === undefined ? current.proxyPort : normalizePort(patch.proxyPort),
    lastProxyError: null,
    lastDetectedDomain: current.lastDetectedDomain && isCovered(current.lastDetectedDomain, ignoredDomains)
      ? null
      : current.lastDetectedDomain
  };

  await chrome.storage.local.set(next);
  const result = await applyProxy();
  return { ...next, applyResult: result };
}

async function getPublicState() {
  const settings = await getSettings();
  const proxyState = await chrome.proxy.settings.get({ incognito: false });
  return {
    ...settings,
    levelOfControl: proxyState.levelOfControl,
    effectiveMode: proxyState.value?.mode ?? "unknown"
  };
}

function isRetryableError(details) {
  return details.tabId >= 0 &&
    RETRYABLE_TYPES.has(details.type) &&
    RETRYABLE_ERRORS.some((error) => String(details.error || "").includes(error));
}

function matchingError(details, candidates) {
  return candidates.find((error) => String(details.error || "").includes(error)) || null;
}

function registerDetectionCandidate(host, details, error) {
  const threshold = AUTO_LEARN_ERROR_THRESHOLDS[error];
  if (!threshold) return { ready: false, supported: false, count: 0 };
  const now = Date.now();
  for (const [candidateKey, candidate] of detectionCandidates) {
    if (now - candidate.lastAt > CANDIDATE_WINDOW_MS) detectionCandidates.delete(candidateKey);
  }
  const scope = details.type === "main_frame" ? "main" : "embedded";
  const key = `${scope}:${host}`;
  const previous = detectionCandidates.get(key);
  const count = previous && previous.error === error && now - previous.lastAt <= CANDIDATE_WINDOW_MS
    ? previous.count + 1
    : 1;
  detectionCandidates.set(key, { count, lastAt: now, error });
  const required = details.type === "main_frame" ? threshold.main : threshold.embedded;
  return { ready: count >= required, supported: true, count, required, key };
}

async function directRequestResponds(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal
    });
    controller.abort();
    return Boolean(response);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleTabReload(tabId, delayMs = 1_500) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const existing = reloadTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
    appendDebug("reload-rescheduled", { tabId, delayMs });
  } else {
    appendDebug("reload-scheduled", { tabId, delayMs });
  }
  const timer = setTimeout(() => {
    reloadTimers.delete(tabId);
    appendDebug("reload-fired", { tabId });
    chrome.tabs.reload(tabId, { bypassCache: true })
      .then(() => appendDebug("reload-accepted", { tabId }))
      .catch((error) => appendDebug("reload-failed", { tabId, error: error.message }));
  }, delayMs);
  reloadTimers.set(tabId, timer);
}

function cancelTabReload(tabId, reason = "completed") {
  const timer = reloadTimers.get(tabId);
  if (!timer) return false;
  clearTimeout(timer);
  reloadTimers.delete(tabId);
  appendDebug("reload-cancelled", { tabId, reason });
  return true;
}

async function flushLearnedNotifications() {
  learnedNotificationTimer = null;
  const domains = [...pendingLearnedNotifications].sort((a, b) => a.localeCompare(b));
  pendingLearnedNotifications.clear();
  if (domains.length === 0) return { ok: true, skipped: true };

  const id = `learned:${Date.now()}`;
  const permission = typeof chrome.notifications.getPermissionLevel === "function"
    ? await chrome.notifications.getPermissionLevel()
    : "granted";
  if (permission !== "granted") {
    await chrome.storage.local.set({
      lastNotificationStatus: "denied",
      lastNotificationDomain: domains.at(-1),
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: "Chrome bildirim izni kapalı."
    });
    return { ok: false, error: "Chrome bildirim izni kapalı." };
  }

  try {
    const createdId = await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: domains.length === 1 ? "Engel algılandı" : `${domains.length} hedef yönlendirmeye eklendi`,
      message: domains.length === 1
        ? `${domains[0]} artık yerel geçit üzerinden denenecek.`
        : `${domains.slice(0, 3).join(", ")}${domains.length > 3 ? ` ve ${domains.length - 3} hedef daha` : ""}.`,
      priority: 1
    });
    await chrome.storage.local.set({
      lastNotificationStatus: "created",
      lastNotificationDomain: domains.at(-1),
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: null
    });
    return { ok: true, id: createdId };
  } catch (error) {
    await chrome.storage.local.set({
      lastNotificationStatus: "failed",
      lastNotificationDomain: domains.at(-1),
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: error.message || "Bildirim oluşturulamadı."
    });
    return { ok: false, error: error.message || "Bildirim oluşturulamadı." };
  }
}

function notifyLearnedDomain(domain) {
  pendingLearnedNotifications.add(domain);
  if (learnedNotificationTimer) clearTimeout(learnedNotificationTimer);
  learnedNotificationTimer = setTimeout(() => {
    flushLearnedNotifications().catch(console.error);
  }, 2_000);
  return Promise.resolve({ ok: true, scheduled: true });
}

function retryLearnedIframe(details, host) {
  if (details.type !== "sub_frame" || !Number.isInteger(details.tabId) || details.tabId < 0) return;
  const parentFrameId = Number.isInteger(details.parentFrameId) && details.parentFrameId >= 0
    ? details.parentFrameId
    : 0;
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [parentFrameId] },
    args: [host],
    func: (targetHost) => {
      const roots = [document];
      while (roots.length > 0) {
        const root = roots.pop();
        for (const frame of root.querySelectorAll("iframe[src]")) {
          try {
            if (new URL(frame.src, location.href).hostname.toLowerCase() === targetHost) {
              frame.src = frame.src;
              return 1;
            }
          } catch {}
        }
        for (const element of root.querySelectorAll("*")) {
          if (element.shadowRoot) roots.push(element.shadowRoot);
        }
      }
      return 0;
    }
  }).then(async (results) => {
    if (results?.[0]?.result === 1) {
      await appendDebug("iframe-retry", {
        tabId: details.tabId,
        host,
        matched: true,
        method: "parent-dom"
      });
      return;
    }

    if (!Number.isInteger(details.frameId) || details.frameId <= 0) {
      await appendDebug("iframe-retry", {
        tabId: details.tabId,
        host,
        matched: false,
        method: "parent-dom"
      });
      return;
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      args: [details.url],
      func: (targetUrl) => {
        location.replace(targetUrl);
        return 1;
      }
    });
    await appendDebug("iframe-retry", {
      tabId: details.tabId,
      host,
      matched: frameResults?.[0]?.result === 1,
      method: "frame-id"
    });
  }).catch((error) => appendDebug("iframe-retry-failed", {
    tabId: details.tabId,
    host,
    error: error.message
  }));
}

function scheduleInitiatorIframeRetry(details, learnedDomains) {
  if (!Number.isInteger(details.frameId) || details.frameId <= 0 || !details.initiator) return;
  let initiatorHost = null;
  try {
    initiatorHost = normalizeDomain(new URL(details.initiator).hostname);
  } catch {
    return;
  }
  if (!initiatorHost || !isLearned(initiatorHost, learnedDomains)) return;

  const key = `${details.tabId}:${initiatorHost}`;
  const existing = iframeRetryTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    iframeRetryTimers.delete(key);
    retryLearnedIframe({
      tabId: details.tabId,
      type: "sub_frame",
      parentFrameId: Number.isInteger(details.parentFrameId) ? details.parentFrameId : 0
    }, initiatorHost);
  }, 700);
  iframeRetryTimers.set(key, timer);
  appendDebug(existing ? "iframe-retry-rescheduled" : "iframe-retry-scheduled", {
    tabId: details.tabId,
    host: initiatorHost,
    learnedDependency: getRequestHost(details),
    delayMs: 700
  });
}

async function sendTestNotification() {
  const permission = typeof chrome.notifications.getPermissionLevel === "function"
    ? await chrome.notifications.getPermissionLevel()
    : "granted";
  if (permission !== "granted") return { ok: false, error: "Chrome bildirim izni kapalı." };
  const id = `test:${Date.now()}`;
  try {
    const createdId = await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: "Otomatik Erişim bildirim testi",
      message: "Bu bildirimi görüyorsanız yeni hedef bildirimleri çalışıyor.",
      priority: 1
    });
    await chrome.storage.local.set({
      lastNotificationStatus: "created",
      lastNotificationDomain: null,
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: null
    });
    return {
      ok: true,
      id: createdId,
      warning: "Chrome bildirimi kabul etti. Windows genel bildirimleri kapalıysa ekranda görünmeyebilir."
    };
  } catch (error) {
    const message = error.message || "Bildirim oluşturulamadı.";
    await chrome.storage.local.set({
      lastNotificationStatus: "failed",
      lastNotificationDomain: null,
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: message
    });
    return { ok: false, error: message };
  }
}

async function notifyLikelyGlobalOutage(domain) {
  await chrome.notifications.create(`outage:${domain}`, {
    type: "basic",
    iconUrl: "assets/icon-128.png",
    title: "Genel kesinti olası",
    message: `${domain} birden fazla dış noktadan da erişilemiyor. Site şu anda genel olarak kapalı olabilir.`
  });
}

function getRequestHost(details) {
  try {
    return normalizeDomain(new URL(details.url).hostname);
  } catch {
    return null;
  }
}

async function learnAndRetry(details) {
  if (!isRetryableError(details)) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const host = getRequestHost(details);

  if (!host || isLocalHost(host) || isCovered(host, settings.ignoredDomains)) return;

  if (isLearned(host, settings.learnedDomains)) {
    if (details.type === "main_frame") {
      await appendDebug("learned-route-failed", {
        tabId: details.tabId,
        host,
        error: matchingError(details, RETRYABLE_ERRORS)
      });
      await chrome.storage.local.set({
        lastIssueType: "route_failed",
        lastIssueDomain: host,
        lastIssueError: matchingError(details, RETRYABLE_ERRORS),
        lastIssueAt: new Date().toISOString(),
        lastGlobalCheck: null
      });
      await setIssueBadge(true, "route_failed", details.tabId);
    }
    return;
  }

  const error = matchingError(details, RETRYABLE_ERRORS);
  const candidate = registerDetectionCandidate(host, details, error);
  await appendDebug("candidate", {
    tabId: details.tabId,
    host,
    requestType: details.type,
    error,
    count: candidate.count,
    required: candidate.required || null,
    supported: candidate.supported
  });
  if (!candidate.supported) {
    if (details.type === "main_frame") {
      await chrome.storage.local.set({
        lastIssueType: "transient_unverified",
        lastIssueDomain: host,
        lastIssueError: error,
        lastIssueAt: new Date().toISOString(),
        lastGlobalCheck: null
      });
      await setIssueBadge(true, "transient_unverified", details.tabId);
    }
    return;
  }
  if (!candidate.ready) return;

  const directlyReachable = await directRequestResponds(details.url);
  const repeatedMainReset = details.type === "main_frame" &&
    ["ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED"].includes(error) &&
    candidate.count >= candidate.required;
  const repeatedEmbeddedReset = details.type !== "main_frame" &&
    ["ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED"].includes(error) &&
    candidate.count >= 2;
  const repeatedReset = repeatedMainReset || repeatedEmbeddedReset;
  await appendDebug("direct-check", {
    tabId: details.tabId,
    host,
    requestType: details.type,
    reachable: directlyReachable,
    overriddenByRepeatedReset: directlyReachable && repeatedReset
  });
  if (directlyReachable && !repeatedReset) {
    const keepForRepeatedEmbeddedReset = details.type !== "main_frame" &&
      ["ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED"].includes(error);
    if (!keepForRepeatedEmbeddedReset) detectionCandidates.delete(candidate.key);
    if (details.type === "main_frame") {
      await chrome.storage.local.set({
        lastIssueType: "transient_reachable",
        lastIssueDomain: host,
        lastIssueError: error,
        lastIssueAt: new Date().toISOString(),
        lastGlobalCheck: null
      });
      await setIssueBadge(true, "transient_reachable", details.tabId);
    }
    return;
  }
  detectionCandidates.delete(candidate.key);

  const learnedDomains = normalizeDomains([
    ...settings.learnedDomains,
    ...mainHostAliases(host, details.type)
  ]);
  const now = Date.now();
  await chrome.storage.local.set({
    learnedDomains,
    lastDetectedDomain: host,
    lastDetectedAt: new Date(now).toISOString(),
    lastProxyError: null,
    lastIssueType: details.type === "main_frame" ? "route_learned" : settings.lastIssueType,
    lastIssueDomain: details.type === "main_frame" ? host : settings.lastIssueDomain,
    lastIssueError: details.type === "main_frame" ? matchingError(details, RETRYABLE_ERRORS) : settings.lastIssueError,
    lastIssueAt: details.type === "main_frame" ? new Date(now).toISOString() : settings.lastIssueAt,
    lastGlobalCheck: details.type === "main_frame" ? null : settings.lastGlobalCheck
  });

  const applied = await applyProxy();
  await appendDebug("learned", {
    tabId: details.tabId,
    host,
    requestType: details.type,
    learnedDomains,
    proxyApplied: applied.ok,
    proxyError: applied.error || null
  });
  if (!applied.ok) return;
  await setBadge(true, false, true, details.tabId);
  await notifyLearnedDomain(host).catch(console.error);
  retryLearnedIframe(details, host);
  scheduleInitiatorIframeRetry(details, learnedDomains);

  // Gömülü API, video, görsel veya iframe hedefleri öğrenilir ancak açık sayfa
  // yenilenmez. Modern siteler bu istekleri çoğunlukla kendileri tekrarlar;
  // zorunlu yenileme açık gönderi, form ve uygulama durumunu kaybettirebilir.
  if (details.type !== "main_frame") return;

  const retryKey = `${details.tabId}:main:${host}`;
  const lastRetry = retryCooldowns.get(retryKey) || 0;
  if (now - lastRetry < 60_000) return;
  retryCooldowns.set(retryKey, now);

  scheduleTabReload(details.tabId);
}

function summarizeGlobalMeasurement(domain, measurement) {
  const results = Array.isArray(measurement?.results) ? measurement.results : [];
  const finished = results.filter(({ result }) =>
    result?.status === "finished" && Number.isInteger(result?.statusCode));
  const targetFailures = results.filter(({ result }) =>
    result?.status === "failed" && result?.failureSource === "target");
  const locations = results.map(({ probe, result }) => ({
    country: probe?.country || "?",
    city: probe?.city || "",
    status: result?.status || "unknown",
    statusCode: Number.isInteger(result?.statusCode) ? result.statusCode : null
  }));

  let status = "inconclusive";
  if (finished.length >= 2) status = "online";
  else if (finished.length === 1) status = "regional";
  else if (targetFailures.length >= 2) status = "likely_down";

  return {
    domain,
    status,
    checkedAt: new Date().toISOString(),
    reachable: finished.length,
    total: results.length,
    locations
  };
}

async function checkGlobalStatus(value, tabId = null) {
  const domain = normalizeDomain(value);
  if (!domain || isLocalHost(domain)) throw new Error("Geçerli bir genel alan adı gerekli.");

  const createdResponse = await fetch("https://api.globalping.io/v1/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      type: "http",
      target: domain,
      locations: [
        { continent: "EU", limit: 1 },
        { continent: "NA", limit: 1 },
        { continent: "AS", limit: 1 }
      ],
      measurementOptions: {
        protocol: "HTTPS",
        request: { method: "HEAD", path: "/" }
      }
    })
  });

  if (!createdResponse.ok) {
    throw new Error(createdResponse.status === 429
      ? "Genel durum servisi istek sınırına ulaştı; biraz sonra tekrar deneyin."
      : "Genel durum ölçümü başlatılamadı.");
  }

  const created = await createdResponse.json();
  if (!created?.id) throw new Error("Genel durum servisi ölçüm kimliği döndürmedi.");

  let measurement = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const resultResponse = await fetch(`https://api.globalping.io/v1/measurements/${created.id}`, {
      headers: { "Accept": "application/json" }
    });
    if (!resultResponse.ok) throw new Error("Genel durum ölçümü okunamadı.");
    measurement = await resultResponse.json();
    if (measurement.status !== "in-progress") break;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  if (!measurement || measurement.status === "in-progress") {
    throw new Error("Genel durum ölçümü zamanında tamamlanmadı.");
  }

  const summary = summarizeGlobalMeasurement(domain, measurement);
  await chrome.storage.local.set({ lastGlobalCheck: summary });
  const settings = await getSettings();
  if (summary.status === "likely_down") {
    await setIssueBadge(settings.enabled, "globally_down", tabId);
    await notifyLikelyGlobalOutage(domain).catch(console.error);
  } else if (Number.isInteger(tabId) && tabId >= 0) {
    await clearTabIssue(tabId);
  }
  return summary;
}

async function clearIssueAfterSuccess(details) {
  if (details.tabId < 0 || details.type !== "main_frame") return;
  await clearTabIssue(details.tabId);
  const host = getRequestHost(details);
  const settings = await getSettings();
  if (!host || settings.lastIssueDomain !== host) return;

  await chrome.storage.local.set({
    lastIssueType: null,
    lastIssueDomain: null,
    lastIssueError: null,
    lastIssueAt: null,
    lastGlobalCheck: null
  });
}

async function initialize() {
  const existing = await chrome.storage.local.get(null);
  if (existing.schemaVersion !== DEFAULT_SETTINGS.schemaVersion) {
    await chrome.storage.local.set({
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      learnedDomains: normalizeDomains(existing.learnedDomains),
      ignoredDomains: normalizeDomains(existing.ignoredDomains),
      enabled: Boolean(existing.enabled),
      debugEnabled: Boolean(existing.debugEnabled),
      proxyHost: DEFAULT_SETTINGS.proxyHost,
      proxyPort: normalizePort(existing.proxyPort),
      lastDetectedDomain: existing.lastDetectedDomain || null,
      lastDetectedAt: existing.lastDetectedAt || null,
      lastProxyError: null,
      lastIssueType: existing.lastIssueType || null,
      lastIssueDomain: existing.lastIssueDomain || null,
      lastIssueError: existing.lastIssueError || null,
      lastIssueAt: existing.lastIssueAt || null,
      lastGlobalCheck: existing.lastGlobalCheck || null
    });
  }
  await chrome.storage.local.remove([
    "dnsFallbackDomains",
    "lastDnsSyncStatus",
    "lastDnsSyncAt",
    "lastDnsSyncError"
  ]);
  await applyProxy();
}

chrome.runtime.onInstalled.addListener(() => initialize().catch(console.error));

chrome.runtime.onStartup.addListener(() => applyProxy().catch(console.error));

chrome.proxy.onProxyError.addListener(async (details) => {
  const message = details?.error || "Yerel proxy bağlantısı kurulamadı.";
  await chrome.storage.local.set({ lastProxyError: message });
  await appendDebug("proxy-error", { error: message });
  const settings = await getSettings();
  await setBadge(settings.enabled, true);
});

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId < 0 || NON_ACTIONABLE_REQUEST_ERRORS.has(String(details.error || ""))) return;
    const host = getRequestHost(details);
    appendDebug("request-error", {
      tabId: details.tabId,
      frameId: Number.isInteger(details.frameId) ? details.frameId : null,
      parentFrameId: Number.isInteger(details.parentFrameId) ? details.parentFrameId : null,
      host,
      requestType: details.type,
      error: details.error || null,
      initiatorHost: details.initiator ? getRequestHost({ url: details.initiator }) : null
    });
    learningQueue = learningQueue
      .then(() => learnAndRetry(details))
      .catch(console.error);
    return learningQueue;
  },
  { urls: ["http://*/*", "https://*/*"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    cancelTabReload(details.tabId, "main-completed");
    const debugWrite = appendDebug("main-completed", {
      tabId: details.tabId,
      host: getRequestHost(details),
      statusCode: details.statusCode || null,
      fromCache: Boolean(details.fromCache)
    });
    const clearIssue = clearIssueAfterSuccess(details).catch(console.error);
    return Promise.all([debugWrite, clearIssue]);
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => clearTabIssue(details.tabId).catch(console.error),
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshTabBadge(tabId).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabIssues.delete(tabId);
  cancelTabReload(tabId, "tab-removed");
  for (const [key, timer] of iframeRetryTimers) {
    if (key.startsWith(`${tabId}:`)) {
      clearTimeout(timer);
      iframeRetryTimers.delete(key);
    }
  }
  for (const key of retryCooldowns.keys()) {
    if (key.startsWith(`${tabId}:`)) retryCooldowns.delete(key);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "getState":
        return { ok: true, state: await getPublicState() };
      case "saveSettings":
        return { ok: true, state: await saveSettings(message.patch || {}) };
      case "reapply":
        return { ok: true, result: await applyProxy(), state: await getPublicState() };
      case "checkGlobalStatus":
        return {
          ok: true,
          result: await checkGlobalStatus(
            message.domain,
            Number.isInteger(message.tabId) ? message.tabId : _sender.tab?.id
          )
        };
      case "testNotification":
        return { ok: true, result: await sendTestNotification() };
      case "clearDebugLog":
        await chrome.storage.local.set({ debugLog: [] });
        return { ok: true };
      default:
        return { ok: false, error: "Bilinmeyen istek." };
    }
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
