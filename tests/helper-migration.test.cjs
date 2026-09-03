"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "helper/migrate-legacy.cmd"), "utf8");
const installer = fs.readFileSync(path.join(root, "helper/install.cmd"), "utf8");
const uninstaller = fs.readFileSync(path.join(root, "helper/uninstall.cmd"), "utf8");

assert.doesNotMatch(migration, /powershell(?:\.exe)?|\bnetsh(?:\.exe)?\b|\breg(?:\.exe)?\s+add\b/i);
assert.doesNotMatch(migration, /schtasks(?:\.exe)?\s+\/Create\b|sc(?:\.exe)?\s+create\b/i);
assert.doesNotMatch(migration, /reg(?:\.exe)?\s+delete\s+"(?:HKLM|HKEY_LOCAL_MACHINE)\\(?:SYSTEM|SOFTWARE)"/i);
assert.doesNotMatch(migration, /\b(?:del|rmdir)(?:\.exe)?\s[^\r\n]*[?*]/i);

for (const value of [
  "SelectiveAccessDns",
  "SelectiveAccessDnsSync",
  "com.ezerche.selective_access",
  "SelectiveAccess managed encrypted DNS",
  "SelectiveAccess managed fallback DNS",
  "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\Parameters\\DnsPolicyConfig",
  "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient\\DnsPolicyConfig"
]) {
  assert.ok(migration.includes(value), `Legacy allowlist entry missing: ${value}`);
}

assert.match(migration, /reg\.exe query "%~1" \/s \/f "%~2" \/d \/e/i);
assert.match(migration, /reg\.exe query "!FOUND_KEY!" \/v Comment/i);
assert.match(migration, /if \/I "!CHILD_KEY!"=="!FOUND_KEY!" exit \/b 1/i);
assert.match(migration, /if not errorlevel 1 exit \/b 1/i);
assert.match(migration, /if "%LEGACY_NRPT_REMOVED%"=="1" ipconfig\.exe \/flushdns/i);
assert.match(installer, /start= auto/i);
assert.doesNotMatch(installer, /start= delayed-auto/i);

for (const [name, script] of [["installer", installer], ["uninstaller", uninstaller]]) {
  const migrationCall = script.indexOf('call "%~dp0migrate-legacy.cmd"');
  const serviceMutation = script.search(/(?:call :RemoveService|sc\.exe create) "%(?:BACKEND|GATEWAY)_SERVICE%"/i);
  assert.ok(migrationCall >= 0, `${name} does not invoke legacy migration`);
  assert.ok(serviceMutation > migrationCall, `${name} mutates the current service before migration`);
  assert.match(script.slice(migrationCall), /if errorlevel 1[\s\S]*?exit \/b 1/i);
}

assert.match(installer, /--port 1081/i);
assert.match(installer, /depend= "%BACKEND_SERVICE%"/i);
assert.match(installer, /SelectiveAccessGateway\.exe/i);
assert.match(installer, /127\.0\.0\.1:1080/i);
assert.match(uninstaller, /127\.0\.0\.1:1081/i);

process.stdout.write("Helper migration checks passed.\n");
