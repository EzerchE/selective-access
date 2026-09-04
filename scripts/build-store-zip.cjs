"use strict";

// Builds the Chrome Web Store package. STORE_READINESS.md requires that the
// helper binaries, tests, development scripts and repository documents stay out
// of the uploaded archive; doing that by hand is how one of them eventually ends
// up shipped, so the file list lives here and is verified before writing.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist");

// Every runtime file the packed extension loads, plus the licence and policy
// documents that belong with a distributed build.
const PACKAGED_FILES = Object.freeze([
  "manifest.json",
  "background.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "i18n.js",
  "_locales/en/messages.json",
  "_locales/tr/messages.json",
  "assets/icon-128.png",
  "LICENSE",
  "PRIVACY.md",
  "RESPONSIBLE_USE.md",
  "THIRD_PARTY_NOTICES.md"
]);

// popup-preview.js only exists so the popup can be opened as a plain web page
// during development. It is inert inside the extension, but dead development
// code has no place in a reviewed package, so the tag is removed instead.
const PREVIEW_SCRIPT_TAG = '    <script src="popup-preview.js"></script>\r\n';

const FORBIDDEN_IN_PACKAGE = Object.freeze([
  /(^|\/)helper\//i,
  /(^|\/)tests?\//i,
  /(^|\/)scripts\//i,
  /(^|\/)\.github\//i,
  /(^|\/)assets\/screenshots\//i,
  /\.exe$/i,
  /\.cmd$/i,
  /\.cjs$/i,
  /(^|\/)README/i,
  /(^|\/)RELEASE\.md$/i,
  /(^|\/)SECURITY\.md$/i,
  /(^|\/)STORE_READINESS\.md$/i,
  /popup-preview\.js$/i
]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

// Minimal store-compatible ZIP writer: deflate entries, no directory records,
// no extra fields. Avoids pulling an archiving dependency into the release path.
function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    locals.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);

    offset += localHeader.length + name.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuffer, end]);
}

function packagedPopupHtml() {
  const source = fs.readFileSync(path.join(root, "popup.html"), "utf8");
  const tag = source.includes(PREVIEW_SCRIPT_TAG)
    ? PREVIEW_SCRIPT_TAG
    : PREVIEW_SCRIPT_TAG.replace("\r\n", "\n");
  if (!source.includes(tag)) {
    throw new Error("popup.html no longer contains the expected popup-preview.js tag.");
  }
  const stripped = source.split(tag).join("");
  if (stripped.includes("popup-preview.js")) {
    throw new Error("popup.html still references popup-preview.js after stripping.");
  }
  for (const required of ["i18n.js", "popup.js", "popup.css"]) {
    if (!stripped.includes(required)) {
      throw new Error(`popup.html lost a required reference while stripping: ${required}`);
    }
  }
  return Buffer.from(stripped, "utf8");
}

function collectEntries() {
  return PACKAGED_FILES.map((name) => {
    const absolute = path.join(root, name);
    if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Packaged file is missing: ${name}`);
    }
    return {
      name,
      data: name === "popup.html" ? packagedPopupHtml() : fs.readFileSync(absolute)
    };
  });
}

function verify(entries, manifest) {
  for (const entry of entries) {
    for (const pattern of FORBIDDEN_IN_PACKAGE) {
      if (pattern.test(entry.name)) {
        throw new Error(`Excluded file reached the package: ${entry.name} (${pattern})`);
      }
    }
  }

  const names = new Set(entries.map((entry) => entry.name));
  const packagedManifest = JSON.parse(
    entries.find((entry) => entry.name === "manifest.json").data.toString("utf8")
  );
  if (packagedManifest.version !== manifest.version) {
    throw new Error("Packaged manifest version does not match the repository manifest.");
  }
  if (!names.has(packagedManifest.background.service_worker)) {
    throw new Error("The service worker named by the manifest is not packaged.");
  }
  if (!names.has(packagedManifest.action.default_popup)) {
    throw new Error("The popup named by the manifest is not packaged.");
  }
  for (const icon of Object.values(packagedManifest.icons)) {
    if (!names.has(icon)) throw new Error(`A manifest icon is not packaged: ${icon}`);
  }
  for (const locale of ["en", "tr"]) {
    if (!names.has(`_locales/${locale}/messages.json`)) {
      throw new Error(`Localization catalogue is not packaged: ${locale}`);
    }
  }

  const popup = entries.find((entry) => entry.name === "popup.html").data.toString("utf8");
  for (const match of popup.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    if (!names.has(match[1])) {
      throw new Error(`popup.html loads a script that is not packaged: ${match[1]}`);
    }
  }
  if (/<script\b[^>]*\bsrc="https?:\/\//i.test(popup)) {
    throw new Error("popup.html must not load remote JavaScript.");
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const entries = collectEntries();
verify(entries, manifest);

fs.mkdirSync(outputDirectory, { recursive: true });
const outputFile = path.join(outputDirectory, `automatic-access-${manifest.version}.zip`);
const archive = buildZip(entries);
fs.writeFileSync(outputFile, archive);

const relativeOutput = path.relative(root, outputFile).replaceAll("\\", "/");
process.stdout.write(`${relativeOutput} (${entries.length} files, ${archive.length} bytes)\n`);
for (const entry of entries) {
  process.stdout.write(`  ${entry.name} (${entry.data.length} bytes)\n`);
}
