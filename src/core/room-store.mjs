import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeCursor, encodeCursor, requireCursor } from "./cursor.mjs";
import { assertAgentWidth, MAX_AGENT_MESSAGE_WIDTH } from "./display-width.mjs";
import { fail } from "./errors.mjs";

export const RULES_VERSION = "room-rules-2026-11-26";
export const ROLE_LABELS = { generic: "通用", proposer: "提案者", reviewer: "审查者", moderator: "主持人" };
export const QUESTION_STATUSES = new Set(["pending", "answered", "withdrawn"]);

const ROLE_INSTRUCTIONS = {
  generic: "",
  proposer: "保持热情和活力，敢于提出明显不同的路线和大胆构想，再说明关键假设和取舍。区分想象与证据，遇到有效反例就修订；热情不等于必须多发帖。",
  reviewer: "兼做核验。检查关键假设，按需查资料、找反例或跑测试。说清已验证的结论、尚未确认的风险，以及什么证据能改变判断；不为反对而反对。",
  moderator: "根据读到的发言归纳共识、分歧和下一步。讨论跑题或重复时，指出已讨论过的内容并拉回尚未解决的问题。成员灰心或迷茫时肯定已有进展，必要时建议容易尝试的下一步。不代替成员决定，不把沉默当成同意。",
};

const COMMON_RULES = `收到房间提醒后，先读相关未读消息（可用 room_unread()）。被唤醒、被 @ 或读完消息，都不要求你发言。有新观点、证据、反例或值得回答的问题时再发帖。没有新内容，就继续原任务或结束本轮；不要只回「收到」或重复别人的结论。
需要对方尽快注意时，从会话指令里的成员名单找到对方的 ID，再用 room_post 或 room_ask 的 mentionMemberIds 点名。需要重查名单时用 room_members()。只在正文写 @显示名 不会点名。普通接话用 replyToMessageId 引用即可；只有确实需要通知所有人才传 mentionAll: true。
需要真人回答时用 room_ask，包括单选问题；只有真人可以正式作答。问同伴用 room_post，需要尽快注意时才点名。不要在独立会话中调用 OpenCode 原生提问工具；发出房间问题后可继续工作或结束本轮。
读完但不发帖是正常行为，不需要发「跳过」消息，也不触发其他成员。没读就结束仍会按未读规则提醒；沉默不改变已读状态，不表示同意。`;

const SCENARIO_INSTRUCTIONS = {
  debate: "当前是双模型辩论。初始立场只是起点，可随证据变化。每帖只写一个主张、反例或修订；优先引用对方原帖。没有新内容可以沉默。收尾时各发一条总结，说明修改了什么或仍分歧在哪里。",
};

