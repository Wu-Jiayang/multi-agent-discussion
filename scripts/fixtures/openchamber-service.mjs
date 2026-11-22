// Headless smoke fixture, not the room implementation. No browser is needed.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("./bridge.json", import.meta.url)));
const { OPENCHAMBER_SERVICE_PORT: port, OPENCHAMBER_SERVICE_TOKEN: hostToken } = process.env;
const pending = [];
const batches = [];
let next = 0;
let timer;

function reply(res, value, code = 200) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  if (req.url === "/health" && req.headers.authorization === `Bearer ${hostToken}`) {
    return reply(res, { ready: true, pending: pending.length, batches: batches.length });
  }
  if (req.headers.authorization !== `Bearer ${config.token}`) {
    return reply(res, { error: "unauthorized" }, 403);
  }
  if (req.method === "GET" && req.url === "/next") {
    return reply(res, { batch: batches.shift() ?? null });
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
    timer ??= setTimeout(() => {
      const rooms = Map.groupBy(pending.splice(0), item => item.recipient);
      for (const [sessionID, posts] of rooms) {
        batches.push({
          sessionID,
          id: `msg_room_${posts[0].seq}`,
          delivery: posts.some(post => post.mention === sessionID) ? "steer" : "queue",
          text: posts.map(post => `[${post.seq} from ${post.author}] ${post.text}`).join("\n"),
          metadata: { roomIDs: posts.map(post => `room_${post.seq}`) },
        });
      }
      timer = undefined;
    }, 300);
    reply(res, { accepted: posts.length });
  } catch {
    reply(res, {}, 400);
  }
}).listen(Number(port), "127.0.0.1", () => {
  writeFileSync(config.endpoint, `http://127.0.0.1:${port}`, { mode: 0o600 });
});
