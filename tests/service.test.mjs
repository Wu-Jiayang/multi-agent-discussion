import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { once } from "node:events";
import { createDiscussionService } from "../src/service/main.mjs";

async function fixture() {
  const root = mkdtempSync(join("/tmp/opencode", "room-service-test-"));
  const active = createServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ data: {} })); });
  active.listen(0, "127.0.0.1");
  await once(active, "listening");
  const serviceToken = "host-secret";
  const pluginToken = "plugin-secret";
  const serviceHost = { sessions: { status: async () => ({ status: "idle" }) }, emit: async () => {} };
  const service = createDiscussionService({
    serviceToken, pluginToken, tempRoot: root,
    opencodeURL: `http://127.0.0.1:${active.address().port}`,
    serviceHost,
  });
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  const base = `http://127.0.0.1:${service.server.address().port}`;
  async function call(method, path, body, plugin = false) {
    const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${plugin ? pluginToken : serviceToken}`, "content-type": "application/json" }, body: body == null ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  async function drainJobs() {
    const jobs = [];
    for (let guard = 0; guard < 30; guard += 1) {
      const response = await call("GET", "/plugin/work", null, true);
      const job = response.data;
      if (!job?.type) break;
      jobs.push(job);
      const result = job.type === "create-root-session" || job.type === "create-session"
        ? { outcome: "accepted", sessionId: job.sessionId }
        : { outcome: "accepted" };
      await call("POST", "/plugin/result", { job, result }, true);
    }
    return jobs;
  }
  return { root, active, service, serviceHost, call, drainJobs, close: async () => {
    service.store.close();
    await new Promise(resolveClose => service.server.close(resolveClose));
    await new Promise(resolveClose => active.close(resolveClose));
    rmSync(root, { recursive: true, force: true });
  } };
}

test("model catalog survives service restart", async () => {
  const root = mkdtempSync(join("/tmp/opencode", "room-catalog-test-"));
  const filename = join(root, "rooms.sqlite");
  const options = { database: filename, serviceToken: "host", pluginToken: "plugin", tempRoot: root };
  let service = createDiscussionService(options);
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  let base = `http://127.0.0.1:${service.server.address().port}`;
  await fetch(base + "/plugin/catalog", { method: "POST", headers: { authorization: "Bearer plugin", "content-type": "application/json" }, body: JSON.stringify({ directory: root, models: [{ providerID: "probe", id: "persisted", name: "Persisted", providerName: "Probe", variant: "high" }] }) });
  service.store.close();
  await new Promise(resolveClose => service.server.close(resolveClose));
  service = createDiscussionService(options);
  service.server.listen(0, "127.0.0.1");
  await once(service.server, "listening");
  base = `http://127.0.0.1:${service.server.address().port}`;
  const response = await fetch(base + `/models?directory=${encodeURIComponent(root)}`, { headers: { authorization: "Bearer host" } });
  const data = await response.json();
  assert.equal(data.models[0].id, "persisted");
  assert.equal(data.models[0].providerName, "Probe");
  assert.equal(data.models[0].variant, "high");
  assert.equal(data.source, "project");
  service.store.close();
  await new Promise(resolveClose => service.server.close(resolveClose));
  rmSync(root, { recursive: true, force: true });
});

