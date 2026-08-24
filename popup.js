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
  testNotification: document.querySelector("#testNotification"),
  debugEnabled: document.querySelector("#debugEnabled"),
  debugControls: document.querySelector("#debugControls"),
  debugLog: document.querySelector("#debugLog"),
  copyDebugLog: document.querySelector("#copyDebugLog"),
  clearDebugLog: document.querySelector("#clearDebugLog")
};

const EXPECTED_SCHEMA_VERSION = 7;

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
    empty.textContent = "Henüz engelli bir hedef algılanmadı";
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
    ignore.textContent = "Yoksay";
    ignore.title = `${domain} hedefini kalıcı olarak yoksay`;
    ignore.setAttribute("aria-label", `${domain} hedefini kalıcı olarak yoksay`);
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
    remove.title = `${domain} hedefini kaldır`;
    remove.setAttribute("aria-label", `${domain} hedefini kaldır`);
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
    empty.textContent = "Yoksayılan bir hedef yok";
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
    restore.title = `${domain} için yoksaymayı kaldır`;
    restore.setAttribute("aria-label", `${domain} için yoksaymayı kaldır`);
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
    : "Henüz kayıt yok";

  const hasControlError = ["not_controllable", "controlled_by_other_extensions"]
    .includes(state.levelOfControl);
  const hasError = versionMismatch || Boolean(state.lastProxyError) || hasControlError;

  elements.statusCard.className = `status-card ${hasError ? "is-error" : state.enabled ? "is-on" : "is-off"}`;
  elements.statusTitle.textContent = hasError
    ? versionMismatch
      ? "Eklentinin yeniden yüklenmesi gerekiyor"
      : "Yerel geçit kullanılamıyor"
    : state.enabled
      ? "Otomatik engel algılama etkin"
      : "Otomatik erişim kapalı";
  elements.statusText.textContent = hasError
    ? versionMismatch
      ? "chrome://extensions sayfasında Otomatik Erişim kartındaki yenile simgesine basın."
      : state.lastProxyError || "Proxy ayarı başka bir eklenti veya yönetici tarafından kontrol ediliyor."
    : state.enabled
      ? state.lastDetectedDomain
        ? `${learnedDomains.length} hedef öğrenildi. Son algılanan: ${state.lastDetectedDomain}`
        : "Bağlantı hatası algılanırsa hedef kaydedilir; yalnız başarısız ana sayfa bir kez yenilenir."
      : "Chrome doğrudan bağlanıyor; engel algılama yapılmıyor.";

  if (versionMismatch) {
    showNotice("Arka plan kodu eski sürümde kaldı. Eklenti kartını yeniledikten sonra popup'ı tekrar açın.", true);
  } else {
    updateSiteAction();
    renderDiagnostic(state);
    if (["denied", "failed"].includes(state.lastNotificationStatus)) {
      showNotice(
        `Son bildirim gösterilemedi: ${state.lastNotificationError || "Chrome veya Windows bildirim ayarını kontrol edin."}`,
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
  elements.checkStatus.textContent = checkingGlobalStatus ? "Üç kıtadan kontrol ediliyor…" : "Genel durumu kontrol et";

  if (globalCheck) {
    const locationText = `${globalCheck.reachable}/${globalCheck.total || 3} dış noktadan HTTP yanıtı alındı.`;
    if (globalCheck.status === "online") {
      elements.diagnosticCard.classList.add("is-online");
      elements.diagnosticTitle.textContent = "Site genel olarak açık";
      elements.diagnosticText.textContent = `${locationText} Site dış noktalardan erişilebilir; sorun yerel ağ veya bölgesel erişim yolunda olabilir.`;
    } else if (globalCheck.status === "likely_down") {
      elements.diagnosticCard.classList.add("is-down");
      elements.diagnosticTitle.textContent = "Genel kesinti olası";
      elements.diagnosticText.textContent = "En az iki kıtadaki dış nokta da hedefe ulaşamadı; sorun büyük olasılıkla sizden kaynaklanmıyor.";
    } else if (globalCheck.status === "regional") {
      elements.diagnosticCard.classList.add("is-warning");
      elements.diagnosticTitle.textContent = "Bölgesel sorun olabilir";
      elements.diagnosticText.textContent = `${locationText} Site tamamen kapalı değil, ancak her bölgeden erişilemiyor.`;
    } else {
      elements.diagnosticCard.classList.add("is-warning");
      elements.diagnosticTitle.textContent = "Genel durum doğrulanamadı";
      elements.diagnosticText.textContent = "Dış ölçümlerin sonucu kesin değil; biraz sonra yeniden deneyin.";
    }
    return;
  }

  elements.diagnosticCard.classList.add("is-warning");
  if (state.lastIssueType === "client_filter_blocked") {
    elements.checkStatus.hidden = true;
    elements.diagnosticTitle.textContent = "Tarayıcı filtresi uygulamayı durdurdu";
    elements.diagnosticText.textContent = "İlk taraf uygulama dosyası başka bir içerik filtresi tarafından engellendi. İlgili filtre kuralını veya bu siteye ait istisnayı kontrol edin.";
  } else if (state.lastIssueType === "route_failed") {
    elements.diagnosticTitle.textContent = "Geçit denemesinden sonra sorun sürüyor";
    elements.diagnosticText.textContent = "Hedef zaten otomatik geçitte. Site genel olarak kapalı veya farklı bir bağlantı sorunu yaşıyor olabilir.";
  } else if (state.lastIssueType === "transient_reachable") {
    elements.diagnosticTitle.textContent = "Geçici bağlantı hatası";
    elements.diagnosticText.textContent = "Doğrudan kontrol hedeften yanıt aldı. Site yönlendirme listesine eklenmedi; sayfayı yeniden deneyebilirsiniz.";
  } else if (state.lastIssueType === "transient_unverified") {
    elements.diagnosticTitle.textContent = "Engel doğrulanmadı";
    elements.diagnosticText.textContent = "Bu hata tek başına erişim engeli kanıtı değildir. Hedef otomatik eklenmedi; yeniden deneyin veya genel durumu kontrol edin.";
  } else {
    elements.diagnosticTitle.textContent = "Alternatif bağlantı deneniyor";
    elements.diagnosticText.textContent = "Hedef öğrenildi ve yerel geçit üzerinden bir kez daha yükleniyor.";
  }
}

function updateSiteAction() {
  if (!currentHost) return;
  const learned = isLearned(currentHost, learnedDomains);
  const ignored = isCovered(currentHost, ignoredDomains);
  elements.siteAction.textContent = ignored ? "Yoksaymayı kaldır" : learned ? "Listeden çıkar" : "Şimdi geçide al";
  elements.siteAction.dataset.mode = ignored ? "unignore" : learned ? "remove" : "add";
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "İşlem tamamlanamadı.");
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

  elements.currentDomain.textContent = currentHost || "Bu sayfa için kullanılamaz";
  elements.siteAction.disabled = !currentHost;
}

async function save(patch = {}) {
  if (!protocolReady) {
    showNotice("Devam etmeden önce chrome://extensions sayfasından eklentiyi yenileyin.", true);
    return;
  }
  elements.save.disabled = true;
  showNotice("");

  try {
    const port = Number(elements.proxyPort.value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Port 1 ile 65535 arasında olmalı.");
    }

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
        ignoredDomains: nextIgnoredDomains,
        proxyPort: port
      }
    });
    const stateResponse = await sendMessage({ type: "getState" });
    render(stateResponse.state);

    if (response.state.applyResult?.ok === false) {
      showNotice(response.state.applyResult.error, true);
    } else {
      showNotice("Otomatik bağlantı ayarları Chrome'a uygulandı.");
    }
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    elements.save.disabled = false;
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
      response.result.ok ? "Otomatik proxy kuralı yeniden uygulandı." : response.result.error,
      !response.result.ok
    );
  } catch (error) {
    showNotice(error.message, true);
  }
});

