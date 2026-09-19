const elements = {
  enabled: document.querySelector("#enabled"),
  statusCard: document.querySelector("#statusCard"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  currentDomain: document.querySelector("#currentDomain"),
  siteAction: document.querySelector("#siteAction"),
  tabRouted: document.querySelector("#tabRouted"),
  tabIgnored: document.querySelector("#tabIgnored"),
  domainList: document.querySelector("#domainList"),
  domainCount: document.querySelector("#domainCount"),
  ignoredList: document.querySelector("#ignoredList"),
  ignoredCount: document.querySelector("#ignoredCount"),
  proxyPort: document.querySelector("#proxyPort"),
  notice: document.querySelector("#notice"),
  retry: document.querySelector("#retry"),
  appVersion: document.querySelector("#appVersion"),
  diagnosticCard: document.querySelector("#diagnosticCard"),
  diagnosticTitle: document.querySelector("#diagnosticTitle"),
  diagnosticText: document.querySelector("#diagnosticText"),
  checkStatus: document.querySelector("#checkStatus"),
  diagnosticPrivacy: document.querySelector("#diagnosticPrivacy"),
  testNotification: document.querySelector("#testNotification"),
  debugEnabled: document.querySelector("#debugEnabled"),
  debugControls: document.querySelector("#debugControls"),
  debugLog: document.querySelector("#debugLog"),
  copyDebugLog: document.querySelector("#copyDebugLog"),
  clearDebugLog: document.querySelector("#clearDebugLog")
};

const EXPECTED_SCHEMA_VERSION = 8;

let currentHost = null;
let currentTabId = null;
let currentState = null;
let protocolReady = true;
let saving = false;
let checkingGlobalStatus = false;
let learnedDomains = [];
let ignoredDomains = [];
let activeList = "routed";

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

function isCovered(host, domains) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isLearned(host, domains) {
  return domains.includes(host);
}

function withoutCover(domains, host) {
  return domains.filter((domain) => !(host === domain || host.endsWith(`.${domain}`)));
}

// Icon-only row action. The label is both the tooltip and the accessible name,
// which is what lets the list drop the paragraphs that used to explain each
// glyph underneath it.
function iconButton(glyph, label, className, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = glyph;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function domainRow(domain, actions) {
  const row = document.createElement("div");
  row.className = "row";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = domain;
  name.title = domain;
  row.append(name, ...actions);
  return row;
}

function emptyState(message) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = message;
  return empty;
}

function renderDomainList() {
  elements.domainList.replaceChildren();
  elements.domainCount.textContent = String(learnedDomains.length);

  if (learnedDomains.length === 0) {
    elements.domainList.append(emptyState(t("noLearnedTargets")));
    return;
  }

  for (const domain of learnedDomains) {
    elements.domainList.append(domainRow(domain, [
      iconButton("⊘", t("ignoreDomain", domain), "icon-btn", () => {
        save({
          learnedDomains: learnedDomains.filter((value) => value !== domain),
          ignoredDomains: [...ignoredDomains, domain]
        });
      }),
      iconButton("×", t("removeDomain", domain), "icon-btn danger", () => {
        save({ learnedDomains: learnedDomains.filter((value) => value !== domain) });
      })
    ]));
  }
}

function renderIgnoredList() {
  elements.ignoredList.replaceChildren();
  elements.ignoredCount.textContent = String(ignoredDomains.length);

  if (ignoredDomains.length === 0) {
    elements.ignoredList.append(emptyState(t("noIgnoredTargets")));
    return;
  }

  for (const domain of ignoredDomains) {
    elements.ignoredList.append(domainRow(domain, [
      iconButton("↩", t("restoreDomain", domain), "icon-btn", () => {
        save({ ignoredDomains: ignoredDomains.filter((value) => value !== domain) });
      })
    ]));
  }
}

function setActiveList(name) {
  activeList = name;
  const routed = name === "routed";
  elements.tabRouted.classList.toggle("is-active", routed);
  elements.tabIgnored.classList.toggle("is-active", !routed);
  elements.tabRouted.setAttribute("aria-selected", String(routed));
  elements.tabIgnored.setAttribute("aria-selected", String(!routed));
  elements.domainList.hidden = !routed;
  elements.ignoredList.hidden = routed;
}

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
  elements.notice.hidden = !message;
}