function json(value) {
  return JSON.stringify(value);
}
function parse(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function id(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
function cleanText(value, label, { required = true, maxChars = 20000 } = {}) {
  if (typeof value !== "string") fail("ROOM_INVALID_INPUT", `${label} must be a string.`);
  const text = value.trim();
  if (required && !text) fail("ROOM_INVALID_INPUT", `${label} must not be empty.`);
  if (text.length > maxChars) fail("ROOM_INVALID_INPUT", `${label} is too long.`, { maxChars });
  return text;
}
function executionErrorMessage(error) {
  if (typeof error === "string") return error.slice(0, 2000);
  const message = error?.message || error?.response?.body || error?.type || "Agent execution failed";
  return String(message).slice(0, 2000);
}
function failureBackoffMs(count) {
  if (count <= 1) return 30000;
  if (count === 2) return 60000;
  return 120000;
}
function page(value, fallback, max) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) fail("ROOM_INVALID_INPUT", `limit must be between 1 and ${max}.`);
  return number;
}
function snippet(text, query, length = 180) {
  if (!query) return text.slice(0, length) + (text.length > length ? "…" : "");
  const at = text.indexOf(query);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, start + length);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RoomStore {
  constructor(filename = ":memory:") {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY, project_dir TEXT NOT NULL, title TEXT NOT NULL, preset TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, ended_at TEXT,
        paused_reason TEXT, human_id TEXT NOT NULL, human_name TEXT NOT NULL,
        budget_period INTEGER NOT NULL DEFAULT 1, budget_limit INTEGER NOT NULL DEFAULT 50,
        budget_remaining INTEGER NOT NULL DEFAULT 50, temp_root TEXT NOT NULL,
        workspace_dir TEXT NOT NULL, config_json TEXT NOT NULL, rules_version TEXT NOT NULL,
        root_session_id TEXT, root_creation_status TEXT NOT NULL DEFAULT 'pending', root_creation_error TEXT,
        root_next_attempt_at TEXT, root_task_attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), kind TEXT NOT NULL,
        display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'generic', model_json TEXT,
        session_id TEXT, creation_status TEXT NOT NULL DEFAULT 'pending', creation_error TEXT,
        instructions_added INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        last_check_at TEXT, execution_round INTEGER NOT NULL DEFAULT 0,
        idle_epoch INTEGER NOT NULL DEFAULT 0, last_status TEXT,
        last_started_event TEXT, last_terminal_round INTEGER NOT NULL DEFAULT -1,
        next_attempt_at TEXT, task_error TEXT, task_attempts INTEGER NOT NULL DEFAULT 0,
        session_linked INTEGER NOT NULL DEFAULT 0, model_synced INTEGER NOT NULL DEFAULT 1,
        failure_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, last_error_at TEXT,
        wake_backoff_until TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS members_session ON members(session_id) WHERE session_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), room_seq INTEGER NOT NULL,
        kind TEXT NOT NULL, author_id TEXT NOT NULL, text TEXT NOT NULL, options_json TEXT,
        reply_to_id TEXT, mention_all INTEGER NOT NULL DEFAULT 0, question_id TEXT,
        created_at TEXT NOT NULL, UNIQUE(room_id, room_seq)
      );
      CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id, room_seq);
      CREATE TABLE IF NOT EXISTS message_mentions (
        message_id TEXT NOT NULL REFERENCES messages(id), member_id TEXT NOT NULL REFERENCES members(id),
        PRIMARY KEY(message_id, member_id)
      );
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
        asker_id TEXT NOT NULL REFERENCES members(id), status TEXT NOT NULL, options_json TEXT,
        answer_message_id TEXT REFERENCES messages(id), withdraw_note TEXT,
        withdraw_reply_id TEXT REFERENCES messages(id), duplicate_of_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS read_receipts (
        message_id TEXT NOT NULL REFERENCES messages(id), member_id TEXT NOT NULL REFERENCES members(id),
        source TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY(message_id, member_id)
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), member_id TEXT NOT NULL REFERENCES members(id),
        kind TEXT NOT NULL CHECK(kind IN ('queue','steer')), status TEXT NOT NULL,
        trigger_key TEXT NOT NULL, snapshot_seq INTEGER NOT NULL, execution_round INTEGER NOT NULL,
        idle_epoch INTEGER NOT NULL, budget_period INTEGER NOT NULL, input_id TEXT NOT NULL UNIQUE,
        unread_count INTEGER NOT NULL DEFAULT 0, unread_mention_count INTEGER NOT NULL DEFAULT 0,
        reason TEXT, answer_message_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, lease_until TEXT,
        next_attempt_at TEXT, charged INTEGER NOT NULL DEFAULT 0,
        refunded INTEGER NOT NULL DEFAULT 0, charged_period INTEGER,
        UNIQUE(member_id, trigger_key, kind)
      );
      CREATE INDEX IF NOT EXISTS reminders_dispatch ON reminders(status, created_at);
      CREATE TABLE IF NOT EXISTS budget_periods (
        room_id TEXT NOT NULL, period INTEGER NOT NULL, limit_count INTEGER NOT NULL,
        started_at TEXT NOT NULL, ended_at TEXT, reason TEXT, used_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(room_id, period)
      );
      CREATE TABLE IF NOT EXISTS presentations (
        id TEXT PRIMARY KEY, room_id TEXT NOT NULL, member_id TEXT NOT NULL,
        message_ids_json TEXT NOT NULL, created_at TEXT NOT NULL, observed_at TEXT, confirmed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS diagnostics (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT, member_id TEXT, session_id TEXT,
        kind TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS config_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, kind TEXT NOT NULL,
        before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
      );
    `);
    const schemaVersion = 6;
    const previousSchema = Number(this.db.prepare("SELECT value FROM meta WHERE key='schema'").get()?.value || 0);
    const roomColumns = new Set(this.db.prepare("PRAGMA table_info(rooms)").all().map(row => row.name));
    for (const [name, definition] of Object.entries({
      root_session_id: "TEXT", root_creation_status: "TEXT NOT NULL DEFAULT 'pending'",
      root_creation_error: "TEXT", root_next_attempt_at: "TEXT", root_task_attempts: "INTEGER NOT NULL DEFAULT 0",
    })) {
      if (!roomColumns.has(name)) this.db.exec(`ALTER TABLE rooms ADD COLUMN ${name} ${definition}`);
    }
    const reminderColumns = new Set(this.db.prepare("PRAGMA table_info(reminders)").all().map(row => row.name));
    for (const [name, definition] of Object.entries({ lease_until: "TEXT", next_attempt_at: "TEXT", charged: "INTEGER NOT NULL DEFAULT 0", refunded: "INTEGER NOT NULL DEFAULT 0", charged_period: "INTEGER" })) {
      if (!reminderColumns.has(name)) this.db.exec(`ALTER TABLE reminders ADD COLUMN ${name} ${definition}`);
    }
    const memberColumns = new Set(this.db.prepare("PRAGMA table_info(members)").all().map(row => row.name));
    for (const [name, definition] of Object.entries({
      next_attempt_at: "TEXT", task_error: "TEXT", task_attempts: "INTEGER NOT NULL DEFAULT 0",
      session_linked: "INTEGER NOT NULL DEFAULT 0", model_synced: "INTEGER NOT NULL DEFAULT 1",
      failure_count: "INTEGER NOT NULL DEFAULT 0", last_error: "TEXT", last_error_at: "TEXT", wake_backoff_until: "TEXT",
    })) {
      if (!memberColumns.has(name)) this.db.exec(`ALTER TABLE members ADD COLUMN ${name} ${definition}`);
    }
    if (previousSchema < schemaVersion) {
      this.db.exec("UPDATE members SET session_linked=0 WHERE kind='agent' AND session_id IS NOT NULL");
      this.db.exec("UPDATE rooms SET root_creation_status='pending',root_creation_error='正在更新会话组说明',root_next_attempt_at=NULL WHERE status<>'ended' AND root_creation_status='ready' AND root_session_id IS NOT NULL");
    }
    const presentationColumns = new Set(this.db.prepare("PRAGMA table_info(presentations)").all().map(row => row.name));
    if (!presentationColumns.has("observed_at")) this.db.exec("ALTER TABLE presentations ADD COLUMN observed_at TEXT");
    const periodColumns = new Set(this.db.prepare("PRAGMA table_info(budget_periods)").all().map(row => row.name));
    if (!periodColumns.has("used_count")) this.db.exec("ALTER TABLE budget_periods ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0");
    if (previousSchema < 3) {
      this.db.exec(`
        UPDATE reminders SET charged=0 WHERE refunded=1;
        UPDATE reminders SET charged=0,refunded=1 WHERE status IN ('failed','covered','cancelled');
        UPDATE reminders SET charged=1,refunded=0,
          charged_period=(SELECT budget_period FROM rooms WHERE rooms.id=reminders.room_id)
          WHERE status IN ('reserved','submitting','unknown','accepted') AND charged=0 AND refunded=0;
        UPDATE budget_periods SET used_count=(SELECT COUNT(*) FROM reminders r
          WHERE r.room_id=budget_periods.room_id AND r.budget_period=budget_periods.period AND r.charged=1 AND r.refunded=0);
        UPDATE rooms SET budget_remaining=MAX(0,budget_limit-(SELECT used_count FROM budget_periods
          WHERE budget_periods.room_id=rooms.id AND budget_periods.period=rooms.budget_period));
      `);
    }
    if (previousSchema < schemaVersion) {
      this.db.prepare("INSERT INTO meta(key,value) VALUES('schema',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(schemaVersion));
    }
  }

  close() { this.db.close(); }

  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try { this.db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  room(id) {
    const row = this.db.prepare("SELECT * FROM rooms WHERE id=?").get(id);
    if (!row) fail("ROOM_NOT_FOUND", "Room not found.", { roomId: id }, 404);
    return row;
  }

  member(id) {
    const row = this.db.prepare("SELECT * FROM members WHERE id=?").get(id);
    if (!row) fail("ROOM_NOT_FOUND", "Member not found.", { memberId: id }, 404);
    return row;
  }

  memberBySession(sessionID) {
    const row = this.db.prepare("SELECT * FROM members WHERE session_id=?").get(sessionID);
    if (!row) fail("ROOM_SESSION_NOT_MEMBER", "This OpenCode session is not a member of a discussion room.", {}, 403);
    return row;
  }

  message(messageId) {
    const row = this.db.prepare("SELECT * FROM messages WHERE id=?").get(messageId);
    if (!row) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", { messageId }, 404);
    return row;
  }

  agents(roomId) {
    return this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' ORDER BY created_at").all(roomId);
  }

  listRooms(projectDir = null) {
    const rows = projectDir
      ? this.db.prepare("SELECT * FROM rooms WHERE project_dir=? ORDER BY created_at DESC").all(projectDir)
      : this.db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all();
    return rows.map(row => this.roomSummary(row));
  }

  roomSummary(room) {
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' ORDER BY created_at").all(room.id);
    const latest = this.db.prepare("SELECT MAX(room_seq) AS seq FROM messages WHERE room_id=?").get(room.id);
    const pending = this.db.prepare("SELECT COUNT(*) AS count FROM questions WHERE room_id=? AND status='pending'").get(room.id);
    return {
      roomId: room.id, title: room.title, projectDir: room.project_dir, preset: room.preset,
      status: room.status, pausedReason: room.paused_reason, createdAt: room.created_at,
      startedAt: room.started_at, endedAt: room.ended_at, latestSeq: latest.seq || 0,
      rootSessionId: room.root_session_id, rootCreationStatus: room.root_creation_status,
      rootCreationError: room.root_creation_error,
      pendingQuestions: pending.count, human: { memberId: room.human_id, displayName: room.human_name, kind: "human" },
      members: members.map(member => this.memberView(member)),
      budget: { period: room.budget_period, limit: room.budget_limit, remaining: room.budget_remaining, used: room.budget_limit - room.budget_remaining },
      workspaceDir: room.workspace_dir, tempRoot: room.temp_root, rulesVersion: room.rules_version,
    };
  }

  memberView(member) {
    return {
      memberId: member.id, displayName: member.display_name, kind: member.kind,
      role: member.role, roleLabel: ROLE_LABELS[member.role] || member.role,
      model: parse(member.model_json), sessionId: member.session_id,
      creationStatus: member.creation_status, creationError: member.creation_error, taskError: member.task_error,
      sessionLinked: member.session_linked === 1, modelSynced: member.model_synced === 1,
      failureCount: member.failure_count, lastError: member.last_error, lastErrorAt: member.last_error_at,
      wakeBackoffUntil: member.wake_backoff_until, sessionStatus: member.last_status || "unknown",
    };
  }

  createRoom(input, now = new Date().toISOString()) {
    const projectDir = cleanText(input.projectDir, "projectDir", { maxChars: 4096 });
    const title = cleanText(input.title || "新的讨论室", "title", { maxChars: 120 });
    const preset = ["generic", "debate"].includes(input.preset) ? input.preset : "generic";
    const specs = input.members;
    if (!Array.isArray(specs) || specs.length < 2 || specs.length > 8) fail("ROOM_INVALID_INPUT", "A room needs 2 to 8 agents.");
    if (specs.some(spec => spec.kind && spec.kind !== "agent")) fail("ROOM_INVALID_INPUT", "New rooms only create agent sessions.");
    const names = new Set();
    const members = specs.map((spec, index) => {
      const role = Object.hasOwn(ROLE_LABELS, spec.role) ? spec.role : "generic";
      const base = role === "generic" ? `Agent ${index + 1}` : ROLE_LABELS[role];
      let displayName = base;
      for (let suffix = 2; names.has(displayName.trim().toLowerCase()); suffix += 1) displayName = `${base} ${suffix}`;
      if (spec.displayName != null) displayName = cleanText(spec.displayName, "displayName", { maxChars: 80 });
      const key = displayName.trim().toLowerCase();
      if (names.has(key)) fail("ROOM_DUPLICATE_NAME", "Member display names must be unique.", { displayName });
      names.add(key);
      const model = spec.model;
      if (!model || typeof model.providerID !== "string" || typeof model.id !== "string") fail("ROOM_INVALID_INPUT", "Every agent needs a providerID and model id.");
      return { id: id("m"), role, displayName, model: { providerID: model.providerID, id: model.id, name: model.name || model.id, providerName: model.providerName || model.provider?.name || model.providerID, ...(model.variant ? { variant: model.variant } : {}) } };
    });
    const roomId = id("r");
    const rootSessionId = `ses_disc_${roomId}_root`;
    const humanName = cleanText(input.humanName || "房主", "humanName", { maxChars: 80 });
    if (names.has(humanName.trim().toLowerCase())) fail("ROOM_DUPLICATE_NAME", "The host display name must differ from agent names.", { displayName: humanName });
    const tempRoot = cleanText(input.tempRoot, "tempRoot", { maxChars: 4096 });
    const workspaceDir = join(tempRoot, "Discussions", roomId);
    mkdirSync(workspaceDir, { recursive: true });
    const limit = Number.isInteger(input.budgetLimit) && input.budgetLimit > 0 ? input.budgetLimit : (preset === "debate" ? 12 : 50);
    const config = { preset, budgetLimit: limit, roles: RULES_VERSION, members: members.map(({ memberId, ...member }) => member) };
    return this.tx(() => {
      this.db.prepare(`INSERT INTO rooms(id,project_dir,title,preset,status,created_at,human_id,human_name,budget_period,budget_limit,budget_remaining,temp_root,workspace_dir,config_json,rules_version,root_session_id,root_creation_status)
        VALUES(?,?,?,?,'creating',?,?,?,1,?,?,?,?,?,?,?,'pending')`).run(roomId, projectDir, title, preset, now, id("h"), humanName, limit, limit, tempRoot, workspaceDir, json(config), RULES_VERSION, rootSessionId);
      const humanId = this.db.prepare("SELECT human_id FROM rooms WHERE id=?").get(roomId).human_id;
      this.db.prepare(`INSERT INTO members(id,room_id,kind,display_name,role,creation_status,created_at) VALUES(?,?,'human',?,'host','ready',?)`)
        .run(humanId, roomId, humanName, now);
      const insert = this.db.prepare(`INSERT INTO members(id,room_id,kind,display_name,role,model_json,creation_status,created_at) VALUES(?,?,'agent',?,?,?,'pending',?)`);
      for (const member of members) insert.run(member.id, roomId, member.displayName, member.role, json(member.model), now);
      this.db.prepare("INSERT INTO budget_periods(room_id,period,limit_count,started_at) VALUES(?,?,?,?)").run(roomId, 1, limit, now);
      this.configEvent(roomId, "room-created", null, config, now);
      return this.roomSummary(this.room(roomId));
    });
  }

  retryCreation(roomId) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    return this.tx(() => {
      const ready = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
      const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
      if (ready === total) {
        this.db.prepare("UPDATE rooms SET status='ready',paused_reason=NULL WHERE id=? AND status='creating'").run(roomId);
        return this.roomSummary(this.room(roomId));
      }
      this.db.prepare("UPDATE rooms SET status='creating', paused_reason=NULL WHERE id=?").run(roomId);
      this.db.prepare("UPDATE members SET creation_error=NULL,creation_status='pending',next_attempt_at=NULL,task_error=NULL WHERE room_id=? AND session_id IS NULL").run(roomId);
      this.db.prepare("UPDATE members SET creation_error=NULL,instructions_added=0,next_attempt_at=NULL,task_error=NULL WHERE room_id=? AND session_id IS NOT NULL AND creation_status<>'ready'").run(roomId);
      this.db.prepare("UPDATE rooms SET root_creation_status=CASE WHEN root_creation_status='ready' THEN 'ready' ELSE 'pending' END,root_creation_error=NULL,root_next_attempt_at=NULL WHERE id=?").run(roomId);
      return this.roomSummary(this.room(roomId));
    });
  }

  prepareRoomRoot(roomId) {
    const room = this.room(roomId);
    if (room.root_session_id) return room;
    const rootSessionId = `ses_disc_${roomId}_root`;
    this.db.prepare("UPDATE rooms SET root_session_id=?,root_creation_status=CASE WHEN root_creation_status='ready' THEN 'pending' ELSE root_creation_status END WHERE id=? AND root_session_id IS NULL").run(rootSessionId, roomId);
    return this.room(roomId);
  }

  rootTaskAttempt(roomId, now = new Date().toISOString()) {
    const retryAt = new Date(Date.parse(now) + 5000).toISOString();
    this.db.prepare("UPDATE rooms SET root_task_attempts=root_task_attempts+1,root_next_attempt_at=? WHERE id=?").run(retryAt, roomId);
  }

  rootSessionCreated(roomId, sessionID, now = new Date().toISOString()) {
    this.room(roomId);
    if (typeof sessionID !== "string" || !sessionID) throw new Error("Room root session creation returned no session ID");
    this.db.prepare("UPDATE rooms SET root_session_id=?,root_creation_status='ready',root_creation_error=NULL,root_next_attempt_at=NULL WHERE id=?").run(sessionID, roomId);
  }

  rootSessionFailed(roomId, message, now = new Date().toISOString()) {
    const room = this.room(roomId);
    const attempts = room.root_task_attempts;
    const delay = Math.min(60000, 5000 * Math.max(1, attempts));
    const retryAt = new Date(Date.parse(now) + delay).toISOString();
    this.db.prepare("UPDATE rooms SET root_creation_status='failed',root_creation_error=?,root_next_attempt_at=? WHERE id=?").run(String(message).slice(0, 2000), retryAt, roomId);
  }

  resetMissingRoot(roomId) {
    const room = this.room(roomId);
    if (room.root_creation_status !== "ready" || !room.root_session_id) return false;
    this.db.prepare("UPDATE rooms SET root_creation_status='pending',root_creation_error='根会话不存在，正在重建',root_next_attempt_at=NULL WHERE id=?").run(roomId);
    this.db.prepare("UPDATE members SET session_linked=0 WHERE room_id=? AND kind='agent' AND session_id IS NOT NULL").run(roomId);
    return true;
  }

  sessionLinked(roomId, memberId) {
    this.room(roomId); this.member(memberId);
    this.db.prepare("UPDATE members SET session_linked=1,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }

  sessionCreated(roomId, memberId, sessionID, now = new Date().toISOString(), linked = false) {
    this.room(roomId); this.member(memberId);
    this.tx(() => {
      this.db.prepare("UPDATE members SET session_id=?,creation_status='session-created',creation_error=NULL,next_attempt_at=NULL,task_error=NULL,session_linked=? WHERE id=? AND room_id=? AND session_id IS NULL")
        .run(sessionID, linked ? 1 : 0, memberId, roomId);
      this.finishCreationIfReady(roomId, now);
    });
  }

  sessionFailed(roomId, memberId, message) {
    this.room(roomId); this.member(memberId);
    this.db.prepare("UPDATE members SET creation_status='failed',creation_error=?,next_attempt_at=NULL,task_error=? WHERE id=? AND room_id=? AND session_id IS NULL")
      .run(String(message).slice(0, 2000), String(message).slice(0, 2000), memberId, roomId);
  }

  taskAttempt(roomId, memberId, now = new Date().toISOString()) {
    const retryAt = new Date(Date.parse(now) + 5000).toISOString();
    this.db.prepare("UPDATE members SET task_attempts=task_attempts+1,next_attempt_at=? WHERE id=? AND room_id=?").run(retryAt, memberId, roomId);
  }

  taskSucceeded(roomId, memberId) {
    this.db.prepare("UPDATE members SET next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }

  taskFailed(roomId, memberId, message, now = new Date().toISOString()) {
    const member = this.member(memberId);
    const attempts = member.task_attempts;
    const delay = Math.min(60000, 5000 * Math.max(1, attempts));
    const retryAt = new Date(Date.parse(now) + delay).toISOString();
    const creationError = member.creation_status === "ready" ? member.creation_error : String(message).slice(0, 2000);
    this.db.prepare("UPDATE members SET next_attempt_at=?,task_error=?,creation_error=? WHERE id=? AND room_id=?").run(retryAt, String(message).slice(0, 2000), creationError, memberId, roomId);
  }

  instructionsAdded(roomId, memberId) {
    this.member(memberId);
    this.tx(() => {
      this.db.prepare("UPDATE members SET instructions_added=1,creation_status='ready',creation_error=NULL,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
      this.finishCreationIfReady(roomId);
    });
  }

  instructionsRemoved(roomId, memberId) {
    this.member(memberId);
    this.db.prepare("UPDATE members SET instructions_added=0,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }

  finishCreationIfReady(roomId, now = new Date().toISOString()) {
    const room = this.room(roomId);
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
    const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
    if (count === total && room.status === "creating") this.db.prepare("UPDATE rooms SET status='ready' WHERE id=?").run(roomId);
  }

  instructions(roomId, memberId) {
    const room = this.room(roomId);
    const self = this.member(memberId);
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? ORDER BY created_at,rowid").all(roomId);
    const agentIndex = members.filter(member => member.kind === "agent").findIndex(member => member.id === self.id);
    const debateStance = room.preset === "debate" && agentIndex === 0
      ? "你的初始立场：可以默认重试。"
      : room.preset === "debate" && agentIndex === 1
        ? "你的初始立场：默认不要重试。"
        : "";
    const roster = [
      `你在本房间是${self.display_name}（Agent，成员 ID \`${self.id}\`）。显示名不是身份；工具调用始终使用这个稳定 ID。`,
      `房间成员名单（房主确认后的显示名）：\n${members.map(m => `- ${m.display_name} · ${m.kind === "agent" ? "Agent" : "人类"}${m.kind === "human" ? " · 房主（只有真人能正式回答房间问题）" : ""} · 成员 ID \`${m.id}\``).join("\n")}`,
      `本讨论的共享临时目录：\`${room.workspace_dir}\`。只把讨论文档写在这里；项目工作目录及相对路径保持不变。建议按角色建子目录，避免同名覆盖。给其他人看文件时贴绝对路径。`,
      ROLE_INSTRUCTIONS[self.role],
      debateStance,
      SCENARIO_INSTRUCTIONS[room.preset] || "",
      COMMON_RULES,
    ].filter(Boolean).join("\n\n");
    return { key: "discussions.room", value: roster };
  }

  renameMember(roomId, memberId, displayName) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const name = cleanText(displayName, "displayName", { maxChars: 80 });
    this.tx(() => {
      const before = this.member(memberId);
      if (before.room_id !== roomId) fail("ROOM_NOT_FOUND", "Member not found.", {}, 404);
      const duplicate = this.db.prepare("SELECT id FROM members WHERE room_id=? AND lower(trim(display_name))=lower(?) AND id<>?").get(roomId, name, memberId);
      if (duplicate || (before.kind !== "human" && name.toLowerCase() === room.human_name.toLowerCase())) fail("ROOM_DUPLICATE_NAME", "Member display names must be unique.", { displayName: name });
      this.db.prepare("UPDATE members SET display_name=? WHERE id=? AND room_id=?").run(name, memberId, roomId);
      if (before.kind === "human") this.db.prepare("UPDATE rooms SET human_name=? WHERE id=?").run(name, roomId);
      this.db.prepare("UPDATE members SET instructions_added=0,session_linked=0 WHERE room_id=? AND kind='agent'").run(roomId);
      this.configEvent(roomId, "member-renamed", { memberId, displayName: before.display_name }, { memberId, displayName: name });
    });
    return this.memberView(this.member(memberId));
  }

  changeMemberModel(roomId, memberId, model, now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const member = this.member(memberId);
    if (member.room_id !== roomId || member.kind !== "agent") fail("ROOM_NOT_FOUND", "Agent member not found.", {}, 404);
    if (!model || typeof model.providerID !== "string" || typeof model.id !== "string") fail("ROOM_INVALID_INPUT", "A model needs providerID and id.");
    const normalized = {
      providerID: model.providerID, id: model.id, name: model.name || model.id,
      providerName: model.providerName || model.provider?.name || model.providerID,
      ...(model.variant ? { variant: model.variant } : {}),
    };
    this.tx(() => {
      this.db.prepare(`UPDATE members SET model_json=?,model_synced=CASE WHEN session_id IS NULL THEN 1 ELSE 0 END,
        failure_count=0,last_error=NULL,last_error_at=NULL,wake_backoff_until=NULL,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?`)
        .run(json(normalized), memberId, roomId);
      this.configEvent(roomId, "member-model-changed", { memberId, model: parse(member.model_json) }, { memberId, model: normalized }, now);
    });
    return this.memberView(this.member(memberId));
  }

  sessionModelSynced(roomId, memberId) {
    this.room(roomId); this.member(memberId);
    this.db.prepare("UPDATE members SET model_synced=1,next_attempt_at=NULL,task_error=NULL WHERE id=? AND room_id=?").run(memberId, roomId);
  }

  validateMentions(roomId, authorId, input) {
    const ids = input.mentionMemberIds == null ? [] : input.mentionMemberIds;
    if (!Array.isArray(ids) || ids.some(value => typeof value !== "string")) fail("ROOM_INVALID_INPUT", "mentionMemberIds must be an array of member IDs.");
    if (input.mentionAll != null && typeof input.mentionAll !== "boolean") fail("ROOM_INVALID_INPUT", "mentionAll must be boolean.");
    const unique = [...new Set(ids)];
    for (const memberId of unique) {
      const member = this.db.prepare("SELECT * FROM members WHERE id=? AND room_id=?").get(memberId, roomId);
      if (!member) fail("ROOM_INVALID_MENTION", "A mention target does not belong to this room.", { memberId });
    }
    const members = this.db.prepare("SELECT id FROM members WHERE room_id=? AND kind='agent'").all(roomId).map(row => row.id);
    const targets = new Set(unique.filter(memberId => memberId !== authorId));
    if (input.mentionAll === true) for (const memberId of members) if (memberId !== authorId) targets.add(memberId);
    return [...targets];
  }

  validateReply(roomId, replyToMessageId) {
    if (replyToMessageId == null) return null;
    const row = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(replyToMessageId, roomId);
    if (!row) fail("ROOM_MESSAGE_NOT_FOUND", "The quoted message does not belong to this room.", { messageId: replyToMessageId }, 404);
    return row;
  }

  validateQuestionOptions(options) {
    if (options == null) return [];
    if (!Array.isArray(options) || options.length < 2) fail("ROOM_INVALID_INPUT", "A choice question needs at least two options.");
    const values = options.map(value => cleanText(value, "option", { maxChars: 500 }));
    if (new Set(values).size !== values.length) fail("ROOM_INVALID_INPUT", "Question options must be unique.");
    return values;
  }

  ensureReadyForMessages(roomId) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const pending = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status<>'ready'").get(roomId).count;
    if (pending) fail("ROOM_NOT_READY", "All member sessions must be ready before posting.", { pending });
  }

  post(roomId, source, input, now = new Date().toISOString()) {
    const room = this.room(roomId);
    this.ensureReadyForMessages(roomId);
    const author = source.kind === "human"
      ? (room.human_id === source.memberId ? { id: room.human_id, display_name: room.human_name, kind: "human" } : fail("ROOM_FORBIDDEN", "Only the room host can post as a human.", {}, 403))
      : this.member(source.memberId);
    if (author.kind !== source.kind || (source.kind === "agent" && author.room_id !== roomId)) fail("ROOM_FORBIDDEN", "Message source does not match the member.", {}, 403);
    if (source.kind === "agent" && author.creation_status !== "ready") fail("ROOM_NOT_READY", "The room is still creating sessions.");
    const text = cleanText(input.text, "text", { maxChars: source.kind === "human" ? 100000 : 2000 });
    if (source.kind === "agent") assertAgentWidth(text);
    const reply = this.validateReply(roomId, input.replyToMessageId);
    const mentions = this.validateMentions(roomId, author.id, input);
    const mentionAll = input.mentionAll === true;
    return this.tx(() => {
      let checkDecision = "not-required";
      if (source.kind === "agent") {
        const check = this.preSendCheck(roomId, author.id, { text, replyToMessageId: reply?.id }, now);
        if (check.status === "review_required") return check;
        checkDecision = check.checkDecision;
      }
      const result = this.insertMessage(roomId, author, { text, kind: "post", replyToMessageId: reply?.id, mentions, mentionAll }, now);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
      const view = this.renderRows(roomId, rows, author.id);
      const presentation = this.presentation(roomId, author.id, view.fullMessageIds, now);
      return {
        status: "stored", messageId: result.messageId, roomSeq: result.roomSeq, questionId: null,
        timeline: view.rows, omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
        unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
        presentation, checkDecision,
        mentionHint: source.kind === "agent" ? this.mentionHint(roomId, author.id, text, mentions, mentionAll) : null,
      };
    });
  }

  ask(roomId, source, input, now = new Date().toISOString()) {
    const room = this.room(roomId);
    this.ensureReadyForMessages(roomId);
    const author = this.member(source.memberId);
    if (author.kind !== "agent" || author.room_id !== roomId) fail("ROOM_FORBIDDEN", "Only room agents can ask a room question.", {}, 403);
    if (author.creation_status !== "ready") fail("ROOM_NOT_READY", "The room is still creating sessions.");
    const text = cleanText(input.text, "text", { maxChars: 2000 });
    const options = this.validateQuestionOptions(input.options);
    assertAgentWidth(options.length ? `${text}\n${options.join("\n")}` : text, "question");
    const reply = this.validateReply(roomId, input.replyToMessageId);
    const mentions = this.validateMentions(roomId, author.id, input);
    const mentionAll = input.mentionAll === true;
    return this.tx(() => {
      const check = this.preSendCheck(roomId, author.id, { text: options.length ? `${text}\n${options.join("\n")}` : text, replyToMessageId: reply?.id }, now);
      if (check.status === "review_required") return check;
      const checkDecision = check.checkDecision;
      const questionId = id("q");
      const result = this.insertMessage(roomId, author, { text, kind: "question", options, replyToMessageId: reply?.id, mentions, mentionAll, questionId }, now);
      this.db.prepare(`INSERT INTO questions(id,room_id,message_id,asker_id,status,options_json,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?)`)
        .run(questionId, roomId, result.messageId, author.id, json(options), now, now);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
      const view = this.renderRows(roomId, rows, author.id);
      return {
        status: "stored", messageId: result.messageId, roomSeq: result.roomSeq, questionId,
        timeline: view.rows, omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
        unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
        presentation: this.presentation(roomId, author.id, view.fullMessageIds, now), checkDecision,
        mentionHint: this.mentionHint(roomId, author.id, text, mentions, mentionAll),
      };
    });
  }

  preSendCheck(roomId, authorId, input, now) {
    const author = this.member(authorId);
    const last = author.last_check_at ? Date.parse(author.last_check_at) : -Infinity;
    if (Number.isFinite(last) && now && Date.parse(now) - last < 30000) return { checkDecision: "skipped" };
    this.db.prepare("UPDATE members SET last_check_at=? WHERE id=?").run(now, author.id);
    const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? ORDER BY room_seq DESC LIMIT 8").all(roomId).reverse();
    const hasUnread = rows.some(row => !this.hasRead(author.id, row.id));
    if (!hasUnread) return { checkDecision: "executed" };
    const view = this.renderRows(roomId, rows, author.id);
    return {
      status: "review_required", messageId: null, roomSeq: null, questionId: null, checkDecision: "executed",
      timeline: view.rows, omittedBefore: view.rows.length ? encodeCursor({ roomId, query: "", authorId: null, mode: "history", direction: "older", anchorSeq: view.rows[0].roomSeq }) : null,
      unread: this.unreadSummary(roomId, author.id, view.fullMessageIds),
      presentation: this.presentation(roomId, author.id, view.fullMessageIds, now),
      mentionHint: null,
      message: "Recent unread messages must be reviewed before posting. The draft was not stored. Read the timeline, then submit again or discard it.",
    };
  }

  insertMessage(roomId, author, input, now) {
    const seq = (this.db.prepare("SELECT COALESCE(MAX(room_seq),0)+1 AS seq FROM messages WHERE room_id=?").get(roomId)).seq;
    const messageId = id("m");
    this.db.prepare(`INSERT INTO messages(id,room_id,room_seq,kind,author_id,text,options_json,reply_to_id,mention_all,question_id,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(messageId, roomId, seq, input.kind, author.id, input.text, json(input.options || []), input.replyToMessageId || null, input.mentionAll ? 1 : 0, input.questionId || null, now);
    const mention = this.db.prepare("INSERT OR IGNORE INTO message_mentions(message_id,member_id) VALUES(?,?)");
    for (const memberId of input.mentions || []) mention.run(messageId, memberId);
    if (this.room(roomId).started_at == null) this.db.prepare("UPDATE rooms SET started_at=? WHERE id=?").run(now, roomId);
    return { messageId, roomSeq: seq };
  }

  answerQuestion(roomId, questionId, input, now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const question = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!question) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    if (question.status !== "pending") fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", { status: question.status }, 409);
    const original = this.db.prepare("SELECT * FROM messages WHERE id=?").get(question.message_id);
    const text = cleanText(input.answer, "answer", { maxChars: 100000 });
    if (original.options_json) {
      const options = parse(original.options_json, []);
      if (options.length && !options.includes(text)) fail("ROOM_INVALID_ANSWER", "Choose one of the question options.", { options });
    }
    const note = input.note == null ? "" : cleanText(input.note, "note", { required: false, maxChars: 100000 });
    return this.tx(() => {
      const changed = this.db.prepare("UPDATE questions SET status='answered',answer_message_id=?,updated_at=? WHERE id=? AND status='pending'").run(null, now, questionId);
      if (!changed.changes) fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", {}, 409);
      const author = { id: room.human_id, display_name: room.human_name, kind: "human" };
      const result = this.insertMessage(roomId, author, { text: note ? `${text}\n${note}` : text, kind: "answer", replyToMessageId: question.message_id, mentions: [], mentionAll: false }, now);
      this.db.prepare("UPDATE questions SET answer_message_id=? WHERE id=?").run(result.messageId, questionId);
      this.markReadInTx(roomId, author.id, [result.messageId], "author", now);
      return { status: "answered", questionId, answerMessageId: result.messageId, messageId: result.messageId, roomSeq: result.roomSeq, askerId: question.asker_id };
    });
  }

  withdrawQuestion(roomId, source, questionId, input, now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    const question = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!question) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    const member = source.kind === "human" ? null : this.member(source.memberId);
    const human = source.kind === "human" && source.memberId === room.human_id;
    if (!human && !(source.kind === "agent" && member.id === question.asker_id && member.room_id === roomId)) fail("ROOM_FORBIDDEN", "Only the asker or the host can withdraw this question.", {}, 403);
    const note = input.note == null ? null : cleanText(input.note, "note", { required: false, maxChars: 1000 });
    if (note != null && source.kind === "agent") assertAgentWidth(note, "withdrawal note");
    const reply = this.validateReply(roomId, input.replyToMessageId);
    if (input.duplicateOfQuestionId != null) {
      const duplicate = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(input.duplicateOfQuestionId, roomId);
      if (!duplicate || duplicate.id === questionId) fail("ROOM_QUESTION_NOT_FOUND", "The duplicate question does not belong to this room.", {}, 404);
    }
    return this.tx(() => {
      const changed = this.db.prepare(`UPDATE questions SET status='withdrawn',withdraw_note=?,withdraw_reply_id=?,duplicate_of_id=?,updated_at=?
        WHERE id=? AND status='pending'`).run(note, reply?.id || null, input.duplicateOfQuestionId || null, now, questionId);
      if (!changed.changes) fail("ROOM_QUESTION_CONFLICT", "The question is no longer pending.", {}, 409);
      return { status: "withdrawn", questionId };
    });
  }

  question(roomId, questionId) {
    const row = this.db.prepare("SELECT * FROM questions WHERE id=? AND room_id=?").get(questionId, roomId);
    if (!row) fail("ROOM_QUESTION_NOT_FOUND", "Question not found.", { questionId }, 404);
    return row;
  }

  questions(roomId, input = {}) {
    const status = input.status || "pending";
    if (!QUESTION_STATUSES.has(status)) fail("ROOM_INVALID_INPUT", "status must be pending, answered, or withdrawn.");
    const limit = page(input.limit, 20, 50);
    let rows;
    let next = null;
    if (input.cursor) {
      const cursor = requireCursor(input.cursor, { roomId, status, mode: "questions" }, "cursor");
      rows = this.db.prepare(`SELECT q.*,m.room_seq AS message_seq FROM questions q JOIN messages m ON m.id=q.message_id
        WHERE q.room_id=? AND q.status=? AND m.room_seq>? ORDER BY m.room_seq LIMIT ?`).all(roomId, status, Number(cursor.afterSeq), limit + 1);
      if (rows.length > limit) next = encodeCursor({ roomId, status, mode: "questions", afterSeq: rows[limit - 1].message_seq });
    } else {
      rows = this.db.prepare(`SELECT q.*,m.room_seq AS message_seq FROM questions q JOIN messages m ON m.id=q.message_id
        WHERE q.room_id=? AND q.status=? ORDER BY m.room_seq LIMIT ?`).all(roomId, status, limit + 1);
      if (rows.length > limit) next = encodeCursor({ roomId, status, mode: "questions", afterSeq: rows[limit - 1].message_seq });
    }
    rows = rows.slice(0, limit);
    return { status, items: rows.map(row => this.questionPreview(row)), nextCursor: next };
  }

  questionPreview(row) {
    const message = this.db.prepare("SELECT * FROM messages WHERE id=?").get(row.message_id);
    const author = this.db.prepare("SELECT * FROM members WHERE id=?").get(row.asker_id);
    const item = {
      questionId: row.id, messageId: row.message_id, roomSeq: message.room_seq,
      asker: { memberId: row.asker_id, displayName: author.display_name, kind: author.kind },
      createdAt: row.created_at, status: row.status, text: snippet(message.text, "", 300),
      options: parse(row.options_json, []), preview: true,
    };
    if (row.status === "answered") item.answerMessageId = row.answer_message_id;
    if (row.status === "withdrawn") {
      item.withdrawNote = row.withdraw_note;
      if (row.withdraw_reply_id) item.replyToMessageId = row.withdraw_reply_id;
      if (row.duplicate_of_id) item.duplicateOfQuestionId = row.duplicate_of_id;
    }
    return item;
  }

  history(roomId, input = {}, now = new Date().toISOString()) {
    const query = input.query == null ? "" : String(input.query).trim();
    const authorId = input.authorMemberId || null;
    if (authorId && authorId !== this.room(roomId).human_id && !this.db.prepare("SELECT id FROM members WHERE id=? AND room_id=?").get(authorId, roomId)) fail("ROOM_INVALID_INPUT", "Author filter does not belong to this room.");
    const limit = page(input.limit, 20, 50);
    const filters = { roomId, query, authorId, mode: "history" };
    let rows;
    let nextCursor = null;
    let previousCursor = null;
    const cursor = input.cursor ? requireCursor(input.cursor, filters, "cursor") : null;
    const base = `FROM messages m WHERE m.room_id=?${query ? " AND (instr(m.text,?)>0 OR EXISTS(SELECT 1 FROM json_each(m.options_json) WHERE instr(value,?)>0))" : ""}${authorId ? " AND m.author_id=?" : ""}`;
    const params = [roomId];
    if (query) params.push(query, query);
    if (authorId) params.push(authorId);
    if (cursor?.direction === "older") {
      rows = this.db.prepare(`SELECT m.* ${base} AND m.room_seq<? ORDER BY m.room_seq DESC LIMIT ?`).all(...params, Number(cursor.anchorSeq), limit + 1).reverse();
    } else if (cursor?.direction === "newer") {
      rows = this.db.prepare(`SELECT m.* ${base} AND m.room_seq>? ORDER BY m.room_seq LIMIT ?`).all(...params, Number(cursor.anchorSeq), limit + 1);
    } else {
      rows = this.db.prepare(`SELECT m.* ${base} ORDER BY m.room_seq DESC LIMIT ?`).all(...params, limit + 1).reverse();
    }
    const hasMore = rows.length > limit;
    rows = cursor?.direction === "newer" ? rows.slice(0, limit) : rows.slice(-limit);
    if (rows.length) {
      if (hasMore && cursor?.direction === "newer") nextCursor = encodeCursor({ ...filters, direction: "newer", anchorSeq: rows.at(-1).room_seq });
      if (hasMore || !cursor || cursor.direction === "newer") previousCursor = encodeCursor({ ...filters, direction: "older", anchorSeq: rows[0].room_seq });
      if (cursor?.direction === "older") nextCursor = encodeCursor({ ...filters, direction: "newer", anchorSeq: rows.at(-1).room_seq });
    }
    const room = this.room(roomId);
    const viewerId = input.viewerMemberId || room.human_id;
    const viewer = viewerId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(viewerId);
    if (viewer.room_id !== roomId) fail("ROOM_FORBIDDEN", "Viewer does not belong to this room.", {}, 403);
    const rendered = this.renderRows(roomId, rows, viewer.id, { query });
    return {
      items: rendered.rows, nextCursor, previousCursor, query, authorMemberId: authorId,
      unread: this.unreadSummary(roomId, viewer.id, query ? [] : rendered.fullMessageIds),
      presentation: !query && input.trackPresentation !== false ? this.presentation(roomId, viewer.id, rendered.fullMessageIds, now) : null,
    };
  }

  context(roomId, messageId, input = {}, now = new Date().toISOString()) {
    const anchor = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!anchor) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", { messageId }, 404);
    const before = input.before == null ? 5 : Number(input.before);
    const after = input.after == null ? 5 : Number(input.after);
    if (!Number.isInteger(before) || before < 0 || before > 50 || !Number.isInteger(after) || after < 0 || after > 50) fail("ROOM_INVALID_INPUT", "before and after must be between 0 and 50.");
    const room = this.room(roomId);
    const viewer = input.viewerMemberId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(input.viewerMemberId);
    if (viewer.room_id !== roomId) fail("ROOM_FORBIDDEN", "Viewer does not belong to this room.", {}, 403);
    const rows = this.db.prepare("SELECT * FROM messages WHERE room_id=? AND room_seq>=? AND room_seq<=? ORDER BY room_seq")
      .all(roomId, anchor.room_seq - before, anchor.room_seq + after);
    const rendered = this.renderRows(roomId, rows, viewer.id);
    return { anchorMessageId: messageId, items: rendered.rows, unread: this.unreadSummary(roomId, viewer.id, rendered.fullMessageIds), presentation: input.trackPresentation === false ? null : this.presentation(roomId, viewer.id, rendered.fullMessageIds, now) };
  }

  unread(roomId, memberId, input = {}, now = new Date().toISOString()) {
    const member = this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    const limit = page(input.limit, 8, 20);
    let afterSeq = 0;
    if (input.cursor) {
      const cursor = requireCursor(input.cursor, { roomId, memberId, mode: "unread" }, "cursor");
      afterSeq = Number(cursor.afterSeq);
    }
    const unreadRows = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.room_seq>? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?) ORDER BY m.room_seq LIMIT ?`).all(roomId, afterSeq, memberId, limit);
    const seqs = new Set(unreadRows.map(row => row.room_seq));
    for (const row of unreadRows) for (let offset = -2; offset <= 2; offset += 1) seqs.add(row.room_seq + offset);
    const rows = seqs.size
      ? this.db.prepare("SELECT * FROM messages WHERE room_id=? AND room_seq BETWEEN ? AND ? ORDER BY room_seq").all(roomId, Math.min(...seqs), Math.max(...seqs))
      : [];
    // Avoid filling the gaps between distant unread posts with unrelated history.
    const keep = new Set();
    for (const unreadRow of unreadRows) for (let offset = -2; offset <= 2; offset += 1) keep.add(unreadRow.room_seq + offset);
    const selected = rows.filter(row => keep.has(row.room_seq));
    const rendered = this.renderRows(roomId, selected, memberId);
    const unreadIds = new Set(unreadRows.map(row => row.id));
    const items = rendered.rows.map(row => ({ ...row, unread: unreadIds.has(row.messageId) }));
    const lastSeq = unreadRows.at(-1)?.room_seq;
    return {
      items, unreadMessageIds: unreadRows.map(row => row.id),
      unread: this.unreadSummary(roomId, memberId, rendered.fullMessageIds),
      nextCursor: unreadRows.length === limit && lastSeq ? encodeCursor({ roomId, memberId, mode: "unread", afterSeq: lastSeq }) : null,
      presentation: this.presentation(roomId, memberId, rendered.fullMessageIds, now),
    };
  }

  mentionMetadata(roomId, memberId, input = {}) {
    const member = this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    const limit = page(input.limit, 20, 50);
    let beforeSeq = Number.MAX_SAFE_INTEGER;
    if (input.mentionCursor || input.cursor) {
      const cursor = requireCursor(input.mentionCursor || input.cursor, { roomId, memberId, mode: "mentions" }, "mentionCursor");
      beforeSeq = Number(cursor.beforeSeq);
    }
    const rows = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.room_seq<? AND m.author_id<>? AND
      (m.mention_all=1 OR EXISTS(SELECT 1 FROM message_mentions x WHERE x.message_id=m.id AND x.member_id=?)) AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?) ORDER BY m.room_seq DESC LIMIT ?`)
      .all(roomId, beforeSeq, memberId, memberId, memberId, limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(row => ({ messageId: row.id, roomSeq: row.room_seq, createdAt: row.created_at }));
    return { unread: this.unreadSummary(roomId, memberId, []), items, nextCursor: hasMore ? encodeCursor({ roomId, memberId, mode: "mentions", beforeSeq: items.at(-1).roomSeq }) : null };
  }

  renderRows(roomId, rows, viewerId, { query = "" } = {}) {
    const fullMessageIds = new Set();
    const rendered = rows.map(row => {
      const author = this.author(row.author_id);
      const question = row.question_id ? this.question(roomId, row.question_id) : null;
      const item = {
        messageId: row.id, roomSeq: row.room_seq,
        author: { memberId: author.memberId, displayName: author.displayName, kind: author.kind },
        isOwn: author.memberId === viewerId, kind: row.kind, createdAt: row.created_at,
        mentions: this.mentionedMembers(row.id), mentionAll: row.mention_all === 1,
        replyToMessageId: row.reply_to_id, questionId: row.question_id,
        questionStatus: question?.status || null, answerMessageId: question?.answer_message_id || null,
        label: `[#${row.room_seq} ${author.displayName} · ${author.kind === "agent" ? "Agent" : "人类"}${author.memberId === viewerId ? " · 你" : ""}]`,
      };
      if (query) {
        const searchable = `${row.text}\n${parse(row.options_json, []).join("\n")}`;
        item.text = snippet(searchable, query);
        item.options = parse(row.options_json, []);
        item.preview = true;
        item.full = false;
        item.truncated = true;
        return item;
      }
      const visibleText = row.kind === "question" && parse(row.options_json, []).length
        ? `${row.text}\n${parse(row.options_json, []).map((option, index) => `${index + 1}. ${option}`).join("\n")}`
        : row.text;
      if (visibleText.length <= 4000) {
        item.text = row.text;
        item.options = parse(row.options_json, []);
        item.full = true;
        item.preview = false;
        fullMessageIds.add(row.id);
      } else {
        item.text = visibleText.slice(0, 4000) + "\n… [预览；完整内容请用 room_context 打开]";
        item.options = parse(row.options_json, []);
        item.preview = true;
        item.full = false;
        item.truncated = true;
      }
      if (row.reply_to_id) item.replyTo = this.renderQuote(roomId, row.reply_to_id, fullMessageIds);
      return item;
    });
    return { rows: rendered, fullMessageIds: [...fullMessageIds] };
  }

  renderQuote(roomId, messageId, fullMessageIds) {
    const row = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!row) return { messageId, unavailable: true, text: "原帖不可用或已删除。" };
    const author = this.author(row.author_id);
    const quote = {
      messageId: row.id, roomSeq: row.room_seq,
      author: { memberId: author.memberId, displayName: author.displayName, kind: author.kind },
      label: `引用 #${row.room_seq}（${row.id}）：${author.displayName} · ${author.kind === "agent" ? "Agent" : "人类"}`,
    };
    if (row.text.length <= 1200) {
      quote.text = row.text;
      quote.options = parse(row.options_json, []);
      quote.full = true;
      fullMessageIds.add(row.id);
    } else {
      quote.text = row.text.slice(0, 1200) + "… [引用预览；完整内容请用 room_context 打开]";
      quote.options = parse(row.options_json, []);
      quote.full = false;
      quote.preview = true;
      quote.truncated = true;
    }
    return quote;
  }

  author(authorId) {
    const member = this.db.prepare("SELECT * FROM members WHERE id=?").get(authorId);
    if (member) return { memberId: member.id, displayName: member.display_name, kind: member.kind };
    const room = this.db.prepare("SELECT * FROM rooms WHERE human_id=?").get(authorId);
    if (room) return { memberId: room.human_id, displayName: room.human_name, kind: "human" };
    return { memberId: authorId, displayName: "未知成员", kind: "agent" };
  }

  mentionedMembers(messageId) {
    return this.db.prepare(`SELECT m.id,m.display_name,m.kind FROM message_mentions x JOIN members m ON m.id=x.member_id WHERE x.message_id=? ORDER BY m.created_at`).all(messageId);
  }

  mentionHint(roomId, authorId, text, targets, mentionAll) {
    if (mentionAll) return null;
    const members = this.db.prepare("SELECT * FROM members WHERE room_id=? AND kind='agent' AND id<>? ORDER BY length(display_name) DESC").all(roomId, authorId);
    const withoutCode = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").split("\n").filter(line => !/^\s*>/.test(line)).join("\n");
    for (const member of members) {
      if (targets.includes(member.id)) continue;
      const pattern = new RegExp(`@${escapeRegex(member.display_name)}(?=$|[\\s\\p{P}\\p{S}])`, "u");
      if (pattern.test(withoutCode)) return `帖子已发送，但未点名 @${member.display_name}；下次可传 mentionMemberIds: [${JSON.stringify(member.id)}]。`;
    }
    return null;
  }

  hasRead(memberId, messageId) {
    return !!this.db.prepare("SELECT 1 FROM read_receipts WHERE message_id=? AND member_id=?").get(messageId, memberId);
  }

  markRead(roomId, memberId, messageIds, source = "tool", now = new Date().toISOString()) {
    if (!Array.isArray(messageIds)) fail("ROOM_INVALID_INPUT", "messageIds must be an array.");
    const room = this.room(roomId);
    const member = memberId === room.human_id ? { id: room.human_id, room_id: roomId } : this.member(memberId);
    if (member.room_id !== roomId) fail("ROOM_FORBIDDEN", "Member does not belong to this room.", {}, 403);
    return this.tx(() => this.markReadInTx(roomId, memberId, messageIds, source, now));
  }

  markReadInTx(roomId, memberId, messageIds, source, now) {
    const statement = this.db.prepare("INSERT OR IGNORE INTO read_receipts(message_id,member_id,source,read_at) VALUES(?,?,?,?)");
    let count = 0;
    for (const messageId of new Set(messageIds)) {
      const message = this.db.prepare("SELECT id FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
      if (!message) continue;
      count += statement.run(messageId, memberId, source, now).changes;
    }
    return { marked: count, unread: this.unreadSummary(roomId, memberId, []) };
  }

  roomByHuman(memberId) {
    return this.db.prepare("SELECT * FROM rooms WHERE human_id=?").get(memberId);
  }

  receipts(roomId, messageId) {
    this.room(roomId);
    const message = this.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, roomId);
    if (!message) fail("ROOM_MESSAGE_NOT_FOUND", "Message not found.", {}, 404);
    const rows = this.db.prepare(`SELECT r.member_id,r.read_at,r.source,m.display_name,m.kind FROM read_receipts r
      LEFT JOIN members m ON m.id=r.member_id WHERE r.message_id=? ORDER BY m.kind,m.display_name`).all(messageId);
    const human = rows.find(row => row.member_id === this.room(roomId).human_id);
    const agents = rows.filter(row => row.member_id !== this.room(roomId).human_id).map(row => ({ memberId: row.member_id, displayName: row.display_name, kind: row.kind, readAt: row.read_at, source: row.source }));
    return { messageId, human: human ? { memberId: human.member_id, displayName: this.room(roomId).human_name, kind: "human", readAt: human.read_at } : null, agents };
  }

  presentation(roomId, memberId, messageIds, now) {
    if (!messageIds.length) return null;
    const presentationId = id("p");
    this.db.prepare("INSERT INTO presentations(id,room_id,member_id,message_ids_json,created_at) VALUES(?,?,?,?,?)")
      .run(presentationId, roomId, memberId, json([...new Set(messageIds)]), now);
    return { presentationId, messageIds: [...new Set(messageIds)], note: "Read receipts are recorded only after the tool output is observed in the next model request." };
  }

  confirmPresentation(presentationId, sessionID, now = new Date().toISOString()) {
    const pending = this.db.prepare("SELECT * FROM presentations WHERE id=? AND confirmed_at IS NULL").get(presentationId);
    if (!pending) return { confirmed: false };
    const member = this.db.prepare("SELECT * FROM members WHERE id=? AND session_id=?").get(pending.member_id, sessionID);
    if (!member) fail("ROOM_FORBIDDEN", "Presentation does not belong to this session.", {}, 403);
    return this.tx(() => {
      this.db.prepare("UPDATE presentations SET confirmed_at=? WHERE id=? AND confirmed_at IS NULL").run(now, presentationId);
      const result = this.markReadInTx(pending.room_id, pending.member_id, parse(pending.message_ids_json, []), "model-context", now);
      this.db.prepare("DELETE FROM presentations WHERE id=?").run(presentationId);
      return { ...result, confirmed: true, roomId: pending.room_id };
    });
  }

  observePresentation(presentationId, sessionID, now = new Date().toISOString()) {
    const pending = this.db.prepare("SELECT * FROM presentations WHERE id=? AND confirmed_at IS NULL").get(presentationId);
    if (!pending) return false;
    const member = this.db.prepare("SELECT id FROM members WHERE id=? AND session_id=?").get(pending.member_id, sessionID);
    if (!member) fail("ROOM_FORBIDDEN", "Presentation does not belong to this session.", {}, 403);
    this.db.prepare("UPDATE presentations SET observed_at=COALESCE(observed_at,?) WHERE id=?").run(now, presentationId);
    return true;
  }

  pendingPresentations(limit = 200) {
    return this.db.prepare(`SELECT p.id AS presentation_id,p.room_id,m.session_id FROM presentations p
      JOIN members m ON m.id=p.member_id WHERE p.confirmed_at IS NULL AND p.observed_at IS NOT NULL AND m.session_id IS NOT NULL
      ORDER BY p.created_at LIMIT ?`).all(limit);
  }

  unreadSummary(roomId, memberId, excludeIds = []) {
    const excluded = [...new Set(excludeIds)];
    const exclusion = excluded.length ? ` AND m.id NOT IN (${excluded.map(() => "?").join(",")})` : "";
    const params = [roomId, memberId, ...excluded];
    const unreadCount = this.db.prepare(`SELECT COUNT(*) AS count FROM messages m WHERE m.room_id=? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?)${exclusion}`).get(...params).count;
    const mentions = this.db.prepare(`SELECT m.* FROM messages m WHERE m.room_id=? AND m.author_id<>? AND NOT EXISTS
      (SELECT 1 FROM read_receipts r WHERE r.message_id=m.id AND r.member_id=?)
      AND (m.mention_all=1 OR EXISTS(SELECT 1 FROM message_mentions x WHERE x.message_id=m.id AND x.member_id=?))${exclusion}
      ORDER BY m.room_seq DESC`).all(roomId, memberId, memberId, memberId, ...excluded);
    const items = mentions.slice(0, 20).map(row => ({ messageId: row.id, roomSeq: row.room_seq, createdAt: row.created_at }));
    return {
      unreadCount, unreadMentionCount: mentions.length, unreadMentions: items,
      hasMoreMentions: mentions.length > 20,
      mentionCursor: mentions.length > 20 ? encodeCursor({ roomId, memberId, mode: "mentions", beforeSeq: items[19].roomSeq }) : null,
    };
  }

  ensureReminder(roomId, memberId, input, now = new Date().toISOString()) {
    const room = this.room(roomId);
    const member = this.member(memberId);
    if (room.status === "ended" || member.kind !== "agent" || member.creation_status !== "ready") return null;
    if ((room.status === "paused" || room.budget_remaining <= 0) && input.kind !== "steer") return null;
    const summary = this.unreadSummary(roomId, memberId, []);
    if (!summary.unreadCount) return null;
    const snapshotSeq = (this.db.prepare("SELECT COALESCE(MAX(room_seq),0) AS seq FROM messages WHERE room_id=?").get(roomId)).seq;
    const existing = this.db.prepare("SELECT * FROM reminders WHERE member_id=? AND trigger_key=? AND kind=?").get(memberId, input.triggerKey, input.kind);
    if (existing && !["pending", "reserved", "failed"].includes(existing.status)) return existing;
    return this.tx(() => {
      if (existing) {
        const retryAt = existing.status === "failed" ? new Date(Date.parse(now) + 1000).toISOString() : existing.next_attempt_at;
        this.db.prepare(`UPDATE reminders SET snapshot_seq=?,unread_count=?,unread_mention_count=?,reason=COALESCE(?,reason),answer_message_id=COALESCE(?,answer_message_id),status=?,updated_at=?,last_error=NULL,next_attempt_at=?
          WHERE id=?`).run(Math.max(existing.snapshot_seq, snapshotSeq), summary.unreadCount, summary.unreadMentionCount, input.reason || null, input.answerMessageId || null, existing.status === "reserved" ? "reserved" : "pending", now, retryAt, existing.id);
        return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(existing.id);
      }
      const reminderId = id("rem");
      const inputId = `msg_room_${roomId}_${reminderId}`;
      this.db.prepare(`INSERT INTO reminders(id,room_id,member_id,kind,status,trigger_key,snapshot_seq,execution_round,idle_epoch,budget_period,input_id,unread_count,unread_mention_count,reason,answer_message_id,created_at,updated_at)
        VALUES(?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?)`).run(reminderId, roomId, memberId, input.kind, input.triggerKey, snapshotSeq, member.execution_round, member.idle_epoch, room.budget_period, inputId, summary.unreadCount, summary.unreadMentionCount, input.reason || null, input.answerMessageId || null, now, now);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }

  refreshReminder(reminderId, now = new Date().toISOString()) {
    const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    if (!reminder) return null;
    const summary = this.unreadSummary(reminder.room_id, reminder.member_id, []);
    const snapshotSeq = (this.db.prepare("SELECT COALESCE(MAX(room_seq),0) AS seq FROM messages WHERE room_id=?").get(reminder.room_id)).seq;
    this.db.prepare("UPDATE reminders SET snapshot_seq=?,unread_count=?,unread_mention_count=?,updated_at=? WHERE id=?")
      .run(snapshotSeq, summary.unreadCount, summary.unreadMentionCount, now, reminderId);
    return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
  }

  refundReminderInTx(reminder, now) {
    if (!reminder.charged || reminder.refunded) return;
    this.db.prepare("UPDATE budget_periods SET used_count=used_count-1 WHERE room_id=? AND period=?").run(reminder.room_id, reminder.charged_period);
    this.db.prepare("UPDATE reminders SET charged=0,refunded=1 WHERE id=?").run(reminder.id);
    const room = this.room(reminder.room_id);
    if (reminder.charged_period === room.budget_period) this.db.prepare("UPDATE rooms SET budget_remaining=budget_remaining+1 WHERE id=?").run(room.id);
    const current = this.room(reminder.room_id);
    if (current.status === "paused" && current.paused_reason === "budget" && current.budget_remaining > 0) {
      this.db.prepare("UPDATE rooms SET status='ready',paused_reason=NULL WHERE id=?").run(room.id);
    }
  }

  reserveReminder(reminderId, now = new Date().toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder) fail("ROOM_REMINDER_NOT_FOUND", "Reminder not found.", {}, 404);
      const room = this.room(reminder.room_id);
      const retryCharged = reminder.charged === 1 && reminder.refunded === 0;
      if (room.status !== "ready" && !(retryCharged && room.status === "paused" && room.paused_reason === "budget")) return null;
      if (!["pending", "unknown"].includes(reminder.status)) return null;
      if (!reminder.unread_count) return null;
      if (!retryCharged) {
        if (room.budget_remaining <= 0) return null;
        this.db.prepare("UPDATE rooms SET budget_remaining=budget_remaining-1 WHERE id=?").run(room.id);
        this.db.prepare("UPDATE budget_periods SET used_count=used_count+1 WHERE room_id=? AND period=?").run(room.id, room.budget_period);
        if (room.budget_remaining === 1) {
          this.db.prepare("UPDATE rooms SET status='paused',paused_reason='budget' WHERE id=?").run(room.id);
          this.configEvent(room.id, "room-paused", { status: "ready", remaining: 1 }, { status: "paused", reason: "budget" }, now);
        }
      }
      const leaseUntil = new Date(Date.parse(now) + 15000).toISOString();
      const chargedPeriod = retryCharged ? reminder.charged_period : room.budget_period;
      this.db.prepare(`UPDATE reminders SET status='reserved',attempts=attempts+1,budget_period=?,charged=1,refunded=0,charged_period=?,
        updated_at=?,lease_until=?,next_attempt_at=NULL WHERE id=?`).run(room.budget_period, chargedPeriod, now, leaseUntil, reminderId);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }

  markSubmitting(reminderId, now = new Date().toISOString(), executionRound = null) {
    const leaseUntil = new Date(Date.parse(now) + 15000).toISOString();
    this.db.prepare("UPDATE reminders SET status='submitting',execution_round=COALESCE(?,execution_round),updated_at=?,lease_until=? WHERE id=?").run(executionRound, now, leaseUntil, reminderId);
  }

  recoverExpiredReminders(now = new Date().toISOString()) {
    this.db.prepare("UPDATE reminders SET status='unknown',last_error='Unfinished reservation recovered; retry with the same input ID' WHERE status='reserved'").run();
    this.db.prepare("UPDATE reminders SET status='unknown',last_error='Submission lease expired; retry with the same input ID' WHERE status='submitting' AND lease_until<?").run(now);
  }

  refundAcceptedRemindersForRound(memberId, executionRound, now = new Date().toISOString()) {
    return this.tx(() => {
      const reminders = this.db.prepare("SELECT * FROM reminders WHERE member_id=? AND execution_round=? AND status='accepted' AND charged=1 AND refunded=0 ORDER BY created_at").all(memberId, executionRound);
      for (const reminder of reminders) this.refundReminderInTx(reminder, now);
      return reminders.map(reminder => this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminder.id));
    });
  }

  ackReminder(reminderId, outcome, error = null, now = new Date().toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder) return null;
      const active = ["pending", "reserved", "submitting", "unknown"].includes(reminder.status);
      if (!active) return reminder;
      if (outcome === "accepted") {
        if (!reminder.charged || reminder.refunded) return reminder;
        this.db.prepare("UPDATE reminders SET status='accepted',updated_at=?,last_error=NULL WHERE id=?").run(now, reminderId);
      } else if (outcome === "failed") {
        this.refundReminderInTx(reminder, now);
        this.db.prepare("UPDATE reminders SET status='failed',updated_at=?,last_error=? WHERE id=?").run(now, String(error || "Submission failed").slice(0, 2000), reminderId);
      } else {
        this.db.prepare("UPDATE reminders SET status='unknown',updated_at=?,last_error=? WHERE id=?").run(now, String(error || "Outcome unknown").slice(0, 2000), reminderId);
      }
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }

  deferReminder(reminderId, reason, now = new Date().toISOString()) {
    return this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder || !["pending", "reserved", "unknown"].includes(reminder.status)) return reminder;
      if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      const retryAt = new Date(Date.parse(now) + 1000).toISOString();
      const status = reminder.status === "pending" ? "pending" : "unknown";
      this.db.prepare("UPDATE reminders SET status=?,updated_at=?,last_error=?,lease_until=NULL,next_attempt_at=? WHERE id=?").run(status, now, String(reason).slice(0, 2000), retryAt, reminderId);
      return this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
    });
  }

  coverOrdinary(roomId, memberId, urgent, now = new Date().toISOString()) {
    return this.tx(() => {
      const rows = this.db.prepare("SELECT * FROM reminders WHERE room_id=? AND member_id=? AND kind='queue' AND status IN ('pending','reserved') AND snapshot_seq<=?")
        .all(roomId, memberId, urgent.snapshot_seq);
      for (const row of rows) {
        this.refundReminderInTx(row, now);
        this.db.prepare("UPDATE reminders SET status='covered',updated_at=?,last_error='Covered by accepted urgent reminder' WHERE id=?").run(now, row.id);
      }
      return rows.length;
    });
  }

  cancelReminder(reminderId, reason, now = new Date().toISOString()) {
    this.tx(() => {
      const reminder = this.db.prepare("SELECT * FROM reminders WHERE id=?").get(reminderId);
      if (!reminder || !["pending", "reserved", "unknown"].includes(reminder.status)) return;
      if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      this.db.prepare("UPDATE reminders SET status='cancelled',updated_at=?,last_error=?,next_attempt_at=NULL WHERE id=?").run(now, String(reason).slice(0, 2000), reminderId);
    });
  }

  dueReminders(roomId = null, limit = 20, now = new Date().toISOString()) {
    const where = `(r.status IN ('pending','reserved','unknown') OR (r.status='submitting' AND r.lease_until<?))
      AND (r.next_attempt_at IS NULL OR r.next_attempt_at<=?)
      AND (m.wake_backoff_until IS NULL OR m.wake_backoff_until<=?)
      AND (rm.status='ready' OR (rm.status='paused' AND rm.paused_reason='budget' AND r.charged=1 AND r.refunded=0))`;
    const rows = roomId
      ? this.db.prepare(`SELECT r.* FROM reminders r JOIN rooms rm ON rm.id=r.room_id JOIN members m ON m.id=r.member_id WHERE r.room_id=? AND ${where} ORDER BY CASE r.kind WHEN 'steer' THEN 0 ELSE 1 END,r.created_at LIMIT ?`).all(roomId, now, now, now, limit)
      : this.db.prepare(`SELECT r.* FROM reminders r JOIN rooms rm ON rm.id=r.room_id JOIN members m ON m.id=r.member_id WHERE ${where} ORDER BY CASE r.kind WHEN 'steer' THEN 0 ELSE 1 END,r.created_at LIMIT ?`).all(now, now, now, limit);
    return rows.map(row => ({ ...row, room: this.room(row.room_id), member: this.member(row.member_id) }));
  }

  reminderView(reminder) {
    return {
      reminderId: reminder.id, roomId: reminder.room_id, memberId: reminder.member_id,
      kind: reminder.kind, status: reminder.status, triggerKey: reminder.trigger_key,
      snapshotSeq: reminder.snapshot_seq, unreadCount: reminder.unread_count,
      unreadMentionCount: reminder.unread_mention_count, inputId: reminder.input_id,
      budgetPeriod: reminder.budget_period, reason: reminder.reason,
      answerMessageId: reminder.answer_message_id, attempts: reminder.attempts,
      lastError: reminder.last_error, createdAt: reminder.created_at, updatedAt: reminder.updated_at,
    };
  }

  reminders(roomId, limit = 100) {
    this.room(roomId);
    return this.db.prepare("SELECT * FROM reminders WHERE room_id=? ORDER BY created_at DESC LIMIT ?").all(roomId, limit).map(row => this.reminderView(row));
  }

  executionEvent(sessionID, type, eventID = null, error = null, now = new Date().toISOString()) {
    const member = this.memberBySession(sessionID);
    if (type === "started") {
      if (eventID && member.last_started_event === eventID) return { changed: false, member };
      this.db.prepare("UPDATE members SET execution_round=execution_round+1,last_status='running',last_started_event=?,last_terminal_round=-1 WHERE id=?")
        .run(eventID, member.id);
      return { changed: true, member: this.member(member.id), terminal: false };
    }
    if (["succeeded", "failed", "interrupted"].includes(type)) {
      if (member.last_terminal_round === member.execution_round) {
        if (type === "failed" && error) {
          const message = executionErrorMessage(error);
          if (message !== member.last_error) {
            const retryAt = new Date(Date.parse(now) + failureBackoffMs(member.failure_count)).toISOString();
            this.db.prepare("UPDATE members SET last_error=?,last_error_at=?,wake_backoff_until=? WHERE id=?").run(message, now, retryAt, member.id);
            return { changed: true, member: this.member(member.id), terminal: true, error: message };
          }
        }
        return { changed: false, member, terminal: true };
      }
      if (type === "succeeded") {
        this.db.prepare("UPDATE members SET last_status='running',last_terminal_round=execution_round,failure_count=0,last_error=NULL,last_error_at=NULL,wake_backoff_until=NULL WHERE id=?").run(member.id);
      } else if (type === "failed") {
        const message = executionErrorMessage(error);
        const failures = member.failure_count + 1;
        const retryAt = new Date(Date.parse(now) + failureBackoffMs(failures)).toISOString();
        this.db.prepare("UPDATE members SET last_status='running',last_terminal_round=execution_round,failure_count=?,last_error=?,last_error_at=?,wake_backoff_until=? WHERE id=?")
          .run(failures, message, now, retryAt, member.id);
      } else {
        this.db.prepare("UPDATE members SET last_status='running',last_terminal_round=execution_round WHERE id=?").run(member.id);
      }
      return { changed: true, member: this.member(member.id), terminal: true, error: type === "failed" ? executionErrorMessage(error) : null };
    }
    return { changed: false, member, terminal: false };
  }

  setSessionStatus(sessionID, status, now = new Date().toISOString()) {
    const member = this.memberBySession(sessionID);
    if (status === "unknown") return { changed: false, member };
    if (status === "idle" && (member.last_status === "running" || member.last_status == null)) {
      this.db.prepare("UPDATE members SET last_status='idle',idle_epoch=idle_epoch+1 WHERE id=?").run(member.id);
      return { changed: true, member: this.member(member.id) };
    }
    this.db.prepare("UPDATE members SET last_status=? WHERE id=?").run(status, member.id);
    return { changed: false, member: this.member(member.id) };
  }

  pauseRoom(roomId, reason = "manual", now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    this.tx(() => {
      this.db.prepare("UPDATE rooms SET status='paused',paused_reason=? WHERE id=?").run(reason, roomId);
      this.configEvent(roomId, "room-paused", { status: room.status, remaining: room.budget_remaining }, { status: "paused", reason });
    });
    return this.roomSummary(this.room(roomId));
  }

  resumeRoom(roomId, budgetLimit = 50, now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") fail("ROOM_ENDED", "The room has ended.");
    if (room.status !== "paused") return this.roomSummary(room);
    if (!Number.isInteger(budgetLimit) || budgetLimit < 1 || budgetLimit > 100000) fail("ROOM_INVALID_INPUT", "budgetLimit must be between 1 and 100000.");
    const period = room.budget_period + 1;
    const ready = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent' AND creation_status='ready'").get(roomId).count;
    const total = this.db.prepare("SELECT COUNT(*) AS count FROM members WHERE room_id=? AND kind='agent'").get(roomId).count;
    return this.tx(() => {
      this.db.prepare("UPDATE budget_periods SET ended_at=?,reason=? WHERE room_id=? AND period=?").run(now, room.paused_reason, roomId, room.budget_period);
      this.db.prepare("UPDATE rooms SET status=?,paused_reason=NULL,budget_period=?,budget_limit=?,budget_remaining=? WHERE id=?").run(ready === total ? "ready" : "creating", period, budgetLimit, budgetLimit, roomId);
      this.db.prepare("INSERT INTO budget_periods(room_id,period,limit_count,started_at) VALUES(?,?,?,?)").run(roomId, period, budgetLimit, now);
      this.db.prepare("UPDATE members SET failure_count=0,last_error=NULL,last_error_at=NULL,wake_backoff_until=NULL WHERE room_id=? AND kind='agent'").run(roomId);
      this.configEvent(roomId, "room-resumed", { period: room.budget_period, remaining: room.budget_remaining }, { period, limit: budgetLimit });
      return this.roomSummary(this.room(roomId));
    });
  }

  endRoom(roomId, now = new Date().toISOString()) {
    const room = this.room(roomId);
    if (room.status === "ended") return this.roomSummary(room);
    return this.tx(() => {
      this.db.prepare("UPDATE rooms SET status='ended',ended_at=?,paused_reason='ended' WHERE id=?").run(now, roomId);
      const active = this.db.prepare("SELECT * FROM reminders WHERE room_id=? AND status IN ('pending','reserved','unknown','submitting')").all(roomId);
      for (const reminder of active) if (reminder.status === "reserved") this.refundReminderInTx(reminder, now);
      this.db.prepare("UPDATE reminders SET status='cancelled',updated_at=?,next_attempt_at=NULL WHERE room_id=? AND status IN ('pending','reserved','unknown','submitting')").run(now, roomId);
      this.configEvent(roomId, "room-ended", { status: room.status }, { status: "ended" });
      return this.roomSummary(this.room(roomId));
    });
  }

  configEvent(roomId, kind, before, after, now = new Date().toISOString()) {
    this.db.prepare("INSERT INTO config_events(room_id,kind,before_json,after_json,created_at) VALUES(?,?,?,?,?)")
      .run(roomId, kind, before == null ? null : json(before), after == null ? null : json(after), now);
  }

  diagnostic(kind, data = {}, now = new Date().toISOString()) {
    try {
      this.db.prepare("INSERT INTO diagnostics(room_id,member_id,session_id,kind,data_json,created_at) VALUES(?,?,?,?,?,?)")
        .run(data.roomId || null, data.memberId || null, data.sessionId || null, kind, json(data), now);
    } catch {
      // Diagnostics are deliberately outside the core consistency boundary.
    }
  }

  diagnostics(roomId, after = 0, limit = 200) {
    this.room(roomId);
    return this.db.prepare("SELECT * FROM diagnostics WHERE room_id=? AND seq>? ORDER BY seq LIMIT ?").all(roomId, Number(after), Math.min(Number(limit) || 200, 1000))
      .map(row => ({ seq: row.seq, kind: row.kind, createdAt: row.created_at, ...parse(row.data_json, {}) }));
  }
}
