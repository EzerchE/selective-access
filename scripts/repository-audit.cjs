"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const excludedDirectories = new Set([".git", "node_modules", "ops"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".exe"]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function fail(message) {
  throw new Error(message);
}

const files = walk(root);
for (const file of files) {
  const name = path.basename(file);
  const extension = path.extname(file).toLowerCase();
  if (/^(?:\.env(?:\..*)?|id_rsa|id_ed25519)$/i.test(name) ||
      /^\.(?:pem|key|pfx|p12|log|db|sqlite)$/i.test(extension)) {
    fail(`Yasakli dosya bulundu: ${relative(file)}`);
  }
  if (extension === ".ps1") fail(`PowerShell betigi bulunmamalidir: ${relative(file)}`);
}

const sensitivePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[opusr]_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /C:\\Users\\[^\\\s]+/,
  /(?<![a-p])[a-p]{32}(?![a-p])/,
  /(?<![0-9])(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})(?![0-9])/
];

for (const file of files) {
  if (binaryExtensions.has(path.extname(file).toLowerCase())) continue;
  const content = fs.readFileSync(file, "utf8");
  if (sensitivePatterns.some((pattern) => pattern.test(content))) {
    fail(`Olasi hassas veri bulundu: ${relative(file)}`);
  }
}

for (const required of [
  "LICENSE",
  "PRIVACY.md",
  "RESPONSIBLE_USE.md",
  "THIRD_PARTY_NOTICES.md",
  "helper/bin/BYEDPI_LICENSE.txt",
  "helper/bin/ciadpi.exe",
  "helper/install.cmd",
  "helper/uninstall.cmd"
]) {
  if (!fs.statSync(path.join(root, required), { throwIfNoEntry: false })?.isFile()) {
    fail(`Gerekli dosya eksik: ${required}`);
  }
}

const ciadpi = fs.readFileSync(path.join(root, "helper/bin/ciadpi.exe"));
const ciadpiHash = crypto.createHash("sha256").update(ciadpi).digest("hex").toUpperCase();
if (ciadpiHash !== "EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4") {
  fail("Yardimci ikili beklenen surumle eslesmiyor: helper/bin/ciadpi.exe");
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.permissions.includes("nativeMessaging")) fail("nativeMessaging izni bulunmamalidir.");

const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
if (/sendNativeMessage|cloudflare-dns\.com|syncDnsFallbackDomains/.test(background)) {
  fail("Arka plan kodu DNS koprusu veya alternatif DNS mantigi icermemelidir.");
}

for (const forbidden of [
  "helper/bin/dnsproxy.exe",
  "helper/bin/DNSPROXY_LICENSE.txt",
  "helper/source/dnsproxy-v0.84.1.tar.gz",
  "helper/native/SelectiveAccessDnsHost.cs",
  "helper/sync-dns.ps1",
  "helper/sync-dns.vbs",
  "helper/install.ps1",
  "helper/uninstall.ps1"
]) {
  if (fs.existsSync(path.join(root, forbidden))) fail(`Kaldirilmis DNS/PowerShell bileseni bulundu: ${forbidden}`);
}

for (const script of ["helper/install.cmd", "helper/uninstall.cmd"]) {
  const content = fs.readFileSync(path.join(root, script), "utf8");
  if (/powershell(?:\.exe)?/i.test(content)) fail(`${script} PowerShell cagirmamalidir.`);
  if (/schtasks(?:\.exe)?\s+\/create|sc(?:\.exe)?\s+create\s+"?SelectiveAccessDns/i.test(content)) {
    fail(`${script} DNS hizmeti veya gorevi olusturmamalidir.`);
  }
}

for (const file of files.filter((item) => path.extname(item).toLowerCase() === ".md")) {
  if (/[A-Za-z]:\\/.test(fs.readFileSync(file, "utf8"))) {
    fail(`Kamuya acik belgede mutlak Windows yolu bulundu: ${relative(file)}`);
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes(`Güncel sürüm: **${manifest.version}**`)) {
  fail(`README güncel manifest surumunu belirtmiyor: ${manifest.version}`);
}

const popup = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const backgroundSchema = background.match(/schemaVersion:\s*(\d+)/)?.[1];
const popupSchema = popup.match(/EXPECTED_SCHEMA_VERSION\s*=\s*(\d+)/)?.[1];
if (!backgroundSchema || backgroundSchema !== popupSchema) {
  fail("Popup ve arka plan veri semasi birbiriyle uyusmuyor.");
}

process.stdout.write("Depo denetimi basarili.\n");
