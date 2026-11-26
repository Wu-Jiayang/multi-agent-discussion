import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RoomStore } from "../src/core/room-store.mjs";
import { RoomEngine } from "../src/core/room-engine.mjs";
import { displayWidth } from "../src/core/display-width.mjs";

const roots = [];
function scratch() {
  const root = mkdtempSync(join("/tmp/opencode", "room-test-"));
  roots.push(root);
  return root;
}
function source(member) { return { kind: "agent", memberId: member.id }; }
function human(store, roomId) { return { kind: "human", memberId: store.room(roomId).human_id }; }

function setup({ budgetLimit = 50, filename = ":memory:", memberCount = 3 } = {}) {
  const root = scratch();
  const store = new RoomStore(filename);
  let clock = Date.parse("2026-11-26T10:00:00.000Z");
  const statuses = new Map();
  const engine = new RoomEngine(store, {
    now: () => new Date(clock).toISOString(),
    statusProvider: async sessionId => ({ status: statuses.get(sessionId) || "idle" }),
  });
  const summary = engine.createRoom({
    projectDir: root, title: "测试房间", tempRoot: root, budgetLimit,
    members: Array.from({ length: memberCount }, (_, index) => ({
      role: index === 2 ? "reviewer" : "generic", model: { providerID: "probe", id: `m${index + 1}` },
    })),
  });
  const roomId = summary.roomId;
  for (let guard = 0; guard < 20; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    assert.equal(job.type === "submit-reminder", false, "creation must not wake a model");
    if (job.type === "create-session") {
      assert.equal(job.directory, root);
      assert.ok(job.permissions.some(rule => rule.action === "question" && rule.effect === "deny"));
      assert.equal(job.metadata.openchamber.kind, "operator-child");
      assert.equal(job.metadata.openchamber.parentID, store.room(roomId).root_session_id);
      statuses.set(job.sessionId, "idle");
    }
    const result = job.type === "create-root-session" || job.type === "create-session"
      ? { outcome: "accepted", sessionId: job.sessionId }
      : { outcome: "accepted" };
    void engine.jobResult(job, result);
  }
  assert.equal(store.room(roomId).status, "ready");
  return {
    store, engine, roomId, statuses, root,
    members: store.agents(roomId),
    tick: ms => { clock += ms; },
    setStatus: (index, status) => statuses.set(store.agents(roomId)[index].session_id, status),
    close: () => store.close(),
  };
}

function confirm(engine, result, member) {
  if (result?.presentation) return engine.confirmPresentation(result.presentation.presentationId, member.session_id);
  return { confirmed: false };
}

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("display width is grapheme-based and shared limits hold at 100/101", () => {
  assert.equal(displayWidth("a".repeat(100)), 100);
  assert.equal(displayWidth("界".repeat(50)), 100);
  assert.equal(displayWidth("界".repeat(50) + "a"), 101);
  assert.equal(displayWidth("e\u0301"), 1);
  assert.equal(displayWidth("\u0301"), 0);
  assert.equal(displayWidth("Ａ"), 2);
  assert.equal(displayWidth("§"), 1);
  assert.equal(displayWidth("👨‍👩‍👧‍👦"), 2);
  assert.equal(displayWidth("ab🙂"), 4);
  assert.equal(displayWidth("\n\t"), 2);
});

test("creation makes independent empty sessions, unique names and per-session instructions", async () => {
  const { store, engine, roomId, members } = setup();
  assert.equal(new Set(members.map(member => member.session_id)).size, 3);
  assert.deepEqual(members.slice(0, 2).map(member => member.display_name), ["Agent 1", "Agent 2"]);
  assert.equal(members[2].display_name, "审查者");
  for (const member of members) {
    const instructions = store.instructions(roomId, member.id).value;
    assert.match(instructions, new RegExp(member.display_name));
    assert.match(instructions, new RegExp(member.id));
    assert.match(instructions, /共享临时目录/);
    assert.match(instructions, /room_unread/);
    if (member.role === "generic") assert.doesNotMatch(instructions, /兼做核验/);
  }
  assert.match(store.instructions(roomId, members[2].id).value, /兼做核验/);
  assert.equal(engine.nextJob(), null);
});

test("room root session is a model-free sidebar container and members link to it", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  assert.equal(rootJob.model, undefined);
  assert.equal(rootJob.permissions, undefined);
  assert.equal(rootJob.metadata.discussionRoot, true);
  assert.match(rootJob.note, /不会向本会话调用模型/);
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  const memberJob = engine.nextJob();
  assert.equal(memberJob.type, "create-session");
  assert.equal(memberJob.parentID, undefined);
  assert.deepEqual(memberJob.metadata.openchamber, { kind: "operator-child", parentID: rootJob.sessionId });
  assert.equal(store.room(room.roomId).root_creation_status, "ready");
});

