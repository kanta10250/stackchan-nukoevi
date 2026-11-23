#!/usr/bin/env bun
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { developmentFilesystem, developmentPermissionName, toToml } from "../channels/stackchan/codex-policy";
import { runCommand } from "../channels/stackchan/child-command";

if (process.platform !== "darwin") throw new Error("This check verifies the macOS sandbox used by the Mac companion");
const directory = mkdtempSync(join(tmpdir(), "stackchan-sandbox-test-"));
const workspace = join(directory, "workspace"); mkdirSync(workspace);
writeFileSync(join(workspace, "allowed.txt"), "safe test file");
writeFileSync(join(workspace, ".env"), "private test value");
writeFileSync(join(directory, "outside.txt"), "private test value");
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("must not reach") });
const policy = [process.env.STACKCHAN_CODEX_BIN ?? "codex", "sandbox", "-P", developmentPermissionName,
  "-c", `permissions.${developmentPermissionName}.filesystem=${toToml(developmentFilesystem())}`,
  "-c", `permissions.${developmentPermissionName}.network.enabled=false`, "-C", workspace, "--"];
try {
  for (const [label, command, expected] of [
    ["workspace read", ["/bin/cat", join(workspace, "allowed.txt")], true],
    ["workspace write", ["/usr/bin/touch", join(workspace, "result.txt")], true],
    ["outside read", ["/bin/cat", join(directory, "outside.txt")], false],
    ["outside write", ["/usr/bin/touch", join(directory, "blocked.txt")], false],
    ["secret read", ["/bin/cat", join(workspace, ".env")], false],
    ["network", ["/usr/bin/curl", "--connect-timeout", "1", "--max-time", "2", `http://127.0.0.1:${server.port}`], false],
  ] as const) {
    let succeeded = false;
    try { await runCommand([...policy, ...command]); succeeded = true; } catch { /* Expected denials are asserted below. */ }
    if (succeeded !== expected) throw new Error(`Sandbox boundary failed: ${label}`);
    console.log(`PASS: ${label}`);
  }
} finally { server.stop(true); rmSync(directory, { recursive: true, force: true }); }
