import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexAssistant } from "../codex-assistant";

const instances: CodexAssistant[] = [];
const directories: string[] = [];
function create(stateDir = mkdtempSync(join(tmpdir(), "nukoevi-codex-test-")), timeoutMs = 2000) {
  if (!directories.includes(stateDir)) directories.push(stateDir);
  const assistant = new CodexAssistant({ stateDir, timeoutMs,
    command: [process.execPath, join(import.meta.dir, "fake-codex-server.ts")] });
  instances.push(assistant);
  return { assistant, stateDir };
}
afterEach(() => {
  for (const instance of instances.splice(0)) instance.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Codex companion", () => {
  test("returns only final reply and uses a dedicated persistent thread", async () => {
    const { assistant, stateDir } = create();
    expect(await assistant.reply("こんにちは")).toBe("こんにちは");
    const state = JSON.parse(readFileSync(join(stateDir, "conversation.json"), "utf8"));
    expect(state.threadId).toBe("test-dedicated-thread");
    expect(statSync(join(stateDir, "conversation.json")).mode & 0o777).toBe(0o600);
    expect(assistant.status().ready).toBe(true);
  });

  test("remembers explicit facts across restarts and supports forgetting", async () => {
    const first = create();
    await first.assistant.reply("remember-test 覚えて");
    first.assistant.close();
    const second = create(first.stateDir);
    expect(await second.assistant.reply("recall-test")).toBe("緑");
    await second.assistant.reply("forget-test 忘れて");
    expect(await second.assistant.reply("recall-test")).toBe("不明");
    expect(second.assistant.status().memoryCount).toBe(0);
  });

  test("serializes concurrent turns", async () => {
    const { assistant } = create();
    expect(await Promise.all([assistant.reply("first"), assistant.reply("second")])).toEqual(["first", "second"]);
  });

  test("bounds the conversation queue", async () => {
    const { assistant } = create();
    const turns = [assistant.reply("first"), assistant.reply("two"), assistant.reply("three"), assistant.reply("four")];
    await expect(assistant.reply("overflow")).rejects.toThrow("queue is full");
    expect(await Promise.all(turns)).toEqual(["first", "two", "three", "four"]);
  });

  test("reports an unavailable Codex executable", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "nukoevi-codex-test-"));
    directories.push(stateDir);
    const assistant = new CodexAssistant({ stateDir, timeoutMs: 1000, command: [join(stateDir, "missing-codex")] });
    instances.push(assistant);
    await expect(assistant.reply("hello")).rejects.toThrow();
    expect(assistant.status().ready).toBe(false);
    expect(assistant.status().lastError).toBeDefined();
  });

  test("rejects invalid inputs before invoking Codex", async () => {
    const { assistant } = create();
    await expect(assistant.reply(" ")).rejects.toThrow("1–8000");
    await expect(assistant.reply("a".repeat(8001))).rejects.toThrow("1–8000");
    expect(assistant.status().hasThread).toBe(false);
  });

  test("rejects malformed model output without losing the conversation", async () => {
    const { assistant } = create();
    await expect(assistant.reply("invalid-output")).rejects.toThrow();
    expect(await assistant.reply("回復")).toBe("回復");
  });

  test("rejects unsafe memory keys", async () => {
    const { assistant } = create();
    await expect(assistant.reply("unsafe-key")).rejects.toThrow();
    expect(assistant.status().memoryCount).toBe(0);
  });

  test("does not persist unsolicited memory changes or credential-shaped values", async () => {
    const { assistant } = create();
    await expect(assistant.reply("unrequested-memory")).rejects.toThrow("explicit user request");
    await expect(assistant.reply("unsafe-memory 覚えて")).rejects.toThrow("Credentials");
    expect(assistant.status().memoryCount).toBe(0);
  });

  test("ignores stale notifications from another turn", async () => {
    const { assistant } = create();
    expect(await assistant.reply("stale-notifications")).toBe("stale-notifications");
  });

  test("reports a provider failure and accepts the next turn", async () => {
    const { assistant } = create();
    await expect(assistant.reply("failed")).rejects.toThrow("test provider failed");
    expect(await assistant.reply("再試行")).toBe("再試行");
  });

  test("recovers after a child process crash", async () => {
    const { assistant } = create();
    await expect(assistant.reply("crash")).rejects.toThrow("Codex exited");
    expect(await assistant.reply("再接続")).toBe("再接続");
  });

  test("bounds a stalled response and recovers", async () => {
    const { assistant } = create(undefined, 400);
    await expect(assistant.reply("hang")).rejects.toThrow("timed out");
    expect(await assistant.reply("再接続")).toBe("再接続");
  });

  test("rejects a malformed protocol stream and recovers", async () => {
    const { assistant } = create();
    await expect(assistant.reply("malformed-protocol")).rejects.toThrow("Invalid Codex protocol");
    expect(await assistant.reply("再接続")).toBe("再接続");
  });

  test("does not silently discard corrupt persistent state", () => {
    const { assistant, stateDir } = create();
    assistant.close();
    writeFileSync(join(stateDir, "conversation.json"), "not-json");
    expect(() => new CodexAssistant({ stateDir })).toThrow();
  });
});