test("schema 6 migration re-links existing member sessions as visible operator children", async () => {
  const filename = join(scratch(), "rooms.sqlite");
  const legacy = new RoomStore(filename);
  const engine = new RoomEngine(legacy);
  const room = engine.createRoom({ projectDir: scratch(), tempRoot: scratch(), members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  legacy.db.prepare("UPDATE rooms SET root_session_id='ses_legacy_root',root_creation_status='ready' WHERE id=?").run(room.roomId);
  for (const member of legacy.agents(room.roomId)) {
    legacy.db.prepare("UPDATE members SET session_id=?,creation_status='ready',instructions_added=1,session_linked=1 WHERE id=?").run(`ses_legacy_${member.id}`, member.id);
  }
  legacy.db.prepare("UPDATE meta SET value='5' WHERE key='schema'").run();
  legacy.close();

  const upgraded = new RoomStore(filename);
  try {
    assert.equal(upgraded.db.prepare("SELECT value FROM meta WHERE key='schema'").get().value, "6");
    assert.ok(upgraded.agents(room.roomId).every(member => member.session_linked === 0));
    const upgradedEngine = new RoomEngine(upgraded);
    const rootRefresh = upgradedEngine.nextJob();
    assert.equal(rootRefresh.type, "create-root-session");
    assert.equal(rootRefresh.sessionId, "ses_legacy_root");
    await upgradedEngine.jobResult(rootRefresh, { outcome: "accepted", sessionId: rootRefresh.sessionId });
    for (const member of upgraded.agents(room.roomId)) {
      const link = upgradedEngine.nextJob();
      assert.equal(link.type, "link-session");
      assert.equal(link.sessionId, `ses_legacy_${member.id}`);
      assert.deepEqual(link.metadata.openchamber, { kind: "operator-child", parentID: "ses_legacy_root" });
    }
  } finally { upgraded.close(); }
});

test("room root creation failures back off and retry the same deterministic session", async () => {
  const root = scratch();
  const store = new RoomStore();
  let clock = Date.parse("2026-11-26T10:00:00.000Z");
  const engine = new RoomEngine(store, { now: () => new Date(clock).toISOString() });
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  const first = engine.nextJob();
  await engine.jobResult(first, { outcome: "failed", error: "temporary root failure" });
  assert.equal(store.room(room.roomId).root_creation_status, "failed");
  assert.match(store.room(room.roomId).root_creation_error, /temporary root failure/);
  const member = engine.nextJob();
  assert.equal(member.type, "create-session");
  assert.equal(member.metadata.openchamber, undefined);
  await engine.jobResult(member, { outcome: "accepted", sessionId: member.sessionId });
  assert.equal(store.member(member.memberId).session_linked, 0);
  const instructions = engine.nextJob();
  assert.equal(instructions.type, "put-instructions");
  await engine.jobResult(instructions, { outcome: "accepted" });
  clock += 5000;
  const retry = engine.nextJob();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(retry.sessionId, first.sessionId);
});

test("ended rooms do not gain a new sidebar root", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  engine.end(room.roomId);
  assert.equal(engine.nextJob(), null);
  assert.equal(store.room(room.roomId).root_creation_status, "pending");
});

test("root existence check failures are cached instead of blocking every room refresh", async () => {
  const root = scratch();
  const store = new RoomStore();
  let checks = 0;
  const engine = new RoomEngine(store, {
    rootSessionProvider: async () => {
      checks += 1;
      throw Object.assign(new Error("unavailable"), { status: 503 });
    },
  });
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  for (let guard = 0; guard < 10; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted", sessionId: job.sessionId });
  }
  await engine.roomState(room.roomId);
  await engine.roomState(room.roomId);
  assert.equal(checks, 1);
});

test("a deleted room root is rebuilt and member links are restored", async () => {
  const root = scratch();
  const store = new RoomStore();
  let missing = false;
  const engine = new RoomEngine(store, {
    rootSessionProvider: async () => {
      if (missing) throw Object.assign(new Error("missing"), { status: 404 });
      return { id: "root" };
    },
  });
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  for (let guard = 0; guard < 10; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted", sessionId: job.sessionId });
  }
  const rootSessionId = store.room(room.roomId).root_session_id;
  missing = true;
  await engine.roomState(room.roomId);
  assert.equal(store.room(room.roomId).root_creation_status, "pending");
  assert.ok(store.agents(room.roomId).every(member => member.session_linked === 0));
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  assert.equal(rootJob.sessionId, rootSessionId);
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  for (const member of store.agents(room.roomId)) {
    const link = engine.nextJob();
    assert.equal(link.type, "link-session");
    assert.equal(link.sessionId, member.session_id);
    await engine.jobResult(link, { outcome: "accepted" });
  }
});

test("existing rooms gain a root and logical member links without model calls", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "reviewer", model: { providerID: "p", id: "b" } },
  ] });
  store.db.prepare("UPDATE rooms SET status='ready',root_session_id=NULL,root_creation_status='pending' WHERE id=?").run(room.roomId);
  for (const [index, member] of store.agents(room.roomId).entries()) {
    store.db.prepare("UPDATE members SET session_id=?,creation_status='ready',instructions_added=1,session_linked=0 WHERE id=?").run(`ses_old_${index}`, member.id);
  }
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  for (const member of store.agents(room.roomId)) {
    const link = engine.nextJob();
    assert.equal(link.type, "link-session");
    assert.equal(link.sessionId, member.session_id);
    assert.equal(link.metadata.openchamber.parentID, rootJob.sessionId);
    await engine.jobResult(link, { outcome: "accepted" });
  }
  assert.equal(engine.nextJob(), null);
  assert.ok(store.agents(room.roomId).every(member => member.session_linked === 1));
});

test("debate stances follow creation order and renaming refreshes every roster", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, preset: "debate", members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  for (let guard = 0; guard < 10; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted", sessionId: job.sessionId });
  }
  const [first, second] = store.agents(room.roomId);
  assert.match(store.instructions(room.roomId, first.id).value, /初始立场：可以默认重试/);
  assert.match(store.instructions(room.roomId, second.id).value, /初始立场：默认不要重试/);
  engine.rename(room.roomId, first.id, "新提案者");
  assert.ok(store.agents(room.roomId).every(member => member.instructions_added === 0));
  for (let guard = 0; guard < 4; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted" });
  }
  assert.match(store.instructions(room.roomId, second.id).value, /新提案者/);
  assert.doesNotMatch(store.instructions(room.roomId, second.id).value, /Agent 1/);
});

