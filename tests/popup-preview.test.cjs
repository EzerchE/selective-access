"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "popup-preview.js"), "utf8");

function evaluate({ chrome, search, ready } = {}) {
  let fetchCalls = 0;
  let documentWrites = 0;
  const document = {
    createElement() { documentWrites += 1; return {}; },
    body: { prepend() { documentWrites += 1; } }
  };
  const location = {};
  Object.defineProperty(location, "search", {
    configurable: true,
    get() { if (search === undefined) throw new Error("location accessed"); return search; }
  });
  const context = {
    chrome,
    document,
    location,
    URLSearchParams,
    Promise,
    console,
    navigator: { language: "en-US" },
    fetch() { fetchCalls += 1; return Promise.reject(new Error("fetch should not run")); }
  };
  context.globalThis = context;
  if (ready !== undefined) context.__i18nReady = ready;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, document, get fetchCalls() { return fetchCalls; }, get documentWrites() { return documentWrites; } };
}

(async () => {
  {
    const chrome = { runtime: { getManifest() {} } };
    const ready = Promise.resolve("sentinel");
    const loaded = evaluate({ chrome, search: undefined, ready });
    assert.equal(loaded.context.chrome, chrome);
    assert.equal(loaded.context.__i18nReady, ready);
    assert.equal(loaded.fetchCalls, 0);
    assert.equal(loaded.documentWrites, 0);
  }
  {
    const chrome = { runtime: { getManifest() {} } };
    const ready = Promise.resolve("sentinel");
    const loaded = evaluate({ chrome, search: "?preview=1", ready });
    assert.equal(loaded.context.chrome, chrome);
    assert.equal(loaded.context.__i18nReady, ready);
    assert.equal(loaded.fetchCalls, 0);
    assert.equal(loaded.documentWrites, 0);
  }
  {
    const chrome = {};
    const ready = Promise.resolve("sentinel");
    const loaded = evaluate({ chrome, search: "", ready });
    assert.equal(loaded.context.chrome, chrome);
    assert.equal(loaded.context.__i18nReady, ready);
    assert.equal(loaded.fetchCalls, 0);
    assert.equal(loaded.documentWrites, 0);
  }
  {
    const loaded = evaluate({ search: "?other=1" });
    assert.equal(loaded.context.chrome, undefined);
    assert.equal(loaded.context.__i18nReady, undefined);
    assert.equal(loaded.fetchCalls, 0);
    assert.equal(loaded.documentWrites, 0);
  }

  console.log("popup-preview tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
