import { RoomError } from "./errors.mjs";

function summarizeToolResult(result) {
  if (!result || typeof result !== "object") return { kind: "value" };
  const items = result.items || result.timeline || result.members || [];
  return {
    status: result.status || "ok", messageId: result.messageId || null,
    questionId: result.questionId || null, roomSeq: result.roomSeq ?? null,
    checkDecision: result.checkDecision || null, itemCount: Array.isArray(items) ? items.length : null,
    fullMessageIds: result.presentation?.messageIds || [],
    previewCount: Array.isArray(items) ? items.filter(item => item?.preview || item?.full === false).length : null,
    unread: result.unread || null,
  };
}

function isProviderQuotaError(error) {
  if (!error) return false;
  if (error.status === 402) return true;
  const text = `${error.type || ""} ${error.message || ""} ${error.response?.body || ""}`.toLowerCase();
  return /insufficient balance|free usage limit reached|quota exceeded|payment required|额度不足|余额不足/.test(text);
}
function reminderText(reminder) {
  const mentions = reminder.unread_mentions || [];
  const lines = [
    `你有 ${reminder.unread_count} 条未读，其中 ${reminder.unread_mention_count} 条 @ 你。`,
    ...mentions.map(item => `- #${item.roomSeq}（${item.createdAt}）：\`${item.messageId}\``),
    "用 room_unread() 阅读，或用 room_context({messageId: \"...\"}) 定位。提醒不含正文，也不改变已读。",
  ];
  if (reminder.reason === "question-answered") lines.push(`原因：你的问题有了回答。答案消息 ID：\`${reminder.answer_message_id}\`。`);
  return lines.join("\n");
}