test("partial creation retry only fills the missing session", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  const first = engine.nextJob();
  assert.equal(first.type, "create-session");
  await engine.jobResult(first, { outcome: "accepted", sessionId: first.sessionId });
  const firstInstructions = engine.nextJob();
  assert.equal(firstInstructions.type, "put-instructions");
  await engine.jobResult(firstInstructions, { outcome: "accepted" });
  const second = engine.nextJob();
  await engine.jobResult(second, { outcome: "failed", error: "provider unavailable" });
  assert.equal(store.room(room.roomId).status, "creating");
  assert.equal(engine.nextJob(), null);
  engine.retryCreation(room.roomId);
  const retry = engine.nextJob();
  assert.equal(retry.memberId, second.memberId);
  assert.equal(retry.sessionId, second.sessionId);
  await engine.jobResult(retry, { outcome: "accepted", sessionId: retry.sessionId });
  const instruction = engine.nextJob();
  await engine.jobResult(instruction, { outcome: "accepted" });
  assert.equal(store.room(room.roomId).status, "ready");
  assert.equal(store.member(first.memberId).session_id, first.sessionId);
});

test("identity comes from the plugin session; invalid mentions reject the whole draft", async () => {
  const { store, engine, roomId, members } = setup();
  const result = engine.post(roomId, source(members[0]), { text: "真实作者", senderId: members[1].id, displayName: "伪造" });
  assert.equal(store.message(result.messageId).author_id, members[0].id);
  const before = store.roomSummary(store.room(roomId)).latestSeq;
  assert.throws(() => engine.post(roomId, source(members[0]), { text: "不会写入", mentionMemberIds: ["m_cross_room"] }), error => error.code === "ROOM_INVALID_MENTION");
  assert.equal(store.roomSummary(store.room(roomId)).latestSeq, before);
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadCount, 1);
});

test("ordinary posts unread everyone; structured mentions are urgent and never self-wake", async () => {
  const { store, engine, roomId, members } = setup();
  await engine.flush();
  const ordinary = engine.post(roomId, source(members[0]), { text: "普通帖 @Agent 2" });
  await engine.flush();
  assert.match(ordinary.mentionHint, /未点名 @Agent 2/);
  assert.equal(store.unreadSummary(roomId, members[0].id, []).unreadCount, 0);
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadCount, 1);
  assert.equal(store.unreadSummary(roomId, members[2].id, []).unreadCount, 1);
  assert.equal(store.dueReminders(roomId).filter(row => row.kind === "steer").length, 0);
  engine.post(roomId, source(members[0]), { text: "点名", mentionMemberIds: [members[1].id, members[1].id, members[0].id] });
  const urgent = store.dueReminders(roomId).filter(row => row.kind === "steer");
  assert.equal(urgent.length, 1);
  assert.equal(urgent[0].member_id, members[1].id);
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadMentionCount, 1);
});

test("mentionAll urgently targets every other agent exactly once", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 3 });
  engine.post(roomId, source(members[0]), { text: "全员注意", mentionAll: true });
  await engine.flush();
  const urgent = store.dueReminders(roomId).filter(row => row.kind === "steer");
  assert.deepEqual(new Set(urgent.map(row => row.member_id)), new Set([members[1].id, members[2].id]));
  assert.equal(urgent.some(row => row.member_id === members[0].id), false);
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadMentionCount, 1);
  assert.equal(store.unreadSummary(roomId, members[2].id, []).unreadMentionCount, 1);
});

test("an accepted urgent reminder covers an older unsubmitted ordinary reminder", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "普通" });
  await engine.flush();
  assert.equal(store.dueReminders(roomId).filter(row => row.kind === "queue").length, 1);
  engine.post(roomId, source(members[0]), { text: "紧急", mentionMemberIds: [members[1].id] });
  const urgent = await engine.dispatchNext();
  assert.equal(urgent.delivery, "steer");
  await engine.jobResult(urgent, { outcome: "accepted" });
  assert.equal(store.dueReminders(roomId).filter(row => row.kind === "queue").length, 0);
  assert.equal(store.room(roomId).budget_remaining, 49);
});

test("a definitively failed urgent reminder releases budget and leaves ordinary delivery available", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "普通" });
  await engine.flush();
  engine.post(roomId, source(members[0]), { text: "紧急", mentionMemberIds: [members[1].id] });
  const urgent = await engine.dispatchNext();
  await engine.jobResult(urgent, { outcome: "failed", error: "rejected" });
  await engine.jobResult(urgent, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 50);
  const ordinary = await engine.dispatchNext();
  assert.equal(ordinary.delivery, "queue");
  await engine.jobResult(ordinary, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 49);
});

