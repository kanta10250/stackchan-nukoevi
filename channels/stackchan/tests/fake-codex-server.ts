import { createInterface } from "node:readline";

const send = (message: unknown) => process.stdout.write(JSON.stringify(message) + "\n");
let threadId = "test-dedicated-thread";
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  const { id, method, params } = request;
  if (id === undefined) return;
  if (method === "initialize") return send({ id, result: {} });
  if (method === "thread/start" || method === "thread/resume") {
    if (params.permissions !== "stackchan_conversation" || params.approvalPolicy !== "never")
      return send({ id, error: { message: "unexpected permission policy" } });
    threadId = params.threadId ?? threadId;
    return send({ id, result: { thread: { id: threadId }, model: "fake-model" } });
  }
  if (method !== "turn/start") return send({ id, error: { message: "unknown method" } });
  const text = String(params.input[0].text);
  const prompt = text.split("\n").at(-1)!;
  if (prompt === "crash") return process.exit(9);
  send({ id, result: { turn: { id: String(id) } } });
  if (prompt === "hang") return;
  if (prompt === "malformed-protocol") return process.stdout.write("not-json\n");
  if (prompt === "failed") return send({ method: "turn/completed", params: {
    threadId, turn: { id: String(id), status: "failed", error: { message: "test provider failed" } },
  } });
  const answer = { reply: prompt, remember: [] as { key: string; value: string }[], forget: [] as string[] };
  if (prompt === "remember-test 覚えて") answer.remember = [{ key: "favorite_color", value: "緑" }];
  if (prompt === "recall-test") answer.reply = text.includes('"favorite_color":"緑"') ? "緑" : "不明";
  if (prompt === "forget-test 忘れて") answer.forget = ["favorite_color"];
  if (prompt === "unsafe-key") answer.remember = [{ key: "__proto__", value: "invalid" }];
  if (prompt === "unrequested-memory") answer.remember = [{ key: "unexpected", value: "must not persist" }];
  if (prompt === "unsafe-memory 覚えて") answer.remember = [{ key: "secret", value: "password: must-not-persist" }];
  if (prompt === "stale-notifications") {
    send({ method: "item/completed", params: { threadId, turnId: "stale", item: { type: "agentMessage", text: "stale" } } });
    send({ method: "turn/completed", params: { threadId, turn: { id: "stale", status: "completed" } } });
  }
  const finish = () => {
    send({ method: "item/completed", params: { threadId, turnId: String(id),
      item: { type: "agentMessage", phase: "commentary", text: "これは返答ではない" } } });
    send({ method: "item/completed", params: { threadId, turnId: String(id),
      item: { type: "agentMessage", phase: "final_answer", text: prompt === "invalid-output" ? "not-json" : JSON.stringify(answer) } } });
    send({ method: "turn/completed", params: { threadId, turn: { id: String(id), status: "completed" } } });
  };
  if (prompt === "first") setTimeout(finish, 50);
  else finish();
});
