function t(key, substitutions) {
  return chrome.i18n?.getMessage?.(key, substitutions) || key;
}

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 8,
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
  "ERR_SSL_PROTOCOL_ERROR",
  "ERR_NAME_NOT_RESOLVED",
  "ERR_NAME_RESOLUTION_FAILED",
  "ERR_DNS_TIMED_OUT",
  "ERR_DNS_SERVER_FAILED",
  "ERR_DNS_MALFORMED_RESPONSE",
  "ERR_FAILED"
]);

const GATEWAY_CONNECTION_ERRORS = Object.freeze([
  "ERR_PROXY_CONNECTION_FAILED",
  "ERR_SOCKS_CONNECTION_FAILED"
]);
const DNS_RESOLUTION_ERRORS = new Set([
  "ERR_NAME_NOT_RESOLVED",
  "ERR_NAME_RESOLUTION_FAILED",
  "ERR_DNS_TIMED_OUT",
  "ERR_DNS_SERVER_FAILED",
  "ERR_DNS_MALFORMED_RESPONSE"
]);

const RETRYABLE_TYPES = new Set([
  "main_frame",
  "sub_frame",
  "script",
  "stylesheet",
  "media",
  "image",
  "xmlhttprequest",
  "websocket",
  "other"
]);

const retryCooldowns = new Map();
const tabIssues = new Map();
const tabMainHosts = new Map();
const tabConnectionResults = new Map();
const tabRoutedHosts = new Map();
const detectionCandidates = new Map();
const reloadTimers = new Map();
const gatewayRetryStates = new Map();
const tabRecoveryStates = new Map();
const clientFilterCandidates = new Map();
const iframeRetryTimers = new Map();
const pendingLearnedNotifications = new Set();
let learnedNotificationTimer = null;
const learningQueues = new Map();
const directProbeInFlight = new Map();
const directProbeCache = new Map();
const routeRecoveryCooldowns = new Map();
const routeRecoveryTimers = new Map();
const probeWaiters = [];
let activeProbeCount = 0;

const AUTO_LEARN_ERROR_THRESHOLDS = Object.freeze({
  ERR_CONNECTION_RESET: { main: 2, embedded: 1 },
  ERR_CONNECTION_CLOSED: { main: 2, embedded: 1 },
  ERR_EMPTY_RESPONSE: { main: 3, embedded: 2 },
  ERR_NAME_NOT_RESOLVED: { main: 1, embedded: 1 },
  ERR_NAME_RESOLUTION_FAILED: { main: 1, embedded: 1 },
  ERR_DNS_TIMED_OUT: { main: 1, embedded: 1 },
  ERR_DNS_SERVER_FAILED: { main: 1, embedded: 1 },
  ERR_DNS_MALFORMED_RESPONSE: { main: 1, embedded: 1 },
  ERR_FAILED: { main: Number.MAX_SAFE_INTEGER, embedded: 2 }
});
const NON_ACTIONABLE_REQUEST_ERRORS = new Set([
  "net::ERR_ABORTED",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_BLOCKED_BY_ORB",
  "net::ERR_CACHE_MISS"
]);
const CRITICAL_CLIENT_FILTER_TYPES = new Set([
  "script",
  "shared_worker",
  "stylesheet",
  "websocket",
  "worker"
]);
const CLIENT_FILTER_WARNING_HOLD_MS = 15_000;
const CLIENT_FILTER_CANDIDATE_WINDOW_MS = 10_000;
const CLIENT_FILTER_WARNING_THRESHOLD = 2;
const CANDIDATE_WINDOW_MS = 30_000;
const DEBUG_LOG_LIMIT = 150;
const DEBUG_FLUSH_DELAY_MS = 150;
const DEBUG_BATCH_SIZE = 20;
const MAX_CONCURRENT_PROBES = 3;
const DIRECT_PROBE_CACHE_MS = 2_000;
const ROUTE_RECOVERY_SETTLE_MS = 3_000;
const ROUTE_RECOVERY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const ROUTE_RECOVERY_CONFIRM_DELAY_MS = 400;
const SAME_ORIGIN_ONLY_TYPES = new Set(["script", "stylesheet"]);
const RECOVERY_WINDOW_MS = 90_000;
const RECOVERY_SETTLE_DELAY_MS = 1_500;
const MAX_SETTLED_RECOVERY_RELOADS = 3;
const GATEWAY_RETRY_DELAYS_MS = Object.freeze([500, 1_500]);
let debugEnabledCache = null;
let debugBuffer = [];
let debugFlushTimer = null;
let debugWriteQueue = Promise.resolve();
let settingsMutationQueue = Promise.resolve();
let routingSnapshot = { enabled: false, learnedDomains: [] };
let routingSnapshotReady = null;

function queueSettingsMutation(task) {
  const current = settingsMutationQueue
    .catch(() => {})
    .then(task);
  settingsMutationQueue = current.catch(() => {});
  return current;
}

async function flushDebugBuffer() {
  if (debugFlushTimer) {
    clearTimeout(debugFlushTimer);
    debugFlushTimer = null;
  }
  if (debugBuffer.length === 0) return debugWriteQueue;
  const batch = debugBuffer.splice(0, debugBuffer.length);
  debugWriteQueue = debugWriteQueue.then(async () => {
    const { debugEnabled = false, debugLog = [] } = await chrome.storage.local.get({
      debugEnabled: false,
      debugLog: []
    });
    debugEnabledCache = Boolean(debugEnabled);
    if (!debugEnabledCache) return;
    await chrome.storage.local.set({
      debugLog: [...(Array.isArray(debugLog) ? debugLog : []), ...batch].slice(-DEBUG_LOG_LIMIT)
    });
  });
  return debugWriteQueue;
}

