import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const repo = resolve(fileURLToPath(new URL("../", import.meta.url)));
const root = mkdtempSync(join("/tmp/opencode", "discussion-smoke-"));
const children = [];
let modelServer;
let releaseB;
let release;
let memberB = "";
const modelRequests = [];
const toolCalls = [];
const deliveredRoomResults = [];

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolvePort(port)); });
  });
}
function start(args, env, logName) {
  mkdirSync(root, { recursive: true });
  const fd = openSync(join(root, logName), "w");
  const child = spawn(args[0], args.slice(1), { cwd: root, env, stdio: ["ignore", fd, fd], detached: process.platform !== "win32" });
  children.push(child);
  return child;
}
async function stop(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  const signal = code => {
    try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, code); else child.kill(code); } catch {}
  };
  signal("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise(resolveStop => setTimeout(resolveStop, 3000))]);
  if (child.exitCode == null && child.signalCode == null) {
    signal("SIGKILL");
    await Promise.race([once(child, "exit"), new Promise(resolveStop => setTimeout(resolveStop, 1000))]);
  }
}
async function until(test, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await test(); if (value) return value; } catch (error) { lastError = error; }
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out: ${label}${lastError ? `\nLast error: ${lastError.message}` : ""}\nModel requests: ${JSON.stringify(modelRequests.slice(-8))}`);
}
function basic(password) { return "Basic " + Buffer.from(`opencode:${password}`).toString("base64"); }

async function main() {
  const opencodePort = await freePort();
  const chamberPort = await freePort();
  const password = "smoke-password";
  const opencodeBase = `http://127.0.0.1:${opencodePort}`;
  const chamberBase = `http://127.0.0.1:${chamberPort}`;
  const opencodeAuth = basic(password);

  modelServer = createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(404).end(); return; }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw);
    const messages = data.messages || [];
    const serialized = JSON.stringify(messages);
    for (const message of messages) {
      if (message.role !== "tool" || typeof message.content !== "string") continue;
      try { deliveredRoomResults.push(JSON.parse(message.content)); } catch {}
    }
    const lastUser = [...messages].reverse().find(message => message.role === "user");
    const userText = lastUser?.content || "";
    const tools = (data.tools || []).map(tool => tool.function.name);
    modelRequests.push({ userText, tools, at: Date.now() });
    if (userText.includes("HOLD_B")) {
      await Promise.race([releaseB.promise, new Promise(resolveHold => setTimeout(resolveHold, 20000))]);
    }
    let delta;
    if (messages.at(-1)?.role !== "tool" && userText.includes("CALL_MENTION")) {
      toolCalls.push({ name: "room_post", args: { text: "请看这条", mentionMemberIds: [memberB] } });
      delta = { role: "assistant", tool_calls: [{ index: 0, id: "call_mention", type: "function", function: { name: "room_post", arguments: JSON.stringify({ text: "请看这条", mentionMemberIds: [memberB] }) } }] };
    } else if (messages.at(-1)?.role !== "tool" && userText.includes("CALL_POST")) {
      toolCalls.push({ name: "room_post", args: { text: "Agent 的真实发言" } });
      delta = { role: "assistant", tool_calls: [{ index: 0, id: "call_post", type: "function", function: { name: "room_post", arguments: JSON.stringify({ text: "Agent 的真实发言" }) } }] };
    } else if (messages.at(-1)?.role !== "tool" && serialized.includes("条未读") && tools.includes("room_unread")) {
      toolCalls.push({ name: "room_unread", args: {} });
      delta = { role: "assistant", tool_calls: [{ index: 0, id: "call_unread", type: "function", function: { name: "room_unread", arguments: "{}" } }] };
    } else delta = { role: "assistant", content: "mock complete" };
    const finish = delta.tool_calls ? "tool_calls" : "stop";
    const chunks = [
      { delta, finish_reason: null },
      { delta: {}, finish_reason: finish },
    ];
    const body = chunks.map(chunk => `data: ${JSON.stringify({ id: "chatcmpl-room", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: data.model, choices: [{ index: 0, ...chunk }] })}\n\n`).join("") + "data: [DONE]\n\n";
    res.writeHead(200, { "content-type": "text/event-stream", "content-length": Buffer.byteLength(body) });
    res.end(body);
  });
  modelServer.listen(0, "127.0.0.1");
  await once(modelServer, "listening");

  mkdirSync(join(root, ".opencode/plugins/probe"), { recursive: true });
  writeFileSync(join(root, "opencode.json"), JSON.stringify({ providers: { probe: {
    name: "Room smoke", env: ["PROBE_API_KEY"], package: "@opencode/ai/providers/openai-compatible",
    settings: { baseURL: `http://127.0.0.1:${modelServer.address().port}/v1` },
    models: {
      "fake-model": { name: "Fake model", capabilities: { toolcall: true } },
      "other-model": { name: "Other fake model", capabilities: { toolcall: true } },
    },
  } } }));
  const env = {
    PATH: process.env.PATH, HOME: root, TMPDIR: root, PROBE_API_KEY: "mock",
    OPENCODE_DB: join(root, "opencode.sqlite"), OPENCODE_PASSWORD: password,
    XDG_CONFIG_HOME: join(root, "config"), XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
  };
  const opencode = start(["opencode", "serve", "--hostname", "127.0.0.1", "--port", String(opencodePort), "--print-logs"], env, "opencode.log");
  const chamberEnv = { ...env, OPENCODE_HOST: opencodeBase, OPENCODE_SKIP_START: "1", OPENCHAMBER_DATA_DIR: join(root, "chamber-data") };
  const chamber = start(["openchamber", "serve", "--foreground", "--api-only", "--port", String(chamberPort)], chamberEnv, "openchamber.log");

  async function oc(path, payload, method) {
    const response = await fetch(opencodeBase + path, { method: method || (payload ? "POST" : "GET"), headers: { authorization: opencodeAuth, "content-type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  }
  async function chamberApi(path, payload, method) {
    const response = await fetch(chamberBase + path, { method: method || (payload ? "POST" : "GET"), headers: { origin: chamberBase, "content-type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  }
  async function chamberControl(action, input) {
    return chamberApi("/api/openchamber/control", { action, input, contextDirectory: root });
  }
  async function service(method, path, body) {
    const wrapped = await chamberApi("/api/guests/multi-agent-discussion/service/request", { method, path, body: body == null ? undefined : JSON.stringify(body) });
    const data = wrapped.body ? JSON.parse(wrapped.body) : null;
    if (wrapped.status >= 400) throw new Error(`${path}: ${wrapped.status} ${JSON.stringify(data)}`);
    return data;
  }

  try {
    await until(async () => { try { return await oc("/api/info"); } catch { return false; } }, "OpenCode ready");
    await until(async () => { try { return chamberApi("/api/guests"); } catch { return false; } }, "OpenChamber ready");
    const installed = await chamberApi("/api/guests", { path: repo });
    assert.equal(installed.guest.id, "multi-agent-discussion");
    const requested = installed.guest.capabilities.requested;
    assert.ok(requested.includes("service") && requested.includes("opencodePlugin") && requested.includes("sessionControl"));
    await chamberApi("/api/guests/multi-agent-discussion/capabilities", { granted: requested }, "PUT");
    await chamberApi("/api/guests/multi-agent-discussion/opencode-plugin/global-config", {}, "POST");
    await until(async () => {
      try { const plugins = await oc("/api/plugin"); return plugins.data?.some(plugin => plugin.id === "multi-agent-discussion"); } catch { return false; }
    }, "discussion plugin loaded");

    const packageKey = createHash("sha256").update(repo).digest("hex").slice(0, 20);
    const bridgeFile = join(root, "opencode/discussions", `service-${packageKey}.json`);
    await until(() => existsSync(bridgeFile), "service bridge");
    const bridge = JSON.parse(readFileSync(bridgeFile, "utf8"));
    assert.match(bridge.endpoint, /^http:\/\/127\.0\.0\.1:/);
    const bridgeHealth = await fetch(bridge.endpoint + "/health", { headers: { authorization: `Bearer ${bridge.token}` } });
    assert.equal(bridgeHealth.status, 200);
    assert.equal((await bridgeHealth.json()).version, "0.1.3");
    console.log("Discussion plugin:", JSON.stringify((await oc("/api/plugin")).data.find(plugin => plugin.id === "multi-agent-discussion")));
    await until(async () => (await service("GET", "/models")).models.some(model => model.providerID === "probe"), "model catalog");

    const created = await service("POST", "/rooms", {
      projectDir: root, title: "真实闭环", preset: "generic",
      members: [
        { role: "generic", displayName: "甲", model: { providerID: "probe", id: "fake-model" } },
        { role: "reviewer", displayName: "乙", model: { providerID: "probe", id: "fake-model" } },
      ],
    });
    const roomId = created.roomId;
    let room;
    try {
      await until(async () => { room = await service("GET", `/rooms/${roomId}`); return room.status === "ready"; }, "room sessions ready");
    } catch (error) {
      console.error("Room state:", JSON.stringify(room, null, 2));
      console.error("Diagnostics:", JSON.stringify((await service("GET", `/rooms/${roomId}/diagnostics`)).items.slice(-20), null, 2));
      throw error;
    }
    assert.equal(modelRequests.length, 0, "creation must not call a model");
    assert.equal(new Set(room.members.map(member => member.sessionId)).size, 2);
    assert.equal(room.rootCreationStatus, "ready");
    assert.ok(room.rootSessionId);
    const rootInfo = await oc(`/api/session/${room.rootSessionId}`);
    assert.equal(rootInfo.data.metadata.discussionRoot, true);
    assert.equal(rootInfo.data.parentID, undefined);
    const rootInbox = await oc(`/api/session/${room.rootSessionId}/inbox`);
    assert.ok(rootInbox.data.some(item => JSON.stringify(item).includes("不会向本会话调用模型")), JSON.stringify(rootInbox));
    const [a, b] = room.members;
    memberB = b.memberId;
    for (const member of room.members) {
      const info = await oc(`/api/session/${member.sessionId}`);
      assert.equal(info.data.parentID, undefined);
      assert.deepEqual(info.data.metadata.openchamber, { kind: "operator-child", parentID: room.rootSessionId });
      assert.ok(info.data.permissions.some(rule => rule.action === "*" && rule.effect === "allow"));
      assert.ok(info.data.permissions.some(rule => rule.action === "question" && rule.effect === "deny"));
      const entries = await oc(`/api/experimental/session/${member.sessionId}/instructions/entries`);
      assert.ok(entries.data.some(entry => entry.key === "discussions.room"));
    }
    const topLevelSessions = await chamberControl("session.list", { directory: root, limit: 100 });
    assert.ok(topLevelSessions.sessions.some(session => session.id === room.rootSessionId));
    assert.ok(topLevelSessions.sessions.every(session => !room.members.some(member => member.sessionId === session.id)));
    const nestedSessions = await chamberControl("session.list", { directory: root, limit: 100, children: true });
    for (const member of room.members) {
      const listed = nestedSessions.sessions.find(session => session.id === member.sessionId);
      assert.equal(listed?.parentID, room.rootSessionId);
    }

    for (const member of room.members) {
      const info = await oc(`/api/session/${member.sessionId}`);
      await oc(`/api/session/${member.sessionId}`, { metadata: { ...info.data.metadata, openchamber: { kind: "workflow-agent", parentID: room.rootSessionId } } }, "PATCH");
    }
    await oc(`/api/session/${room.rootSessionId}`, null, "DELETE");
    await until(async () => {
      room = await service("GET", `/rooms/${roomId}`);
      if (room.rootCreationStatus !== "ready" || !room.members.every(member => member.sessionLinked)) return false;
      try { await oc(`/api/session/${room.rootSessionId}`); return true; } catch { return false; }
    }, "deleted room root rebuilt and member links restored");
    assert.equal(room.rootSessionId, rootInfo.data.id);
    const rebuiltRootInbox = await oc(`/api/session/${room.rootSessionId}/inbox`);
    assert.ok(rebuiltRootInbox.data.some(item => JSON.stringify(item).includes("成员会话显示在本会话下方")));
    for (const member of room.members) {
      const info = await oc(`/api/session/${member.sessionId}`);
      assert.deepEqual(info.data.metadata.openchamber, { kind: "operator-child", parentID: room.rootSessionId });
    }
    const relinkedSessions = await chamberControl("session.list", { directory: root, limit: 100, children: true });
    assert.ok(relinkedSessions.sessions.filter(session => session.parentID === room.rootSessionId).length >= room.members.length);

    await service("POST", `/rooms/${roomId}/members/${a.memberId}/model`, { model: { providerID: "probe", id: "other-model", name: "Other fake model", providerName: "Room smoke" } });
    await until(async () => {
      room = await service("GET", `/rooms/${roomId}`);
      return room.members.find(member => member.memberId === a.memberId)?.modelSynced === true;
    }, "member model switched");
    const switchedModel = await oc(`/api/session/${a.sessionId}`);
    assert.equal(switchedModel.data.model.id, "other-model");

    writeFileSync(join(room.workspaceDir, "smoke.md"), "# 房间文件");
    const workspaceFiles = await service("POST", "/workspace/list", { roomId });
    assert.ok(workspaceFiles.entries.some(entry => entry.name === "smoke.md" && entry.kind === "file"));
    const workspacePreview = await service("POST", "/workspace/read", { roomId, path: join(room.workspaceDir, "smoke.md") });
    assert.match(workspacePreview.content, /房间文件/);

    const health = await oc("/api/rpc/multi-agent-discussion/health", { input: {} }, "POST");
    assert.equal((health.output || health.data || health).plugin, "multi-agent-discussion");
    assert.equal((health.output || health.data || health).version, "0.1.3");

    const first = await service("POST", `/rooms/${roomId}/messages`, { text: "真人首帖：请审查这个方案。" });
    try {
      await until(() => modelRequests.filter(request => request.userText.includes("条未读")).length >= 2, "ordinary reminders reached both agents");
    } catch (error) {
      console.error("Reminder state:", JSON.stringify(await service("GET", `/rooms/${roomId}`), null, 2));
      console.error("Diagnostics:", JSON.stringify((await service("GET", `/rooms/${roomId}/diagnostics`)).items.slice(-20), null, 2));
      throw error;
    }
    try {
      await until(async () => (await service("GET", `/rooms/${roomId}/messages/${first.messageId}/receipts`)).agents.length === 2, "model-context read receipts");
    } catch (error) {
      console.error("Tool calls:", JSON.stringify(toolCalls.slice(-10), null, 2));
      console.error("Diagnostics:", JSON.stringify((await service("GET", `/rooms/${roomId}/diagnostics`)).items.slice(-20), null, 2));
      throw error;
    }
    room = await service("GET", `/rooms/${roomId}`);
    assert.equal(room.budget.used, 2);
    assert.ok(modelRequests.filter(request => request.userText.includes("条未读")).every(request => !request.tools.includes("question")));

    await oc(`/api/session/${a.sessionId}/prompt`, { text: "CALL_POST" });
    await until(() => toolCalls.some(call => call.name === "room_post"), "agent room_post tool");
    await until(async () => (await service("GET", `/rooms/${roomId}/timeline`)).items.some(message => message.text === "Agent 的真实发言"), "agent post stored");
    const postResult = await until(() => deliveredRoomResults.find(result => result?.status === "stored" && result.timeline?.some(message => message.text === "Agent 的真实发言")), "model receives the post and recent messages");
    assert.equal(postResult.checkDecision, undefined);
    assert.equal(postResult.presentation, undefined);
    assert.equal(postResult.timeline.at(-1).label, undefined);
    const storedTool = await until(async () => {
      const context = await oc(`/api/session/${a.sessionId}/context`);
      return context.data.flatMap(message => message.type === "assistant" ? message.content : [])
        .find(part => part.type === "tool" && part.name === "room_post" && part.state.metadata?.discussionPresentationId);
    }, "post receipt metadata persisted outside the model output");
    assert.match(storedTool.state.metadata.discussionPresentationId, /^p_/);
    await until(async () => {
      const state = await service("GET", `/rooms/${roomId}`);
      return state.reminders.some(reminder => reminder.kind === "queue" && reminder.status === "accepted" && reminder.snapshotSeq > first.roomSeq);
    }, "ordinary agent reply reminder");

    releaseB = { promise: new Promise(resolveRelease => { release = resolveRelease; }) };
    await oc(`/api/session/${b.sessionId}/prompt`, { text: "HOLD_B" });
    await until(() => modelRequests.some(request => request.userText.includes("HOLD_B")), "recipient busy");
    await oc(`/api/session/${a.sessionId}/prompt`, { text: "CALL_MENTION" });
    let urgent;
    await until(async () => {
      const state = await service("GET", `/rooms/${roomId}`);
      urgent = state.reminders.find(reminder => reminder.kind === "steer" && reminder.status === "accepted");
      return urgent;
    }, "busy steer accepted");
    let urgentInbox;
    await until(async () => {
      urgentInbox = (await oc(`/api/session/${b.sessionId}/inbox`)).data.find(item => item.id === urgent.inputId);
      return urgentInbox;
    }, "urgent reminder admitted to inbox");
    assert.match(urgentInbox.payload.text, /条未读，其中 1 条 @ 你/);
    assert.doesNotMatch(urgentInbox.payload.text, /请看这条/);
    release();
    await until(() => {
      const holdIndex = modelRequests.findIndex(request => request.userText.includes("HOLD_B"));
      return holdIndex >= 0 && modelRequests.slice(holdIndex + 1).some(request => request.userText.includes("条未读"));
    }, "steer delivered at tool boundary");
    await until(async () => {
      const timeline = await service("GET", `/rooms/${roomId}/timeline`);
      const mention = timeline.items.find(message => message.text === "请看这条");
      return mention && (await service("GET", `/rooms/${roomId}/messages/${mention.messageId}/receipts`)).agents.some(item => item.memberId === b.memberId);
    }, "mentioned message read");

    const finalRoom = await service("GET", `/rooms/${roomId}`);
    assert.ok(finalRoom.budget.used <= finalRoom.budget.limit);
    assert.equal(finalRoom.members.length, 2);
    console.log("PASS real OpenChamber/OpenCode room smoke");
    console.log(JSON.stringify({ roomId, sessions: finalRoom.members.map(member => member.sessionId), budget: finalRoom.budget, modelRequests: modelRequests.length, toolCalls }, null, 2));
  } finally {
    release?.();
    await stop(opencode);
    await stop(chamber);
    modelServer.closeAllConnections?.();
    await new Promise(resolveClose => modelServer.close(resolveClose));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  for (const name of ["opencode.log", "openchamber.log"]) {
    const file = join(root, name);
    if (existsSync(file)) console.error(`\n--- ${name} ---\n${readFileSync(file, "utf8").slice(-12000)}`);
  }
  process.exitCode = 1;
}).finally(async () => {
  for (const child of children) await stop(child);
  rmSync(root, { recursive: true, force: true });
});
