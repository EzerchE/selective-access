"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { buildZip, buildStorePackage } = require("./build-store-zip.cjs");
const root = path.resolve(__dirname, "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;
const dist = path.join(root, "dist");

// Explicit lists keep local experiments, private diagnostics and extra native
// binaries out of distributed helper and publisher-material archives.
const helperFiles = [
  "helper/install.cmd", "helper/migrate-legacy.cmd", "helper/README.md",
  "helper/share.cmd", "helper/uninstall.cmd", "helper/bin/BYEDPI_LICENSE.txt",
  "helper/bin/ciadpi.exe", "helper/bin/GATEWAY_SOURCE.md", "helper/bin/LAN_SHARE_SOURCE.md",
  "helper/bin/SelectiveAccessGateway.exe", "helper/bin/SelectiveAccessLanShare.exe", "helper/bin/SOURCE.md",
  "helper/source/build-gateway.cmd", "helper/source/build-lan-share.cmd",
  "helper/source/SelectiveAccessGateway.cs", "helper/source/SelectiveAccessLanShare.cs"
];
const documents = ["STORE_LISTING.md", "STORE_READINESS.md", "STORE_SUBMISSION.md",
  "STORE_REVIEWER_GUIDE.md", "PRIVACY.md", "PRIVACY_TR.md"];
const materialFiles = ["assets/store/README.md", "assets/store/screenshot-routing.png",
  "assets/store/screenshot-routing-dark.png", "assets/store/screenshot-setup.png",
  "assets/store/promo-small.png", "assets/icon-128.png", ...documents];

function archive(name, files, entryName = (name) => name) {
  const entries = files.map((source) => ({ name: entryName(source), data: fs.readFileSync(path.join(root, source)) }));
  fs.writeFileSync(path.join(dist, name), buildZip(entries));
  console.log(`${name} (${entries.length} files)`);
  return name;
}

buildStorePackage();
const names = [`automatic-access-${version}.zip`,
  archive(`selective-access-helper-${version}.zip`, helperFiles),
  archive(`automatic-access-store-materials-${version}.zip`, materialFiles, (name) => name.replace(/^assets\//, ""))];
const sums = names.map((name) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(dist, name))).digest("hex")}  ${name}`).join("\n") + "\n";
fs.writeFileSync(path.join(dist, "SHA256SUMS.txt"), sums);
fs.writeFileSync(path.join(dist, `SHA256SUMS-${version}.txt`), sums);
console.log(sums.trim());