test("HTTP service authenticates host/plugin separately and creates rooms without model calls", async () => {
  const f = await fixture();
  try {
    const unauthenticated = await fetch(`http://127.0.0.1:${f.service.server.address().port}/health`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(typeof (await f.call("GET", "/meta")).data.humanName, "string");
    assert.equal((await f.call("GET", "/health")).data.version, "0.1.2");
    assert.equal((await f.call("GET", "/plugin/work", null, true)).status, 200);
    assert.equal((await f.call("GET", "/rooms", null, true)).status, 404);
    await f.call("POST", "/plugin/catalog", { models: [{ providerID: "probe", id: "fake", name: "Fake" }] }, true);
    assert.equal((await f.call("GET", "/models")).data.models.length, 1);
    await f.call("POST", "/plugin/catalog", { models: [{ providerID: "other", id: "x" }], directory: "/other" }, true);
    assert.equal((await f.call("GET", "/models")).data.models[0].providerID, "other");
    const fallback = (await f.call("GET", "/models?directory=%2Fmissing")).data;
    assert.equal(fallback.source, "global");
    assert.equal(fallback.models[0].providerID, "other");
    const created = (await f.call("POST", "/rooms", { projectDir: f.root, title: "HTTP 房间", members: [
      { role: "generic", model: { providerID: "probe", id: "fake" } },
      { role: "reviewer", model: { providerID: "probe", id: "fake" } },
    ] })).data;
    const jobs = await f.drainJobs();
    assert.equal(jobs.filter(job => job.type === "create-root-session").length, 1);
    assert.equal(jobs.filter(job => job.type === "create-session").length, 2);
    assert.equal(jobs.filter(job => job.type === "put-instructions").length, 2);
    assert.equal(jobs.some(job => job.type === "submit-reminder"), false);
    const memberJobs = jobs.filter(job => job.type === "create-session");
    assert.ok(memberJobs.every(job => job.metadata.openchamber.kind === "operator-child"));
    assert.ok(memberJobs.every(job => job.metadata.openchamber.parentID === created.rootSessionId));
    const room = (await f.call("GET", `/rooms/${created.roomId}`)).data;
    assert.equal(room.status, "ready");
    assert.equal(room.rootCreationStatus, "ready");
    assert.equal(room.members.length, 2);
    assert.ok(room.members.every(member => member.sessionStatus === "idle"));
    const changed = await f.call("POST", `/rooms/${created.roomId}/members/${room.members[0].memberId}/model`, { model: { providerID: "probe", id: "replacement", name: "Replacement", providerName: "Probe" } });
    assert.equal(changed.data.model.id, "replacement");
    assert.equal(changed.data.modelSynced, false);
    const modelJobs = await f.drainJobs();
    assert.equal(modelJobs.filter(job => job.type === "change-session-model").length, 1);
  } finally { await f.close(); }
});

test("structured provider quota errors pause the room and refund the accepted reminder", async () => {
  const f = await fixture();
  try {
    const created = (await f.call("POST", "/rooms", { projectDir: f.root, title: "额度房间", members: [
      { role: "generic", model: { providerID: "probe", id: "fake" } },
      { role: "generic", model: { providerID: "probe", id: "fake" } },
    ] })).data;
    await f.drainJobs();
    const room = (await f.call("GET", `/rooms/${created.roomId}`)).data;
    await f.call("POST", `/rooms/${created.roomId}/messages`, { text: "触发唤醒", mentionMemberIds: [room.members[0].memberId] });
    const jobs = await f.drainJobs();
    const reminder = jobs.find(job => job.type === "submit-reminder");
    assert.ok(reminder);
    await f.call("POST", "/plugin/event", { type: "session.execution.started", id: "quota-start", data: { sessionID: reminder.sessionId } }, true);
    await f.call("POST", "/plugin/event", { type: "session.execution.failed", id: "quota-failed", data: { sessionID: reminder.sessionId, error: { type: "QuotaExceeded", message: "Insufficient balance" } } }, true);
    const paused = (await f.call("GET", `/rooms/${created.roomId}`)).data;
    assert.equal(paused.status, "paused");
    assert.equal(paused.pausedReason, "provider-quota");
    assert.equal(paused.budget.remaining, 49);
    assert.match(paused.members.find(member => member.memberId === reminder.memberId).lastError, /Insufficient balance/);
  } finally { await f.close(); }
});

test("plugin tools, presentation receipts, questions and safe workspace previews work over HTTP", async () => {
  const f = await fixture();
  try {
    const created = (await f.call("POST", "/rooms", { projectDir: f.root, title: "工具房间", members: [
      { role: "generic", model: { providerID: "probe", id: "fake" } },
      { role: "generic", model: { providerID: "probe", id: "fake" } },
    ] })).data;
    await f.drainJobs();
    const room = (await f.call("GET", `/rooms/${created.roomId}`)).data;
    const [a, b] = room.members;
    f.serviceHost.sessions.status = async () => ({ status: "waiting" });
    f.service.engine.hostEvent({ type: "question-asked", session: { id: a.sessionId } });
    assert.equal((await f.call("GET", `/rooms/${created.roomId}`)).data.members.find(member => member.memberId === a.memberId).sessionStatus, "waiting-question");
    f.serviceHost.sessions.status = async () => ({ status: "idle" });
    f.service.engine.hostEvent({ type: "turn-started", session: { id: a.sessionId } });
    const posted = (await f.call("POST", `/rooms/${created.roomId}/messages`, { text: "人类消息" })).data;
    await f.service.engine.flush();
    const reminders = await f.drainJobs();
    assert.equal(reminders.filter(job => job.type === "submit-reminder").length, 2, JSON.stringify({room:await f.call("GET", `/rooms/${created.roomId}`),diagnostics:await f.call("GET", `/rooms/${created.roomId}/diagnostics`)}));
    const unread = (await f.call("POST", "/plugin/tool", { sessionID: a.sessionId, name: "room_unread", input: {} }, true)).data;
    assert.equal(unread.items[0].messageId, posted.messageId);
    assert.equal((await f.call("GET", `/rooms/${created.roomId}/messages/${posted.messageId}/receipts`)).data.agents.length, 0);
    assert.equal((await f.call("GET", "/plugin/presentations", null, true)).data.items.length, 0);
    await f.call("POST", "/plugin/observe", { presentationId: unread.presentation.presentationId, sessionID: a.sessionId }, true);
    assert.equal((await f.call("GET", "/plugin/presentations", null, true)).data.items.length, 1);
    await f.call("POST", "/plugin/present", { presentationId: unread.presentation.presentationId, sessionID: a.sessionId }, true);
    assert.equal((await f.call("GET", `/rooms/${created.roomId}/messages/${posted.messageId}/receipts`)).data.agents.length, 1);
    const asked = (await f.call("POST", "/plugin/tool", { sessionID: a.sessionId, name: "room_ask", input: { text: "选哪个？", options: ["甲", "乙"] } }, true)).data;
    assert.equal(asked.status, "stored");
    await f.call("POST", `/rooms/${created.roomId}/questions/${asked.questionId}/answer`, { answer: "甲", note: "理由" });
    const answered = (await f.call("GET", `/rooms/${created.roomId}/questions?status=answered`)).data.items[0];
    assert.ok(answered.answerMessageId);
    assert.notEqual(answered.answerMessageId, asked.messageId);
    const tooLong = await f.call("POST", "/plugin/tool", { sessionID: a.sessionId, name: "room_post", input: { text: "界".repeat(51) } }, true);
    assert.equal(tooLong.status, 422);
    assert.equal(tooLong.data.error.code, "ROOM_MESSAGE_TOO_LONG");

    const workspace = (await f.call("GET", `/rooms/${created.roomId}`)).data.workspaceDir;
    writeFileSync(join(workspace, "note.md"), "# 讨论文档\n内容");
    mkdirSync(join(workspace, "review"));
    writeFileSync(join(workspace, "review", "findings.txt"), "findings");
    symlinkSync("/etc/passwd", join(workspace, "escape.md"));
    const listed = await f.call("POST", "/workspace/list", { roomId: created.roomId });
    assert.deepEqual(listed.data.entries.map(entry => entry.name), ["review", "note.md"]);
    assert.equal(listed.data.parentPath, null);
    assert.equal(listed.data.rootPath, realpathSync(workspace));
    assert.equal(listed.data.relativePath, "");
    assert.equal(listed.data.entries.find(entry => entry.name === "review").kind, "directory");
    assert.equal(listed.data.entries.find(entry => entry.name === "note.md").kind, "file");
    const nested = await f.call("POST", "/workspace/list", { roomId: created.roomId, path: join(workspace, "review") });
    assert.equal(nested.data.entries[0].relativePath, "review/findings.txt");
    assert.equal(nested.data.parentPath, workspace);
    assert.equal(nested.data.relativePath, "review");
    const workspaceAlias = join(f.root, "workspace-alias");
    const reviewAlias = join(f.root, "review-alias");
    symlinkSync(workspace, workspaceAlias);
    symlinkSync(join(workspace, "review"), reviewAlias);
    const aliasedRoot = await f.call("POST", "/workspace/list", { roomId: created.roomId, path: workspaceAlias });
    assert.equal(aliasedRoot.data.path, realpathSync(workspace));
    assert.equal(aliasedRoot.data.relativePath, "");
    const aliasedReview = await f.call("POST", "/workspace/list", { roomId: created.roomId, path: reviewAlias });
    assert.equal(aliasedReview.data.relativePath, "review");
    const escapedList = await f.call("POST", "/workspace/list", { roomId: created.roomId, path: "/etc" });
    assert.equal(escapedList.status, 403);
    assert.equal(escapedList.data.error.code, "ROOM_BAD_PATH");
    const preview = await f.call("POST", "/workspace/read", { roomId: created.roomId, path: join(workspace, "note.md") });
    assert.match(preview.data.content, /讨论文档/);
    const escaped = await f.call("POST", "/workspace/read", { roomId: created.roomId, path: join(workspace, "escape.md") });
    assert.equal(escaped.status, 403, JSON.stringify(escaped.data));
    assert.equal(escaped.data.error.code, "ROOM_BAD_PATH");
    assert.notEqual(a.sessionId, b.sessionId);
    await f.service.engine.flush();
  } finally { await f.close(); }
});
