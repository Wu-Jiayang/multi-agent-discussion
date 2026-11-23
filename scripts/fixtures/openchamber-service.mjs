// Headless smoke fixture, not the room implementation. No browser is needed.
import { createServer } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { displayWidth } from "./display-width.mjs";

const config = JSON.parse(readFileSync(new URL("./bridge.json", import.meta.url)));
const {
  OPENCHAMBER_SERVICE_PORT: port, OPENCHAMBER_SERVICE_TOKEN: hostToken,
  OPENCHAMBER_OPENCODE_URL: opencode,
} = process.env;
const state = existsSync(config.journal)
  ? JSON.parse(readFileSync(config.journal, "utf8"))
  : { pending: [], outstanding: {}, next: 0, trigger: null };
const { pending, outstanding } = state;
const MAX_POST_WIDTH = 100;

function save() {
  writeFileSync(config.journal + ".tmp", JSON.stringify(state), { mode: 0o600 });
  renameSync(config.journal + ".tmp", config.journal);
}

function reply(res, value, code = 200) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

async function nextBatch(trigger) {
  if (!pending.length && !Object.keys(outstanding).length) return null;
  const headers = { authorization: `Bearer ${hostToken}` };
  const activity = await fetch(`${opencode}/api/session/active`, { headers });
  if (!activity.ok) throw new Error(`Session activity returned ${activity.status}`);
  const busy = (await activity.json()).data;
  const groups = Map.groupBy(pending, item => item.recipient);
  const recipients = new Set([...groups.keys(), ...Object.keys(outstanding)]);
  for (const sessionID of recipients) {
    const posts = groups.get(sessionID) ?? [];
    const previous = outstanding[sessionID];
    const steer = posts.some(post => post.mention === sessionID);
    if (previous) {
      const message = await fetch(`${opencode}/api/session/${sessionID}/message/${previous.id}`, { headers });
      if (!message.ok) {
        if (message.status !== 404) throw new Error(`Previous message lookup returned ${message.status}`);
        if (steer && previous.delivery === "queue") return { promotion: previous };
        // Reuse the original ID after an unknown outcome, including a service restart.
        if (previous.acknowledged) continue;
        return { batch: previous.batch };
      }
      delete outstanding[sessionID];
      save();
    }
    if (!posts.length) continue;
    if (busy[sessionID] && !steer && !config.forceQueueRace) continue;
    const id = `msg_room_${posts[0].seq}`;
    for (const post of posts) pending.splice(pending.indexOf(post), 1);
    const batch = {
      sessionID, id, delivery: steer ? "steer" : "queue",
      text: posts.map(post => `[${post.seq} from ${post.author}] ${post.text}`).join("\n"),
      metadata: { roomIDs: posts.map(post => `room_${post.seq}`) },
    };
    outstanding[sessionID] = { sessionID, id, delivery: batch.delivery, batch, acknowledged: false };
    state.trigger = trigger;
    save();
    return { batch };
  }
  return null;
}

createServer(async (req, res) => {
  if (req.url === "/health" && req.headers.authorization === `Bearer ${hostToken}`) {
    return reply(res, { ready: true, pending: pending.length });
  }
  if (req.headers.authorization !== `Bearer ${config.token}`) {
    return reply(res, { error: "unauthorized" }, 403);
  }
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/state") {
    return reply(res, { pending: pending.length, trigger: state.trigger, pid: process.pid });
  }
  if (req.method === "POST" && url.pathname === "/restart-probe") {
    // Only this disposable fixture process exits, never OpenChamber or OpenCode.
    return res.end("", () => process.exit(0));
  }
  if (req.method === "GET" && url.pathname === "/next") {
    try {
      return reply(res, await nextBatch(url.searchParams.get("trigger")) ?? {});
    } catch (error) {
      return reply(res, { error: error.message }, 502);
    }
  }
  if (req.method !== "POST" || !["/post", "/ack"].includes(url.pathname)) return reply(res, {}, 404);
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) return reply(res, {}, 413);
    }
    const input = JSON.parse(body);
    if (url.pathname === "/ack") {
      const item = outstanding[input.sessionID];
      if (item?.id === input.id) {
        if (config.loseFirstAck && !existsSync(config.journal + ".lost-ack")) {
          writeFileSync(config.journal + ".lost-ack", "");
          return res.end("", () => process.exit(0));
        }
        item.acknowledged = true;
        item.delivery = input.delivery;
        save();
      }
      return reply(res, { acknowledged: true });
    }
    const { author, recipient, posts } = input;
    if (!author || !recipient || author === recipient || !Array.isArray(posts) ||
        !posts.length || !posts.every(post => typeof post.text === "string")) {
      return reply(res, {}, 400);
    }
    const normalized = posts.map(post => ({ ...post, text: post.text.trim() }));
    for (const post of normalized) {
      const actual = displayWidth(post.text, config.wideRanges);
      if (actual > MAX_POST_WIDTH) {
        return reply(res, { error: "ROOM_MESSAGE_TOO_LONG", actual, max: MAX_POST_WIDTH }, 422);
      }
    }
    pending.push(...normalized.map(post => ({ ...post, author, recipient, seq: ++state.next })));
    save();
    reply(res, { accepted: posts.length });
  } catch {
    reply(res, {}, 400);
  }
}).listen(Number(port), "127.0.0.1", () => {
  writeFileSync(config.endpoint, `http://127.0.0.1:${port}`, { mode: 0o600 });
});
