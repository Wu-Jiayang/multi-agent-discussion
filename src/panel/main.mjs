import { connectHost } from "@openchamber/sdk";
import { applyHostReady } from "@openchamber/sdk/ui";

const host = connectHost();
const $ = selector => document.querySelector(selector);
const app = $("#app");
const state = {
  directory: null, rooms: [], models: [], room: null, roomId: null, creating: false,
  createAgents: [], createHumanName: "房主", timeline: [], timelineCursor: null, timelineSignature: "",
  questions: [], questionStatus: "pending", questionSignature: "", questionFirstSignature: "", questionCursor: null, selectedQuestionId: null,
  chatAnchor: null, followLatest: true, search: "", author: "", replyTo: null,
  mentions: new Set(), mentionAll: false, answerDrafts: {}, composerDraft: "", composerDraftRestored: false, mobilePane: "chat",
  chatScroll: 0, questionScroll: 0, pendingView: null, loading: false, generation: 0,
};
const roleLabels = { generic: "通用", proposer: "提案者", reviewer: "审查者", moderator: "主持人" };
const statusLabels = {
  idle: "空闲", running: "运行中", "waiting-human": "等待人工输入",
  "waiting-question": "等待原生提问", "waiting-permission": "等待权限确认", unknown: "状态未知／不可达",
};

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function time(value) {
  try { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)); }
  catch { return String(value || ""); }
}
function showError(error) {
  const el = $("#error");
  el.textContent = error?.message || String(error);
  el.hidden = false;
}
function clearError() { $("#error").hidden = true; }
async function request(method, path, body, query) {
  const result = await host.serviceRequest({ method, path, query: query && Object.fromEntries(Object.entries(query).filter(([, value]) => value != null && value !== "").map(([key, value]) => [key, String(value)])), body: body == null ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = result.body ? JSON.parse(result.body) : null; } catch {}
  if (result.status >= 400) {
    const error = new Error(data?.error?.message || `请求失败（${result.status}）`);
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }
  return data;
}
function toast(message, kind = "info") { host.toast({ kind, message }).catch(() => {}); }
function persistView() {
  const view = { roomId: state.roomId, chatAnchor: state.chatAnchor, search: state.search, author: state.author, questionStatus: state.questionStatus, selectedQuestionId: state.selectedQuestionId, mobilePane: state.mobilePane, composerDraft: state.composerDraft, followLatest: state.followLatest, chatScroll: state.chatScroll, questionScroll: state.questionScroll };
  host.storage.set("discussion-view", view).catch(() => {});
}
let viewPersistTimer;
function persistViewSoon() {
  clearTimeout(viewPersistTimer);
  viewPersistTimer = setTimeout(persistView, 200);
}

function renderRoomSelect() {
  const select = $("#room-select");
  select.innerHTML = `<option value="">选择讨论室</option>${state.rooms.map(room => `<option value="${escape(room.roomId)}">${escape(room.title)} · ${escape(room.status === "ready" ? "进行中" : room.status === "paused" ? "已暂停" : room.status === "ended" ? "已结束" : "创建中")}</option>`).join("")}`;
  select.value = state.roomId || "";
  $("#new-room").textContent = state.creating ? "取消新建" : "新建房间";
}
async function refreshModels(force = false) {
  if (!state.directory || (!force && state.models.length)) return;
  try {
    const catalog = await request("GET", "/models", null, { directory: state.directory });
    const signature = JSON.stringify(catalog.models);
    if (signature === JSON.stringify(state.models)) return;
    state.models = catalog.models;
    if (!state.createAgents.length) resetCreateAgents();
    else {
      const available = new Set(state.models.map(modelKey));
      const missing = state.createAgents.some(row => row.modelKey && !available.has(row.modelKey));
      if (missing) {
        for (const row of state.createAgents) if (!available.has(row.modelKey)) row.modelKey = "";
        showError(new Error("模型目录已变化，请重新选择受影响的成员模型。"));
      }
    }
    if (state.creating) renderCreate();
  } catch (error) { showError(error); }
}
function showCreate() {
  state.creating = true;
  state.roomId = null;
  state.room = null;
  $("#create-view").hidden = false;
  $("#room-view").hidden = true;
  renderRoomSelect();
  renderCreate();
  void refreshModels(true);
}
function hideCreate() {
  state.creating = false;
  $("#create-view").hidden = true;
  renderRoomSelect();
}
function defaultName(role, index, rows) {
  const base = role === "generic" ? `Agent ${index + 1}` : roleLabels[role];
  let name = base;
  for (let suffix = 2; rows.some((row, rowIndex) => rowIndex !== index && row.displayName === name); suffix += 1) name = `${base} ${suffix}`;
  return name;
}
function modelKey(model) { return model ? JSON.stringify([model.providerID, model.id]) : ""; }
function modelOptions(selected) {
  const providers = [...new Set(state.models.map(model => model.providerID))];
  return `<option value="" ${selected ? "" : "selected"}>请选择模型</option>` + providers.map(provider => `<optgroup label="${escape(provider)}">${state.models.filter(model => model.providerID === provider).map(model => `<option value="${escape(modelKey(model))}" ${selected === modelKey(model) ? "selected" : ""}>${escape(model.name)}${model.variant ? ` (${escape(model.variant)})` : ""}</option>`).join("")}</optgroup>`).join("");
}
function renderCreate() {
  const preset = state.createPreset || "generic";
  $("#create-view").innerHTML = `
    <h1>新建讨论室</h1>
    <p class="intro">为每个角色创建独立 OpenCode 会话。确认前可改显示名；建房本身不会调用模型。</p>
    <div class="form-grid">
      <div class="field"><label>房间名称</label><input id="create-title" value="${escape(state.createTitle || "新的讨论室")}" maxlength="120"></div>
      <div class="field"><label>预设</label><select id="create-preset"><option value="generic" ${preset === "generic" ? "selected" : ""}>普通讨论</option><option value="debate" ${preset === "debate" ? "selected" : ""}>双模型辩论</option></select></div>
      <div class="field"><label>房主显示名</label><input id="create-human" value="${escape(state.createHumanName)}" maxlength="80"></div>
    </div>
    ${preset === "debate" ? `<div class="warning">双模型辩论预设共享 12 次自动唤醒。初始立场会写进会话指令，允许随证据修改。</div>` : ""}
    <div id="agent-rows">${state.createAgents.map((row, index) => `
      <div class="agent-editor" data-agent="${index}">
        <div class="agent-title"><strong>成员 ${index + 1}</strong><button class="button ghost danger" data-action="remove-agent" ${state.createAgents.length <= 2 ? "disabled" : ""}>移除</button></div>
        <div class="agent-fields">
          <div class="field"><label>显示名</label><input data-field="displayName" value="${escape(row.displayName)}" maxlength="80"></div>
          <div class="field"><label>角色</label><select data-field="role">${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${row.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="field"><label>模型</label><select data-field="model">${state.models.length ? modelOptions(row.modelKey) : `<option>正在读取可用模型…</option>`}</select></div>
        </div>
      </div>`).join("")}</div>
    <button class="button secondary" data-action="add-agent">添加成员</button>
    <div class="warning">新会话使用当前项目工作区，默认完全执行权限，并在会话级禁用原生提问工具。多个 Agent 同时写同一工作区可能互相覆盖文件；讨论文档请写房间临时目录。不会修改全局权限，不创建 worktree。</div>
    <div class="create-actions"><button class="button primary" data-action="create-room" ${!state.models.length || !state.directory || state.createAgents.some(row => !row.modelKey) ? "disabled" : ""}>创建房间</button><button class="button secondary" data-action="cancel-create">取消</button></div>
    ${!state.directory ? `<p class="intro">请先在 OpenChamber 打开一个项目。</p>` : ""}
  `;
}
function resetCreateAgents() {
  state.createPreset = "generic";
  state.createTitle = "新的讨论室";
  state.createAgents = [0, 1].map(index => ({ role: "generic", displayName: `Agent ${index + 1}`, modelKey: modelKey(state.models[Math.min(index, Math.max(0, state.models.length - 1))]), autoName: true }));
}

async function loadRooms(preferred) {
  const data = await request("GET", "/rooms", null, { projectDir: state.directory });
  state.rooms = data.rooms;
  const requested = preferred || state.roomId;
  let next = state.rooms.some(room => room.roomId === requested) ? requested : state.rooms[0]?.roomId || null;
  if (state.creating) next = null;
  renderRoomSelect();
  if (next && state.rooms.some(room => room.roomId === next)) await selectRoom(next, state.pendingView);
  else if (!state.creating) {
    state.room = null; state.roomId = null;
    $("#create-view").hidden = false; $("#room-view").hidden = true;
    renderCreate();
  }
}
async function selectRoom(roomId, restore = null) {
  if (!roomId) return;
  const view = restore?.roomId === roomId ? restore : null;
  state.roomId = roomId;
  state.creating = false;
  state.chatAnchor = view?.chatAnchor || null;
  state.selectedQuestionId = view?.selectedQuestionId || null;
  state.timelineSignature = ""; state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null; state.followLatest = view?.followLatest ?? true;
  state.search = view?.search || ""; state.author = view?.author || ""; state.replyTo = null;
  state.mentions.clear(); state.mentionAll = false; state.composerDraft = view?.composerDraft || ""; state.composerDraftRestored = !!view;
  state.pendingView = null;
  $("#create-view").hidden = true;
  $("#room-view").hidden = false;
  $("#room-view").dataset.mobilePane = state.mobilePane;
  $("#question-status").value = state.questionStatus;
  document.querySelectorAll(".mobile-tabs button").forEach(button => button.classList.toggle("active", button.dataset.pane === state.mobilePane));
  $("#history-search").value = state.search;
  renderRoomSelect();
  await Promise.all([refreshRoom(), loadQuestions()]);
  if (state.chatAnchor) await loadTimeline(false, null, state.chatAnchor);
  else await loadTimeline(true);
  if (view?.questionScroll) $("#question-list").scrollTop = view.questionScroll;
  if (view?.chatScroll) $("#timeline").scrollTop = view.chatScroll;
  renderComposer();
  renderAuthorFilter();
  persistView();
}

async function refreshRoom() {
  if (!state.roomId) return;
  state.room = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}`);
  renderRoomHeader();
  renderAuthorFilter();
  const ready = state.room.status === "ready";
  if (state.composerReady !== ready) {
    const draft = $("#composer-text")?.value || "";
    state.composerReady = ready;
    renderComposer();
    if (draft) $("#composer-text").value = draft;
  }
}
function renderRoomHeader() {
  const room = state.room;
  if (!room) return;
  const paused = room.status === "paused";
  $("#room-header").innerHTML = `
    <div><div class="room-title">${escape(room.title)}</div><div class="member-list"><span class="member-chip"><span>${escape(room.human.displayName)}</span><span class="pill">人类 · 房主</span></span>${room.members.map(member => `<span class="member-chip"><span>${escape(member.displayName)}</span>${member.creationStatus === "failed" || member.creationError ? `<span class="pill error">创建失败：${escape(member.creationError || member.taskError || "未知原因")}</span>` : `<span class="pill ${escape(member.sessionStatus)}">${escape(statusLabels[member.sessionStatus] || member.sessionStatus)}</span>`}${member.sessionId ? `<button data-action="open-session" data-session="${escape(member.sessionId)}">会话</button>` : ""}</span>`).join("")}</div></div>
    <div class="room-controls">
      <span class="pill budget">余额 ${room.budget.remaining}/${room.budget.limit} · 第 ${room.budget.period} 段</span>
      ${room.status === "creating" ? `<button class="button secondary" data-action="retry">重试缺失会话</button>` : room.status !== "ended" ? `${paused ? `<button class="button primary" data-action="resume">继续房间</button>` : `<button class="button secondary" data-action="pause">暂停唤醒</button>`}<button class="button ghost danger" data-action="end">结束房间</button>` : ""}
    </div>
    ${paused && room.status !== "creating" ? `<div class="composer-hint">自动唤醒已暂停（${escape(room.pausedReason === "budget" ? "额度用尽" : "手动暂停")}）。发帖、阅读和提问仍可使用。</div>` : ""}
  `;
}
function renderAuthorFilter() {
  const room = state.room;
  if (!room) return;
  const select = $("#author-filter");
  const previous = state.author;
  select.innerHTML = `<option value="">全部作者</option><option value="${escape(room.human.memberId)}">${escape(room.human.displayName)} · 人类</option>${room.members.map(member => `<option value="${escape(member.memberId)}">${escape(member.displayName)} · Agent</option>`).join("")}`;
  select.value = previous;
}
function renderText(text) {
  const escaped = escape(text);
  const root = state.room?.workspaceDir;
  if (!root) return escaped;
  const safeRoot = escape(root);
  let output = "";
  let cursor = 0;
  while (cursor < escaped.length) {
    const at = escaped.indexOf(safeRoot, cursor);
    if (at < 0) { output += escaped.slice(cursor); break; }
    output += escaped.slice(cursor, at);
    let end = at + safeRoot.length;
    while (end < escaped.length && !/[\s`<>，。；）)]/.test(escaped[end])) end += 1;
    const path = escaped.slice(at, end);
    output += `<button class="path-link" data-action="open-file" data-path="${path}">${path}</button>`;
    cursor = end;
  }
  return output;
}
function renderMessage(message) {
  const own = message.isOwn ? "own" : "";
  const anchor = state.chatAnchor === message.messageId ? "anchor" : "";
  const question = message.questionId ? `<div class="question-card"><span class="pill">问题 · ${escape(message.questionStatus || "pending")}</span>${message.options?.length ? `<ol class="options">${message.options.map(option => `<li>${escape(option)}</li>`).join("")}</ol>` : ""}${message.answerMessageId ? `<button class="button ghost" data-action="open-message" data-message="${escape(message.answerMessageId)}">打开答案</button>` : ""}</div>` : "";
  const quote = message.replyTo ? `<div class="quote" data-action="open-message" data-message="${escape(message.replyTo.messageId)}" ${message.replyTo.full ? `data-full-message-id="${escape(message.replyTo.messageId)}"` : ""}><div class="quote-label">${escape(message.replyTo.label)}</div><div class="quote-text">${renderText(message.replyTo.text || "原帖不可用或已删除。")}</div></div>` : "";
  const mentions = message.mentions?.length || message.mentionAll ? `<span class="mentions">${message.mentionAll ? `<span class="mention">@所有人</span>` : ""}${(message.mentions || []).map(member => `<span class="mention">@${escape(member.display_name)}</span>`).join("")}</span>` : "";
  return `<article class="message ${message.author.kind} ${own} ${anchor}" data-message-row="${escape(message.messageId)}">
    <div class="avatar">${escape(message.author.displayName.slice(0, 1))}</div>
    <div class="message-body">
      <div class="message-meta"><span class="message-author">${escape(message.author.displayName)} · ${message.author.kind === "agent" ? "Agent" : "人类"}${message.isOwn ? " · 你" : ""}</span><span class="message-seq">#${message.roomSeq}</span><span class="message-time">${escape(time(message.createdAt))}</span>${mentions}</div>
      <div class="message-text" ${message.full ? `data-full-message-id="${escape(message.messageId)}"` : ""}>${renderText(message.text)}</div>
      ${message.preview ? `<div class="composer-hint">预览 · 打开全文后才记已读</div>` : ""}
      ${quote}${question}
      <div class="message-actions"><button data-action="reply" data-message="${escape(message.messageId)}">引用回复</button><button data-action="open-message" data-message="${escape(message.messageId)}">定位</button><button data-action="receipts" data-message="${escape(message.messageId)}">已读详情</button><button data-action="copy-locator" data-message="${escape(message.messageId)}" data-seq="${message.roomSeq}">复制定位</button></div>
    </div>
  </article>`;
}
function renderTimeline() {
  const el = $("#timeline");
  const oldHeight = el.scrollHeight;
  const oldTop = el.scrollTop;
  el.innerHTML = state.timeline.length ? state.timeline.map(renderMessage).join("") : `<div class="empty">${state.chatAnchor ? "这个消息不可用。" : "还没有消息。全部会话就绪后，发出第一条议题。"}</div>`;
  if (state.chatAnchor) {
    const target = el.querySelector(`[data-message-row="${CSS.escape(state.chatAnchor)}"]`);
    target?.scrollIntoView({ block: "center" });
  } else if (state.followLatest) el.scrollTop = el.scrollHeight;
  else el.scrollTop = oldTop + (el.scrollHeight - oldHeight);
  observeReads();
}
async function loadTimeline(initial = false, cursor = null, contextId = null) {
  if (!state.roomId) return;
  let data;
  if (contextId) data = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/messages/${encodeURIComponent(contextId)}/context`, null, { before: 5, after: 8 });
  else data = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/timeline`, null, { cursor, limit: 50, query: state.search, authorMemberId: state.author });
  const signature = JSON.stringify(data.items);
  if (!cursor && !contextId && signature === state.timelineSignature && !initial) return;
  state.timelineSignature = signature;
  if (cursor) state.timeline = [...data.items, ...state.timeline];
  else state.timeline = data.items;
  state.timelineCursor = data.previousCursor || null;
  renderTimeline();
}
function renderComposer() {
  const room = state.room;
  const ready = (room?.status === "ready" || room?.status === "paused") && room.members.every(member => member.creationStatus === "ready");
  if (state.composerRoomId !== state.roomId) {
    state.composerRoomId = state.roomId;
    if (!state.composerDraftRestored) state.composerDraft = room?.preset === "debate" && !room.startedAt ? room.title : "";
    state.composerDraftRestored = false;
  }
  const composer = $("#composer");
  composer.innerHTML = `
    <div class="composer-chips" id="composer-chips"></div>
    <textarea id="composer-text" placeholder="${ready ? "说点什么；输入 @ 选择成员才会真正点名" : "会话全部就绪后才能发送"}" maxlength="60000" ${ready ? "" : "disabled"}>${escape(state.composerDraft)}</textarea>
    <div class="composer-bottom"><button id="mention-button" class="button ghost" ${ready ? "" : "disabled"}>@ 点名</button><span id="width-hint" class="composer-hint"></span><span class="spacer"></span><button id="send-button" class="button primary" ${ready ? "" : "disabled"}>${room?.startedAt ? "发送" : "开始讨论"}</button></div>
  `;
  renderComposerChips();
  $("#composer-text").addEventListener("input", onComposerInput);
  $("#composer-text").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendMessage(); });
  $("#mention-button").addEventListener("click", () => showMentionMenu(""));
  $("#send-button").addEventListener("click", sendMessage);
}
function renderComposerChips() {
  const chips = $("#composer-chips");
  if (!chips) return;
  chips.innerHTML = `${state.replyTo ? `<span class="mention">引用 #${state.replyTo.roomSeq}<button data-action="remove-reply" style="border:0;background:transparent;color:inherit">×</button></span>` : ""}${[...state.mentions].map(id => `<span class="mention">@${escape(state.room.members.find(member => member.memberId === id)?.displayName || id)}<button data-action="remove-mention" data-member="${escape(id)}" style="border:0;background:transparent;color:inherit">×</button></span>`).join("")}${state.mentionAll ? `<span class="mention">@所有人<button data-action="remove-all" style="border:0;background:transparent;color:inherit">×</button></span>` : ""}`;
}
function onComposerInput() {
  const text = $("#composer-text").value;
  state.composerDraft = text;
  persistViewSoon();
  $("#width-hint").textContent = `${text.length} 字符`;
  const match = text.match(/@([^@\s]*)$/);
  if (match) showMentionMenu(match[1]);
  else hideMentionMenu();
}
function showMentionMenu(query) {
  hideMentionMenu();
  if (!state.room) return;
  const items = [
    ...state.room.members.map(member => ({ id: member.memberId, label: member.displayName, kind: "agent" })),
    { id: "@all", label: "所有人", kind: "all" },
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase()));
  if (!items.length) return;
  const menu = document.createElement("div");
  menu.id = "mention-menu";
  menu.className = "mention-menu";
  menu.innerHTML = items.map(item => `<button data-action="pick-mention" data-member="${escape(item.id)}">@${escape(item.label)} <span class="composer-hint">${item.kind === "all" ? "紧急通知其他全员" : "Agent"}</span></button>`).join("");
  document.body.append(menu);
  const rect = $("#composer-text").getBoundingClientRect();
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 250)}px`;
  menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 220)}px`;
}
function hideMentionMenu() { $("#mention-menu")?.remove(); }
async function sendMessage() {
  const textarea = $("#composer-text");
  const text = textarea.value.trim();
  if (!text || !state.roomId) return;
  try {
    await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/messages`, { text, replyToMessageId: state.replyTo?.messageId, mentionMemberIds: [...state.mentions], mentionAll: state.mentionAll });
    textarea.value = ""; state.composerDraft = "";
    state.replyTo = null; state.mentions.clear(); state.mentionAll = false;
    renderComposerChips();
    state.chatAnchor = null; state.followLatest = true;
    await Promise.all([refreshRoom(), loadTimeline(true), loadQuestions()]);
  } catch (error) { showError(error); }
}

async function loadQuestions(append = false) {
  if (!state.roomId) return;
  const data = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/questions`, null, { status: state.questionStatus, limit: 50, cursor: append ? state.questionCursor : null });
  const signature = JSON.stringify(data.items);
  if (!append && signature === state.questionFirstSignature) return;
  if (append) {
    const known = new Set(state.questions.map(question => question.questionId));
    state.questions.push(...data.items.filter(question => !known.has(question.questionId)));
    state.questionSignature = JSON.stringify(state.questions);
  } else {
    state.questionFirstSignature = signature;
    state.questionSignature = signature;
    state.questions = data.items;
  }
  state.questionCursor = data.nextCursor || null;
  renderQuestions();
}
function renderQuestions() {
  const list = $("#question-list");
  const oldTop = list.scrollTop;
  $("#pending-count").textContent = String(state.room?.pendingQuestions || 0);
  list.innerHTML = (state.questions.length ? state.questions.map(question => {
    const selected = question.questionId === state.selectedQuestionId;
    const draft = state.answerDrafts[question.questionId] || { answer: question.options?.[0] || "", note: "" };
    return `<article class="question-item ${selected ? "selected" : ""}" data-action="select-question" data-question="${escape(question.questionId)}" data-message="${escape(question.messageId)}">
      <div class="q-meta">#${question.roomSeq} · ${escape(question.asker.displayName)} · ${escape(time(question.createdAt))}</div>
      <div class="q-text">${escape(question.text)}</div>
      ${question.options?.length ? `<ol class="options">${question.options.map(option => `<li>${escape(option)}</li>`).join("")}</ol>` : ""}
      ${question.status === "answered" ? `<button class="button ghost" data-action="open-message" data-message="${escape(question.answerMessageId)}">打开答案</button>` : ""}
      ${question.status === "withdrawn" ? `<div class="q-meta">已撤回${question.withdrawNote ? `：${escape(question.withdrawNote)}` : ""}</div>` : ""}
      ${selected && question.status === "pending" ? `<form class="answer-form" data-question-form="${escape(question.questionId)}">
        ${question.options?.length ? `<select data-answer-field="answer">${question.options.map(option => `<option ${draft.answer === option ? "selected" : ""}>${escape(option)}</option>`).join("")}</select>` : `<textarea data-answer-field="answer" placeholder="正式回答" maxlength="60000">${escape(draft.answer)}</textarea>`}
        <textarea data-answer-field="note" placeholder="补充说明（可选）" maxlength="60000">${escape(draft.note)}</textarea>
        <div><button class="button primary" type="submit">回答并广播</button><button class="button ghost danger" type="button" data-action="withdraw-question" data-question="${escape(question.questionId)}">撤回问题</button></div>
      </form>` : ""}
    </article>`;
  }).join("") : `<div class="empty">当前筛选下没有问题。</div>`) + (state.questionCursor ? `<button class="button secondary" data-action="more-questions" style="width:100%;margin-top:8px">加载后面的问题</button>` : "");
  list.scrollTop = oldTop;
}
async function selectQuestion(questionId, messageId) {
  state.selectedQuestionId = questionId;
  state.chatAnchor = messageId;
  state.mobilePane = "chat";
  $("#room-view").dataset.mobilePane = "chat";
  document.querySelectorAll(".mobile-tabs button").forEach(button => button.classList.toggle("active", button.dataset.pane === "chat"));
  renderQuestions();
  await loadTimeline(false, null, messageId);
  persistView();
}
async function submitAnswer(form) {
  const questionId = form.dataset.questionForm;
  const answer = form.querySelector('[data-answer-field="answer"]')?.value || "";
  const note = form.querySelector('[data-answer-field="note"]')?.value || "";
  if (!answer.trim()) return showError(new Error("请先填写正式答案。"));
  try {
    await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/questions/${encodeURIComponent(questionId)}/answer`, { answer, note });
    delete state.answerDrafts[questionId];
    state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null;
    await Promise.all([refreshRoom(), loadQuestions(), state.chatAnchor ? loadTimeline(false, null, state.chatAnchor) : loadTimeline(true)]);
    toast("答案已写入房间并广播。", "success");
  } catch (error) {
    showError(error);
    if (error.code === "ROOM_QUESTION_CONFLICT") { state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null; await Promise.all([refreshRoom(), loadQuestions()]); }
  }
}
async function openMessage(messageId) {
  state.chatAnchor = messageId;
  await loadTimeline(false, null, messageId);
  persistView();
}
function showModal(title, content) {
  $("#modal-content").innerHTML = `<h2>${escape(title)}</h2>${content}<div class="modal-actions"><button class="button secondary" data-action="close-modal">关闭</button></div>`;
  $("#modal").showModal();
}
async function openFile(path) {
  try {
    const file = await request("POST", "/workspace/read", { roomId: state.roomId, path });
    showModal(file.path, `<pre>${escape(file.content)}</pre>`);
  } catch (error) { showError(error); }
}
async function showReceipts(messageId) {
  const receipts = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/messages/${encodeURIComponent(messageId)}/receipts`);
  showModal("已读详情", `<p>人类：${receipts.human ? `${escape(receipts.human.displayName)} · ${escape(time(receipts.human.readAt))}` : "未读"}</p><p>Agent：</p><ul>${receipts.agents.length ? receipts.agents.map(item => `<li>${escape(item.displayName)} · ${escape(time(item.readAt))} · ${escape(item.source)}</li>`).join("") : "<li>暂无</li>"}</ul>`);
}