elements.copyDebugLog.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.debugLog.textContent);
    showNotice("Hata ayıklama günlüğü panoya kopyalandı.");
  } catch (error) {
    showNotice(`Günlük kopyalanamadı: ${error.message}`, true);
  }
});

elements.debugEnabled.addEventListener("change", () => {
  save({ debugEnabled: elements.debugEnabled.checked });
});

elements.clearDebugLog.addEventListener("click", async () => {
  try {
    await sendMessage({ type: "clearDebugLog" });
    elements.debugLog.textContent = "Henüz kayıt yok";
    showNotice("Hata ayıklama günlüğü temizlendi.");
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
        ? response.result.warning || "Test bildirimi Chrome'a gönderildi. Görünmüyorsa Windows Bildirim Merkezi ve Rahatsız etmeyin ayarını kontrol edin."
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
if (previewMode) {
  currentHost = "portal.example";
  elements.currentDomain.textContent = currentHost;
  elements.siteAction.disabled = false;
  render(previewMode === "legacy"
    ? {
        enabled: false,
        domains: ["legacy-target.example"],
        proxyPort: 1080,
        lastProxyError: null,
        levelOfControl: "controlled_by_this_extension"
      }
    : {
        schemaVersion: 7,
        enabled: true,
        learnedDomains: ["media-cdn.example"],
        ignoredDomains: ["ignored.example"],
        lastDetectedDomain: "media-cdn.example",
        proxyPort: 1080,
        lastProxyError: null,
        levelOfControl: "controlled_by_this_extension"
      });
} else {
  (async () => {
    try {
      await loadCurrentTab();
      const response = await sendMessage({ type: "getState" });
      render(response.state);
    } catch (error) {
      showNotice(error.message, true);
    }
  })();
}