test("post receipt keeps room order, expands one quote, and confirms reads only after presentation", async () => {
  const { store, engine, roomId, members } = setup();
  const first = engine.post(roomId, source(members[1]), { text: "第一条" });
  const read = store.unread(roomId, members[0].id);
  confirm(engine, read, members[0]);
  const second = engine.post(roomId, source(members[1]), { text: "第二条", replyToMessageId: first.messageId });
  store.db.prepare("UPDATE members SET last_check_at=? WHERE id=?").run("2026-11-26T10:00:00.000Z", members[0].id);
  const third = engine.post(roomId, source(members[0]), { text: "第三条", replyToMessageId: second.messageId });
  assert.deepEqual(third.timeline.map(row => row.roomSeq), [1, 2, 3]);
  assert.equal(third.timeline[2].isOwn, true);
  assert.equal(third.timeline[2].replyTo.text, "第二条");
  assert.equal(third.timeline[2].replyTo.replyTo, undefined);
  assert.equal(store.hasRead(members[0].id, second.messageId), false);
  confirm(engine, third, members[0]);
  assert.equal(store.hasRead(members[0].id, second.messageId), true);
  assert.equal(store.hasRead(members[0].id, first.messageId), true);
});

test("pre-send review shares a 30 second window between post and ask", async () => {
  const { store, engine, roomId, members, tick } = setup();
  engine.post(roomId, source(members[1]), { text: "请先读" });
  const blocked = engine.post(roomId, source(members[0]), { text: "草稿" });
  assert.equal(blocked.status, "review_required");
  assert.equal(blocked.checkDecision, "executed");
  assert.equal(store.roomSummary(store.room(roomId)).latestSeq, 1);
  assert.equal(blocked.unread.unreadCount, 0);
  confirm(engine, blocked, members[0]);
  tick(10000);
  const asked = engine.ask(roomId, source(members[0]), { text: "问真人", options: ["甲", "乙"] });
  assert.equal(asked.status, "stored");
  assert.equal(asked.checkDecision, "skipped");
  tick(19000);
  assert.equal(engine.post(roomId, source(members[0]), { text: "窗口内" }).status, "stored");
  engine.post(roomId, source(members[1]), { text: "新未读" });
  tick(1000);
  assert.equal(engine.post(roomId, source(members[0]), { text: "再次检查" }).status, "review_required");
});

test("over-width drafts do not write or refresh the check window", async () => {
  const { store, engine, roomId, members, tick } = setup();
  engine.post(roomId, source(members[1]), { text: "未读" });
  assert.throws(() => engine.post(roomId, source(members[0]), { text: "界".repeat(51) }), error => error.code === "ROOM_MESSAGE_TOO_LONG" && error.details.actual === 102);
  assert.equal(store.member(members[0].id).last_check_at, null);
  assert.equal(engine.post(roomId, source(members[0]), { text: "合格草稿" }).status, "review_required");
  const checkedAt = store.member(members[0].id).last_check_at;
  tick(1000);
  assert.throws(() => engine.ask(roomId, source(members[0]), { text: "界".repeat(51) }), error => error.code === "ROOM_MESSAGE_TOO_LONG");
  assert.equal(store.member(members[0].id).last_check_at, checkedAt);
});

test("history search is preview-only, cursors bind filters, context opens full text", async () => {
  const { store, engine, roomId, members } = setup();
  const old = engine.post(roomId, source(members[1]), { text: "关键词 甲" });
  for (let index = 0; index < 25; index += 1) engine.post(roomId, human(store, roomId), { text: `其他 ${index}` });
  const search = store.history(roomId, { query: "关键词", viewerMemberId: members[0].id });
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0].messageId, old.messageId);
  assert.equal(search.items[0].author.displayName, "Agent 2");
  assert.equal(search.items[0].preview, true);
  assert.equal(store.hasRead(members[0].id, old.messageId), false);
  assert.equal(store.history(roomId, { query: "[", viewerMemberId: members[0].id }).items.length, 0);
  const latest = store.history(roomId, { limit: 5, viewerMemberId: members[0].id });
  const older = store.history(roomId, { limit: 5, viewerMemberId: members[0].id, cursor: latest.previousCursor });
  assert.equal(older.items[0].roomSeq, 17);
  assert.throws(() => store.history(roomId, { query: "不同", cursor: latest.previousCursor }), error => error.code === "ROOM_INVALID_CURSOR");
  const context = store.context(roomId, old.messageId, { viewerMemberId: members[0].id, before: 0, after: 0 });
  assert.equal(context.items[0].full, true);
  confirm(engine, context, members[0]);
  assert.equal(store.hasRead(members[0].id, old.messageId), true);
});

test("long human posts remain previews and do not clear unread", async () => {
  const { store, engine, roomId, members } = setup();
  const posted = engine.post(roomId, human(store, roomId), { text: "长".repeat(5000) });
  assert.equal(posted.status, "stored");
  const history = store.history(roomId, { viewerMemberId: members[0].id });
  assert.equal(history.items[0].full, false);
  assert.equal(history.unread.unreadCount, 1);
  confirm(engine, history, members[0]);
  assert.equal(store.hasRead(members[0].id, posted.messageId), false);
});

test("choice questions validate options and human answers create one linked broadcast", async () => {
  const { store, engine, roomId, members } = setup();
  assert.throws(() => engine.ask(roomId, source(members[0]), { text: "选择", options: ["只有一个"] }), error => error.code === "ROOM_INVALID_INPUT");
  const asked = engine.ask(roomId, source(members[0]), { text: "选择哪种？", options: ["只读重试", "默认不重试"] });
  assert.equal(store.questions(roomId).items[0].questionId, asked.questionId);
  const beforeMentions = store.unreadSummary(roomId, members[0].id, []).unreadMentionCount;
  const answered = engine.answer(roomId, asked.questionId, { answer: "只读重试", note: "写操作要幂等键" });
  assert.equal(answered.status, "answered");
  assert.equal(store.questions(roomId).items.length, 0);
  assert.equal(store.questions(roomId, { status: "answered" }).items[0].answerMessageId, answered.answerMessageId);
  const urgent = store.dueReminders(roomId).find(row => row.kind === "steer" && row.member_id === members[0].id);
  assert.equal(urgent.reason, "question-answered");
  assert.equal(urgent.answer_message_id, answered.answerMessageId);
  assert.equal(store.unreadSummary(roomId, members[0].id, []).unreadMentionCount, beforeMentions);
  assert.throws(() => engine.answer(roomId, asked.questionId, { answer: "默认不重试" }), error => error.code === "ROOM_QUESTION_CONFLICT");
});

