import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir, userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createServiceHost, readSessionEventRequest } from "@openchamber/sdk";
import { RoomStore } from "../core/room-store.mjs";
import { RoomEngine } from "../core/room-engine.mjs";
import { asRoomError, RoomError } from "../core/errors.mjs";
import { MAX_AGENT_MESSAGE_WIDTH, UNICODE_IMPLEMENTATION } from "../core/display-width.mjs";

const VERSION = "0.1.3";
const MAX_BODY = 1024 * 1024;

function packageRoot() {
  return resolve(fileURLToPath(new URL("../", import.meta.url)));
}

export function resolveTempRoot(env = process.env) {
  const explicit = env.OPENCODE_TMP_DIR || env.OPENCHAMBER_DISCUSSION_TMP_ROOT;
  if (explicit) return resolve(explicit);
  const inherited = env.TMPDIR || env.TEMP || env.TMP || tmpdir();
  return basename(inherited) === "opencode" ? resolve(inherited) : join(resolve(inherited), "opencode");
}

function rendezvousTempRoot(env = process.env) {
  const inherited = env.TMPDIR || env.TEMP || env.TMP || tmpdir();
  return basename(inherited) === "opencode" ? resolve(inherited) : join(resolve(inherited), "opencode");
}

function bridgePath(root = packageRoot()) {
  const key = createHash("sha256").update(root).digest("hex").slice(0, 20);
  return join(rendezvousTempRoot(), "discussions", `service-${key}.json`);
}

function atomicWrite(filename, value) {
  mkdirSync(resolve(filename, ".."), { recursive: true });
  writeFileSync(filename + ".tmp", value, { mode: 0o600 });
  renameSync(filename + ".tmp", filename);
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function body(req) {
  let text = "";
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new RoomError("ROOM_REQUEST_TOO_LARGE", "Request body is too large.", {}, 413);
    text += chunk;
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new RoomError("ROOM_INVALID_JSON", "Request body must be JSON.", {}, 400); }
}

function defaultHumanName() {
  try { return userInfo().username || "房主"; } catch { return "房主"; }
}

function normalizeModels(models) {
  return (Array.isArray(models) ? models : []).map(model => ({
    providerID: model.providerID, id: model.id, name: model.name || model.id,
    providerName: model.providerName || model.provider?.name || model.providerID,
    capabilities: model.capabilities || {}, ...(model.variant ? { variant: model.variant } : {}),
  }));
}

