const elements = {
  enabled: document.querySelector("#enabled"),
  statusCard: document.querySelector("#statusCard"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  currentDomain: document.querySelector("#currentDomain"),
  siteAction: document.querySelector("#siteAction"),
  domainList: document.querySelector("#domainList"),
  domainCount: document.querySelector("#domainCount"),
  ignoredList: document.querySelector("#ignoredList"),
  ignoredCount: document.querySelector("#ignoredCount"),
  proxyPort: document.querySelector("#proxyPort"),
  notice: document.querySelector("#notice"),
  save: document.querySelector("#save"),
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
let checkingGlobalStatus = false;
let learnedDomains = [];
let ignoredDomains = [];

elements.appVersion.textContent = `v${chrome.runtime.getManifest().version}`;

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

function renderDomainList() {
  elements.domainList.replaceChildren();
  elements.domainCount.textContent = String(learnedDomains.length);

  if (learnedDomains.length === 0) {
    const empty = document.createElement("p");
    empty.className = "domain-empty";
    empty.textContent = t("noLearnedTargets");
    elements.domainList.append(empty);
    return;
  }

  for (const domain of learnedDomains) {
    const row = document.createElement("div");
    row.className = "domain-row";

    const name = document.createElement("span");
    name.className = "domain-name";
    name.textContent = domain;
    name.title = domain;

    const actions = document.createElement("div");
    actions.className = "domain-actions";

    const ignore = document.createElement("button");
    ignore.className = "domain-ignore";
    ignore.type = "button";
    ignore.textContent = t("ignore");
    ignore.title = t("ignoreDomain", domain);
    ignore.setAttribute("aria-label", t("ignoreDomain", domain));
    ignore.addEventListener("click", () => {
      save({
        learnedDomains: learnedDomains.filter((value) => value !== domain),
        ignoredDomains: [...ignoredDomains, domain]
      });
    });

    const remove = document.createElement("button");
    remove.className = "domain-remove";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = t("removeDomain", domain);
    remove.setAttribute("aria-label", t("removeDomain", domain));
    remove.addEventListener("click", () => {
      save({ learnedDomains: learnedDomains.filter((value) => value !== domain) });
    });

    actions.append(ignore, remove);
    row.append(name, actions);
    elements.domainList.append(row);
  }
}

function renderIgnoredList() {
  elements.ignoredList.replaceChildren();
  elements.ignoredCount.textContent = String(ignoredDomains.length);

  if (ignoredDomains.length === 0) {
    const empty = document.createElement("p");
    empty.className = "domain-empty";
    empty.textContent = t("noIgnoredTargets");
    elements.ignoredList.append(empty);
    return;
  }

  for (const domain of ignoredDomains) {
    const row = document.createElement("div");
    row.className = "domain-row";
    const name = document.createElement("span");
    name.className = "domain-name";
    name.textContent = domain;
    name.title = domain;
    const restore = document.createElement("button");
    restore.className = "domain-remove";
    restore.type = "button";
    restore.textContent = "↩";
    restore.title = t("restoreDomain", domain);
    restore.setAttribute("aria-label", t("restoreDomain", domain));
    restore.addEventListener("click", () => {
      save({ ignoredDomains: ignoredDomains.filter((value) => value !== domain) });
    });
    row.append(name, restore);
    elements.ignoredList.append(row);
  }
}

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
  elements.notice.hidden = !message;
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
  elements.save.disabled = versionMismatch;
  elements.retry.disabled = versionMismatch;
  renderDomainList();
  renderIgnoredList();
  elements.proxyPort.value = String(state.proxyPort);
  elements.debugEnabled.checked = Boolean(state.debugEnabled);
  elements.debugControls.hidden = !state.debugEnabled;
  elements.debugLog.textContent = Array.isArray(state.debugLog) && state.debugLog.length
    ? state.debugLog.map((entry) => JSON.stringify(entry)).join("\n")
    : t("noLogs");

  const hasControlError = ["not_controllable", "controlled_by_other_extensions"]
    .includes(state.levelOfControl);
  const activeTargetUsesGateway = Boolean(currentHost && isLearned(currentHost, learnedDomains));
  const hasActiveGatewayError = Boolean(state.lastProxyError && activeTargetUsesGateway);
  const hasError = versionMismatch || hasActiveGatewayError || hasControlError;

  elements.statusCard.className = `status-card ${hasError ? "is-error" : state.enabled ? "is-on" : "is-off"}`;
  elements.statusTitle.textContent = hasError
    ? versionMismatch
      ? t("reloadRequired")
      : t("gatewayUnavailable")
    : state.enabled
      ? t("detectionEnabled")
      : t("accessDisabled");
  elements.statusText.textContent = hasError
    ? versionMismatch
      ? t("reloadInstruction")
      : hasActiveGatewayError
        ? state.lastProxyError
        : t("proxyControlled")
    : state.enabled
      ? state.lastDetectedDomain
        ? t("learnedSummary", [String(learnedDomains.length), state.lastDetectedDomain])
        : t("detectionWaiting")
      : t("directMode");

  if (versionMismatch) {
    showNotice(t("backgroundOutdated"), true);
  } else {
    updateSiteAction();
    renderDiagnostic(state);
    if (["denied", "failed"].includes(state.lastNotificationStatus)) {
      showNotice(
        t("notificationFailed", state.lastNotificationError || t("notificationSettingsHint")),
        true
      );
    }
  }
}

function renderDiagnostic(state) {
  const issueMatches = Boolean(currentHost && state.lastIssueDomain === currentHost);
  const globalCheck = state.lastGlobalCheck?.domain === currentHost ? state.lastGlobalCheck : null;
  elements.diagnosticCard.hidden = !issueMatches && !globalCheck;
  if (elements.diagnosticCard.hidden) return;

  elements.diagnosticCard.className = "diagnostic-card";
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
      elements.diagnosticCard.classList.add("is-warning");
      elements.diagnosticTitle.textContent = t("regionalIssue");
      elements.diagnosticText.textContent = t("regionalIssueDetail", locationText);
    } else {
      elements.diagnosticCard.classList.add("is-warning");
      elements.diagnosticTitle.textContent = t("statusInconclusive");
      elements.diagnosticText.textContent = t("statusInconclusiveDetail");
    }
    return;
  }

  elements.diagnosticCard.classList.add("is-warning");
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
  } else {
    elements.diagnosticTitle.textContent = t("alternativeTitle");
    elements.diagnosticText.textContent = t("alternativeDetail");
  }
}