test("only asker or host can withdraw; withdrawal is conditional and stays searchable", async () => {
  const { store, engine, roomId, members } = setup();
  const asked = engine.ask(roomId, source(members[0]), { text: "重复问题？" });
  assert.throws(() => engine.withdraw(roomId, source(members[1]), asked.questionId, {}), error => error.code === "ROOM_FORBIDDEN");
  assert.equal(engine.withdraw(roomId, source(members[0]), asked.questionId, { note: "已有答案" }).status, "withdrawn");
  assert.equal(store.questions(roomId).items.length, 0);
  assert.equal(store.questions(roomId, { status: "withdrawn" }).items.length, 1);
  assert.throws(() => engine.withdraw(roomId, human(store, roomId), asked.questionId, {}), error => error.code === "ROOM_QUESTION_CONFLICT");
});

test("busy mention uses steer, ordinary waits, and round-end reminders repeat without duplicate charge", async () => {
  const { store, engine, roomId, members, statuses, setStatus } = setup({ budgetLimit: 3, memberCount: 2 });
  const recipient = members[1];
  statuses.set(recipient.session_id, "running");
  engine.post(roomId, source(members[0]), { text: "普通" });
  await engine.flush();
  assert.equal(store.dueReminders(roomId).filter(row => row.member_id === recipient.id && row.kind === "queue").length, 0);
  engine.post(roomId, source(members[0]), { text: "紧急", mentionMemberIds: [recipient.id] });
  const urgentJob = await engine.dispatchNext();
  assert.equal(urgentJob.delivery, "steer");
  assert.match(urgentJob.text, /2 条未读，其中 1 条 @ 你/);
  assert.doesNotMatch(urgentJob.text, /普通/);
  await engine.jobResult(urgentJob, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 2);
  engine.executionEvent(recipient.session_id, "started", "evt-start");
  engine.executionEvent(recipient.session_id, "succeeded", "evt-end");
  setStatus(1, "idle");
  await engine.flush();
  await engine.recheckMember(roomId, recipient.id);
  const normalJob = await engine.dispatchNext();
  assert.equal(normalJob.delivery, "queue");
  await engine.jobResult(normalJob, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 1);
  engine.executionEvent(recipient.session_id, "started", "evt-start-2");
  engine.executionEvent(recipient.session_id, "succeeded", "evt-end-2");
  engine.executionEvent(recipient.session_id, "succeeded", "evt-end-2");
  setStatus(1, "idle");
  await engine.flush();
  await engine.recheckMember(roomId, recipient.id);
  const again = await engine.dispatchNext();
  assert.equal(again.delivery, "queue");
  await engine.jobResult(again, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 0);
  assert.equal(store.room(roomId).status, "paused");
  assert.equal(store.room(roomId).paused_reason, "budget");
});

test("ended and paused rooms do not occupy the global dispatch queue", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "排队" });
  await engine.flush();
  assert.equal(store.dueReminders(roomId).length, 1);
  engine.pause(roomId);
  assert.equal(store.dueReminders(null).length, 0);
  engine.resume(roomId, 50);
  const job = await engine.dispatchNext();
  await engine.jobResult(job, { outcome: "unknown", error: "lost" });
  engine.end(roomId);
  assert.equal(store.dueReminders(null).length, 0);
});

test("a reminder can only be reserved once", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "单次预留" });
  await engine.flush();
  const reminder = store.dueReminders(roomId)[0];
  assert.ok(store.reserveReminder(reminder.id));
  assert.equal(store.reserveReminder(reminder.id), null);
  assert.equal(store.room(roomId).budget_remaining, 49);
  store.recoverExpiredReminders();
  assert.equal(store.db.prepare("SELECT status FROM reminders WHERE id=?").get(reminder.id).status, "unknown");
  assert.ok(store.reserveReminder(reminder.id));
  assert.equal(store.room(roomId).budget_remaining, 49);
});

test("dispatch recovers an expired submitting lease without a separate scan", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "租约" });
  await engine.flush();
  const first = await engine.dispatchNext();
  store.db.prepare("UPDATE reminders SET lease_until='2000-01-01T00:00:00.000Z' WHERE id=?").run(first.jobId);
  const retry = await engine.dispatchNext();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(store.room(roomId).budget_remaining, 49);
});

test("model variants survive room creation", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a", name: "Model A", providerName: "Probe", variant: "high" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  const memberJob = engine.nextJob();
  assert.equal(memberJob.model.variant, "high");
  const saved = store.roomSummary(store.room(room.roomId)).members[0].model;
  assert.equal(saved.providerName, "Probe");
  assert.equal(saved.variant, "high");
});

