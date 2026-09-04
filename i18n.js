"use strict";

// chrome.i18n.getMessage is synchronous inside the extension, so this promise is
// already settled there and nothing waits. The development preview installs its
// own catalogue loader on globalThis.__i18nReady, and every consumer must hold
// off until that catalogue is in place or it renders raw message keys.
const i18nReady = globalThis.__i18nReady instanceof Promise
  ? globalThis.__i18nReady
  : Promise.resolve();

function t(key, substitutions) {
  const value = chrome.i18n?.getMessage?.(key, substitutions);
  return value || key;
}

function localizeDocument() {
  const uiLanguage = chrome.i18n?.getUILanguage?.() || "en";
  document.documentElement.lang = uiLanguage.toLowerCase().startsWith("tr") ? "tr" : "en";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
}

i18nReady.then(localizeDocument);