function updateSiteAction() {
  if (!currentHost) return;
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
  try {
    const url = new URL(tab?.url || "");
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    currentHost = normalizeDomain(url.hostname);
  } catch {
    currentHost = null;
  }

  elements.currentDomain.textContent = currentHost || t("pageUnavailable");
  elements.siteAction.disabled = !currentHost;
}

async function save(patch = {}) {
  if (!protocolReady) {
    showNotice(t("refreshBeforeContinue"), true);
    return;
  }
  elements.save.disabled = true;
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
    } else {
      showNotice(t("settingsApplied"));
    }
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    elements.save.disabled = !protocolReady;
  }
}

elements.enabled.addEventListener("change", () => {
  save({ enabled: elements.enabled.checked });
});

elements.siteAction.addEventListener("click", () => {
  if (!currentHost) return;
  let nextDomains = [...learnedDomains];

  if (elements.siteAction.dataset.mode === "remove") {
    nextDomains = nextDomains.filter((domain) => domain !== currentHost);
  } else if (elements.siteAction.dataset.mode === "unignore") {
    save({
      ignoredDomains: ignoredDomains.filter(
        (domain) => !(currentHost === domain || currentHost.endsWith(`.${domain}`))
      )
    });
    return;
  } else {
    nextDomains.push(currentHost);
  }

  save({
    learnedDomains: nextDomains,
    ignoredDomains: ignoredDomains.filter(
      (domain) => !(currentHost === domain || currentHost.endsWith(`.${domain}`))
    )
  });
});

elements.save.addEventListener("click", () => save());

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

  if (previewMode) {
    currentHost = "portal.example";
    elements.currentDomain.textContent = currentHost;
    elements.siteAction.disabled = false;
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
          learnedDomains: ["media-cdn.example"],
          ignoredDomains: ["ignored.example"],
          lastDetectedDomain: "media-cdn.example",
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