function appendDebug(event, data = {}) {
  const enqueue = async () => {
    if (debugEnabledCache === null) {
      const state = await chrome.storage.local.get({ debugEnabled: false });
      debugEnabledCache = Boolean(state.debugEnabled);
    }
    if (!debugEnabledCache) return;
    debugBuffer.push({ at: new Date().toISOString(), event, ...data });
    if (debugBuffer.length >= DEBUG_BATCH_SIZE) return flushDebugBuffer();
    if (!debugFlushTimer) {
      debugFlushTimer = setTimeout(() => {
        flushDebugBuffer().catch((error) =>
          console.debug("Otomatik Erişim debug kaydı yazılamadı", error));
      }, DEBUG_FLUSH_DELAY_MS);
    }
  };
  return enqueue().catch((error) =>
    console.debug("Otomatik Erişim debug kaydı hazırlanamadı", error));
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
  const candidate = String(host || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!candidate) return true;
  if (candidate === "localhost" || candidate.endsWith(".localhost") || candidate.endsWith(".local")) {
    return true;
  }
  if (candidate === "::" || candidate === "::1") return true;
  if (candidate.includes(":")) {
    return candidate.startsWith("fc") || candidate.startsWith("fd") ||
      candidate.startsWith("fe8") || candidate.startsWith("fe9") ||
      candidate.startsWith("fea") || candidate.startsWith("feb");
  }
  const parts = candidate.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function getSettings() {
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const ignoredDomains = normalizeDomains(saved.ignoredDomains);
  const learnedDomains = normalizeDomains(saved.learnedDomains)
    .filter((domain) => !isCovered(domain, ignoredDomains));
  const settings = {
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
  routingSnapshot = {
    enabled: settings.enabled,
    learnedDomains: settings.learnedDomains
  };
  return settings;
}

routingSnapshotReady = getSettings().catch((error) => {
  console.debug("Otomatik Erişim ayarları hazırlanamadı", error);
});

function buildPacScript(settings) {
  const learnedDomains = JSON.stringify(settings.learnedDomains);
  const proxy = `SOCKS5 ${settings.proxyHost}:${settings.proxyPort}`;

  return `
function FindProxyForURL(url, host) {
  host = host.toLowerCase().replace(/\\.$/, "");
  var learnedDomains = ${learnedDomains};
  var address = host.replace(/^\\[|\\]$/g, "");
  var ipv4 = address.split(".");
  var isPrivateIpv4 = false;
  if (ipv4.length === 4) {
    var first = parseInt(ipv4[0], 10);
    var second = parseInt(ipv4[1], 10);
    isPrivateIpv4 = first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  var isPrivateIpv6 = address.indexOf(":") !== -1 &&
    (address === "::" || address === "::1" ||
     shExpMatch(address, "fc*") || shExpMatch(address, "fd*") ||
     shExpMatch(address, "fe8*") || shExpMatch(address, "fe9*") ||
     shExpMatch(address, "fea*") || shExpMatch(address, "feb*"));

  if (isPlainHostName(host) ||
      host === "localhost" ||
      dnsDomainIs(host, ".localhost") ||
      dnsDomainIs(host, ".local") ||
      isPrivateIpv4 ||
      isPrivateIpv6) {
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

const BADGE_STATES = Object.freeze({
  disabled: { text: "×", color: "#64748b", titleKey: "badgeDisabled" },
  unavailable: { text: "", color: "#64748b", titleKey: "badgeUnavailable" },
  loading: { text: "", color: "#d97706", titleKey: "badgeChecking" },
  direct: { text: "", color: "#15803d", titleKey: "badgeDirect" },
  routed: { text: "↗", color: "#2563eb", titleKey: "badgeRouted" },
  learned: { text: "+", color: "#0891b2", titleKey: "badgeTargetLearned" },
  issue: { text: "?", color: "#d97706", titleKey: "badgeIssueContinues" },
  unreachable: { text: "!", color: "#dc2626", titleKey: "badgeUnreachable" },
  down: { text: "!", color: "#dc2626", titleKey: "badgeOutageLikely" },
  gatewayError: { text: "!", color: "#b91c1c", titleKey: "badgeGatewayError" }
});

async function setConnectionBadge(stateName, tabId = null) {
  const state = BADGE_STATES[stateName] || BADGE_STATES.direct;
  await chrome.action.setBadgeText(actionTarget(tabId, { text: state.text }));
  await chrome.action.setBadgeBackgroundColor(actionTarget(tabId, { color: state.color }));
  await chrome.action.setTitle(actionTarget(tabId, { title: t(state.titleKey) }));
}

function connectionStateForTab(settings, tabId) {
  if (!settings.enabled) return "disabled";
  if (!Number.isInteger(tabId)) return settings.lastProxyError ? "gatewayError" : "unavailable";
  const host = tabMainHosts.get(tabId);
  if (!host) return "unavailable";
  const routedHosts = tabRoutedHosts.get(tabId);
  const routedDependency = routedHosts && [...routedHosts]
    .some((routedHost) => isLearned(routedHost, settings.learnedDomains));
  if (settings.lastProxyError &&
      (isLearned(host, settings.learnedDomains) || routedDependency)) return "gatewayError";
  if (tabConnectionResults.get(tabId) === "failed") return "unreachable";
  if (isLearned(host, settings.learnedDomains) || routedDependency) return "routed";
  if (tabConnectionResults.get(tabId) === "loading") return "loading";
  if (tabConnectionResults.get(tabId) !== "success") return "unavailable";
  return "direct";
}

function markTabLoading(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabConnectionResults.set(tabId, "loading");
  tabRoutedHosts.delete(tabId);
}

async function trackCompletedRoute(details) {
  await routingSnapshotReady;
  if (!Number.isInteger(details.tabId) || details.tabId < 0 || !routingSnapshot.enabled) {
    return false;
  }
  const host = getRequestHost(details);
  if (!host || !isLearned(host, routingSnapshot.learnedDomains)) return false;
  const routedHosts = tabRoutedHosts.get(details.tabId) || new Set();
  const changed = !routedHosts.has(host);
  routedHosts.add(host);
  tabRoutedHosts.set(details.tabId, routedHosts);
  return changed;
}

function updateTabMainHost(tabId, url) {
  if (!Number.isInteger(tabId) || tabId < 0) return null;
  let host = null;
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) host = normalizeDomain(parsed.hostname);
  } catch {}
  if (host) tabMainHosts.set(tabId, host);
  else tabMainHosts.delete(tabId);
  return host;
}

async function refreshTrackedBadges(settings) {
  await setConnectionBadge(connectionStateForTab(settings, null));
  const tabIds = [...tabMainHosts.keys()];
  const results = await Promise.allSettled(tabIds.map((tabId) => {
    const issueType = tabIssues.get(tabId);
    if (issueType) return setIssueBadge(settings.enabled, issueType, tabId);
    return setConnectionBadge(connectionStateForTab(settings, tabId), tabId);
  }));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    tabMainHosts.delete(tabIds[index]);
    tabIssues.delete(tabIds[index]);
    tabConnectionResults.delete(tabIds[index]);
    tabRoutedHosts.delete(tabIds[index]);
  });
}

async function setIssueBadge(enabled, issueType, tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabIssues.set(tabId, issueType);
  const isDown = issueType === "globally_down";
  const isUnreachable = ["unreachable", "dns_unresolved", "gateway_unavailable"].includes(issueType);
  await setConnectionBadge(
    enabled ? (isDown ? "down" : (isUnreachable ? "unreachable" : "issue")) : "disabled",
    tabId
  );
}

async function clearTabIssue(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  tabIssues.delete(tabId);
  const settings = await getSettings();
  await setConnectionBadge(connectionStateForTab(settings, tabId), tabId);
}

async function refreshTabBadge(tabId) {
  if (typeof chrome.tabs?.get === "function") {
    try {
      const tab = await chrome.tabs.get(tabId);
      updateTabMainHost(tabId, tab?.url || "");
    } catch {}
  }
  const issueType = tabIssues.get(tabId);
  const settings = await getSettings();
  if (issueType) await setIssueBadge(settings.enabled, issueType, tabId);
  else await setConnectionBadge(connectionStateForTab(settings, tabId), tabId);
}

async function applyProxy(learnedDomainsOverride = null) {
  const settings = await getSettings();
  const effectiveSettings = Array.isArray(learnedDomainsOverride)
    ? { ...settings, learnedDomains: normalizeDomains(learnedDomainsOverride) }
    : settings;
  const updateBadges = !Array.isArray(learnedDomainsOverride);

  if (!effectiveSettings.enabled || effectiveSettings.learnedDomains.length === 0) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    if (updateBadges) await refreshTrackedBadges(effectiveSettings);
    return { ok: true, enabled: effectiveSettings.enabled };
  }

  const current = await chrome.proxy.settings.get({ incognito: false });
  if (["not_controllable", "controlled_by_other_extensions"].includes(current.levelOfControl)) {
    const message = t("proxyControlled");
    await chrome.storage.local.set({ lastProxyError: message });
    await setConnectionBadge("gatewayError");
    return { ok: false, enabled: true, error: message };
  }

  const config = {
    mode: "pac_script",
    pacScript: {
      data: buildPacScript(effectiveSettings),
      mandatory: true
    }
  };

  await chrome.proxy.settings.set({ value: config, scope: "regular" });
  await chrome.storage.local.set({ lastProxyError: null });
  if (updateBadges) await refreshTrackedBadges({ ...effectiveSettings, lastProxyError: null });
  return { ok: true, enabled: true };
}

async function saveSettingsUnlocked(patch) {
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

  debugEnabledCache = next.debugEnabled;
  if (!next.debugEnabled) {
    debugBuffer = [];
    if (debugFlushTimer) {
      clearTimeout(debugFlushTimer);
      debugFlushTimer = null;
    }
  }
  await chrome.storage.local.set(next);
  const result = await applyProxy();
  return { ...next, applyResult: result };
}

function saveSettings(patch) {
  return queueSettingsMutation(() => saveSettingsUnlocked(patch));
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
  if (details.tabId < 0 || !RETRYABLE_TYPES.has(details.type)) return false;
  const error = matchingError(details, RETRYABLE_ERRORS);
  if (!error) return false;
  return error !== "ERR_FAILED" || details.type === "websocket";
}

function matchingError(details, candidates) {
  return candidates.find((error) => String(details.error || "").includes(error)) || null;
}

function matchingGatewayConnectionError(details) {
  return matchingError(details, GATEWAY_CONNECTION_ERRORS);
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

function sanitizedProbeUrl(url) {
  const probeUrl = new URL(url);
  if (probeUrl.protocol === "ws:") probeUrl.protocol = "http:";
  if (probeUrl.protocol === "wss:") probeUrl.protocol = "https:";
  if (!["http:", "https:"].includes(probeUrl.protocol)) throw new Error(t("unsupportedProbe"));
  probeUrl.username = "";
  probeUrl.password = "";
  probeUrl.pathname = "/";
  probeUrl.search = "";
  probeUrl.hash = "";
  return probeUrl.toString();
}

async function acquireProbeSlot() {
  if (activeProbeCount < MAX_CONCURRENT_PROBES) {
    activeProbeCount += 1;
    return;
  }
  await new Promise((resolve) => probeWaiters.push(resolve));
  activeProbeCount += 1;
}

function releaseProbeSlot() {
  activeProbeCount = Math.max(0, activeProbeCount - 1);
  probeWaiters.shift()?.();
}

async function runDirectProbe(probeUrl) {
  await acquireProbeSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);
  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      headers: { Range: "bytes=0-0" },
      signal: controller.signal
    });
    controller.abort();
    return Boolean(response);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    releaseProbeSlot();
  }
}

function directRequestResponds(url) {
  let probeUrl;
  try {
    probeUrl = sanitizedProbeUrl(url);
  } catch {
    return Promise.resolve(false);
  }
  const now = Date.now();
  for (const [key, value] of directProbeCache) {
    if (now - value.at >= DIRECT_PROBE_CACHE_MS) directProbeCache.delete(key);
  }
  const cached = directProbeCache.get(probeUrl);
  if (cached) {
    return Promise.resolve(cached.reachable);
  }
  const existing = directProbeInFlight.get(probeUrl);
  if (existing) return existing;
  const request = runDirectProbe(probeUrl)
    .then((reachable) => {
      directProbeCache.set(probeUrl, { at: Date.now(), reachable });
      return reachable;
    })
    .finally(() => {
      if (directProbeInFlight.get(probeUrl) === request) directProbeInFlight.delete(probeUrl);
    });
  directProbeInFlight.set(probeUrl, request);
  return request;
}

async function verifyLearnedRouteStillNeeded(details) {
  const host = getRequestHost(details);
  if (!host || isLocalHost(host)) return { checked: false, reason: "invalid-host" };

  const settings = await getSettings();
  if (!settings.enabled || !isLearned(host, settings.learnedDomains)) {
    return { checked: false, reason: "not-routed" };
  }

  const aliases = new Set(mainHostAliases(host));
  const remainingDomains = settings.learnedDomains.filter((domain) => !aliases.has(domain));
  if (remainingDomains.length === settings.learnedDomains.length) {
    return { checked: false, reason: "not-routed" };
  }

  let probeUrl;
  try {
    probeUrl = sanitizedProbeUrl(details.url);
  } catch {
    return { checked: false, reason: "unsupported-url" };
  }

  await appendDebug("route-recovery-check-started", { host, tabId: details.tabId });
  const bypassApplied = await applyProxy(remainingDomains);
  if (!bypassApplied.ok) {
    await appendDebug("route-recovery-check-skipped", {
      host,
      tabId: details.tabId,
      reason: "proxy-unavailable"
    });
    return { checked: false, reason: "proxy-unavailable" };
  }

  let firstResponse = false;
  let secondResponse = false;
  try {
    firstResponse = await runDirectProbe(probeUrl);
    if (firstResponse) {
      await new Promise((resolve) => setTimeout(resolve, ROUTE_RECOVERY_CONFIRM_DELAY_MS));
      secondResponse = await runDirectProbe(probeUrl);
    }
  } finally {
    if (!(firstResponse && secondResponse)) await applyProxy();
  }

  if (!firstResponse || !secondResponse) {
    await appendDebug("route-recovery-check-failed", {
      host,
      tabId: details.tabId,
      firstResponse,
      secondResponse
    });
    return { checked: true, restored: false };
  }

  const latest = await getSettings();
  const learnedDomains = latest.learnedDomains.filter((domain) => !aliases.has(domain));
  const issueMatches = latest.lastIssueDomain && aliases.has(latest.lastIssueDomain);
  try {
    await chrome.storage.local.set({
      learnedDomains,
      lastDetectedDomain: latest.lastDetectedDomain && aliases.has(latest.lastDetectedDomain)
        ? null
        : latest.lastDetectedDomain,
      lastIssueType: issueMatches ? null : latest.lastIssueType,
      lastIssueDomain: issueMatches ? null : latest.lastIssueDomain,
      lastIssueError: issueMatches ? null : latest.lastIssueError,
      lastIssueAt: issueMatches ? null : latest.lastIssueAt,
      lastGlobalCheck: issueMatches ? null : latest.lastGlobalCheck,
      lastProxyError: null
    });
  } catch (error) {
    await applyProxy();
    throw error;
  }
  await appendDebug("route-recovered", {
    host,
    tabId: details.tabId,
    removedCount: latest.learnedDomains.length - learnedDomains.length,
    proxyApplied: true
  });
  await clearTabIssue(details.tabId);
  await refreshTrackedBadges(await getSettings());
  await notifyRecoveredDomain(host).catch(console.error);
  return { checked: true, restored: true, learnedDomains };
}

async function scheduleLearnedRouteRecovery(details) {
  const host = getRequestHost(details);
  if (!host || isLocalHost(host) || !Number.isInteger(details.tabId) || details.tabId < 0) return;
  const settings = await getSettings();
  if (!settings.enabled || !isLearned(host, settings.learnedDomains)) return;

  const routeKey = comparableMainHost(host);
  const now = Date.now();
  const lastCheck = routeRecoveryCooldowns.get(routeKey) || 0;
  if (now - lastCheck < ROUTE_RECOVERY_CHECK_INTERVAL_MS || routeRecoveryTimers.has(routeKey)) return;
  const timer = setTimeout(() => {
    routeRecoveryTimers.delete(routeKey);
    routeRecoveryCooldowns.set(routeKey, Date.now());
    queueSettingsMutation(() => verifyLearnedRouteStillNeeded(details)).catch(console.error);
  }, ROUTE_RECOVERY_SETTLE_MS);
  routeRecoveryTimers.set(routeKey, { timer, tabId: details.tabId });
}

function cancelRouteRecoveryForTab(tabId) {
  for (const [routeKey, pending] of routeRecoveryTimers) {
    if (pending.tabId !== tabId) continue;
    clearTimeout(pending.timer);
    routeRecoveryTimers.delete(routeKey);
  }
}

function enqueueHostTask(details, task) {
  const host = getRequestHost(details) || `tab-${details.tabId}`;
  const previous = learningQueues.get(host) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(task)
    .catch(console.error)
    .finally(() => {
      if (learningQueues.get(host) === current) learningQueues.delete(host);
    });
  learningQueues.set(host, current);
  return current;
}

function scheduleTabReload(tabId, delayMs = 1_500, scheduleReason = "main-route") {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const existing = reloadTimers.get(tabId);
  if (existing) {
    clearTimeout(existing.timer);
    appendDebug("reload-rescheduled", { tabId, delayMs, scheduleReason });
  } else {
    appendDebug("reload-scheduled", { tabId, delayMs, scheduleReason });
  }
  const timer = setTimeout(() => {
    reloadTimers.delete(tabId);
    if (scheduleReason === "main-route") {
      const recovery = tabRecoveryStates.get(tabId);
      if (recovery) recovery.rootReloadPending = false;
    }
    appendDebug("reload-fired", { tabId, scheduleReason });
    chrome.tabs.reload(tabId, { bypassCache: true })
      .then(() => appendDebug("reload-accepted", { tabId, scheduleReason }))
      .catch((error) => appendDebug("reload-failed", {
        tabId,
        scheduleReason,
        error: error.message
      }));
  }, delayMs);
  reloadTimers.set(tabId, { timer, scheduleReason });
}

function cancelTabReload(tabId, reason = "completed", expectedScheduleReason = null) {
  const scheduled = reloadTimers.get(tabId);
  if (!scheduled || (expectedScheduleReason && scheduled.scheduleReason !== expectedScheduleReason)) {
    return false;
  }
  clearTimeout(scheduled.timer);
  reloadTimers.delete(tabId);
  if (scheduled.scheduleReason === "main-route") {
    const recovery = tabRecoveryStates.get(tabId);
    if (recovery) recovery.rootReloadPending = false;
  }
  appendDebug("reload-cancelled", {
    tabId,
    reason,
    scheduleReason: scheduled.scheduleReason
  });
  return true;
}

function cancelGatewayRetry(tabId, reason = "completed", expectedHost = null) {
  const pending = gatewayRetryStates.get(tabId);
  if (!pending || (expectedHost && pending.host !== expectedHost)) return false;
  if (pending.timer) clearTimeout(pending.timer);
  gatewayRetryStates.delete(tabId);
  appendDebug("gateway-retry-cancelled", {
    tabId,
    host: pending.host,
    attempt: pending.attempt,
    reason
  });
  return true;
}

function scheduleGatewayRetry(details, host) {
  const tabId = details.tabId;
  if (!Number.isInteger(tabId) || tabId < 0 || !host) return false;

  const previous = gatewayRetryStates.get(tabId);
  if (previous && previous.host !== host) cancelGatewayRetry(tabId, "host-changed");
  const current = gatewayRetryStates.get(tabId);
  if (current?.timer) return true;
  const attempt = current?.attempt || 0;
  if (attempt >= GATEWAY_RETRY_DELAYS_MS.length) return false;

  const delayMs = GATEWAY_RETRY_DELAYS_MS[attempt];
  const retry = { host, attempt: attempt + 1, timer: null };
  retry.timer = setTimeout(async () => {
    retry.timer = null;
    try {
      const [tab, settings] = await Promise.all([chrome.tabs.get(tabId), getSettings()]);
      const activeHost = updateTabMainHost(tabId, tab?.url || "");
      if (activeHost !== host || !settings.enabled || !isLearned(host, settings.learnedDomains)) {
        cancelGatewayRetry(tabId, "route-changed", host);
        return;
      }
      await appendDebug("gateway-retry-fired", { tabId, host, attempt: retry.attempt });
      await chrome.tabs.reload(tabId, { bypassCache: true });
    } catch (error) {
      cancelGatewayRetry(tabId, "reload-failed", host);
      await appendDebug("gateway-retry-failed", {
        tabId,
        host,
        attempt: retry.attempt,
        error: error.message
      });
    }
  }, delayMs);
  gatewayRetryStates.set(tabId, retry);
  appendDebug("gateway-retry-scheduled", { tabId, host, attempt: retry.attempt, delayMs });
  return true;
}

async function recoverTransientGatewayFailure(details) {
  if (details.type !== "main_frame") return false;
  const error = matchingGatewayConnectionError(details);
  const host = getRequestHost(details);
  if (!error || !host) return false;

  const settings = await getSettings();
  if (!settings.enabled || !isLearned(host, settings.learnedDomains)) return false;
  const scheduled = scheduleGatewayRetry(details, host);
  await chrome.storage.local.set({
    lastProxyError: error,
    lastIssueType: scheduled ? "gateway_recovering" : "gateway_unavailable",
    lastIssueDomain: host,
    lastIssueError: error,
    lastIssueAt: new Date().toISOString(),
    lastGlobalCheck: null
  });
  await appendDebug("gateway-connection-failed", {
    tabId: details.tabId,
    host,
    error,
    retryScheduled: scheduled
  });
  await setIssueBadge(true, scheduled ? "gateway_recovering" : "gateway_unavailable", details.tabId);
  return true;
}

function comparableMainHost(host) {
  return String(host || "").replace(/^www\./, "");
}

function beginTabRecovery(tabId, mainHost, now = Date.now()) {
  if (!Number.isInteger(tabId) || tabId < 0 || !mainHost) return;
  tabRecoveryStates.set(tabId, {
    mainHost,
    expiresAt: now + RECOVERY_WINDOW_MS,
    rootReloadPending: true,
    settledReloads: 0
  });
}

function scheduleSettledRecoveryReload(details) {
  const tabId = details.tabId;
  const recovery = tabRecoveryStates.get(tabId);
  if (!recovery) return false;
  if (Date.now() > recovery.expiresAt) {
    tabRecoveryStates.delete(tabId);
    return false;
  }
  if (recovery.rootReloadPending) return false;
  if (Number.isInteger(details.frameId) && details.frameId !== 0) return false;

  const initiatorHost = details.initiator
    ? getRequestHost({ url: details.initiator })
    : null;
  if (!initiatorHost ||
      comparableMainHost(initiatorHost) !== comparableMainHost(recovery.mainHost)) {
    return false;
  }

  const existing = reloadTimers.get(tabId);
  if (existing?.scheduleReason !== "dependency-settled") {
    if (recovery.settledReloads >= MAX_SETTLED_RECOVERY_RELOADS) return false;
    recovery.settledReloads += 1;
  }
  scheduleTabReload(tabId, RECOVERY_SETTLE_DELAY_MS, "dependency-settled");
  return true;
}

function trackMainNavigation(details) {
  const recovery = tabRecoveryStates.get(details.tabId);
  if (!recovery) return;
  const host = getRequestHost(details);
  if (!host || comparableMainHost(host) !== comparableMainHost(recovery.mainHost)) {
    tabRecoveryStates.delete(details.tabId);
  }
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
      lastNotificationError: t("notificationPermissionDenied")
    });
    return { ok: false, error: t("notificationPermissionDenied") };
  }

  try {
    const createdId = await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: domains.length === 1 ? t("learnedOneTitle") : t("learnedManyTitle", String(domains.length)),
      message: domains.length === 1
        ? t("learnedOneMessage", domains[0])
        : `${domains.slice(0, 3).join(", ")}${
            domains.length > 3 ? t("moreTargets", String(domains.length - 3)) : ""
          }.`,
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
      lastNotificationError: error.message || t("notificationCreationFailed")
    });
    return { ok: false, error: error.message || t("notificationCreationFailed") };
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

async function notifyRecoveredDomain(domain) {
  const permission = typeof chrome.notifications.getPermissionLevel === "function"
    ? await chrome.notifications.getPermissionLevel()
    : "granted";
  if (permission !== "granted") {
    await chrome.storage.local.set({
      lastNotificationStatus: "denied",
      lastNotificationDomain: domain,
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: t("notificationPermissionDenied")
    });
    return { ok: false, error: t("notificationPermissionDenied") };
  }

  try {
    const createdId = await chrome.notifications.create(`restored:${Date.now()}`, {
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: t("routeRestoredTitle"),
      message: t("routeRestoredMessage", domain),
      priority: 1
    });
    await chrome.storage.local.set({
      lastNotificationStatus: "created",
      lastNotificationDomain: domain,
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: null
    });
    return { ok: true, id: createdId };
  } catch (error) {
    const message = error.message || t("notificationCreationFailed");
    await chrome.storage.local.set({
      lastNotificationStatus: "failed",
      lastNotificationDomain: domain,
      lastNotificationAt: new Date().toISOString(),
      lastNotificationError: message
    });
    return { ok: false, error: message };
  }
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
  if (permission !== "granted") return { ok: false, error: t("notificationPermissionDenied") };
  const id = `test:${Date.now()}`;
  try {
    const createdId = await chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "assets/icon-128.png",
      title: t("notificationTestTitle"),
      message: t("notificationTestMessage"),
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
      warning: t("notificationAcceptedWarning")
    };
  } catch (error) {
    const message = error.message || t("notificationCreationFailed");
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
    title: t("outageLikely"),
    message: t("outageNotificationMessage", domain)
  });
}

function getRequestHost(details) {
  try {
    return normalizeDomain(new URL(details.url).hostname);
  } catch {
    return null;
  }
}

async function recordCriticalClientFilter(details) {
  if (!CRITICAL_CLIENT_FILTER_TYPES.has(details.type)) return;
  const host = getRequestHost(details);
  const initiatorHost = details.initiator
    ? getRequestHost({ url: details.initiator })
    : null;
  if (!host || !initiatorHost || host !== initiatorHost) return;
  if (tabIssues.get(details.tabId) === "client_filter_blocked") return;

  const settings = await getSettings();
  if (!settings.enabled) return;
  const now = Date.now();
  const previous = clientFilterCandidates.get(details.tabId);
  const candidate = previous && previous.host === host && now - previous.at <= CLIENT_FILTER_CANDIDATE_WINDOW_MS
    ? { host, at: now, count: previous.count + 1 }
    : { host, at: now, count: 1 };
  clientFilterCandidates.set(details.tabId, candidate);
  await appendDebug("client-filter-candidate", {
    tabId: details.tabId,
    requestType: details.type,
    count: candidate.count,
    required: CLIENT_FILTER_WARNING_THRESHOLD
  });
  if (candidate.count < CLIENT_FILTER_WARNING_THRESHOLD) return;
  clientFilterCandidates.delete(details.tabId);
  await chrome.storage.local.set({
    lastIssueType: "client_filter_blocked",
    lastIssueDomain: initiatorHost,
    lastIssueError: "ERR_BLOCKED_BY_CLIENT",
    lastIssueAt: new Date().toISOString(),
    lastGlobalCheck: null
  });
  await appendDebug("client-filter-blocked-critical", {
    tabId: details.tabId,
    requestType: details.type
  });
  await setIssueBadge(true, "client_filter_blocked", details.tabId);
}

function commitLearnedRoute(host, details, error) {
  return queueSettingsMutation(async () => {
    const latest = await getSettings();
    if (!latest.enabled || isLocalHost(host) || isCovered(host, latest.ignoredDomains)) {
      return { added: false, skipped: true, learnedDomains: latest.learnedDomains };
    }
    if (isLearned(host, latest.learnedDomains)) {
      return { added: false, skipped: false, learnedDomains: latest.learnedDomains };
    }

    const learnedDomains = normalizeDomains([
      ...latest.learnedDomains,
      ...mainHostAliases(host, details.type)
    ]);
    const now = Date.now();
    await chrome.storage.local.set({
      learnedDomains,
      lastDetectedDomain: host,
      lastDetectedAt: new Date(now).toISOString(),
      lastProxyError: null,
      lastIssueType: details.type === "main_frame" ? "route_learned" : latest.lastIssueType,
      lastIssueDomain: details.type === "main_frame" ? host : latest.lastIssueDomain,
      lastIssueError: details.type === "main_frame" ? error : latest.lastIssueError,
      lastIssueAt: details.type === "main_frame" ? new Date(now).toISOString() : latest.lastIssueAt,
      lastGlobalCheck: details.type === "main_frame" ? null : latest.lastGlobalCheck
    });
    const applied = await applyProxy();
    return { added: true, skipped: false, learnedDomains, now, applied };
  });
}

async function learnAndRetry(details) {
  if (!isRetryableError(details)) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const host = getRequestHost(details);
  const error = matchingError(details, RETRYABLE_ERRORS);
  const initiatorHost = details.initiator
    ? getRequestHost({ url: details.initiator })
    : null;
  const mainHost = tabMainHosts.get(details.tabId) || null;
  const hasLearnedContext = [initiatorHost, mainHost]
    .some((contextHost) => contextHost && isLearned(contextHost, settings.learnedDomains));

  if (!host || isLocalHost(host) || isCovered(host, settings.ignoredDomains)) return;
  if (DNS_RESOLUTION_ERRORS.has(error) &&
      !["main_frame", "sub_frame"].includes(details.type) &&
      !hasLearnedContext) return;
  if (SAME_ORIGIN_ONLY_TYPES.has(details.type)) {
    const routedDependencyDnsFailure = DNS_RESOLUTION_ERRORS.has(error) && hasLearnedContext;
    if ((!initiatorHost || initiatorHost !== host) && !routedDependencyDnsFailure) return;
  }

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
  if (!candidate.ready) {
    if (details.type === "main_frame") {
      await setIssueBadge(settings.enabled, "detecting", details.tabId);
    }
    return;
  }

  const repeatedMainReset = details.type === "main_frame" &&
    ["ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED"].includes(error) &&
    candidate.count >= candidate.required;
  const repeatedEmbeddedReset = details.type !== "main_frame" &&
    ["ERR_CONNECTION_RESET", "ERR_CONNECTION_CLOSED"].includes(error) &&
    candidate.count >= 2;
  const repeatedWebSocketFailure = details.type === "websocket" &&
    error === "ERR_FAILED" &&
    candidate.count >= candidate.required;
  const repeatedReset = repeatedMainReset || repeatedEmbeddedReset || repeatedWebSocketFailure;
  // An HTTP origin probe cannot validate a failed WebSocket handshake. Once
  // the bounded repeated-failure threshold is met, waiting for that unrelated
  // probe only delays applying the route.
  const directlyReachable = repeatedWebSocketFailure
    ? false
    : await directRequestResponds(details.url);
  await appendDebug("direct-check", {
    tabId: details.tabId,
    host,
    requestType: details.type,
    reachable: directlyReachable,
    skippedForRepeatedWebSocket: repeatedWebSocketFailure,
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

  const committed = await commitLearnedRoute(host, details, error);
  if (committed.skipped || !committed.added) return;
  const { learnedDomains, now, applied } = committed;
  await appendDebug("learned", {
    tabId: details.tabId,
    host,
    requestType: details.type,
    learnedDomains,
    proxyApplied: applied.ok,
    proxyError: applied.error || null
  });
  if (!applied.ok) return;
  await setConnectionBadge("learned", details.tabId);
  await notifyLearnedDomain(host).catch(console.error);
  retryLearnedIframe(details, host);
  scheduleInitiatorIframeRetry(details, learnedDomains);

  // Normal gezinmede gömülü hedefler sayfayı yenilemez. Ancak ana hedef için
  // otomatik kurtarma başlatılmışsa, ilk yeniden yüklemede keşfedilen bağımlılıkları
  // kısa bir sakinleşme penceresinde toplar ve sınırlı bir ek deneme yapar.
  if (details.type !== "main_frame") {
    scheduleSettledRecoveryReload(details);
    return;
  }

  const retryKey = `${details.tabId}:main:${host}`;
  const lastRetry = retryCooldowns.get(retryKey) || 0;
  if (now - lastRetry < 60_000) return;
  retryCooldowns.set(retryKey, now);

  beginTabRecovery(details.tabId, host, now);
  scheduleTabReload(details.tabId, 1_500, "main-route");
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
  if (!domain || isLocalHost(domain)) throw new Error(t("invalidPublicDomain"));

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
      ? t("globalRateLimited")
      : t("globalStartFailed"));
  }

  const created = await createdResponse.json();
  if (!created?.id) throw new Error(t("globalNoId"));

  let measurement = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const resultResponse = await fetch(`https://api.globalping.io/v1/measurements/${created.id}`, {
      headers: { "Accept": "application/json" }
    });
    if (!resultResponse.ok) throw new Error(t("globalReadFailed"));
    measurement = await resultResponse.json();
    if (measurement.status !== "in-progress") break;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  if (!measurement || measurement.status === "in-progress") {
    throw new Error(t("globalTimedOut"));
  }

  const summary = summarizeGlobalMeasurement(domain, measurement);
  await chrome.storage.local.set({ lastGlobalCheck: summary });
  let settings = await getSettings();
  if (summary.status === "likely_down") {
    const aliases = new Set(mainHostAliases(domain));
    const learnedDomains = settings.learnedDomains.filter((host) => !aliases.has(host));
    const removedCount = settings.learnedDomains.length - learnedDomains.length;
    if (removedCount > 0) {
      const wasLastDetected = aliases.has(settings.lastDetectedDomain);
      settings = await saveSettings({ learnedDomains });
      if (wasLastDetected) {
        await chrome.storage.local.set({ lastDetectedDomain: null, lastDetectedAt: null });
        settings = { ...settings, lastDetectedDomain: null, lastDetectedAt: null };
      }
      await appendDebug("globally-down-route-removed", {
        tabId,
        domain,
        removedCount
      });
    }
    await setIssueBadge(settings.enabled, "globally_down", tabId);
    await notifyLikelyGlobalOutage(domain).catch(console.error);
  } else {
    if (settings.lastIssueDomain === domain) {
      await chrome.storage.local.set({
        lastIssueType: null,
        lastIssueDomain: null,
        lastIssueError: null,
        lastIssueAt: null
      });
    }
    if (Number.isInteger(tabId) && tabId >= 0) await clearTabIssue(tabId);
  }
  return summary;
}