// The card describes the tab this popup was opened over, so the branches run
// from the conditions that make the whole extension unusable down to the ones
// that only concern this one host.
function describeTab(state, { versionMismatch, hasControlError, hasGatewayError, learned, ignored }) {
  if (versionMismatch) {
    return { tone: "is-error", title: t("reloadRequired"), detail: t("reloadInstruction") };
  }
  if (hasControlError) {
    return { tone: "is-error", title: t("gatewayUnavailable"), detail: t("proxyControlled") };
  }
  if (hasGatewayError) {
    return { tone: "is-error", title: t("gatewayUnavailable"), detail: state.lastProxyError };
  }
  if (!state.enabled) {
    return { tone: "is-off", title: t("accessDisabled"), detail: t("directMode") };
  }
  if (ignored) {
    return { tone: "is-off", title: t("stateIgnored"), detail: t("stateIgnoredDetail") };
  }
  if (learned) {
    return { tone: "is-on", title: t("stateRouted"), detail: t("stateRoutedDetail") };
  }
  return {
    tone: "is-on",
    title: t("detectionEnabled"),
    detail: state.lastDetectedDomain
      ? t("learnedSummary", [String(learnedDomains.length), state.lastDetectedDomain])
      : t("detectionWaiting")
  };
}

function render(state) {
  currentState = state;
  learnedDomains = Array.isArray(state.learnedDomains) ? [...state.learnedDomains] : [];
  ignoredDomains = Array.isArray(state.ignoredDomains) ? [...state.ignoredDomains] : [];
  const versionMismatch = state.schemaVersion !== EXPECTED_SCHEMA_VERSION;
  protocolReady = !versionMismatch;
  elements.enabled.checked = state.enabled;
  elements.enabled.disabled = versionMismatch;
  elements.siteAction.disabled = versionMismatch || !currentHost;
  elements.retry.disabled = versionMismatch;
  renderDomainList();
  renderIgnoredList();
  setActiveList(activeList);
  elements.proxyPort.textContent = `${state.proxyHost || "127.0.0.1"}:${state.proxyPort}`;
  elements.debugEnabled.checked = Boolean(state.debugEnabled);
  elements.debugControls.hidden = !state.debugEnabled;
  elements.debugLog.textContent = Array.isArray(state.debugLog) && state.debugLog.length
    ? state.debugLog.map((entry) => JSON.stringify(entry)).join("\n")
    : t("noLogs");

  const hasControlError = ["not_controllable", "controlled_by_other_extensions"]
    .includes(state.levelOfControl);
  const learned = Boolean(currentHost && isLearned(currentHost, learnedDomains));
  const ignored = Boolean(currentHost && isCovered(currentHost, ignoredDomains));
  const hasGatewayError = Boolean(state.lastProxyError && learned);

  const tab = describeTab(state, {
    versionMismatch,
    hasControlError,
    hasGatewayError,
    learned,
    ignored
  });
  elements.statusCard.className = `tab-card ${tab.tone}`;
  elements.statusTitle.textContent = tab.title;
  elements.statusText.textContent = tab.detail;

  if (versionMismatch) {
    showNotice(t("backgroundOutdated"), true);
    return;
  }

  updateSiteAction();
  renderDiagnostic(state);
  if (["denied", "failed"].includes(state.lastNotificationStatus)) {
    showNotice(
      t("notificationFailed", state.lastNotificationError || t("notificationSettingsHint")),
      true
    );
  }
}

