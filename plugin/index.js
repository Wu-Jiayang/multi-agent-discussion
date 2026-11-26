// src/plugin/index.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var root = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
var temp = process.env.TMPDIR || process.env.TEMP || process.env.TMP || "/tmp";
var tempRoot = temp.replace(/\/$/, "").endsWith("/opencode") ? temp : join(temp, "opencode");
var key = createHash("sha256").update(root).digest("hex").slice(0, 20);
var bridgeFile = join(tempRoot, "discussions", `service-${key}.json`);
var controller = new AbortController();
var bridge;
function config() {
  bridge = JSON.parse(readFileSync(bridgeFile, "utf8"));
  return bridge;
}
async function call(path, init = {}) {
  const current = config();
  return fetch(current.endpoint + path, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${current.token}`, "content-type": "application/json" },
    signal: init.signal || controller.signal
  });
}
async function rpc(path, input = {}, signal) {
  const response = await call(path, { method: "POST", body: JSON.stringify(input), signal });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(`${result.error?.code || "ROOM_ERROR"}: ${result.error?.message || response.statusText}`);
    error.code = result.error?.code;
    error.details = result.error?.details;
    throw error;
  }
  return result;
}
var mentionFields = {
  replyToMessageId: { type: "string", description: "Quote one visible message from this room." },
  mentionMemberIds: { type: "array", items: { type: "string" }, description: "Structured member IDs to notify urgently. Display names in text do not count." },
  mentionAll: { type: "boolean", description: "Urgently notify every other agent, never the sender." }
};
var noInput = { type: "object", properties: {}, additionalProperties: false };
var tools = [
  {
    name: "room_unread",
    description: "Read the earliest unread room posts with nearby context. Full text shown by the returned tool result is recorded as read only after the next model request receives it. mentionCursor reads only mention locators.",
    input: { type: "object", properties: { cursor: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 }, mentionCursor: { type: "string" }, mentionsOnly: { type: "boolean" } }, additionalProperties: false }
  },
  {
    name: "room_history",
    description: "Browse room history by stable sequence cursors, optionally with a literal substring query and author member ID. Search snippets are previews and do not mark messages read.",
    input: { type: "object", properties: { query: { type: "string" }, cursor: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 }, authorMemberId: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "room_context",
    description: "Open one message's full text and up to 50 neighbors on each side. Quotes expand one level only.",
    input: { type: "object", properties: { messageId: { type: "string" }, before: { type: "integer", minimum: 0, maximum: 50 }, after: { type: "integer", minimum: 0, maximum: 50 } }, required: ["messageId"], additionalProperties: false }
  },
  {
    name: "room_members",
    description: "List stable member IDs, display names, human/agent identity and queried agent session status. Does not mark anything read or wake anyone.",
    input: noInput
  },
  {
    name: "room_questions",
    description: "List room questions by pending, answered or withdrawn status. Previews do not mark the original post read. Answered questions include an answerMessageId for room_context.",
    input: { type: "object", properties: { status: { enum: ["pending", "answered", "withdrawn"] }, cursor: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false }
  },
  {
    name: "room_post",
    description: "Post a short message, reply or peer question. Maximum display width 100. May return review_required without storing when recent unread messages must be read first. Sender identity comes only from this session.",
    input: { type: "object", properties: { text: { type: "string", minLength: 1 }, ...mentionFields }, required: ["text"], additionalProperties: false }
  },
  {
    name: "room_ask",
    description: "Ask the human an asynchronous room question without blocking this turn. Text is open-ended; options creates a single-choice question with at least two unique options. Question and options share the 100 display-width limit.",
    input: { type: "object", properties: { text: { type: "string", minLength: 1 }, options: { type: "array", minItems: 2, items: { type: "string", minLength: 1 } }, ...mentionFields }, required: ["text"], additionalProperties: false }
  },
  {
    name: "room_withdraw_question",
    description: "Withdraw your own pending room question, or let the host withdraw it. Optional note is limited to 100 display width. Does not wake the room.",
    input: { type: "object", properties: { questionId: { type: "string" }, note: { type: "string" }, replyToMessageId: { type: "string" }, duplicateOfQuestionId: { type: "string" } }, required: ["questionId"], additionalProperties: false }
  }
];
function collectPresentationIds(value, found) {
  if (typeof value === "string") {
    try {
      collectPresentationIds(JSON.parse(value), found);
    } catch {
      for (const match of value.matchAll(/"presentationId"\s*:\s*"(p_[a-zA-Z0-9_]+)"/g)) found.add(match[1]);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPresentationIds(item, found);
    return;
  }
  if (typeof value.presentationId === "string") found.add(value.presentationId);
  for (const item of Object.values(value)) collectPresentationIds(item, found);
}
function extractPresentations(value, found) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) extractPresentations(item, found);
    return;
  }
  const isTool = value.type === "tool" || value.type === "tool-result" || value.role === "tool" || typeof value.name === "string" && value.name.startsWith("room_");
  if (isTool) collectPresentationIds(value.result ?? value.output ?? value.content ?? value.state?.output ?? value.state?.metadata ?? value, found);
  for (const [key2, item] of Object.entries(value)) {
    if (key2 !== "output" && key2 !== "content" && key2 !== "state" && key2 !== "result" && item && typeof item === "object") extractPresentations(item, found);
  }
}
var index_default = {
  id: "multi-agent-discussion",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      for (const tool of tools) editor.add({ ...tool, options: { codemode: false }, execute: async (input, context) => {
        const result = await rpc("/plugin/tool", { sessionID: context.sessionID, name: tool.name, input }, context.signal);
        return { content: JSON.stringify(result) };
      } });
    });
    const candidates = /* @__PURE__ */ new Map();
    const seenPresentations = /* @__PURE__ */ new Set();
    await ctx.session.hook("context", (event) => {
      const found = /* @__PURE__ */ new Set();
      extractPresentations(event.messages, found);
      if (found.size && event.sessionID) {
        const current = candidates.get(event.sessionID) || /* @__PURE__ */ new Set();
        for (const item of found) if (!seenPresentations.has(item)) {
          current.add(item);
          void rpc("/plugin/observe", { presentationId: item, sessionID: event.sessionID }).catch(() => {
          });
        }
        candidates.set(event.sessionID, current);
      }
    });
    const RoomRPC = {
      id: "multi-agent-discussion",
      methods: {
        health: { input: { type: "object", properties: {}, additionalProperties: false }, output: { type: "object", properties: { plugin: { type: "string" }, version: { type: "string" } }, required: ["plugin", "version"], additionalProperties: false } },
        room: { input: { type: "object", properties: { roomId: { type: "string" } }, required: ["roomId"], additionalProperties: false }, output: { type: "object", additionalProperties: true } }
      },
      events: { changed: { schema: { type: "object", properties: { roomId: { type: "string" } }, required: ["roomId"], additionalProperties: false } } }
    };
    await ctx.rpc.register(RoomRPC, {
      health: async () => ({ plugin: "multi-agent-discussion", version: "0.1.2" }),
      room: async (input) => rpc("/plugin/rpc/room", input)
    });
    async function publishCatalog() {
      try {
        const result = await ctx.model.list();
        const models = Array.isArray(result) ? result : result?.data || [];
        await rpc("/plugin/catalog", { models, directory: ctx.location.directory });
      } catch (error) {
        if (error?.code !== "ENOENT" && !controller.signal.aborted) console.error("Discussion model catalog failed", error.message);
      }
    }
    let running = false;
    let wakeAgain = false;
    let lastUnavailableLog = 0;
    async function sendJobResult(job, result) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await rpc("/plugin/result", { job, result });
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (attempt < 2) await new Promise((resolveRetry) => setTimeout(resolveRetry, 100 * (attempt + 1)));
          else console.error("Discussion result acknowledgment failed", error.message);
        }
      }
    }
    async function syncSessionGrouping(job, existing) {
      const metadata = {
        ...existing.metadata,
        ...job.metadata,
        openchamber: { ...existing.metadata?.openchamber, ...job.metadata.openchamber }
      };
      await ctx.session.update({ sessionID: job.sessionId, title: job.title, metadata });
    }
    async function executeJob(job) {
      let result;
      try {
        if (job.type === "create-root-session") {
          const created = await ctx.session.create({
            id: job.sessionId,
            title: job.title,
            location: { directory: job.directory },
            metadata: job.metadata
          });
          if (created.metadata?.discussionRoomId !== job.roomId || created.metadata?.discussionRoot !== true) {
            throw new Error("The deterministic room root session ID belongs to different discussion metadata");
          }
          try {
            await ctx.session.synthetic({
              sessionID: created.id,
              id: `msg_discussion_root_${job.roomId}_v2`,
              text: job.note,
              description: "\u591A\u667A\u80FD\u4F53\u8BA8\u8BBA\u5BA4\u4F1A\u8BDD\u7EC4",
              resume: false,
              metadata: { source: "multi-agent-discussion-root", discussionRoomId: job.roomId }
            });
          } catch (error) {
            if (error?.code !== "CONFLICT") console.error("Discussion root note failed", error.message);
          }
          result = { outcome: "accepted", sessionId: created.id };
        } else if (job.type === "create-session") {
          const model = { providerID: job.model.providerID, id: job.model.id };
          if (job.model.variant) model.variant = job.model.variant;
          const created = await ctx.session.create({
            id: job.sessionId,
            title: job.title,
            location: { directory: job.directory },
            model,
            permissions: job.permissions,
            metadata: job.metadata
          });
          if (created.metadata?.discussionRoomId !== job.roomId || created.metadata?.discussionMemberId !== job.memberId) {
            throw new Error("The deterministic session ID belongs to different discussion metadata");
          }
          result = { outcome: "accepted", sessionId: created.id };
        } else if (job.type === "link-session") {
          const existing = await ctx.session.get({ sessionID: job.sessionId });
          await syncSessionGrouping(job, existing);
          result = { outcome: "accepted" };
        } else if (job.type === "change-session-model") {
          const model = { providerID: job.model.providerID, id: job.model.id };
          if (job.model.variant) model.variant = job.model.variant;
          await ctx.session.switchModel({ sessionID: job.sessionId, model });
          result = { outcome: "accepted" };
        } else if (job.type === "put-instructions") {
          await ctx.session.instructions.entry.put({ sessionID: job.sessionId, key: job.key, value: job.value });
          result = { outcome: "accepted" };
        } else if (job.type === "remove-instructions") {
          await ctx.session.instructions.entry.remove({ sessionID: job.sessionId, key: job.key });
          result = { outcome: "accepted" };
        } else if (job.type === "submit-reminder") {
          await ctx.session.prompt({
            sessionID: job.sessionId,
            id: job.inputId,
            text: job.text,
            delivery: job.delivery,
            resume: true,
            metadata: job.metadata
          });
          result = { outcome: "accepted" };
        } else throw new Error(`Unknown discussion job: ${job.type}`);
      } catch (error) {
        if (job.type === "create-root-session" || job.type === "create-session") {
          try {
            const existing = await ctx.session.get({ sessionID: job.sessionId });
            const matchesRoot = job.type === "create-root-session" && existing.metadata?.discussionRoomId === job.roomId && existing.metadata?.discussionRoot === true;
            const matchesMember = job.type === "create-session" && existing.metadata?.discussionRoomId === job.roomId && existing.metadata?.discussionMemberId === job.memberId;
            if (matchesRoot) {
              try {
                await ctx.session.synthetic({
                  sessionID: existing.id,
                  id: `msg_discussion_root_${job.roomId}_v2`,
                  text: job.note,
                  description: "\u591A\u667A\u80FD\u4F53\u8BA8\u8BBA\u5BA4\u4F1A\u8BDD\u7EC4",
                  resume: false,
                  metadata: { source: "multi-agent-discussion-root", discussionRoomId: job.roomId }
                });
              } catch (noteError) {
                if (noteError?.code !== "CONFLICT") console.error("Discussion root note failed", noteError.message);
              }
            }
            if (matchesMember && job.metadata?.openchamber) await syncSessionGrouping(job, existing);
            if (matchesRoot || matchesMember) result = { outcome: "accepted", sessionId: existing.id };
          } catch {
          }
        }
        result ||= { outcome: job.type === "submit-reminder" ? "unknown" : "failed", error: error.message };
      }
      await sendJobResult(job, result);
    }
    async function dispatch(trigger = "poll") {
      if (running) {
        wakeAgain = true;
        return;
      }
      running = true;
      try {
        do {
          wakeAgain = false;
          let response;
          try {
            response = await call("/plugin/work");
          } catch (error) {
            if (!controller.signal.aborted && Date.now() - lastUnavailableLog > 3e4) {
              lastUnavailableLog = Date.now();
              console.error(error?.code === "ENOENT" ? "Discussion bridge not found; check that OpenChamber and OpenCode share TMPDIR" : "Discussion service unavailable", error.message);
            }
            return;
          }
          if (!response.ok) throw new Error(`Discussion work returned ${response.status}`);
          const job = await response.json();
          if (job?.type) await executeJob(job);
          else if (wakeAgain) continue;
          else break;
        } while (wakeAgain && !controller.signal.aborted);
      } catch (error) {
        if (!controller.signal.aborted) console.error("Discussion dispatch failed", error.message);
      } finally {
        running = false;
      }
    }
    async function confirmPresentations(sessionID) {
      const pending = candidates.get(sessionID);
      if (!pending?.size) return;
      for (const presentationId of [...pending]) {
        try {
          const confirmation = await rpc("/plugin/present", { presentationId, sessionID });
          pending.delete(presentationId);
          seenPresentations.add(presentationId);
          if (!confirmation?.confirmed && !controller.signal.aborted) console.error("Discussion presentation was not confirmed", presentationId);
        } catch (error) {
          if (!controller.signal.aborted) console.error("Discussion presentation confirmation failed", error.message);
        }
      }
      const key2 = `discussion.pendingPresentations.${sessionID}`;
      if (!pending.size) {
        candidates.delete(sessionID);
        await ctx.storage.remove(key2);
      } else {
        await ctx.storage.set(key2, [...pending]);
      }
    }
    async function replayPresentations() {
      try {
        let after;
        do {
          const page = await ctx.storage.scan({ prefix: "discussion.pendingPresentations.", after, limit: 100 });
          for (const entry of page.entries) {
            const sessionID = entry.key.slice("discussion.pendingPresentations.".length);
            const ids = Array.isArray(entry.value) ? entry.value.filter((id) => typeof id === "string" && !seenPresentations.has(id)) : [];
            if (!ids.length) {
              await ctx.storage.remove(entry.key);
              continue;
            }
            const pending = candidates.get(sessionID) || /* @__PURE__ */ new Set();
            for (const id of ids) pending.add(id);
            candidates.set(sessionID, pending);
            await confirmPresentations(sessionID);
          }
          after = page.next;
        } while (after && !controller.signal.aborted);
      } catch (error) {
        if (!controller.signal.aborted) console.error("Discussion presentation replay failed", error.message);
      }
    }
    void (async () => {
      let retryDelay = 1e3;
      while (!controller.signal.aborted) {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal, types: [
            "session.execution.started",
            "session.execution.succeeded",
            "session.execution.failed",
            "session.execution.interrupted",
            "session.step.first-token",
            "model.updated",
            "provider.updated"
          ] })) {
            if (event.type === "model.updated" || event.type === "provider.updated") {
              void publishCatalog();
            } else if (event.type === "session.step.first-token") {
              const pending = candidates.get(event.data.sessionID);
              if (pending?.size) {
                try {
                  await ctx.storage.set(`discussion.pendingPresentations.${event.data.sessionID}`, [...pending]);
                } catch {
                }
              }
              await confirmPresentations(event.data.sessionID);
            } else {
              try {
                await rpc("/plugin/event", event);
              } catch {
              }
              void dispatch(event.type);
            }
          }
          retryDelay = 1e3;
        } catch (error) {
          if (!controller.signal.aborted) console.error("Discussion event subscription failed", error.message);
          await new Promise((resolveRetry) => setTimeout(resolveRetry, retryDelay));
          retryDelay = Math.min(3e4, retryDelay * 2);
          void replayPresentations();
        }
      }
    })();
    const poll = setInterval(() => void dispatch("poll"), 200);
    const catalog = setInterval(() => void publishCatalog(), 3e5);
    const catalogRetry = setTimeout(() => void publishCatalog(), 1500);
    const presentationReplay = setInterval(() => void replayPresentations(), 5e3);
    void publishCatalog();
    void replayPresentations();
    void dispatch("startup");
    return () => {
      controller.abort();
      clearInterval(poll);
      clearInterval(catalog);
      clearTimeout(catalogRetry);
      clearInterval(presentationReplay);
    };
  }
};
export {
  index_default as default
};