export class RoomEngine {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now || (() => new Date().toISOString());
    this.statusProvider = options.statusProvider || (async () => ({ status: "unknown" }));
    this.rootSessionProvider = options.rootSessionProvider || null;
    this.rootChecks = new Map();
    this.onChange = options.onChange || (() => {});
    this.waitKinds = options.waitKinds || new Map();
    this.pendingChecks = new Set();
    this.decisionSignatures = new Map();
    this.scanning = false;
    this.timer = null;
    this.store.recoverExpiredReminders(this.now());
  }

  start(interval = 1000) {
    if (this.timer) return () => {};
    this.timer = setInterval(() => void this.scan().catch(error => this.store.diagnostic("scan-failed", { error: error.message })), interval);
    this.timer.unref?.();
    void this.scan().catch(error => this.store.diagnostic("scan-failed", { error: error.message }));
    return () => { clearInterval(this.timer); this.timer = null; };
  }

  changed(roomId) {
    try { this.onChange({ roomId }); } catch {}
  }

  createRoom(input) {
    const room = this.store.createRoom(input, this.now());
    this.store.diagnostic("room-created", { roomId: room.roomId, projectDir: room.projectDir });
    this.changed(room.roomId);
    return room;
  }

  retryCreation(roomId) {
    const room = this.store.retryCreation(roomId);
    this.changed(roomId);
    return room;
  }

  post(roomId, source, input) {
    const result = this.store.post(roomId, source, input, this.now());
    this.store.diagnostic(result.status === "review_required" ? "pre-send-review" : "room-post", { roomId, memberId: source.memberId, ...summarizeToolResult(result) });
    if (result.status === "stored") this.afterMessage(result.messageId);
    else this.changed(roomId);
    return result;
  }

  ask(roomId, source, input) {
    const result = this.store.ask(roomId, source, input, this.now());
    this.store.diagnostic(result.status === "review_required" ? "pre-send-review" : "room-ask", { roomId, memberId: source.memberId, ...summarizeToolResult(result) });
    if (result.status === "stored") this.afterMessage(result.messageId);
    else this.changed(roomId);
    return result;
  }

  answer(roomId, questionId, input) {
    const result = this.store.answerQuestion(roomId, questionId, input, this.now());
    this.afterMessage(result.messageId, result.askerId);
    this.changed(roomId);
    return result;
  }

  withdraw(roomId, source, questionId, input) {
    const result = this.store.withdrawQuestion(roomId, source, questionId, input, this.now());
    this.store.diagnostic("question-withdrawn", { roomId, memberId: source.memberId, questionId });
    this.changed(roomId);
    return result;
  }

  afterMessage(messageId, answerAskerId = null) {
    const message = this.store.message(messageId);
    const mentions = new Set(this.store.mentionedMembers(messageId).map(member => member.id));
    for (const member of this.store.agents(message.room_id)) {
      if (member.id === message.author_id) continue;
      if (mentions.has(member.id) || member.id === answerAskerId) {
        this.store.ensureReminder(message.room_id, member.id, {
          kind: "steer",
          triggerKey: answerAskerId === member.id ? `answer:${message.question_id || messageId}` : `message:${messageId}`,
          reason: answerAskerId === member.id ? "question-answered" : "mention",
          answerMessageId: answerAskerId === member.id ? messageId : null,
        }, this.now());
      }
      this.checkMemberLater(message.room_id, member.id);
    }
    this.changed(message.room_id);
  }

  checkMemberLater(roomId, memberId) {
    const promise = Promise.resolve().then(() => this.recheckMember(roomId, memberId)).catch(error => {
      this.store.diagnostic("status-check-failed", { roomId, memberId, error: error.message });
    }).finally(() => this.pendingChecks.delete(promise));
    this.pendingChecks.add(promise);
  }

  async flush() {
    while (this.pendingChecks.size) await Promise.all([...this.pendingChecks]);
  }

  diagnosticOnce(key, kind, data) {
    if (this.decisionSignatures.get(key) === kind) return;
    this.decisionSignatures.set(key, kind);
    this.store.diagnostic(kind, data);
  }

  async queryStatus(member) {
    try {
      const result = await this.statusProvider(member.session_id);
      return result?.status || "unknown";
    } catch (error) {
      this.diagnosticOnce(`status-error:${member.session_id}:${error.message}`, "session-status-error", { roomId: member.room_id, memberId: member.id, sessionId: member.session_id, error: error.message });
      return "unknown";
    }
  }

  async recheckMember(roomId, memberId) {
    const room = this.store.room(roomId);
    const member = this.store.member(memberId);
    if (room.status !== "ready" || member.creation_status !== "ready") return null;
    if (member.wake_backoff_until && Date.parse(member.wake_backoff_until) > Date.parse(this.now())) return null;
    const before = this.store.unreadSummary(roomId, memberId, []);
    if (!before.unreadCount) return null;
    const status = await this.queryStatus(member);
    const observed = this.store.setSessionStatus(member.session_id, status, this.now());
    let reminder = null;
    if (status === "idle") {
      reminder = this.store.ensureReminder(roomId, memberId, {
        kind: "queue", triggerKey: `idle:${observed.member.idle_epoch}`, reason: "round-end",
      }, this.now());
    }
    const reason = status === "idle" ? "round-end" : `session-${status}`;
    this.diagnosticOnce(`wake:${memberId}:${status}:${before.unreadCount}:${before.unreadMentionCount}:${reminder?.id || "none"}`, "wake-decision", {
      roomId, memberId, sessionId: member.session_id, status,
      unreadCount: before.unreadCount, unreadMentionCount: before.unreadMentionCount,
      reminderId: reminder?.id || null, reason,
    });
    return { status, reminder };
  }

  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      this.store.recoverExpiredReminders(this.now());
      for (const room of this.store.listRooms()) {
        if (room.status !== "ready") continue;
        for (const member of this.store.agents(room.roomId)) {
          if (member.creation_status !== "ready") continue;
          if (!this.store.unreadSummary(room.roomId, member.id, []).unreadCount) continue;
          await this.recheckMember(room.roomId, member.id);
        }
      }
    } finally {
      this.scanning = false;
    }
  }

  async memberStatuses(roomId) {
    const members = this.store.agents(roomId);
    const statuses = await Promise.all(members.map(member => this.queryStatus(member)));
    return Object.fromEntries(members.map((member, index) => [member.id, statuses[index]]));
  }

  async ensureRootSession(roomId) {
    if (!this.rootSessionProvider) return;
    const room = this.store.room(roomId);
    if (room.status === "ended" || room.root_creation_status !== "ready" || !room.root_session_id) return;
    const previous = this.rootChecks.get(roomId);
    const interval = previous?.healthy ? 30000 : 5000;
    if (previous && Date.now() - previous.at < interval) return;
    try {
      await this.rootSessionProvider(room.root_session_id);
      this.rootChecks.set(roomId, { at: Date.now(), healthy: true });
    } catch (error) {
      if (error?.status !== 404) {
        this.rootChecks.set(roomId, { at: Date.now(), healthy: false });
        return;
      }
      if (this.store.resetMissingRoot(roomId)) this.changed(roomId);
      this.rootChecks.delete(roomId);
    }
  }

  async roomState(roomId) {
    await this.ensureRootSession(roomId);
    const summary = this.store.roomSummary(this.store.room(roomId));
    const statuses = await this.memberStatuses(roomId);
    summary.members = summary.members.map(member => member.kind === "agent" ? { ...member, sessionStatus: statuses[member.memberId] || "unknown" } : member);
    summary.reminders = this.store.reminders(roomId, 30);
    return summary;
  }

  listRooms(projectDir) { return this.store.listRooms(projectDir); }

  timeline(roomId, input = {}) {
    return this.store.history(roomId, { ...input, trackPresentation: false, viewerMemberId: input.viewerMemberId || this.store.room(roomId).human_id }, this.now());
  }

  context(roomId, messageId, input = {}) {
    return this.store.context(roomId, messageId, { ...input, trackPresentation: false, viewerMemberId: this.store.room(roomId).human_id }, this.now());
  }

  questions(roomId, input = {}) { return this.store.questions(roomId, input); }
  receipts(roomId, messageId) { return this.store.receipts(roomId, messageId); }
  diagnostics(roomId, after = 0) { return this.store.diagnostics(roomId, after); }

  markRead(roomId, memberId, messageIds, source = "ui") {
    const result = this.store.markRead(roomId, memberId, messageIds, source, this.now());
    if (result.marked > 0) this.changed(roomId);
    return result;
  }

  confirmPresentation(presentationId, sessionID) {
    const result = this.store.confirmPresentation(presentationId, sessionID, this.now());
    if (result.confirmed) this.changed(result.roomId);
    return result;
  }

  pause(roomId, reason = "manual") {
    const room = this.store.pauseRoom(roomId, reason, this.now());
    this.changed(roomId);
    return room;
  }

  resume(roomId, budgetLimit = 50) {
    const room = this.store.resumeRoom(roomId, budgetLimit, this.now());
    this.changed(roomId);
    void this.scan().catch(error => this.store.diagnostic("scan-failed", { error: error.message }));
    return room;
  }

  end(roomId) {
    const room = this.store.endRoom(roomId, this.now());
    this.changed(roomId);
    return room;
  }

  rename(roomId, memberId, displayName) {
    const member = this.store.renameMember(roomId, memberId, displayName);
    this.changed(roomId);
    return member;
  }

  changeModel(roomId, memberId, model) {
    const member = this.store.changeMemberModel(roomId, memberId, model, this.now());
    this.changed(roomId);
    return member;
  }

  executionEvent(sessionID, type, eventID, error = null) {
    let member;
    try { member = this.store.memberBySession(sessionID); } catch { return; }
    const now = this.now();
    const result = this.store.executionEvent(sessionID, type, eventID, error, now);
    if (result.changed) this.store.diagnostic("execution-event", { roomId: member.room_id, memberId: member.id, sessionId: sessionID, type, eventId: eventID || null, error: result.error, changed: true });
    if (result.terminal && type === "failed") {
      if (isProviderQuotaError(error)) {
        const refunded = this.store.refundAcceptedRemindersForRound(member.id, result.member.execution_round - 1, now);
        if (this.store.room(member.room_id).status !== "ended") this.store.pauseRoom(member.room_id, "provider-quota", now);
        this.store.diagnostic("provider-quota-pause", { roomId: member.room_id, memberId: member.id, sessionId: sessionID, error: result.error, refundedReminderIds: refunded.map(reminder => reminder.id) });
      }
    } else if (result.terminal) {
      this.checkMemberLater(member.room_id, member.id);
      const retry = setTimeout(() => this.checkMemberLater(member.room_id, member.id), 100);
      retry.unref?.();
    }
    this.changed(member.room_id);
    return result;
  }

  hostEvent(event) {
    const sessionID = event.session?.id;
    if (!sessionID) return;
    let member;
    try { member = this.store.memberBySession(sessionID); } catch { return; }
    if (event.type === "permission-asked" || event.type === "question-asked") {
      this.waitKinds.set(sessionID, event.type === "permission-asked" ? "waiting-permission" : "waiting-question");
      this.store.diagnostic("native-wait-started", { roomId: member.room_id, memberId: member.id, sessionId: sessionID, kind: this.waitKinds.get(sessionID) });
      this.changed(member.room_id);
    } else if (event.type === "turn-started") {
      this.waitKinds.delete(sessionID);
    } else if (event.type === "turn-finished" || event.type === "turn-failed") {
      this.waitKinds.delete(sessionID);
      this.executionEvent(sessionID, event.type === "turn-finished" ? "succeeded" : "failed", `host:${event.id}`, event.error || null);
    }
  }

  async tool(sessionID, name, input = {}) {
    const member = this.store.memberBySession(sessionID);
    const roomId = member.room_id;
    try {
      let result;
      switch (name) {
        case "room_unread":
          result = input.mentionCursor != null || input.mentionsOnly === true
            ? this.store.mentionMetadata(roomId, member.id, input)
            : this.store.unread(roomId, member.id, input, this.now());
          break;
        case "room_history":
          result = this.store.history(roomId, { ...input, viewerMemberId: member.id }, this.now());
          break;
        case "room_context":
          result = this.store.context(roomId, input.messageId, { ...input, viewerMemberId: member.id }, this.now());
          break;
        case "room_members": {
          const statuses = await this.memberStatuses(roomId);
          result = {
            roomId,
            members: [
              { memberId: this.store.room(roomId).human_id, displayName: this.store.room(roomId).human_name, kind: "human", role: "host" },
              ...this.store.agents(roomId).map(item => ({ memberId: item.id, displayName: item.display_name, kind: item.kind, role: item.role, sessionStatus: statuses[item.id] || "unknown" })),
            ],
          };
          break;
        }
        case "room_questions": result = this.store.questions(roomId, input); break;
        case "room_post": result = this.post(roomId, { kind: "agent", memberId: member.id }, input); break;
        case "room_ask": result = this.ask(roomId, { kind: "agent", memberId: member.id }, input); break;
        case "room_withdraw_question": result = this.withdraw(roomId, { kind: "agent", memberId: member.id }, input.questionId, input); break;
        default: throw new RoomError("ROOM_UNKNOWN_TOOL", `Unknown room tool: ${name}`, {}, 400);
      }
      this.store.diagnostic(`tool:${name}`, { roomId, memberId: member.id, sessionId: sessionID, ...summarizeToolResult(result) });
      return result;
    } catch (error) {
      this.store.diagnostic(`tool:${name}`, { roomId, memberId: member.id, sessionId: sessionID, status: "error", code: error.code, error: error.message });
      throw error;
    }
  }

  nextJob() {
    const now = this.now();
    const due = member => !member.next_attempt_at || Date.parse(member.next_attempt_at) <= Date.parse(now);
    const rootDue = room => !room.root_next_attempt_at || Date.parse(room.root_next_attempt_at) <= Date.parse(now);
    for (const room of this.store.listRooms()) {
      if (room.status === "ended") {
        for (const member of this.store.agents(room.roomId)) {
          if (member.session_id && member.instructions_added && due(member)) {
            this.store.taskAttempt(room.roomId, member.id, now);
            return { jobId: `remove:${room.roomId}:${member.id}`, type: "remove-instructions", roomId: room.roomId, memberId: member.id, sessionId: member.session_id, key: "discussions.room" };
          }
        }
      }
    }
    for (const listed of this.store.listRooms()) {
      if (listed.status === "ended") continue;
      const room = this.store.prepareRoomRoot(listed.roomId);
      const roomId = room.id;
      const rootReady = room.root_creation_status === "ready";
      if (!rootReady && rootDue(room)) {
        this.store.rootTaskAttempt(roomId, now);
        return {
          jobId: `root:${roomId}`, type: "create-root-session", roomId,
          sessionId: room.root_session_id, title: `${room.title} · 讨论室`, directory: room.project_dir,
          metadata: { discussionRoomId: roomId, discussionRoot: true },
          note: `这是“${room.title}”的讨论室会话组。成员会话不会显示在侧栏，请从“多智能体讨论室”页面中的成员“会话”按钮打开。房间自动调度不会向本会话调用模型；请勿直接向本会话发送议题。`,
        };
      }
      for (const member of this.store.agents(roomId)) {
        if (!due(member)) continue;
        const metadata = {
          discussionRoomId: roomId,
          discussionMemberId: member.id,
          ...(rootReady ? { openchamber: { kind: "workflow-agent", parentID: room.root_session_id } } : {}),
        };
        const title = `${room.title} · ${member.display_name}`;
        if (member.session_id && !member.session_linked && rootReady) {
          this.store.taskAttempt(roomId, member.id, now);
          return { jobId: `link:${roomId}:${member.id}`, type: "link-session", roomId, memberId: member.id, sessionId: member.session_id, title, metadata };
        }
        if (room.status === "ended") continue;
        if (member.session_id && !member.model_synced) {
          this.store.taskAttempt(roomId, member.id, now);
          return { jobId: `model:${roomId}:${member.id}`, type: "change-session-model", roomId, memberId: member.id, sessionId: member.session_id, model: JSON.parse(member.model_json) };
        }
        if (!member.session_id && member.creation_status === "pending") {
          this.store.taskAttempt(roomId, member.id, now);
          return {
            jobId: `create:${roomId}:${member.id}`, type: "create-session", roomId, memberId: member.id,
            sessionId: `ses_disc_${roomId}_${member.id}`, title,
            directory: room.project_dir, model: JSON.parse(member.model_json), permissions: [
              { action: "*", resource: "*", effect: "allow" },
              { action: "question", resource: "*", effect: "deny" },
            ],
            metadata,
          };
        }
        if (member.session_id && !member.instructions_added) {
          this.store.taskAttempt(roomId, member.id, now);
          return { jobId: `instructions:${roomId}:${member.id}`, type: "put-instructions", roomId, memberId: member.id, sessionId: member.session_id, ...this.store.instructions(roomId, member.id) };
        }
      }
    }
    return null;
  }

  reminderRelevant(reminder) {
    if (reminder.kind === "queue") return true;
    const messageId = reminder.trigger_key.split(":")[1];
    const message = this.store.db.prepare("SELECT * FROM messages WHERE id=? AND room_id=?").get(messageId, reminder.room_id);
    if (!message || this.store.hasRead(reminder.member_id, message.id)) return false;
    if (reminder.trigger_key.startsWith("answer:")) {
      const question = this.store.db.prepare("SELECT * FROM questions WHERE answer_message_id=? AND asker_id=?").get(message.id, reminder.member_id);
      return !!question;
    }
    return message.author_id !== reminder.member_id && (message.mention_all === 1 || !!this.store.db.prepare("SELECT 1 FROM message_mentions WHERE message_id=? AND member_id=?").get(message.id, reminder.member_id));
  }

  async dispatchNext() {
    const creation = this.nextJob();
    if (creation) return creation;
    this.store.recoverExpiredReminders(this.now());
    const deadline = Date.now() + 8000;
    for (const candidate of this.store.dueReminders(null, 100, this.now())) {
      if (Date.now() >= deadline) break;
      if (candidate.member.creation_status !== "ready") continue;
      const canRetryCharged = candidate.charged === 1 && candidate.room.status === "paused" && candidate.room.paused_reason === "budget";
      if (candidate.room.status !== "ready" && !canRetryCharged) continue;
      let reminder = this.store.refreshReminder(candidate.id, this.now());
      if (!reminder?.unread_count) { this.store.cancelReminder(candidate.id, "No unread messages remain"); continue; }
      if (!this.reminderRelevant(reminder)) { this.store.cancelReminder(candidate.id, "Mentioned message is no longer unread"); continue; }
      const member = this.store.member(reminder.member_id);
      const status = await this.queryStatus(member);
      if (Date.now() >= deadline) {
        this.store.deferReminder(reminder.id, `Status check exceeded the dispatch time budget`, this.now());
        break;
      }
      const waiting = status === "unknown" || status === "waiting-human" || status === "waiting-question" || status === "waiting-permission";
      if (waiting || (reminder.kind === "queue" && status !== "idle")) {
        this.store.deferReminder(reminder.id, waiting ? `Session status is ${status}; reminder deferred` : `Session is ${status}; ordinary reminder waits for idle`, this.now());
        continue;
      }
      reminder = this.store.refreshReminder(reminder.id, this.now());
      if (!reminder?.unread_count) { this.store.cancelReminder(candidate.id, "Messages were read before dispatch"); continue; }
      const reserved = this.store.reserveReminder(reminder.id, this.now());
      if (!reserved) continue;
      this.store.markSubmitting(reminder.id, this.now());
      const summary = this.store.unreadSummary(reminder.room_id, reminder.member_id, []);
      if (!summary.unreadCount) { this.store.ackReminder(reminder.id, "failed", "Messages were read before submission"); continue; }
      const payload = { ...reminder, unread_count: summary.unreadCount, unread_mention_count: summary.unreadMentionCount, unread_mentions: summary.unreadMentions };
      this.store.diagnostic("reminder-submitting", { roomId: reminder.room_id, memberId: reminder.member_id, reminderId: reminder.id, kind: reminder.kind, snapshotSeq: reminder.snapshot_seq, unreadCount: summary.unreadCount, budgetRemaining: this.store.room(reminder.room_id).budget_remaining });
      this.changed(reminder.room_id);
      return {
        jobId: reminder.id, type: "submit-reminder", roomId: reminder.room_id, memberId: reminder.member_id,
        sessionId: member.session_id, inputId: reminder.input_id, delivery: reminder.kind,
        text: reminderText(payload),
        metadata: { discussionRoomId: reminder.room_id, discussionMemberId: reminder.member_id, reminderId: reminder.id, reminderKind: reminder.kind, snapshotSeq: reminder.snapshot_seq },
      };
    }
    return null;
  }

  async jobResult(job, result) {
    const outcome = result.outcome;
    if (job.type === "create-root-session") {
      if (outcome === "accepted") this.store.rootSessionCreated(job.roomId, result.sessionId, this.now());
      else this.store.rootSessionFailed(job.roomId, result.error || "Room root session creation failed", this.now());
    } else if (job.type === "create-session") {
      if (outcome === "accepted") this.store.sessionCreated(job.roomId, job.memberId, result.sessionId, this.now(), job.metadata?.openchamber?.parentID != null);
      else this.store.sessionFailed(job.roomId, job.memberId, result.error || "Session creation failed");
    } else if (job.type === "link-session") {
      if (outcome === "accepted") this.store.sessionLinked(job.roomId, job.memberId);
      else this.store.taskFailed(job.roomId, job.memberId, result.error || "Session grouping failed", this.now());
    } else if (job.type === "change-session-model") {
      if (outcome === "accepted") this.store.sessionModelSynced(job.roomId, job.memberId);
      else this.store.taskFailed(job.roomId, job.memberId, result.error || "Model switch failed", this.now());
    } else if (job.type === "put-instructions") {
      if (outcome === "accepted") this.store.instructionsAdded(job.roomId, job.memberId);
      else if (!this.store.member(job.memberId).instructions_added) this.store.taskFailed(job.roomId, job.memberId, result.error || "Instruction update failed", this.now());
    } else if (job.type === "remove-instructions") {
      if (outcome === "accepted") this.store.instructionsRemoved(job.roomId, job.memberId);
      else if (this.store.member(job.memberId).instructions_added) this.store.taskFailed(job.roomId, job.memberId, result.error || "Instruction removal failed", this.now());
    } else if (job.type === "submit-reminder") {
      const reminder = this.store.ackReminder(job.jobId, outcome, result.error, this.now());
      if (outcome === "accepted" && reminder?.status === "accepted" && reminder.kind === "steer") this.store.coverOrdinary(reminder.room_id, reminder.member_id, reminder, this.now());
      this.store.diagnostic("reminder-result", { roomId: job.roomId, memberId: job.memberId, reminderId: job.jobId, outcome, inputId: job.inputId, error: result.error || null });
    }
    this.changed(job.roomId);
    return { ok: true };
  }

  mentionCandidates(roomId) {
    const room = this.store.room(roomId);
    return [
      ...this.store.agents(roomId).map(member => ({ id: member.id, label: member.display_name, kind: "agent" })),
      { id: "@all", label: "所有人", kind: "all" },
    ];
  }
}
