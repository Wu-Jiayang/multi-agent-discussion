// Headless smoke fixture, not the room implementation. No browser is needed.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("./bridge.json", import.meta.url)));
const {
  OPENCHAMBER_SERVICE_PORT: port, OPENCHAMBER_SERVICE_TOKEN: hostToken,
  OPENCHAMBER_OPENCODE_URL: opencode,
} = process.env;
const pending = [];
const outstanding = new Map();
let next = 0;

function reply(res, value, code = 200) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

async function nextBatch() {
  if (!pending.length) return null;
  const headers = { authorization: `Bearer ${hostToken}` };
  const activity = await fetch(`${opencode}/api/session/active`, { headers });
  if (!activity.ok) throw new Error(`Session activity returned ${activity.status}`);
  const busy = (await activity.json()).data;
  for (const [sessionID, posts] of Map.groupBy(pending, item => item.recipient)) {
    const previous = outstanding.get(sessionID);
    if (previous) {
      const message = await fetch(`${opencode}/api/session/${sessionID}/message/${previous}`, { headers });
      if (!message.ok) continue; // Never let a newer batch pass an unobserved older batch.
      outstanding.delete(sessionID);
    }
    const steer = posts.some(post => post.mention === sessionID);
    if (busy[sessionID] && !steer) continue;
    const id = `msg_room_${posts[0].seq}`;
    for (const post of posts) pending.splice(pending.indexOf(post), 1);
    outstanding.set(sessionID, id);
    return {
      sessionID, id, delivery: steer ? "steer" : "queue",
      text: posts.map(post => `[${post.seq} from ${post.author}] ${post.text}`).join("\n"),
      metadata: { roomIDs: posts.map(post => `room_${post.seq}`) },
    };
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
  if (req.method === "GET" && req.url === "/state") return reply(res, { pending: pending.length });
  if (req.method === "GET" && req.url === "/next") {
    try {
      return reply(res, { batch: await nextBatch() });
    } catch (error) {
      return reply(res, { error: error.message }, 502);
    }
  }
  if (req.method !== "POST" || req.url !== "/post") return reply(res, {}, 404);
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) return reply(res, {}, 413);
    }
    const { author, recipient, posts } = JSON.parse(body);
    if (!author || !recipient || author === recipient || !Array.isArray(posts) ||
        !posts.length || !posts.every(post => typeof post.text === "string")) {
      return reply(res, {}, 400);
    }
    pending.push(...posts.map(post => ({ ...post, author, recipient, seq: ++next })));
    reply(res, { accepted: posts.length });
  } catch {
    reply(res, {}, 400);
  }
}).listen(Number(port), "127.0.0.1", () => {
  writeFileSync(config.endpoint, `http://127.0.0.1:${port}`, { mode: 0o600 });
});