function renderDiagnostic(state) {
  const issueMatches = Boolean(currentHost && state.lastIssueDomain === currentHost);
  const globalCheck = state.lastGlobalCheck?.domain === currentHost ? state.lastGlobalCheck : null;
  elements.diagnosticCard.hidden = !issueMatches && !globalCheck;
  if (elements.diagnosticCard.hidden) return;

  elements.diagnosticCard.className = "diag";
  elements.checkStatus.hidden = false;
  elements.checkStatus.disabled = checkingGlobalStatus;
  elements.checkStatus.textContent = checkingGlobalStatus ? t("checkingContinents") : t("checkGlobalStatus");
  elements.diagnosticPrivacy.hidden = false;

  if (globalCheck) {
    const locationText = t("locationsResponded", [String(globalCheck.reachable), String(globalCheck.total || 3)]);
    if (globalCheck.status === "online") {
      elements.diagnosticCard.classList.add("is-online");
      elements.diagnosticTitle.textContent = t("siteOnline");
      elements.diagnosticText.textContent = t("siteOnlineDetail", locationText);
    } else if (globalCheck.status === "likely_down") {
      elements.diagnosticCard.classList.add("is-down");
      elements.diagnosticTitle.textContent = t("outageLikely");
      elements.diagnosticText.textContent = t("outageLikelyDetail");
    } else if (globalCheck.status === "regional") {
      elements.diagnosticTitle.textContent = t("regionalIssue");
      elements.diagnosticText.textContent = t("regionalIssueDetail", locationText);
    } else {
      elements.diagnosticTitle.textContent = t("statusInconclusive");
      elements.diagnosticText.textContent = t("statusInconclusiveDetail");
    }
    return;
  }

  if (state.lastIssueType === "client_filter_blocked") {
    elements.checkStatus.textContent = t("reloadWithoutCache");
    elements.diagnosticPrivacy.hidden = true;
    elements.diagnosticTitle.textContent = t("clientFilterTitle");
    elements.diagnosticText.textContent = t("clientFilterDetail");
  } else if (state.lastIssueType === "gateway_recovering") {
    elements.checkStatus.hidden = true;
    elements.diagnosticPrivacy.hidden = true;
    elements.diagnosticTitle.textContent = t("gatewayRecoveringTitle");
    elements.diagnosticText.textContent = t("gatewayRecoveringDetail");
  } else if (state.lastIssueType === "gateway_unavailable") {
    elements.diagnosticTitle.textContent = t("gatewayUnavailable");
    elements.diagnosticText.textContent = t("gatewayUnavailableDetail");
  } else if (state.lastIssueType === "route_failed") {
    elements.diagnosticTitle.textContent = t("routeFailedTitle");
    elements.diagnosticText.textContent = t("routeFailedDetail");
  } else if (state.lastIssueType === "transient_reachable") {
    elements.diagnosticTitle.textContent = t("transientTitle");
    elements.diagnosticText.textContent = t("transientDetail");
  } else if (state.lastIssueType === "transient_unverified") {
    elements.diagnosticTitle.textContent = t("unverifiedTitle");
    elements.diagnosticText.textContent = t("unverifiedDetail");
  } else if (state.lastIssueType === "slow_loading") {
    elements.diagnosticTitle.textContent = t("slowLoadingTitle");
    elements.diagnosticText.textContent = t("slowLoadingDetail");
  } else {
    elements.diagnosticTitle.textContent = t("alternativeTitle");
    elements.diagnosticText.textContent = t("alternativeDetail");
  }
}

function updateSiteAction() {
  if (!currentHost) {
    // Nothing to act on, but the label is still read out, so it must not keep
    // advertising an action for whichever host was open last.
    elements.siteAction.textContent = t("routeNow");
    elements.siteAction.dataset.mode = "none";
    return;
  }
  const learned = isLearned(currentHost, learnedDomains);
  const ignored = isCovered(currentHost, ignoredDomains);
  elements.siteAction.textContent = ignored ? t("stopIgnoring") : learned ? t("removeFromList") : t("routeNow");
  elements.siteAction.dataset.mode = ignored ? "unignore" : learned ? "remove" : "add";
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || t("operationFailed"));
  return response;
}

