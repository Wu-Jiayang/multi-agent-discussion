// Probe-only adapter. The journal and bridge exist only in temporary test state.
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
          properties: { recipient: { type: "string" }, mode: { enum: ["queue", "steer", "limit", "too-long"] } },
          required: ["recipient", "mode"],
        },
        options: { codemode: false },
        execute: async ({ recipient, mode }, context) => {
          const post = {
            queue: { text: "QUEUED_PROBE" },
            steer: { text: "STEERED_PROBE", mention: recipient },
            limit: { text: "界".repeat(99) + "🙂" },
            "too-long": { text: "界".repeat(100) + "🙂" },
          }[mode];
          const response = await call("/post", {
            method: "POST",
            body: JSON.stringify({ author: context.sessionID, recipient, posts: [post] }),
          });
          const result = await response.json();
          if (result.error === "ROOM_MESSAGE_TOO_LONG") {
            throw new Error(`ROOM_MESSAGE_TOO_LONG: ${result.actual} characters; max ${result.max}. Shorten and retry.`);
          }
          if (!response.ok) throw new Error(`Probe service rejected post: ${response.status}`);
          return { content: JSON.stringify(result) };
        },
      });
    });
    const acknowledge = (item, delivery) => call("/ack", {
      method: "POST", body: JSON.stringify({ ...item, delivery }),
    });
    let running = false;
    let wakeAgain;
    async function dispatch(trigger) {
      if (running) {
        wakeAgain = trigger;
        return;
      }
      running = true;
      try {
        const response = await call(`/next?trigger=${trigger}`);
        if (!response.ok) throw new Error(`Probe service could not dispatch: ${await response.text()}`);
        const { batch, promotion } = await response.json();
        if (promotion) {
          const response = await fetch(`${config.opencode}/api/session/${promotion.sessionID}/inbox/${promotion.id}`, {
            method: "PATCH",
            headers: { authorization: config.opencodeAuth, "content-type": "application/json" },
            body: JSON.stringify({ delivery: "steer" }),
            signal: controller.signal,
          });
          if (response.ok || response.status === 409) {
            const result = await acknowledge(promotion, "steer");
            if (!result.ok) throw new Error(`Promotion acknowledgment failed: ${result.status}`);
            wakeAgain ??= "recheck";
          } else {
            throw new Error(`Promotion failed: ${response.status}`);
          }
        }
        if (batch) {
          await ctx.session.prompt(batch);
          const result = await acknowledge(batch, batch.delivery);
          if (!result.ok) throw new Error(`Batch acknowledgment failed: ${result.status}`);
        }
      } catch (error) {
        if (error?.code !== "ENOENT" && !controller.signal.aborted) {
          console.error("Room smoke delivery failed", error);
        }
      } finally {
        running = false;
        if (wakeAgain && !controller.signal.aborted) {
          const next = wakeAgain;
          wakeAgain = undefined;
          queueMicrotask(() => void dispatch(next));
        }
      }
    }
    const timer = config.eventOnly ? undefined : setInterval(() => void dispatch("scan"), 40);
    if (config.eventOnly) {
      void (async () => {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal, types: [
            "session.execution.succeeded", "session.execution.failed", "session.execution.interrupted",
            "session.inbox.delivered",
          ] })) {
            if (event.type.startsWith("session.execution.")) {
              // The terminal event can arrive just before the active drain is released.
              setTimeout(() => void dispatch(`execution-event:${event.data.sessionID}`), 25);
            } else {
              void dispatch("inbox-event");
            }
          }
        } catch (error) {
          if (!controller.signal.aborted) console.error("Probe event stream failed", error);
        }
      })();
    }
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  },
};
