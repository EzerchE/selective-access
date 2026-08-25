"use strict";

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

localizeDocument();