async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = Number.isInteger(tab?.id) ? tab.id : null;
  currentHost = null;
  for (const rawUrl of [tab?.pendingUrl, tab?.url]) {
    if (!rawUrl) continue;
    try {
      const url = new URL(rawUrl);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      currentHost = normalizeDomain(url.hostname);
      if (currentHost) break;
    } catch {}
  }

  if (!currentHost && Number.isInteger(currentTabId)) {
    try {
      const context = await sendMessage({ type: "getTabContext", tabId: currentTabId });
      currentHost = normalizeDomain(context.host);
    } catch {}
  }

  elements.currentDomain.textContent = currentHost || t("pageUnavailable");
  // The host ellipsises, and the list rows already carry the full value in a
  // title, so a long host should not be the one place it is unreadable.
  elements.currentDomain.title = currentHost || "";
  elements.siteAction.disabled = !currentHost;
}

function setBusy(busy) {
  saving = busy;
  elements.siteAction.disabled = busy || !protocolReady || !currentHost;
  elements.retry.disabled = busy || !protocolReady;
  elements.enabled.disabled = busy || !protocolReady;
}

async function save(patch = {}) {
  if (!protocolReady) {
    showNotice(t("refreshBeforeContinue"), true);
    return;
  }
  setBusy(true);
  showNotice("");

  try {
    const nextDomains = patch.learnedDomains === undefined
      ? learnedDomains
      : [...new Set(patch.learnedDomains.map(normalizeDomain).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const nextIgnoredDomains = patch.ignoredDomains === undefined
      ? ignoredDomains
      : [...new Set(patch.ignoredDomains.map(normalizeDomain).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const response = await sendMessage({
      type: "saveSettings",
      patch: {
        ...patch,
        learnedDomains: nextDomains,
        ignoredDomains: nextIgnoredDomains
      }
    });
    const stateResponse = await sendMessage({ type: "getState" });
    render(stateResponse.state);

    if (response.state.applyResult?.ok === false) {
      showNotice(response.state.applyResult.error, true);
    } else if (elements.notice.hidden) {
      // render() leaves a standing problem in the notice, such as a refused
      // notification permission. Overwriting it with the success line would
      // swallow that warning on every change the user makes.
      showNotice(t("settingsApplied"));
    }
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    setBusy(false);
  }
}

elements.enabled.addEventListener("change", () => {
  save({ enabled: elements.enabled.checked });
});

// The background learns targets on its own while the popup is open, and the
// popup used to show whatever it read when it opened. These are the stored keys
// that change what it renders; debugLog is left out because it is written in
// batches every few hundred milliseconds and sits behind Advanced anyway.
const LIVE_KEYS = [
  "enabled",
  "learnedDomains",
  "ignoredDomains",
  "lastDetectedDomain",
  "lastProxyError",
  "lastIssueType",
  "lastIssueDomain",
  "lastGlobalCheck",
  "lastNotificationStatus",
  "debugEnabled"
];

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  // A save of our own already re-renders, and a global check renders when it
  // settles; reacting again would fight whichever is in flight.
  if (areaName !== "local" || saving || checkingGlobalStatus) return;
  if (!LIVE_KEYS.some((key) => Object.hasOwn(changes, key))) return;
  sendMessage({ type: "getState" })
    .then((response) => render(response.state))
    .catch(() => {});
});

elements.tabRouted.addEventListener("click", () => setActiveList("routed"));
elements.tabIgnored.addEventListener("click", () => setActiveList("ignored"));

elements.siteAction.addEventListener("click", () => {
  if (!currentHost) return;

  if (elements.siteAction.dataset.mode === "unignore") {
    save({ ignoredDomains: withoutCover(ignoredDomains, currentHost) });
    return;
  }

  const nextDomains = elements.siteAction.dataset.mode === "remove"
    ? learnedDomains.filter((domain) => domain !== currentHost)
    : [...learnedDomains, currentHost];

  save({
    learnedDomains: nextDomains,
    ignoredDomains: withoutCover(ignoredDomains, currentHost)
  });
});

elements.retry.addEventListener("click", async () => {
  showNotice("");
  try {
    const response = await sendMessage({ type: "reapply" });
    render(response.state);
    showNotice(
      response.result.ok ? t("ruleReapplied") : response.result.error,
      !response.result.ok
    );
  } catch (error) {
    showNotice(error.message, true);
  }
});

elements.copyDebugLog.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.debugLog.textContent);
    showNotice(t("logCopied"));
  } catch (error) {
    showNotice(t("logCopyFailed", error.message), true);
  }
});

