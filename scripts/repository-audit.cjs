"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const excludedDirectories = new Set([".git", "node_modules", "ops"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".exe"]);
const publicHostAllowlist = new Set([
  "api.globalping.io",
  "developer.chrome.com",
  "github.com",
  "globalping.io"
]);
const publicTlds = new Set([
  "app", "biz", "cc", "co", "com", "dev", "info", "io", "me", "net", "online", "org", "site", "tv", "xyz"
]);

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

function unapprovedPublicHosts(content) {
  const hosts = new Set();
  const pattern = /(?:(?:https?|wss?):\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;
  for (const match of content.matchAll(pattern)) {
    const value = match[0].toLowerCase().replace(/^(?:https?|wss?):\/\//, "");
    const host = value.replace(/\.$/, "");
    const tld = host.split(".").at(-1);
    if (!publicTlds.has(tld)) continue;
    if (host.endsWith(".example") ||
        ["example.com", "example.net", "example.org"].some((reserved) =>
          host === reserved || host.endsWith(`.${reserved}`)) ||
        publicHostAllowlist.has(host)) continue;
    hosts.add(host);
  }
  return [...hosts];
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
  if (unapprovedPublicHosts(content).length > 0) {
    fail(`Onaylanmamis genel hedef adi bulundu: ${relative(file)}`);
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
const sourceRecord = fs.readFileSync(path.join(root, "helper/bin/SOURCE.md"), "utf8");
if (!sourceRecord.includes("v0.17.3") ||
    !sourceRecord.includes("70D2C94147193CB915F9C6EB5144B8D404DACBCFA90BDA2383B6B211AFAFA456") ||
    !sourceRecord.includes(ciadpiHash)) {
  fail("Yardimci ikili kaynak, arsiv veya hash kaydi eksik.");
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.permissions.includes("nativeMessaging")) fail("nativeMessaging izni bulunmamalidir.");
if (manifest.manifest_version !== 3) fail("Manifest V3 kullanilmalidir.");

const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
if (/sendNativeMessage|cloudflare-dns\.com|syncDnsFallbackDomains/.test(background)) {
  fail("Arka plan kodu DNS koprusu veya alternatif DNS mantigi icermemelidir.");
}
if (/\beval\s*\(|\bnew\s+Function\b|importScripts\s*\(\s*["']https?:\/\//i.test(background)) {
  fail("Arka plan kodu uzaktan veya dinamik kod calistirmamalidir.");
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
  if (/schtasks|DnsPolicyConfig|NRPT|SelectiveAccessDns|\breg(?:\.exe)?\s+(?:add|delete)\b/i.test(content)) {
    fail(`${script} DNS, zamanlanmis gorev veya kayit defteri islemi yapmamalidir.`);
  }
}

const installer = fs.readFileSync(path.join(root, "helper/install.cmd"), "utf8");
if (!/obj=\s*"NT AUTHORITY\\LocalService"/i.test(installer)) {
  fail("Yerel hizmet LocalService hesabi ile calismalidir.");
}
if (!/sc\.exe failure\b/i.test(installer) ||
    !/icacls\.exe/i.test(installer) ||
    !/:WaitForServicePort/i.test(installer)) {
  fail("Yerel hizmet kurtarma, ACL ve port dogrulamasi icermelidir.");
}
if ((installer.match(/--oob\s+1/gi) || []).length !== 1) {
  fail("Yerel hizmet parametrelerinde yinelenen --oob bulunmamalidir.");
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

for (const document of ["README.md", "PRIVACY.md", "STORE_READINESS.md"]) {
  const content = fs.readFileSync(path.join(root, document), "utf8");
  for (const permission of manifest.permissions) {
    if (!content.includes(`\`${permission}\``)) {
      fail(`${document} manifest iznini aciklamiyor: ${permission}`);
    }
  }
  if (!/HTTP\/HTTPS\/WS\/WSS/i.test(content)) {
    fail(`${document} tum ag semalarini aciklamiyor.`);
  }
}

for (const workflow of fs.readdirSync(path.join(root, ".github/workflows"))) {
  if (!/\.ya?ml$/i.test(workflow)) continue;
  const content = fs.readFileSync(path.join(root, ".github/workflows", workflow), "utf8");
  for (const match of content.matchAll(/uses:\s*[^\s@]+@([^\s#]+)/g)) {
    if (!/^[0-9a-f]{40}$/i.test(match[1])) {
      fail(`GitHub Actions degismez commit SHA kullanmiyor: ${workflow}`);
    }
  }
}

const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
if (!/permissions:\s*\r?\n\s+contents:\s*read/i.test(ciWorkflow) ||
    !/fetch-depth:\s*0/i.test(ciWorkflow) ||
    !/repository-audit\.cjs --history/i.test(ciWorkflow)) {
  fail("CI minimum izin, tam gecmis ve gecmis denetimi kullanmalidir.");
}

const uninstaller = fs.readFileSync(path.join(root, "helper/uninstall.cmd"), "utf8");
if (!/:WaitForServiceRemoval/i.test(uninstaller) ||
    !/if exist "%INSTALL_DIR%"/i.test(uninstaller) ||
    !/netstat\.exe/i.test(uninstaller)) {
  fail("Kaldirici hizmet, dosya ve port durumunu dogrulamalidir.");
}

const popup = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const backgroundSchema = background.match(/schemaVersion:\s*(\d+)/)?.[1];
const popupSchema = popup.match(/EXPECTED_SCHEMA_VERSION\s*=\s*(\d+)/)?.[1];
if (!backgroundSchema || backgroundSchema !== popupSchema) {
  fail("Popup ve arka plan veri semasi birbiriyle uyusmuyor.");
}

if (process.argv.includes("--history")) {
  let commits = [];
  try {
    commits = execFileSync("git", ["rev-list", "--all"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch {
    fail("Git gecmisi okunamadi.");
  }
  for (const commit of commits) {
    let content = "";
    try {
      content = execFileSync("git", [
        "grep", "-I", "-h", "-E", "[A-Za-z0-9-]+\\.[A-Za-z]{2,}",
        commit, "--", ".", ":(exclude)helper/bin/*"
      ], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024
      });
    } catch (error) {
      if (error.status !== 1) fail(`Git gecmisi taranamadi: ${commit.slice(0, 12)}`);
    }
    if (unapprovedPublicHosts(content).length > 0 || /[A-Za-z]:\\Users\\[^\\\s]+/.test(content)) {
      fail(`Git gecmisinde kamuya acik olmamasi gereken veri bulundu: ${commit.slice(0, 12)}`);
    }
  }
}

process.stdout.write("Depo denetimi basarili.\n");
