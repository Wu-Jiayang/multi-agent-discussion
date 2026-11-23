// Probe-only adapter. Production needs a durable outbox and retry-safe claims.
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../bridge.json", import.meta.url)));
const auth = { authorization: `Bearer ${config.token}` };
const controller = new AbortController();

function call(path, init = {}) {
  const endpoint = readFileSync(config.endpoint, "utf8");
  return fetch(endpoint + path, {
    ...init,
    headers: { ...auth, "content-type": "application/json" },
    signal: controller.signal,
  });
}

export default {
  id: "room-smoke-probe",
  async setup(ctx) {
    await ctx.tool.transform(editor => {
      editor.add({
        name: "probe_hold",
        description: "Return test tool output",
        input: { type: "object", properties: {} },
        options: { codemode: false },
        execute: async () => ({ content: "held request completed" }),
      });
      editor.add({
        name: "probe_publish",
        description: "Post a deterministic smoke-test bundle from this session",
        input: {
          type: "object",
          properties: { recipient: { type: "string" }, mode: { enum: ["queue", "steer"] } },
          required: ["recipient", "mode"],
        },
        options: { codemode: false },
        execute: async ({ recipient, mode }, context) => {
          const post = mode === "queue"
            ? { text: "QUEUED_PROBE" }
            : { text: "STEERED_PROBE", mention: recipient };
          const response = await call("/post", {
            method: "POST",
            body: JSON.stringify({ author: context.sessionID, recipient, posts: [post] }),
          });
          if (!response.ok) throw new Error(`Probe service rejected post: ${response.status}`);
          return { content: JSON.stringify(await response.json()) };
        },
      });
    });
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const response = await call("/next");
        if (!response.ok) throw new Error(`Probe service could not dispatch: ${await response.text()}`);
        const { batch } = await response.json();
        if (batch) await ctx.session.prompt(batch);
      } catch (error) {
        if (error?.code !== "ENOENT" && !controller.signal.aborted) {
          console.error("Room smoke delivery failed", error);
        }
      } finally {
        running = false;
      }
    }, 40);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  },
};