elements.debugEnabled.addEventListener("change", () => {
  save({ debugEnabled: elements.debugEnabled.checked });
});

elements.clearDebugLog.addEventListener("click", async () => {
  try {
    await sendMessage({ type: "clearDebugLog" });
    elements.debugLog.textContent = t("noLogs");
    showNotice(t("logCleared"));
  } catch (error) {
    showNotice(error.message, true);
  }
});

elements.testNotification.addEventListener("click", async () => {
  showNotice("");
  elements.testNotification.disabled = true;
  try {
    const response = await sendMessage({ type: "testNotification" });
    showNotice(
      response.result.ok
        ? response.result.warning || t("testNotificationSent")
        : response.result.error,
      !response.result.ok
    );
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    elements.testNotification.disabled = false;
  }
});

elements.checkStatus.addEventListener("click", async () => {
  if (!currentHost || checkingGlobalStatus) return;
  if (currentState?.lastIssueType === "client_filter_blocked" && currentState.lastIssueDomain === currentHost) {
    elements.checkStatus.disabled = true;
    showNotice("");
    try {
      await sendMessage({ type: "reloadTabBypassCache", tabId: currentTabId });
      window.close();
    } catch (error) {
      showNotice(error.message, true);
      elements.checkStatus.disabled = false;
    }
    return;
  }
  checkingGlobalStatus = true;
  renderDiagnostic(currentState);
  showNotice("");
  try {
    await sendMessage({ type: "checkGlobalStatus", domain: currentHost, tabId: currentTabId });
    const response = await sendMessage({ type: "getState" });
    render(response.state);
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    checkingGlobalStatus = false;
    if (currentState) renderDiagnostic(currentState);
  }
});

const previewMode = new URLSearchParams(location.search).get("preview");
(async () => {
  // In the extension i18nReady is already resolved, so this changes nothing
  // there. The development preview loads its message catalogue over fetch and
  // must not render a single label before that catalogue is in place.
  await i18nReady;
  // getManifest is synchronous in the extension; the development preview reads
  // the manifest over fetch, so the version is written once that has settled.
  elements.appVersion.textContent = `v${chrome.runtime.getManifest().version}`;

  if (previewMode) {
    currentHost = null;
    elements.currentDomain.textContent = t("pageUnavailable");
    elements.siteAction.disabled = true;
    render(previewMode === "legacy"
      ? {
          schemaVersion: EXPECTED_SCHEMA_VERSION - 1,
          enabled: false,
          domains: ["legacy-target.example"],
          proxyPort: 1080,
          lastProxyError: null,
          levelOfControl: "controlled_by_this_extension"
        }
      : {
          schemaVersion: EXPECTED_SCHEMA_VERSION,
          enabled: true,
          learnedDomains: [],
          ignoredDomains: [],
          lastDetectedDomain: null,
          proxyPort: 1080,
          lastProxyError: null,
          levelOfControl: "controlled_by_this_extension"
        });
    return;
  }

  try {
    await loadCurrentTab();
    const response = await sendMessage({ type: "getState" });
    render(response.state);
  } catch (error) {
    showNotice(error.message, true);
  }
})();