async function clearIssueAfterSuccess(details) {
  if (details.tabId < 0 || details.type !== "main_frame") return;
  const host = getRequestHost(details);
  let settings = await getSettings();
  if (host && isLearned(host, settings.learnedDomains) && settings.lastProxyError) {
    await chrome.storage.local.set({ lastProxyError: null });
    settings = { ...settings, lastProxyError: null };
  }
  const issueTime = Date.parse(settings.lastIssueAt || "");
  const recentClientFilterIssue =
    host &&
    settings.lastIssueType === "client_filter_blocked" &&
    settings.lastIssueDomain === host &&
    Number.isFinite(issueTime) &&
    Date.now() - issueTime < CLIENT_FILTER_WARNING_HOLD_MS;

  if (recentClientFilterIssue) {
    await setIssueBadge(settings.enabled, "client_filter_blocked", details.tabId);
    return;
  }

  await clearTabIssue(details.tabId);
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
  debugEnabledCache = Boolean(existing.debugEnabled);
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
  const message = details?.error || t("localProxyFailed");
  await chrome.storage.local.set({ lastProxyError: message });
  await appendDebug("proxy-error", { error: message });
  const settings = await getSettings();
  await refreshTrackedBadges({ ...settings, lastProxyError: message });
});

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.type === "main_frame" && !NON_ACTIONABLE_REQUEST_ERRORS.has(String(details.error || ""))) {
      updateTabMainHost(details.tabId, details.url);
      tabConnectionResults.set(details.tabId, "failed");
    }
    if (details.error === "net::ERR_BLOCKED_BY_CLIENT") {
      return enqueueHostTask(details, () => recordCriticalClientFilter(details));
    }
    if (NON_ACTIONABLE_REQUEST_ERRORS.has(String(details.error || ""))) return;
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
    return enqueueHostTask(details, async () => {
      if (await recoverTransientGatewayFailure(details)) return;
      if (details.type === "main_frame") {
        const settings = await getSettings();
        await setIssueBadge(settings.enabled, "unreachable", details.tabId);
      }
      return learnAndRetry(details);
    });
  },
  { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }
);

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const routeChanged = await trackCompletedRoute(details);
    if (details.type !== "main_frame") {
      if (routeChanged) return refreshTabBadge(details.tabId).catch(console.error);
      return;
    }
    updateTabMainHost(details.tabId, details.url);
    tabConnectionResults.set(details.tabId, "success");
    clientFilterCandidates.delete(details.tabId);
    cancelGatewayRetry(details.tabId, "main-completed", getRequestHost(details));
    cancelTabReload(
      details.tabId,
      "main-completed",
      "main-route"
    );
    // The main document can complete before its scheduled route reload while
    // late dependencies are still being discovered. Keep the bounded recovery
    // window alive so a learned dependency can trigger one settled reload.
    const debugWrite = appendDebug("main-completed", {
      tabId: details.tabId,
      host: getRequestHost(details),
      statusCode: details.statusCode || null,
      fromCache: Boolean(details.fromCache)
    });
    const clearIssue = clearIssueAfterSuccess(details).catch(console.error);
    // A live recovery probe must not temporarily alter the browser-wide proxy
    // configuration while the completed page is still loading subresources.
    return Promise.all([debugWrite, clearIssue]);
  },
  { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    clientFilterCandidates.delete(details.tabId);
    const retry = gatewayRetryStates.get(details.tabId);
    const nextHost = getRequestHost(details);
    if (retry && retry.host !== nextHost) cancelGatewayRetry(details.tabId, "navigation-changed");
    updateTabMainHost(details.tabId, details.url);
    markTabLoading(details.tabId);
    cancelRouteRecoveryForTab(details.tabId);
    trackMainNavigation(details);
    return clearTabIssue(details.tabId).catch(console.error);
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshTabBadge(tabId).catch(console.error);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo?.url || tab?.url;
  if (url) updateTabMainHost(tabId, url);
  if (changeInfo?.status === "loading") markTabLoading(tabId);
  if (!url && !changeInfo?.status) return;
  refreshTabBadge(tabId).catch(console.error);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cancelRouteRecoveryForTab(tabId);
  cancelGatewayRetry(tabId, "tab-removed");
  tabIssues.delete(tabId);
  tabMainHosts.delete(tabId);
  tabConnectionResults.delete(tabId);
  tabRoutedHosts.delete(tabId);
  tabRecoveryStates.delete(tabId);
  clientFilterCandidates.delete(tabId);
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
      case "reloadTabBypassCache": {
        const tabId = Number.isInteger(message.tabId) ? message.tabId : _sender.tab?.id;
        if (!Number.isInteger(tabId) || tabId < 0) {
          throw new Error(t("tabNotFound"));
        }
        await chrome.storage.local.set({
          lastIssueType: null,
          lastIssueDomain: null,
          lastIssueError: null,
          lastIssueAt: null,
          lastGlobalCheck: null
        });
        await clearTabIssue(tabId);
        await chrome.tabs.reload(tabId, { bypassCache: true });
        return { ok: true };
      }
      case "testNotification":
        return { ok: true, result: await sendTestNotification() };
      case "clearDebugLog":
        debugBuffer = [];
        if (debugFlushTimer) {
          clearTimeout(debugFlushTimer);
          debugFlushTimer = null;
        }
        await debugWriteQueue;
        await chrome.storage.local.set({ debugLog: [] });
        return { ok: true };
      default:
        return { ok: false, error: t("unknownRequest") };
    }
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
