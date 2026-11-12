"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gateway-resolution-")), "GatewayResolutionTests.exe");
const csc = path.join(process.env.WINDIR, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
execFileSync(csc, ["/nologo", "/target:exe", "/main:GatewayResolutionTests", `/out:${out}`,
  path.join(root, "helper/source/SelectiveAccessGateway.cs"), path.join(__dirname, "GatewayResolutionTests.cs")], {stdio:"inherit", windowsHide:true});
execFileSync(out, [], {stdio:"inherit", windowsHide:true, timeout:15000});