test("provider quota failures refund the reminder and pause automatic wakeups", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, human(store, roomId), { text: "额度测试", mentionMemberIds: [members[0].id] });
  await engine.flush();
  const job = await engine.dispatchNext();
  assert.equal(job.memberId, members[0].id);
  await engine.jobResult(job, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 49);
  engine.executionEvent(members[0].session_id, "started", "quota-start");
  engine.executionEvent(members[0].session_id, "failed", "quota-failed", { type: "QuotaExceeded", message: "Insufficient balance" });
  const room = store.room(roomId);
  const member = store.member(members[0].id);
  assert.equal(room.status, "paused");
  assert.equal(room.paused_reason, "provider-quota");
  assert.equal(room.budget_remaining, 50);
  assert.equal(member.failure_count, 1);
  assert.match(member.last_error, /Insufficient balance/);
  assert.equal(Date.parse(member.wake_backoff_until) - Date.parse("2026-11-26T10:00:00.000Z"), 30000);
  assert.equal(store.dueReminders(roomId).length, 0);
  engine.resume(roomId, 10);
  assert.equal(store.room(roomId).status, "ready");
  assert.equal(store.member(members[0].id).failure_count, 0);
  assert.equal(store.member(members[0].id).wake_backoff_until, null);
});

test("ordinary execution failures use increasing wake backoff", async () => {
  const root = scratch();
  const store = new RoomStore();
  let clock = Date.parse("2026-11-26T10:00:00.000Z");
  const engine = new RoomEngine(store, { now: () => new Date(clock).toISOString(), statusProvider: async () => ({ status: "idle" }) });
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  for (let guard = 0; guard < 10; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted", sessionId: job.sessionId });
  }
  const member = store.agents(room.roomId)[0];
  for (const [index, delay] of [30000, 60000, 120000].entries()) {
    engine.post(room.roomId, human(store, room.roomId), { text: `失败 ${index}`, mentionMemberIds: [member.id] });
    await engine.flush();
    const job = await engine.dispatchNext();
    assert.equal(job.memberId, member.id);
    await engine.jobResult(job, { outcome: "accepted" });
    engine.executionEvent(member.session_id, "started", `start-${index}`);
    engine.executionEvent(member.session_id, "failed", `failed-${index}`, { type: "ProviderError", message: "temporary provider failure" });
    const current = store.member(member.id);
    assert.equal(current.failure_count, index + 1);
    assert.equal(Date.parse(current.wake_backoff_until) - clock, delay);
    assert.equal(store.dueReminders(room.roomId).some(row => row.member_id === member.id), false);
    clock += delay;
    await engine.recheckMember(room.roomId, member.id);
  }
});

test("changing a member model queues an idempotent session model switch", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  const changed = engine.changeModel(roomId, members[0].id, { providerID: "p", id: "replacement", name: "Replacement", providerName: "Probe", variant: "high" });
  assert.equal(changed.model.id, "replacement");
  assert.equal(changed.model.providerName, "Probe");
  assert.equal(changed.modelSynced, false);
  const job = engine.nextJob();
  assert.equal(job.type, "change-session-model");
  assert.equal(job.sessionId, members[0].session_id);
  assert.deepEqual(job.model, { providerID: "p", id: "replacement", name: "Replacement", providerName: "Probe", variant: "high" });
  await engine.jobResult(job, { outcome: "accepted" });
  assert.equal(store.member(members[0].id).model_synced, 1);
});

test("instruction refresh failures on ready members are visible and back off", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.rename(roomId, members[0].id, "新名字");
  let job;
  for (let guard = 0; guard < 4; guard += 1) {
    job = engine.nextJob();
    if (job.type === "put-instructions") break;
    assert.equal(job.type, "link-session");
    await engine.jobResult(job, { outcome: "accepted" });
  }
  assert.equal(job.type, "put-instructions");
  await engine.jobResult(job, { outcome: "failed", error: "temporary instruction error" });
  assert.match(store.member(job.memberId).task_error, /temporary instruction error/);
  assert.equal(store.member(job.memberId).creation_error, null);
  assert.ok(store.member(job.memberId).next_attempt_at);
});

test("unknown submission retries the same input ID and charges once", async () => {
  const { store, engine, roomId, members } = setup({ budgetLimit: 2, memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "唤醒" });
  await engine.flush();
  const first = await engine.dispatchNext();
  await engine.jobResult(first, { outcome: "unknown", error: "connection lost" });
  assert.equal(store.room(roomId).budget_remaining, 1);
  store.db.prepare("UPDATE reminders SET status='submitting',lease_until='2000-01-01T00:00:00.000Z' WHERE id=?").run(first.jobId);
  store.recoverExpiredReminders("2026-11-26T10:00:01.000Z");
  const retry = await engine.dispatchNext();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(retry.inputId, first.inputId);
  await engine.jobResult(retry, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 1);
});

test("unknown reminder deferred while busy is not refunded or recharged", async () => {
  const { store, engine, roomId, members, setStatus, tick } = setup({ budgetLimit: 2, memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "未知结果" });
  await engine.flush();
  const first = await engine.dispatchNext();
  await engine.jobResult(first, { outcome: "unknown", error: "lost ack" });
  setStatus(1, "running");
  tick(1000);
  assert.equal(await engine.dispatchNext(), null);
  assert.equal(store.room(roomId).budget_remaining, 1);
  setStatus(1, "idle");
  tick(1000);
  const retry = await engine.dispatchNext();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(store.room(roomId).budget_remaining, 1);
  await engine.jobResult(retry, { outcome: "accepted" });
  assert.equal(store.db.prepare("SELECT status FROM reminders WHERE id=?").get(first.jobId).status, "accepted");
});

