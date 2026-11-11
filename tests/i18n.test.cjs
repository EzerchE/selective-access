"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "i18n.js"), "utf8");

function element(dataset = {}) {
  return {
    dataset,
    textContent: "original",
    title: "original title",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); }
  };
}

function load(options = {}) {
  const bodyText = element({ i18n: "greeting" });
  const title = element({ i18nTitle: "title" });
  const aria = element({ i18nAriaLabel: "aria" });
  const document = {
    documentElement: { lang: "" },
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return options.textElements || [bodyText];
      if (selector === "[data-i18n-title]") return options.titleElements || [title];
      if (selector === "[data-i18n-aria-label]") return options.ariaElements || [aria];
      throw new Error(`unexpected selector: ${selector}`);
    }
  };
  const chrome = options.chrome === undefined ? {
    i18n: {
      getUILanguage: () => options.language || "en-US",
      getMessage(key, substitutions) {
        const messages = { greeting: "Hello $1", title: "Document title", aria: "Accessible name" };
        const value = messages[key];
        if (!value) return "";
        const values = Array.isArray(substitutions) ? substitutions : [substitutions];
        return value.replace(/\$(\d)/g, (match, index) => String(values[Number(index) - 1] ?? match));
      }
    }
  } : options.chrome;
  const context = {
    chrome,
    document,
    Promise,
    console,
    globalThis: null
  };
  context.globalThis = context;
  if (options.ready !== undefined) context.__i18nReady = options.ready;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, document, bodyText, title, aria };
}

(async () => {
  {
    const { context } = load();
    assert.equal(context.t("greeting", ["Ada"]), "Hello Ada");
    assert.equal(context.t("missing"), "missing");
  }
  {
    const { context } = load({ chrome: { i18n: { getMessage: () => "" } } });
    assert.equal(context.t("missing"), "missing");
    assert.equal(context.t("another"), "another");
  }
  {
    const { context } = load({ chrome: {} });
    assert.equal(context.t("missing"), "missing");
  }
  {
    const { context } = load({ chrome: { i18n: {} } });
    assert.equal(context.t("missing"), "missing");
  }

  for (const language of ["tr", "tr-TR", "TR-tr", "tr_CY"]) {
    const { context, document, bodyText, title, aria } = load({ language });
    await vm.runInContext("i18nReady", context);
    assert.equal(document.documentElement.lang, "tr");
    assert.equal(bodyText.textContent, "Hello $1");
    assert.equal(title.title, "Document title");
    assert.equal(aria.attributes["aria-label"], "Accessible name");
  }
  for (const language of ["en", "en-US", "fr-FR", undefined]) {
    const { context, document } = load({ language });
    await vm.runInContext("i18nReady", context);
    assert.equal(document.documentElement.lang, "en");
  }
  for (const getUILanguage of [() => "", () => undefined]) {
    const loaded = load({
      chrome: {
        i18n: {
          getUILanguage,
          getMessage: () => "translated"
        }
      }
    });
    await vm.runInContext("i18nReady", loaded.context);
    assert.equal(loaded.document.documentElement.lang, "en");
  }
  {
    const loaded = load({
      chrome: { i18n: { getMessage: () => "translated" } }
    });
    await vm.runInContext("i18nReady", loaded.context);
    assert.equal(loaded.document.documentElement.lang, "en");
  }

  {
    let resolve;
    const ready = new Promise((done) => { resolve = done; });
    const loaded = load({ ready });
    assert.equal(vm.runInContext("i18nReady", loaded.context), ready);
    assert.equal(loaded.document.documentElement.lang, "");
    assert.equal(loaded.bodyText.textContent, "original");
    resolve();
    await ready;
    await Promise.resolve();
    assert.equal(loaded.document.documentElement.lang, "en");
    assert.equal(loaded.bodyText.textContent, "Hello $1");
  }

  {
    const loaded = load({ ready: Promise.resolve() });
    assert.equal(vm.runInContext("i18nReady", loaded.context), loaded.context.__i18nReady);
    await vm.runInContext("i18nReady", loaded.context);
    assert.equal(loaded.document.documentElement.lang, "en");
  }

  {
    const loaded = load({ ready: "not a promise" });
    const effectiveReady = vm.runInContext("i18nReady", loaded.context);
    assert.ok(effectiveReady instanceof Promise);
    assert.notEqual(effectiveReady, loaded.context.__i18nReady);
    await effectiveReady;
    assert.equal(loaded.document.documentElement.lang, "en");
  }

  console.log("i18n tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