export function createDiscussionService(options = {}) {
  const store = options.store || new RoomStore(options.database || ":memory:");
  const serviceToken = options.serviceToken || randomBytes(32).toString("base64url");
  const pluginToken = options.pluginToken || randomBytes(32).toString("base64url");
  const tempRoot = options.tempRoot || resolveTempRoot();
  const opencodeURL = options.opencodeURL || process.env.OPENCHAMBER_OPENCODE_URL || "";
  const serviceHost = options.serviceHost || null;
  const waitKinds = options.waitKinds || new Map();
  const modelCatalogFile = options.modelCatalogFile || (options.database && options.database !== ":memory:" ? `${options.database}.models.json` : null);
  let catalogSnapshot = {};
  if (modelCatalogFile) {
    try { catalogSnapshot = JSON.parse(readFileSync(modelCatalogFile, "utf8")); } catch {}
  }
  let models = options.models || catalogSnapshot.global || [];
  const modelCatalogs = new Map(Object.entries(catalogSnapshot.directories || {}));
  const statusCache = new Map();
  const statusErrors = new Map();
  let engine;

  async function opencode(path) {
    if (!opencodeURL) throw new Error("OpenCode read access is unavailable");
    const response = await fetch(opencodeURL.replace(/\/$/, "") + path, {
      headers: { authorization: `Bearer ${serviceToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const error = new Error(`OpenCode read returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function statusProvider(sessionID) {
    const cached = statusCache.get(sessionID);
    if (cached && Date.now() - cached.at < 300) return cached.value;
    let value = { status: "unknown" };
    try {
      const [activeResponse, hostState] = await Promise.all([
        opencode("/api/session/active"),
        serviceHost ? serviceHost.sessions.status(sessionID) : Promise.reject(new Error("Host status unavailable")),
      ]);
      const hostStatus = hostState?.status;
      const active = activeResponse.data || {};
      if (hostStatus === "waiting") value = { status: waitKinds.get(sessionID) || "waiting-human" };
      else if (hostStatus === "busy" || active[sessionID]) value = { status: "running" };
      else if (hostStatus === "idle") value = { status: "idle" };
    } catch (error) {
      if (statusErrors.get(sessionID) !== error.message) {
        statusErrors.set(sessionID, error.message);
        store.diagnostic("status-provider-error", { sessionId: sessionID, error: error.message });
      }
    }
    statusCache.set(sessionID, { at: Date.now(), value });
    return value;
  }

  engine = options.engine || new RoomEngine(store, {
    statusProvider, waitKinds,
    rootSessionProvider: sessionID => opencode(`/api/session/${encodeURIComponent(sessionID)}`),
    onChange: event => {
      statusCache.clear();
      if (serviceHost) void serviceHost.emit("room:changed", event).catch(() => {});
    },
  });

  function human(roomId) { return { kind: "human", memberId: store.room(roomId).human_id }; }
  function query(url) { return Object.fromEntries(url.searchParams); }
  function roomIdFrom(path) {
    const match = path.match(/^\/rooms\/([^/]+)(?:\/(.*))?$/);
    return match ? { roomId: decodeURIComponent(match[1]), rest: match[2] || "" } : null;
  }

  function resolveWorkspacePath(roomId, requested) {
    const room = store.room(roomId);
    if (typeof requested !== "string" || !isAbsolute(requested) || requested.includes("\0")) throw new RoomError("ROOM_BAD_PATH", "Use an absolute path inside this room's temporary directory.", {}, 400);
    const base = realpathSync(room.workspace_dir);
    let target;
    try { target = realpathSync(requested); } catch { throw new RoomError("ROOM_FILE_NOT_FOUND", "The discussion path does not exist.", {}, 404); }
    if (target !== base && !target.startsWith(base + sep)) throw new RoomError("ROOM_BAD_PATH", "The path leaves this room's temporary directory.", {}, 403);
    return { base, target };
  }

  function listWorkspace(roomId, requested) {
    const { base, target } = resolveWorkspacePath(roomId, requested);
    const info = statSync(target);
    if (!info.isDirectory()) throw new RoomError("ROOM_BAD_PATH", "Only discussion directories can be listed.", {}, 400);
    const entries = [];
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      let path;
      try { path = realpathSync(join(target, entry.name)); } catch { continue; }
      if (path !== base && !path.startsWith(base + sep)) continue;
      const stat = statSync(path);
      if (!stat.isDirectory() && !stat.isFile()) continue;
      entries.push({
        name: entry.name, path, relativePath: relative(base, path),
        kind: stat.isDirectory() ? "directory" : "file",
        size: stat.isFile() ? stat.size : null, mtime: stat.mtime.toISOString(),
      });
    }
    entries.sort((a, b) => a.kind !== b.kind ? (a.kind === "directory" ? -1 : 1) : a.name.localeCompare(b.name, "zh-CN"));
    return {
      rootPath: base, path: target, relativePath: relative(base, target),
      parentPath: target === base ? null : resolve(target, ".."), entries,
    };
  }

  function readWorkspace(roomId, requested) {
    const { target } = resolveWorkspacePath(roomId, requested);
    const info = statSync(target);
    if (!info.isFile()) throw new RoomError("ROOM_BAD_PATH", "Only regular files can be previewed.", {}, 400);
    if (info.size > 2 * 1024 * 1024) throw new RoomError("ROOM_FILE_TOO_LARGE", "The preview limit is 2 MB.", {}, 413);
    return { path: target, content: readFileSync(target, "utf8") };
  }

  async function route(req, res, url) {
    const auth = req.headers.authorization;
    const isPlugin = auth === `Bearer ${pluginToken}`;
    if (auth !== `Bearer ${serviceToken}` && !isPlugin) return json(res, 401, { error: { code: "ROOM_UNAUTHORIZED", message: "Unauthorized." } });
    if (url.pathname === "/health") return json(res, 200, { ready: true, version: VERSION });
    if (isPlugin) {
      if (req.method === "GET" && url.pathname === "/plugin/work") return json(res, 200, await engine.dispatchNext() || {});
      if (req.method === "POST" && url.pathname === "/plugin/result") {
        const input = await body(req);
        return json(res, 200, await engine.jobResult(input.job, input.result || {}));
      }
      if (req.method === "POST" && url.pathname === "/plugin/tool") {
        const input = await body(req);
        return json(res, 200, await engine.tool(input.sessionID, input.name, input.input || {}));
      }
      if (req.method === "POST" && url.pathname === "/plugin/event") {
        const event = await body(req);
        const type = event.type.replace("session.execution.", "");
        engine.executionEvent(event.data?.sessionID, type, event.id || (event.durable?.seq ? `${type}:${event.durable.seq}` : null), event.data?.error || null);
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/plugin/observe") {
        const input = await body(req);
        return json(res, 200, { observed: store.observePresentation(input.presentationId, input.sessionID) });
      }
      if (req.method === "GET" && url.pathname === "/plugin/presentations") return json(res, 200, { items: store.pendingPresentations() });
      if (req.method === "POST" && url.pathname === "/plugin/present") {
        const input = await body(req);
        return json(res, 200, engine.confirmPresentation(input.presentationId, input.sessionID));
      }
      if (req.method === "POST" && url.pathname === "/plugin/catalog") {
        const input = await body(req);
        models = normalizeModels(input.models);
        if (input.directory) modelCatalogs.set(input.directory, models);
        if (modelCatalogFile) atomicWrite(modelCatalogFile, JSON.stringify({ global: models, directories: Object.fromEntries(modelCatalogs) }));
        if (serviceHost) void serviceHost.emit("models:changed", { directory: input.directory || null }).catch(() => {});
        return json(res, 200, { ok: true, count: models.length });
      }
      if (req.method === "POST" && url.pathname === "/plugin/rpc/room") {
        const input = await body(req);
        return json(res, 200, await engine.roomState(input.roomId));
      }
      return json(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Plugin route not found." } });
    }

    if (req.method === "POST" && url.pathname === "/session-events") {
      const raw = await reqText(req);
      const request = readSessionEventRequest(raw);
      if (!request) return json(res, 400, { ok: false, error: "not a session event" });
      engine.hostEvent(request.event);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/meta") return json(res, 200, { humanName: defaultHumanName() });
    if (req.method === "GET" && url.pathname === "/room-for-root-session") {
      return json(res, 200, store.roomForRootSession(query(url).sessionId || ""));
    }
    if (req.method === "GET" && url.pathname === "/models") {
      const directory = query(url).directory;
      const scoped = directory ? modelCatalogs.get(directory) : undefined;
      const catalog = scoped ?? models;
      const source = catalog.length ? (scoped ? "project" : "global") : "empty";
      return json(res, 200, { models: catalog, source, unicode: UNICODE_IMPLEMENTATION, maxAgentWidth: MAX_AGENT_MESSAGE_WIDTH });
    }
    if (req.method === "GET" && url.pathname === "/rooms") return json(res, 200, { rooms: engine.listRooms(query(url).projectDir || null) });
    if (req.method === "POST" && url.pathname === "/rooms") {
      const input = await body(req);
      const name = input.humanName || defaultHumanName();
      return json(res, 200, engine.createRoom({ ...input, humanName: name, tempRoot }));
    }
    if (req.method === "POST" && url.pathname === "/workspace/list") {
      const input = await body(req);
      const room = store.room(input.roomId);
      return json(res, 200, listWorkspace(input.roomId, input.path || room.workspace_dir));
    }
    if (req.method === "POST" && url.pathname === "/workspace/read") {
      const input = await body(req);
      return json(res, 200, readWorkspace(input.roomId, input.path));
    }

    const target = roomIdFrom(url.pathname);
    if (!target) return json(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Route not found." } });
    const { roomId, rest } = target;
    if (req.method === "GET" && !rest) return json(res, 200, await engine.roomState(roomId));
    if (req.method === "POST" && rest === "retry") return json(res, 200, engine.retryCreation(roomId));
    if (req.method === "POST" && rest === "messages") {
      const input = await body(req);
      return json(res, 200, engine.post(roomId, human(roomId), input));
    }
    if (req.method === "GET" && rest === "timeline") return json(res, 200, engine.timeline(roomId, query(url)));
    if (req.method === "GET" && rest === "questions") return json(res, 200, engine.questions(roomId, query(url)));
    if (req.method === "GET" && rest === "mentions") return json(res, 200, { items: engine.mentionCandidates(roomId) });
    if (req.method === "GET" && rest === "diagnostics") return json(res, 200, { items: engine.diagnostics(roomId, query(url).after || 0) });
    const answerMatch = rest.match(/^questions\/([^/]+)\/answer$/);
    if (req.method === "POST" && answerMatch) {
      const input = await body(req);
      return json(res, 200, engine.answer(roomId, decodeURIComponent(answerMatch[1]), input));
    }
    const withdrawMatch = rest.match(/^questions\/([^/]+)\/withdraw$/);
    if (req.method === "POST" && withdrawMatch) {
      const input = await body(req);
      return json(res, 200, engine.withdraw(roomId, human(roomId), decodeURIComponent(withdrawMatch[1]), input));
    }
    const contextMatch = rest.match(/^messages\/([^/]+)\/context$/);
    if (req.method === "GET" && contextMatch) return json(res, 200, engine.context(roomId, decodeURIComponent(contextMatch[1]), query(url)));
    const receiptMatch = rest.match(/^messages\/([^/]+)\/receipts$/);
    if (req.method === "GET" && receiptMatch) return json(res, 200, engine.receipts(roomId, decodeURIComponent(receiptMatch[1])));
    if (req.method === "POST" && rest === "read") {
      const input = await body(req);
      return json(res, 200, engine.markRead(roomId, store.room(roomId).human_id, input.messageIds || [], "ui"));
    }
    if (req.method === "POST" && rest === "pause") return json(res, 200, engine.pause(roomId, "manual"));
    if (req.method === "POST" && rest === "resume") {
      const input = await body(req);
      return json(res, 200, engine.resume(roomId, Number(input.budgetLimit) || 50));
    }
    if (req.method === "POST" && rest === "end") return json(res, 200, engine.end(roomId));
    const modelMatch = rest.match(/^members\/([^/]+)\/model$/);
    if (req.method === "POST" && modelMatch) {
      const input = await body(req);
      return json(res, 200, engine.changeModel(roomId, decodeURIComponent(modelMatch[1]), input.model));
    }
    const renameMatch = rest.match(/^members\/([^/]+)\/rename$/);
    if (req.method === "POST" && renameMatch) {
      const input = await body(req);
      return json(res, 200, engine.rename(roomId, decodeURIComponent(renameMatch[1]), input.displayName));
    }
    return json(res, 404, { error: { code: "ROOM_NOT_FOUND", message: "Route not found." } });
  }

  async function reqText(req) {
    let text = "";
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new RoomError("ROOM_REQUEST_TOO_LARGE", "Request body is too large.", {}, 413);
      text += chunk;
    }
    return text;
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    route(req, res, url).catch(error => {
      const normalized = asRoomError(error);
      if (!res.headersSent) json(res, normalized.status, { error: { code: normalized.code, message: normalized.message, details: normalized.details } });
      else res.end();
    });
  });

  return { server, engine, store, serviceToken, pluginToken, tempRoot, getModels: () => models };
}

export function writeBridge(info, root = packageRoot()) {
  const filename = bridgePath(root);
  atomicWrite(filename, JSON.stringify({ endpoint: `http://127.0.0.1:${info.server.address().port}`, token: info.pluginToken, version: VERSION }, null, 2));
  return filename;
}

async function main() {
  const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
  const token = process.env.OPENCHAMBER_SERVICE_TOKEN;
  if (!port || !token) throw new Error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  const dataDir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || join(packageRoot(), ".runtime");
  mkdirSync(dataDir, { recursive: true });
  const serviceHost = createServiceHost({ env: process.env });
  const service = createDiscussionService({
    database: join(dataDir, "rooms.sqlite"), serviceToken: token,
    opencodeURL: process.env.OPENCHAMBER_OPENCODE_URL, serviceHost,
  });
  service.server.listen(port, "127.0.0.1", () => {
    writeBridge(service);
    service.engine.start(1000);
    console.log(`Multi-agent discussion service ${VERSION} listening on 127.0.0.1:${port}`);
  });
  const stop = () => { service.engine.timer && clearInterval(service.engine.timer); service.store.close(); service.server.close(() => process.exit(0)); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.env.OPENCHAMBER_SERVICE_PORT) await main();