test("cancelling a reserved reminder refunds exactly once", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "取消预留" });
  await engine.flush();
  const reminder = store.dueReminders(roomId)[0];
  store.reserveReminder(reminder.id);
  store.cancelReminder(reminder.id, "no longer needed");
  store.cancelReminder(reminder.id, "duplicate");
  assert.equal(store.room(roomId).budget_remaining, 50);
  assert.equal(store.db.prepare("SELECT charged,refunded,status FROM reminders WHERE id=?").get(reminder.id).charged, 0);
});

test("a definitively failed reminder retries with a fresh budget charge", async () => {
  const { store, engine, roomId, members, tick } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "失败重试" });
  await engine.flush();
  const first = await engine.dispatchNext();
  await engine.jobResult(first, { outcome: "failed", error: "temporary" });
  assert.equal(store.room(roomId).budget_remaining, 50);
  await engine.recheckMember(roomId, members[1].id);
  tick(1000);
  const retry = await engine.dispatchNext();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(store.room(roomId).budget_remaining, 49);
});

test("schema upgrade backfills charged reminders and reconciles budget", async () => {
  const root = scratch();
  const filename = join(root, "old.sqlite");
  let store = new RoomStore(filename);
  const room = store.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  store.db.prepare("UPDATE members SET creation_status='ready' WHERE room_id=?").run(room.roomId);
  store.post(room.roomId, { kind: "human", memberId: room.human.memberId }, { text: "未读" });
  const reminder = store.ensureReminder(room.roomId, store.agents(room.roomId)[0].id, { kind: "queue", triggerKey: "idle:old" });
  store.db.prepare("UPDATE reminders SET status='unknown',charged=0,refunded=0,charged_period=NULL WHERE id=?").run(reminder.id);
  store.db.prepare("UPDATE budget_periods SET used_count=0 WHERE room_id=?").run(room.roomId);
  store.db.prepare("UPDATE rooms SET budget_remaining=budget_limit WHERE id=?").run(room.roomId);
  store.db.prepare("UPDATE meta SET value='1' WHERE key='schema'").run();
  store.close();
  store = new RoomStore(filename);
  const upgraded = store.db.prepare("SELECT charged,refunded,charged_period FROM reminders WHERE id=?").get(reminder.id);
  assert.equal(upgraded.charged, 1);
  assert.equal(upgraded.refunded, 0);
  assert.equal(upgraded.charged_period, 1);
  assert.equal(store.room(room.roomId).budget_remaining, 49);
  store.close();
});

test("a charged unknown reminder can settle after the last budget unit pauses the room", async () => {
  const { store, engine, roomId, members } = setup({ budgetLimit: 1, memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "最后一次" });
  await engine.flush();
  const first = await engine.dispatchNext();
  assert.equal(store.room(roomId).status, "paused");
  assert.equal(store.room(roomId).budget_remaining, 0);
  await engine.jobResult(first, { outcome: "unknown", error: "lost ack" });
  const retry = await engine.dispatchNext();
  assert.equal(retry.jobId, first.jobId);
  assert.equal(retry.inputId, first.inputId);
  await engine.jobResult(retry, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 0);
  assert.equal(store.room(roomId).budget_period, 1);
});

test("refunding an old budget period does not inflate the new period", async () => {
  const { store, engine, roomId, members } = setup({ budgetLimit: 1, memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "旧段" });
  await engine.flush();
  const first = await engine.dispatchNext();
  await engine.jobResult(first, { outcome: "unknown", error: "lost ack" });
  engine.resume(roomId, 5);
  await engine.jobResult(first, { outcome: "failed", error: "definitive rejection" });
  assert.equal(store.room(roomId).budget_remaining, 5);
  assert.equal(store.room(roomId).budget_period, 2);
});

test("pause keeps posts and questions usable, resume starts a fresh budget and rechecks unread", async () => {
  const { store, engine, roomId, members } = setup({ budgetLimit: 1, memberCount: 2 });
  engine.pause(roomId);
  engine.post(roomId, source(members[0]), { text: "暂停也发帖", mentionMemberIds: [members[1].id] });
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadCount, 1);
  assert.equal(store.dueReminders(roomId).filter(row => row.kind === "steer").length, 0);
  assert.equal(store.reminders(roomId).filter(row => row.kind === "steer").length, 1);
  assert.equal(await engine.dispatchNext(), null);
  const asked = engine.ask(roomId, source(members[0]), { text: "暂停也能问" });
  engine.answer(roomId, asked.questionId, { answer: "可以" });
  engine.resume(roomId, 2);
  await engine.flush();
  const job = await engine.dispatchNext();
  assert.equal(job.delivery, "steer");
  assert.equal(store.room(roomId).budget_period, 2);
});

test("a busy reminder does not block an idle recipient", async () => {
  const { store, engine, roomId, members, setStatus } = setup({ memberCount: 3 });
  engine.post(roomId, source(members[0]), { text: "广播" });
  await engine.flush();
  setStatus(1, "running");
  const job = await engine.dispatchNext();
  assert.equal(job.memberId, members[2].id);
  assert.equal(store.db.prepare("SELECT attempts FROM reminders WHERE member_id=? AND status='pending'").get(members[1].id).attempts, 0);
});