let readObserver;
let readBatchTimer;
let visibleMessages = new Set();
let sentReads = new Set();
function observeReads() {
  readObserver?.disconnect();
  clearTimeout(readBatchTimer);
  visibleMessages.clear();
  readObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const id = entry.target.dataset.fullMessageId;
      if (!id) continue;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visibleMessages.add(id);
      else visibleMessages.delete(id);
    }
    if (!visibleMessages.size && readBatchTimer) { clearTimeout(readBatchTimer); readBatchTimer = null; }
    if (visibleMessages.size && !readBatchTimer) readBatchTimer = setTimeout(async () => {
      readBatchTimer = null;
      const ids = [...visibleMessages].filter(id => !sentReads.has(id));
      if (!ids.length || !state.roomId) return;
      for (const id of ids) sentReads.add(id);
      try { await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/read`, { messageIds: ids }); }
      catch { for (const id of ids) sentReads.delete(id); }
    }, 500);
  }, { threshold: [0.5] });
  document.querySelectorAll("#timeline [data-full-message-id]").forEach(el => readObserver.observe(el));
}

app.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "select-question" && event.target.closest("form,button,select,textarea,input")) return;
  if (action === "cancel-create") { if (state.rooms[0]) { hideCreate(); await selectRoom(state.rooms[0].roomId); } else showCreate(); return; }
  if (action === "add-agent" && state.createAgents.length < 8) {
    const index = state.createAgents.length;
    state.createAgents.push({ role: "generic", displayName: "", modelKey: modelKey(state.models[0]), autoName: true });
    state.createAgents[index].displayName = defaultName("generic", index, state.createAgents);
    renderCreate(); return;
  }
  if (action === "remove-agent") { state.createAgents.splice(Number(button.closest("[data-agent]").dataset.agent), 1); renderCreate(); return; }
  if (action === "create-room") {
    try {
      clearError();
      const members = state.createAgents.map(row => {
        const model = state.models.find(item => modelKey(item) === row.modelKey);
        if (!model) throw new Error("请为每个成员选择有效模型。");
        return { role: row.role, displayName: row.displayName.trim(), model };
      });
      const room = await request("POST", "/rooms", { projectDir: state.directory, title: $("#create-title").value, preset: $("#create-preset").value, humanName: $("#create-human").value, members });
      state.creating = false;
      await loadRooms(room.roomId);
      toast("房间已创建，正在准备独立会话。", "success");
    } catch (error) { showError(error); }
    return;
  }
  if (action === "pause" || action === "resume" || action === "retry" || action === "end") {
    try {
      if (action === "end" && !confirm("结束房间？会停止后续自动唤醒并移除本扩展添加的会话指令，但保留讨论记录和会话。")) return;
      await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/${action}`, action === "resume" ? { budgetLimit: state.room?.budget.limit || 50 } : undefined);
      await refreshRoom();
      if (action === "resume") await loadTimeline(true);
      if (action === "end") renderComposer();
    } catch (error) { showError(error); }
    return;
  }
  if (action === "open-session") { persistView(); await host.openSession(button.dataset.session); return; }
  if (action === "reply") {
    const message = state.timeline.find(item => item.messageId === button.dataset.message);
    state.replyTo = message; renderComposerChips(); $("#composer-text")?.focus(); return;
  }
  if (action === "remove-reply") { state.replyTo = null; renderComposerChips(); return; }
  if (action === "remove-mention") { state.mentions.delete(button.dataset.member); renderComposerChips(); return; }
  if (action === "remove-all") { state.mentionAll = false; renderComposerChips(); return; }
  if (action === "pick-mention") {
    const textarea = $("#composer-text");
    textarea.value = textarea.value.replace(/@([^@\s]*)$/, "");
    state.composerDraft = textarea.value;
    if (button.dataset.member === "@all") state.mentionAll = true;
    else state.mentions.add(button.dataset.member);
    hideMentionMenu(); renderComposerChips(); textarea.focus(); return;
  }
  if (action === "open-message") { event.stopPropagation(); await openMessage(button.dataset.message); return; }
  if (action === "select-question") { await selectQuestion(button.dataset.question, button.dataset.message); return; }
  if (action === "receipts") { await showReceipts(button.dataset.message); return; }
  if (action === "copy-locator") { await host.writeClipboard(`讨论室 ${state.room.title} · #${button.dataset.seq} · ${button.dataset.message}`); toast("已复制稳定定位信息。", "success"); return; }
  if (action === "open-file") { await openFile(button.dataset.path); return; }
  if (action === "more-questions") { await loadQuestions(true); return; }
  if (action === "withdraw-question") {
    const note = prompt("撤回说明（可留空）", "");
    if (note == null) return;
    try {
      await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/questions/${encodeURIComponent(button.dataset.question)}/withdraw`, { note });
      state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null; await loadQuestions();
    } catch (error) {
      showError(error);
      if (error.code === "ROOM_QUESTION_CONFLICT") { state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null; await Promise.all([refreshRoom(), loadQuestions()]); }
    }
    return;
  }
  if (action === "close-modal") { $("#modal").close(); }
});
app.addEventListener("change", async event => {
  const target = event.target;
  if (target.id === "create-preset") { state.createPreset = target.value; state.createTitle = target.value === "debate" ? "命令行请求超时：应默认重试吗？" : "新的讨论室"; renderCreate(); return; }
  const field = target.dataset.field;
  const row = target.closest("[data-agent]");
  if (row && field) {
    const index = Number(row.dataset.agent);
    const item = state.createAgents[index];
    if (field === "role") {
      const oldDefault = defaultName(item.role, index, state.createAgents);
      item.role = target.value;
      if (item.autoName || !item.displayName || item.displayName === oldDefault) { item.displayName = defaultName(item.role, index, state.createAgents); item.autoName = true; }
    } else if (field === "model") item.modelKey = target.value;
    else { item.displayName = target.value; item.autoName = false; }
    if (field !== "displayName") renderCreate();
    return;
  }
  if (target.id === "question-status") { state.questionStatus = target.value; state.selectedQuestionId = null; state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null; await loadQuestions(); }
});
app.addEventListener("input", event => {
  if (event.target.id === "create-title") state.createTitle = event.target.value;
  if (event.target.id === "create-human") state.createHumanName = event.target.value;
  const field = event.target.dataset.answerField;
  if (field) {
    const form = event.target.closest("[data-question-form]");
    const draft = state.answerDrafts[form.dataset.questionForm] ||= { answer: "", note: "" };
    draft[field] = event.target.value;
  }
});
app.addEventListener("submit", event => { if (event.target.matches("[data-question-form]")) { event.preventDefault(); submitAnswer(event.target); } });
$("#new-room").addEventListener("click", () => state.creating ? (hideCreate(), state.rooms[0] && selectRoom(state.rooms[0].roomId)) : (resetCreateAgents(), showCreate()));
$("#room-select").addEventListener("change", event => event.target.value && selectRoom(event.target.value));
$("#question-status").addEventListener("change", () => {});
$("#history-search").addEventListener("change", async () => { state.search = $("#history-search").value.trim(); state.chatAnchor = null; state.followLatest = true; await loadTimeline(true); });
$("#author-filter").addEventListener("change", async () => { state.author = $("#author-filter").value; state.chatAnchor = null; state.followLatest = true; await loadTimeline(true); });
$("#older-button").addEventListener("click", async () => { if (state.timelineCursor) { state.followLatest = false; await loadTimeline(false, state.timelineCursor); } });
$("#latest-button").addEventListener("click", async () => { state.chatAnchor = null; state.search = ""; state.author = ""; $("#history-search").value = ""; renderAuthorFilter(); state.followLatest = true; await loadTimeline(true); });
$("#timeline").addEventListener("scroll", () => { state.chatScroll = $("#timeline").scrollTop; if (!state.chatAnchor) state.followLatest = $("#timeline").scrollHeight - $("#timeline").scrollTop - $("#timeline").clientHeight < 100; persistViewSoon(); });
$("#question-list").addEventListener("scroll", () => { state.questionScroll = $("#question-list").scrollTop; persistViewSoon(); });
$("#modal").addEventListener("click", event => { if (event.target === $("#modal")) $("#modal").close(); });
document.querySelectorAll(".mobile-tabs button").forEach(button => button.addEventListener("click", () => { state.mobilePane = button.dataset.pane; $("#room-view").dataset.mobilePane = state.mobilePane; document.querySelectorAll(".mobile-tabs button").forEach(item => item.classList.toggle("active", item === button)); persistView(); }));
document.addEventListener("keydown", event => { if (event.key === "Escape") hideMentionMenu(); });

let refreshTimer = 0;
async function refreshOpenRoom() {
  if (!state.directory || document.hidden) return;
  clearTimeout(refreshTimer);
  if (!state.models.length) {
    try {
      const catalog = await request("GET", "/models", null, { directory: state.directory });
      if (catalog.models.length) {
        state.models = catalog.models;
        if (!state.createAgents.length) resetCreateAgents();
        if (state.creating) renderCreate();
      }
    } catch {}
  }
  if (!state.roomId || state.creating) return;
  refreshTimer = setTimeout(async () => {
    try {
      await refreshRoom();
      if (!state.chatAnchor && state.followLatest) await loadTimeline();
      await loadQuestions();
    } catch (error) { showError(error); }
  }, 80);
}
host.onServiceEvent(event => {
  if (event.topic === "room:changed") void refreshOpenRoom();
  if (event.topic === "models:changed") void refreshModels(true);
});
setInterval(() => void refreshOpenRoom(), 1800);

let readyGeneration = 0;
host.onReady(async ctx => {
  applyHostReady(ctx, document.documentElement);
  const generation = ++readyGeneration;
  if (ctx.directory !== state.directory) {
    state.directory = ctx.directory;
    state.roomId = null;
    state.rooms = [];
    if (ctx.directory) {
      try {
        const saved = await host.storage.get("discussion-view");
        if (saved?.roomId) { state.roomId = saved.roomId; state.pendingView = saved; }
        if (saved?.questionStatus) state.questionStatus = saved.questionStatus;
        if (saved?.mobilePane) state.mobilePane = saved.mobilePane;
        const [catalog, meta] = await Promise.all([
          request("GET", "/models", null, { directory: state.directory }),
          request("GET", "/meta"),
        ]);
        state.createHumanName = meta.humanName || state.createHumanName;
        state.models = catalog.models;
        if (!state.createAgents.length) resetCreateAgents();
        await loadRooms();
      } catch (error) { showError(error); }
    }
  }
  if (generation !== readyGeneration) return;
});
