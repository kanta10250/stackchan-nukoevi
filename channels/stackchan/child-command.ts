import { spawn } from "node:child_process";

export function childEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "CODEX_HOME"]
    .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
}

export function runCommand(command: string[], options: { cwd?: string; timeoutMs?: number; input?: string; maxBytes?: number; signal?: AbortSignal } = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: options.cwd, env: childEnvironment(), stdio: "pipe", detached: true });
    let stdout = "", bytes = 0, failed = false;
    const stop = (error: Error) => {
      if (failed) return;
      failed = true;
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch (killError) {
          if ((killError as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
        }
      }
      reject(error);
    };
    const timer = setTimeout(() => stop(new Error("Command timed out")), options.timeoutMs ?? 15000);
    const abort = () => stop(new Error("Command canceled"));
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (data: Buffer) => {
      bytes += data.length;
      if (bytes > (options.maxBytes ?? 1024 * 1024)) stop(new Error("Command output exceeded limit"));
      else stdout += data.toString("utf8");
    });
    child.stderr.on("data", (data: Buffer) => {
      bytes += data.length;
      if (bytes > (options.maxBytes ?? 1024 * 1024)) stop(new Error("Command output exceeded limit"));
    });
    child.on("error", stop);
    child.stdin.on("error", stop);
    child.on("close", (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (failed) return;
      if (code !== 0) reject(new Error(`Command failed (${code}): ${command[0]}`));
      else resolve(stdout);
    });
    child.stdin.end(options.input);
  });
}