test("duplicate and late reminder acknowledgements cannot refund twice", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "提醒" });
  await engine.flush();
  const job = await engine.dispatchNext();
  await engine.jobResult(job, { outcome: "failed", error: "rejected" });
  await engine.jobResult(job, { outcome: "failed", error: "duplicate" });
  await engine.jobResult(job, { outcome: "accepted" });
  assert.equal(store.room(roomId).budget_remaining, 50);
  assert.equal(store.db.prepare("SELECT status FROM reminders WHERE id=?").get(job.jobId).status, "failed");
});

test("paused rooms still accept posts and retry on a ready room is a no-op", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  engine.pause(roomId);
  assert.equal(engine.post(roomId, human(store, roomId), { text: "暂停也发" }).status, "stored");
  assert.equal(engine.retryCreation(roomId).status, "paused");
  assert.ok(members.every(member => member.creation_status === "ready"));
});

test("creating rooms continue through pause and resume never skips missing sessions", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  engine.pause(room.roomId);
  const rootJob = engine.nextJob();
  assert.equal(rootJob.type, "create-root-session");
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  const first = engine.nextJob();
  assert.equal(first.type, "create-session");
  await engine.jobResult(first, { outcome: "accepted", sessionId: first.sessionId });
  const resumed = engine.resume(room.roomId, 10);
  assert.equal(resumed.status, "creating");
  assert.throws(() => engine.post(room.roomId, human(store, room.roomId), { text: "还不能发" }), error => error.code === "ROOM_NOT_READY");
});

test("receipt and mention cursors are directly reusable", async () => {
  const { store, engine, roomId, members } = setup({ memberCount: 2 });
  const posted = engine.post(roomId, source(members[0]), { text: "游标" });
  const older = store.history(roomId, { cursor: posted.omittedBefore, viewerMemberId: members[0].id });
  assert.deepEqual(older.items, []);
  for (let index = 0; index < 21; index += 1) engine.post(roomId, source(members[0]), { text: `点名 ${index}`, mentionMemberIds: [members[1].id] });
  const summary = store.unreadSummary(roomId, members[1].id, []);
  assert.ok(summary.mentionCursor);
  const page = await engine.tool(members[1].session_id, "room_unread", { mentionCursor: summary.mentionCursor });
  assert.equal(page.items.length, 1);
  assert.equal(store.unreadSummary(roomId, members[1].id, []).unreadCount, 22);
});

test("unknown status recovery does not manufacture a new idle opportunity", async () => {
  const { store, engine, roomId, members, setStatus } = setup({ memberCount: 2 });
  engine.post(roomId, source(members[0]), { text: "未读" });
  await engine.flush();
  const before = store.dueReminders(roomId).map(row => row.id);
  setStatus(1, "unknown");
  await engine.recheckMember(roomId, members[1].id);
  setStatus(1, "idle");
  await engine.recheckMember(roomId, members[1].id);
  assert.deepEqual(store.dueReminders(roomId).map(row => row.id), before);
});

test("a failed instruction task backs off instead of blocking other members", async () => {
  const root = scratch();
  const store = new RoomStore();
  const engine = new RoomEngine(store);
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  const rootJob = engine.nextJob();
  await engine.jobResult(rootJob, { outcome: "accepted", sessionId: rootJob.sessionId });
  const first = engine.nextJob();
  assert.equal(first.type, "create-session");
  await engine.jobResult(first, { outcome: "accepted", sessionId: first.sessionId });
  const instruction = engine.nextJob();
  assert.equal(instruction.type, "put-instructions");
  await engine.jobResult(instruction, { outcome: "failed", error: "temporary" });
  const next = engine.nextJob();
  assert.equal(next.type, "create-session");
  assert.notEqual(next.memberId, first.memberId);
});

test("unknown session state is never treated as idle", async () => {
  const { store, engine, roomId, members, statuses } = setup();
  statuses.set(members[1].session_id, "unknown");
  engine.post(roomId, source(members[0]), { text: "状态未知" });
  await engine.flush();
  assert.equal(store.dueReminders(roomId).some(row => row.member_id === members[1].id), false);
  assert.notEqual(store.member(members[1].id).last_status, "idle");
});

test("SQLite reopen preserves room, receipts, questions and reminder dedupe", async () => {
  const root = scratch();
  const filename = join(root, "rooms.sqlite");
  let store = new RoomStore(filename);
  let engine = new RoomEngine(store, { statusProvider: async () => ({ status: "idle" }) });
  const room = engine.createRoom({ projectDir: root, tempRoot: root, members: [
    { role: "generic", model: { providerID: "p", id: "a" } },
    { role: "generic", model: { providerID: "p", id: "b" } },
  ] });
  for (let guard = 0; guard < 10; guard += 1) {
    const job = engine.nextJob();
    if (!job) break;
    await engine.jobResult(job, { outcome: "accepted", sessionId: job.sessionId });
  }
  const members = store.agents(room.roomId);
  const posted = engine.post(roomIdOf(room), source(members[0]), { text: "持久化" });
  store.markRead(room.roomId, members[1].id, [posted.messageId], "ui");
  const asked = engine.ask(room.roomId, source(members[0]), { text: "持久化问题" });
  await engine.flush();
  store.close();
  store = new RoomStore(filename);
  assert.equal(store.roomSummary(store.room(room.roomId)).latestSeq, 2);
  assert.equal(store.hasRead(members[1].id, posted.messageId), true);
  assert.equal(store.questions(room.roomId).items[0].questionId, asked.questionId);
  assert.equal(store.dueReminders(room.roomId).length > 0, true);
  store.close();
});

function roomIdOf(room) { return room.roomId; }
