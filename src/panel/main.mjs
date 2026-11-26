import { connectHost } from "@openchamber/sdk";
import { applyHostReady, mountBanner, mountButton, mountEmpty, mountList, mountSearchField, mountSelect, mountSpinner, mountText } from "@openchamber/sdk/ui";

const host = connectHost();
const $ = selector => document.querySelector(selector);
const app = $("#app");
const state = {
  directory: null, projectDir: null, projectId: null, projectManual: false,
  projects: [], projectsState: "loading", projectsError: null,
  modelSource: null, modelError: null, modelsLoading: false, modelsForProject: undefined, modelsRequestGeneration: 0, contextGeneration: 0,
  rooms: [], models: [], room: null, roomId: null, creating: false,
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
const rootStatusLabels = { pending: "准备中", ready: "已就绪", failed: "创建失败" };

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

let projectSelectHandle = null;
let projectsLoaded = false;
let projectsSubscribed = false;
const modelHandles = new Map();
let agentUid = 0;

function projectOptions() {
  const options = [];
  const directories = new Set();
  if (state.directory && !state.projects.some(project => project.directory === state.directory)) {
    options.push({ id: "current-workspace", label: "当前工作区", hint: state.directory, directory: state.directory });
    directories.add(state.directory);
  }
  for (const project of state.projects) {
    if (!project || typeof project.directory !== "string" || directories.has(project.directory)) continue;
    options.push({ id: project.id, label: project.name || project.directory, hint: project.directory, directory: project.directory });
    directories.add(project.directory);
  }
  return options;
}
function resolveProjectSelection() {
  const options = projectOptions();
  let option = state.projectId ? options.find(item => item.id === state.projectId) : null;
  if (!option && state.projectManual) state.projectManual = false;
  if (!option) {
    option = options.find(item => item.directory === state.projectDir)
      || (state.directory ? options.find(item => item.directory === state.directory) : null)
      || (state.directory ? options.find(item => item.id === "current-workspace") : null)
      || null;
  }
  state.projectId = option?.id || null;
  state.projectDir = option?.directory ?? state.directory ?? null;
}
function renderProjectHint() {
  const el = $("#project-hint");
  if (!el) return;
  let text = "";
  if (state.projectsState === "loading") text = "正在读取项目列表…";
  else if (state.projectsState === "error") text = "项目列表读取失败，仍可使用当前工作区。";
  el.textContent = text;
  el.hidden = !text;
}
function updateProjectPicker() {
  if (!projectSelectHandle) return;
  const options = projectOptions();
  const value = options.some(option => option.id === state.projectId) ? state.projectId : null;
  projectSelectHandle.update({
    options,
    value,
    disabled: state.projectsState === "loading",
    placeholder: options.length ? "选择项目" : state.projectsState === "loading" ? "读取项目…" : "没有可用项目",
  });
  renderProjectHint();
}
function applyProjectsSnapshot(snapshot) {
  if (snapshot?.state === "error") {
    state.projectsState = "error";
    state.projectsError = new Error("项目列表读取失败。");
    updateProjectPicker();
    return;
  }
  const previousDir = state.projectDir;
  state.projectsState = snapshot?.state || "ready";
  state.projectsError = null;
  const nextProjects = Array.isArray(snapshot?.projects) ? snapshot.projects.filter(project => project && typeof project.id === "string" && typeof project.directory === "string") : [];
  if (state.projectsState === "loading" && !nextProjects.length && state.projects.length) {
    updateProjectPicker();
    return;
  }
  state.projects = nextProjects;
  resolveProjectSelection();
  updateProjectPicker();
  if (state.projectDir !== previousDir) void reloadProjectContext();
}
async function loadProjects() {
  try {
    applyProjectsSnapshot(await host.listProjects());
  } catch (error) {
    state.projectsState = "error";
    state.projectsError = error;
    updateProjectPicker();
  }
}
function subscribeProjects() {
  if (projectsSubscribed) return;
  projectsSubscribed = true;
  host.onProjects(applyProjectsSnapshot).catch(error => {
    state.projectsState = "error";
    state.projectsError = error;
    updateProjectPicker();
  });
}
function mountProjectPicker() {
  if (projectSelectHandle) return;
  const root = $("#project-picker");
  if (!root) return;
  projectSelectHandle = mountSelect(root, {
    label: "房间所属项目",
    value: null,
    options: [],
    onChange: id => selectProject(id),
    placeholder: "读取项目…",
    searchable: true,
    searchPlaceholder: "搜索项目",
    disabled: true,
  });
  updateProjectPicker();
}
function selectProject(id) {
  const option = projectOptions().find(item => item.id === id);
  if (!option) return;
  state.projectManual = true;
  state.projectId = id;
  const changed = state.projectDir !== option.directory;
  state.projectDir = option.directory;
  projectSelectHandle?.update({ value: id });
  if (changed) void reloadProjectContext();
  else updateProjectPicker();
}

function modelKey(model) { return model ? JSON.stringify([model.providerID, model.id, model.variant || ""]) : ""; }
function memberModelInfo(member) {
  const model = member?.model;
  if (!model?.providerID || !model?.id) return null;
  const exact = state.models.find(item => item.providerID === model.providerID && item.id === model.id && (item.variant || "") === (model.variant || ""));
  const catalog = exact || state.models.find(item => item.providerID === model.providerID && item.id === model.id);
  return {
    provider: catalog?.providerName || model.providerName || model.providerID,
    name: catalog?.name || model.name || model.id,
    variant: model.variant || "",
  };
}
function memberModelPill(member) {
  const info = memberModelInfo(member);
  if (!info) return "";
  const label = `${info.provider} · ${info.name}${info.variant ? ` (${info.variant})` : ""}`;
  return `<span class="pill model" title="${escape(label)}">${escape(label)}</span>`;
}
function modelSelectOptions() {
  return state.models.map(model => ({
    id: modelKey(model),
    label: `${model.providerName || model.providerID || "未知提供商"} · ${model.name || model.id}${model.variant ? ` (${model.variant})` : ""}`,
    hint: model.providerID || "",
  }));
}
function normalizeModelSource(source, models) {
  if (source === "project" || source === "global" || source === "empty") return source;
  return models.length ? (state.projectDir ? "project" : "global") : "empty";
}
function renderModelSourceHint() {
  const el = $("#model-source-hint");
  if (!el) return;
  let text = "";
  let retry = false;
  if (state.modelsLoading) text = "正在读取模型目录…";
  else if (state.modelError) { text = `模型目录读取失败：${state.modelError.message || state.modelError}`; retry = true; }
  else if (state.modelSource === "global") text = "该项目模型目录尚未加载，当前显示来自其他项目的模型目录，可能不可用；创建失败时会显示具体错误。";
  else if (state.modelSource === "empty") { text = state.projectDir ? "该项目暂无可用模型目录。" : "尚未读取到可用模型目录。"; retry = true; }
  else if (!state.projectDir) text = "尚未选择项目，将使用全局模型目录。";
  el.classList.toggle("warning", retry);
  el.innerHTML = text ? `${escape(text)}${retry ? ` <button class="button ghost" data-action="retry-models">重试</button>` : ""}` : "";
  el.hidden = !text;
}
function disposeModelHandles() {
  for (const handle of modelHandles.values()) handle.dispose();
  modelHandles.clear();
}
function mountCreateModelPickers() {
  for (const root of document.querySelectorAll("#agent-rows [data-model-picker]")) {
    const row = state.createAgents[Number(root.dataset.modelPicker)];
    if (!row) continue;
    let handle;
    handle = mountSelect(root, {
      label: "模型",
      value: row.modelKey || null,
      options: modelSelectOptions(),
      onChange: id => {
        const current = state.createAgents.find(item => item.uid === row.uid);
        if (!current) return;
        current.modelKey = id;
        handle.update({ value: id });
        updateCreateActions();
      },
      placeholder: "请选择模型",
      searchable: true,
      searchPlaceholder: "搜索模型或提供商",
      disabled: !state.models.length,
    });
    modelHandles.set(row.uid, handle);
  }
}
function syncCreateModelPickers() {
  if (!$("#agent-rows") || $("#create-view").hidden) return;
  for (const [uid, handle] of modelHandles) {
    const row = state.createAgents.find(item => item.uid === uid);
    if (!row) continue;
    handle.update({ options: modelSelectOptions(), value: row.modelKey || null, disabled: !state.models.length });
  }
  updateCreateActions();
  renderModelSourceHint();
}
function updateCreateActions() {
  const button = $("#create-actions")?.querySelector('[data-action="create-room"]');
  if (!button) return;
  button.disabled = !state.models.length || !state.projectDir || state.modelsLoading || state.createAgents.some(row => !row.modelKey);
}
function validateCreateModels() {
  if (!state.createAgents.length) { resetCreateAgents(); return; }
  const available = new Set(state.models.map(modelKey));
  const missing = state.createAgents.some(row => row.modelKey && !available.has(row.modelKey));
  if (!missing) return;
  for (const row of state.createAgents) if (row.modelKey && !available.has(row.modelKey)) row.modelKey = "";
  showError(new Error("模型目录已变化，请重新选择受影响的成员模型。"));
}
async function refreshModels(force = false, generation = state.contextGeneration) {
  if (!force && !state.modelsLoading && state.modelsForProject === state.projectDir && (state.models.length || state.modelSource)) return;
  const requestGeneration = ++state.modelsRequestGeneration;
  state.modelsLoading = true;
  state.modelError = null;
  renderModelSourceHint();
  try {
    const catalog = await request("GET", "/models", null, state.projectDir ? { directory: state.projectDir } : null);
    if (generation !== state.contextGeneration || requestGeneration !== state.modelsRequestGeneration) return;
    state.models = Array.isArray(catalog?.models) ? catalog.models : [];
    state.modelsForProject = state.projectDir;
    state.modelSource = normalizeModelSource(catalog?.source, state.models);
    state.modelsLoading = false;
    validateCreateModels();
    if (!state.createAgents.length) resetCreateAgents();
    syncCreateModelPickers();
  } catch (error) {
    if (generation !== state.contextGeneration || requestGeneration !== state.modelsRequestGeneration) return;
    state.models = [];
    state.modelsForProject = state.projectDir;
    state.modelsLoading = false;
    state.modelSource = "empty";
    state.modelError = error;
    validateCreateModels();
    syncCreateModelPickers();
    showError(error);
  }
  renderModelSourceHint();
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
function renderCreate() {
  disposeModelHandles();
  const preset = state.createPreset || "generic";
  $("#create-view").innerHTML = `
    <h1>新建讨论室</h1>
    <p class="intro">每个房间创建一个根会话；成员会话不显示在侧栏，可从成员“会话”按钮打开。建房本身不会调用模型。</p>
    <div class="form-grid">
      <div class="field"><label>房间名称</label><input id="create-title" value="${escape(state.createTitle || "新的讨论室")}" maxlength="120"></div>
      <div class="field"><label>预设</label><select id="create-preset"><option value="generic" ${preset === "generic" ? "selected" : ""}>普通讨论</option><option value="debate" ${preset === "debate" ? "selected" : ""}>双模型辩论</option></select></div>
      <div class="field"><label>房主显示名</label><input id="create-human" value="${escape(state.createHumanName)}" maxlength="80"></div>
    </div>
    ${preset === "debate" ? `<div class="warning">双模型辩论预设共享 12 次自动唤醒。初始立场会写进会话指令，允许随证据修改。</div>` : ""}
    <div id="agent-rows">${state.createAgents.map((row, index) => `
      <div class="agent-editor" data-agent="${index}" data-agent-uid="${escape(row.uid)}">
        <div class="agent-title"><strong>成员 ${index + 1}</strong><button class="button ghost danger" data-action="remove-agent" ${state.createAgents.length <= 2 ? "disabled" : ""}>移除</button></div>
        <div class="agent-fields">
          <div class="field"><label>显示名</label><input data-field="displayName" value="${escape(row.displayName)}" maxlength="80"></div>
          <div class="field"><label>角色</label><select data-field="role">${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${row.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="field model-picker" data-model-picker="${index}"></div>
        </div>
      </div>`).join("")}</div>
    <button class="button secondary" data-action="add-agent">添加成员</button>
    <div class="warning">新会话使用所选项目工作区，默认完全执行权限，并在会话级禁用原生提问工具。多个 Agent 同时写同一工作区可能互相覆盖文件；讨论文档请写房间临时目录。不会修改全局权限，不创建 worktree。</div>
    <div id="model-source-hint" class="model-source-hint" hidden></div>
    <div id="create-actions" class="create-actions"><button class="button primary" data-action="create-room" disabled>创建房间</button><button class="button secondary" data-action="cancel-create">取消</button></div>
    ${!state.projectDir ? `<p class="intro">请先选择房间所属项目。</p>` : ""}
  `;
  mountCreateModelPickers();
  updateCreateActions();
  renderModelSourceHint();
}
function newAgentRow(model) {
  return { uid: `agent-${++agentUid}`, role: "generic", displayName: "", modelKey: modelKey(model), autoName: true };
}
function resetCreateAgents() {
  state.createPreset = "generic";
  state.createTitle = "新的讨论室";
  state.createAgents = [0, 1].map(index => {
    const row = newAgentRow(state.models[index] || state.models[0] || null);
    row.displayName = `Agent ${index + 1}`;
    return row;
  });
}

async function reloadProjectContext() {
  const generation = ++state.contextGeneration;
  state.pendingView = null;
  state.rooms = []; state.room = null; state.roomId = null;
  state.timeline = []; state.timelineCursor = null; state.timelineSignature = "";
  state.questions = []; state.questionSignature = ""; state.questionFirstSignature = ""; state.questionCursor = null;
  state.selectedQuestionId = null; state.chatAnchor = null; state.followLatest = true;
  state.models = []; state.modelsForProject = undefined; state.modelSource = null; state.modelError = null; state.modelsLoading = false;
  renderRoomSelect();
  $("#room-view").hidden = true;
  if (!state.creating) {
    $("#create-view").hidden = false;
    renderCreate();
  }
  if (!state.projectDir) { await refreshModels(true, generation); return; }
  await Promise.all([refreshModels(true, generation), loadRooms(null, generation)]);
}
async function loadRooms(preferred, generation = state.contextGeneration) {
  const data = await request("GET", "/rooms", null, { projectDir: state.projectDir });
  if (generation !== state.contextGeneration) return;
  state.rooms = data.rooms;
  const requested = preferred || state.roomId;
  let next = state.rooms.some(room => room.roomId === requested) ? requested : state.rooms[0]?.roomId || null;
  if (state.creating) next = null;
  renderRoomSelect();
  if (next && state.rooms.some(room => room.roomId === next)) await selectRoom(next, state.pendingView, generation);
  else if (!state.creating) {
    state.room = null; state.roomId = null;
    $("#create-view").hidden = false; $("#room-view").hidden = true;
    renderCreate();
  }
}
async function selectRoom(roomId, restore = null, generation = state.contextGeneration) {
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
  if (generation !== state.contextGeneration) return;
  if (state.chatAnchor) await loadTimeline(false, null, state.chatAnchor);
  else await loadTimeline(true);
  if (generation !== state.contextGeneration) return;
  if (view?.questionScroll) $("#question-list").scrollTop = view.questionScroll;
  if (view?.chatScroll) $("#timeline").scrollTop = view.chatScroll;
  renderComposer();
  renderAuthorFilter();
  persistView();
}

async function refreshRoom() {
  if (!state.roomId) return;
  const roomId = state.roomId;
  const room = await request("GET", `/rooms/${encodeURIComponent(roomId)}`);
  if (state.roomId !== roomId) return;
  state.room = room;
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
  const rootStatus = room.rootCreationStatus;
  const rootPill = rootStatus === "ready" ? "running" : rootStatus === "failed" ? "unknown" : "waiting-human";
  const rootChip = rootStatus || room.rootSessionId ? `<span class="member-chip root-session"><span>根会话</span>${rootStatus ? `<span class="pill ${rootPill}">${escape(rootStatusLabels[rootStatus] || rootStatus)}</span>` : ""}${room.rootSessionId ? `<button data-action="open-root-session" data-session="${escape(room.rootSessionId)}">会话组</button>` : ""}</span>` : "";
  $("#room-header").innerHTML = `
    <div><div class="room-title">${escape(room.title)}</div><div class="member-list">${rootChip}<span class="member-chip"><span>${escape(room.human.displayName)}</span><span class="pill">人类 · 房主</span></span>${room.members.map(member => `<span class="member-chip"><span>${escape(member.displayName)}</span>${memberModelPill(member)}${member.creationStatus === "failed" || member.creationError ? `<span class="pill error">创建失败：${escape(member.creationError || "未知原因")}</span>` : member.taskError ? `<span class="pill waiting-human">会话同步失败：${escape(member.taskError)}</span><span class="pill ${escape(member.sessionStatus)}">${escape(statusLabels[member.sessionStatus] || member.sessionStatus)}</span>` : `<span class="pill ${escape(member.sessionStatus)}">${escape(statusLabels[member.sessionStatus] || member.sessionStatus)}</span>`}${member.sessionId ? `<button data-action="open-session" data-session="${escape(member.sessionId)}">会话</button>` : ""}</span>`).join("")}</div></div>
    <div class="room-controls">
      <button class="button ghost" data-action="open-workspace">文件</button>
      <span class="pill budget">余额 ${room.budget.remaining}/${room.budget.limit} · 第 ${room.budget.period} 段</span>
      ${room.status === "creating" ? `<button class="button secondary" data-action="retry">重试缺失会话</button>` : room.status !== "ended" ? `${paused ? `<button class="button primary" data-action="resume">继续房间</button>` : `<button class="button secondary" data-action="pause">暂停唤醒</button>`}<button class="button ghost danger" data-action="end">结束房间</button>` : ""}
    </div>
    ${rootStatus === "failed" ? `<div class="root-error">根会话创建失败：${escape(room.rootCreationError || "未知原因")}</div>` : ""}
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
  const roomId = state.roomId;
  let data;
  if (contextId) data = await request("GET", `/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(contextId)}/context`, null, { before: 5, after: 8 });
  else data = await request("GET", `/rooms/${encodeURIComponent(roomId)}/timeline`, null, { cursor, limit: 50, query: state.search, authorMemberId: state.author });
  if (state.roomId !== roomId) return;
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
  const roomId = state.roomId;
  const data = await request("GET", `/rooms/${encodeURIComponent(roomId)}/questions`, null, { status: state.questionStatus, limit: 50, cursor: append ? state.questionCursor : null });
  if (state.roomId !== roomId) return;
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
const modalSdkHandles = new Map();
let fileBrowser = null;
function disposeModalSdk() {
  for (const handle of modalSdkHandles.values()) handle.dispose();
  modalSdkHandles.clear();
}
function clearModalRoot(root) {
  modalSdkHandles.get(root)?.dispose();
  modalSdkHandles.delete(root);
  root.replaceChildren();
}
function mountModalRoot(root, mount) {
  if (!root || typeof root.append !== "function") throw new Error(`Invalid SDK mount root: ${root?.constructor?.name || String(root)}`);
  clearModalRoot(root);
  const handle = mount(root);
  modalSdkHandles.set(root, handle);
  return handle;
}
function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function parentDirectory(path) {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at > 0 ? path.slice(0, at) : path;
}
function fileName(path) {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(at + 1);
}
function textPreviewable(path) {
  return /\.(md|markdown|txt|log|csv)$/i.test(path);
}
function showModal(title, content) {
  disposeModalSdk();
  fileBrowser = null;
  $("#modal-content").innerHTML = `<h2>${escape(title)}</h2>${content}<div class="modal-actions"><button class="button secondary" data-action="close-modal">关闭</button></div>`;
  $("#modal").classList.remove("file-browser-dialog");
  $("#modal").showModal();
}
function renderWorkspaceBreadcrumb() {
  if (!fileBrowser?.data) return;
  const root = fileBrowser.data.rootPath || fileBrowser.rootPath;
  const relativePath = fileBrowser.data.relativePath || "";
  const parts = relativePath ? relativePath.split(/[\\/]+/) : [];
  let path = root;
  const items = [{ label: "房间文件", path: root }];
  for (const part of parts) {
    path = `${path.replace(/\/$/, "")}/${part}`;
    items.push({ label: part, path });
  }
  $("#file-breadcrumb").innerHTML = items.map((item, index) => `${index ? '<span class="breadcrumb-sep">/</span>' : ""}<button class="button ghost" data-action="file-dir" data-path="${escape(item.path)}">${escape(item.label)}</button>`).join("");
}
function updateWorkspaceToolbar() {
  const up = modalSdkHandles.get($("#file-up"));
  up?.update({ disabled: !fileBrowser?.data?.parentPath });
}
function renderWorkspaceToolbar() {
  mountModalRoot($("#file-search"), target => mountSearchField(target, {
    value: fileBrowser.query,
    placeholder: "搜索当前目录文件",
    label: "搜索房间文件",
    onChange: value => { fileBrowser.query = value; renderWorkspaceList(); },
  }));
  mountModalRoot($("#file-refresh"), target => mountButton(target, {
    label: "刷新", variant: "outline", size: "sm",
    onClick: () => void loadWorkspaceDirectory(fileBrowser.path || fileBrowser.rootPath),
  }));
  mountModalRoot($("#file-up"), target => mountButton(target, {
    label: "上一级", variant: "outline", size: "sm", disabled: true,
    onClick: () => fileBrowser.data?.parentPath && void loadWorkspaceDirectory(fileBrowser.data.parentPath),
  }));
  updateWorkspaceToolbar();
}
function renderWorkspaceList() {
  if (!fileBrowser?.data) return;
  const root = $("#file-list");
  const query = fileBrowser.query.trim().toLowerCase();
  const entries = fileBrowser.data.entries.filter(entry => !query || entry.name.toLowerCase().includes(query) || entry.relativePath.toLowerCase().includes(query));
  if (!entries.length) {
    mountModalRoot(root, target => mountEmpty(target, { title: query ? "没有匹配的文件" : "这个目录是空的", body: query ? "换个关键词试试。" : "Agent 写入的讨论文档会显示在这里。" }));
    return;
  }
  const byId = new Map(entries.map(entry => [encodeURIComponent(entry.relativePath), entry]));
  const selectedEntry = fileBrowser.selectedPath ? fileBrowser.data.entries.find(entry => entry.path === fileBrowser.selectedPath) : null;
  mountModalRoot(root, target => mountList(target, {
    items: [...byId].map(([id, entry]) => ({
      id,
      title: entry.name,
      subtitle: entry.relativePath,
      leading: entry.kind === "directory" ? "▸" : "·",
      meta: entry.kind === "file" ? formatBytes(entry.size) : "目录",
    })),
    selectedId: selectedEntry ? encodeURIComponent(selectedEntry.relativePath) : null,
    emptyText: "没有文件",
    ariaLabel: "房间文件列表",
    onSelect: id => {
      const entry = byId.get(id);
      if (!entry) return;
      if (entry.kind === "directory") void loadWorkspaceDirectory(entry.path);
      else queueMicrotask(() => void previewWorkspacePath(entry.path));
    },
  }));
}
async function loadWorkspaceDirectory(path, previewPath = null) {
  if (!fileBrowser || !state.roomId) return;
  const roomId = state.roomId;
  const generation = ++fileBrowser.generation;
  fileBrowser.path = path;
  mountModalRoot($("#file-list"), target => mountSpinner(target, { label: "正在读取目录…" }));
  try {
    const data = await request("POST", "/workspace/list", { roomId, path });
    if (!fileBrowser || fileBrowser.roomId !== roomId || fileBrowser.generation !== generation) return;
    fileBrowser.data = data;
    fileBrowser.rootPath = data.rootPath || fileBrowser.rootPath;
    fileBrowser.path = data.path;
    renderWorkspaceBreadcrumb();
    updateWorkspaceToolbar();
    renderWorkspaceList();
    if (previewPath) void previewWorkspacePath(previewPath);
  } catch (error) {
    if (!fileBrowser || fileBrowser.roomId !== roomId || fileBrowser.generation !== generation) return;
    mountModalRoot($("#file-list"), target => mountBanner(target, {
      tone: "error", title: "无法读取目录", body: error.message,
      action: { label: "重试", onClick: () => void loadWorkspaceDirectory(path, previewPath) },
    }));
  }
}
async function previewWorkspacePath(path) {
  if (!fileBrowser || !state.roomId) return;
  const roomId = state.roomId;
  const generation = fileBrowser.generation;
  fileBrowser.selectedPath = path;
  renderWorkspaceList();
  $("#file-preview-title").textContent = fileName(path);
  $("#file-preview-title").title = path;
  const root = $("#file-preview-content");
  mountModalRoot(root, target => mountSpinner(target, { label: "正在读取文件…" }));
  try {
    const file = await request("POST", "/workspace/read", { roomId, path });
    if (!fileBrowser || fileBrowser.roomId !== roomId || fileBrowser.generation !== generation) return;
    if (file.path !== fileBrowser.selectedPath) {
      fileBrowser.selectedPath = file.path;
      renderWorkspaceList();
    }
    if (!file.content) {
      mountModalRoot(root, target => mountEmpty(target, { title: "文件为空", body: file.path }));
    } else if (textPreviewable(file.path)) {
      mountModalRoot(root, target => mountText(target, { text: file.content, onOpenUrl: url => void host.openUrl(url) }));
    } else {
      clearModalRoot(root);
      const pre = document.createElement("pre");
      pre.textContent = file.content;
      root.append(pre);
    }
  } catch (error) {
    if (!fileBrowser || fileBrowser.roomId !== roomId || fileBrowser.generation !== generation) return;
    mountModalRoot(root, target => mountBanner(target, {
      tone: "error", title: "无法预览文件", body: error.message,
      action: { label: "重试", onClick: () => void previewWorkspacePath(path) },
    }));
  }
}
async function openWorkspaceBrowser(previewPath = null) {
  if (!state.roomId || !state.room?.workspaceDir) return showError(new Error("当前房间没有可浏览的临时目录。"));
  disposeModalSdk();
  const roomId = state.roomId;
  fileBrowser = {
    roomId, rootPath: state.room.workspaceDir, path: state.room.workspaceDir,
    data: null, entries: [], query: "", selectedPath: previewPath, generation: 0,
  };
  $("#modal-content").innerHTML = `
    <h2>房间文件</h2>
    <div class="file-browser">
      <div class="file-browser-toolbar">
        <div id="file-breadcrumb" class="file-breadcrumb"></div>
        <div id="file-search" class="file-search"></div>
        <div class="file-toolbar-actions"><div id="file-up"></div><div id="file-refresh"></div></div>
      </div>
      <div class="file-browser-body">
        <div id="file-list" class="file-list"></div>
        <section class="file-preview"><div id="file-preview-title" class="file-preview-title">选择一个文件</div><div id="file-preview-content" class="file-preview-content"></div></section>
      </div>
    </div>
    <div class="modal-actions"><button class="button secondary" data-action="close-modal">关闭</button></div>`;
  $("#modal").classList.add("file-browser-dialog");
  $("#modal").showModal();
  renderWorkspaceToolbar();
  await loadWorkspaceDirectory(previewPath ? parentDirectory(previewPath) : fileBrowser.rootPath, previewPath);
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
  if (action === "retry-models") { void refreshModels(true); return; }
  if (action === "add-agent" && state.createAgents.length < 8) {
    const index = state.createAgents.length;
    const row = newAgentRow(state.models[0] || null);
    state.createAgents.push(row);
    row.displayName = defaultName("generic", index, state.createAgents);
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
      const room = await request("POST", "/rooms", { projectDir: state.projectDir, title: $("#create-title").value, preset: $("#create-preset").value, humanName: $("#create-human").value, members });
      state.creating = false;
      await loadRooms(room.roomId);
      toast("房间已创建，正在准备根会话和成员会话。", "success");
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
  if (action === "open-session" || action === "open-root-session") { persistView(); await host.openSession(button.dataset.session); return; }
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
  if (action === "open-workspace") { await openWorkspaceBrowser(); return; }
  if (action === "open-file") { await openWorkspaceBrowser(button.dataset.path); return; }
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
$("#modal").addEventListener("click", async event => {
  if (event.target === $("#modal")) { $("#modal").close(); return; }
  const button = event.target.closest("[data-action]");
  if (button?.dataset.action === "close-modal") { $("#modal").close(); return; }
  if (button?.dataset.action === "file-dir") { await loadWorkspaceDirectory(button.dataset.path); }
});
$("#modal").addEventListener("close", () => { disposeModalSdk(); fileBrowser = null; });
document.querySelectorAll(".mobile-tabs button").forEach(button => button.addEventListener("click", () => { state.mobilePane = button.dataset.pane; $("#room-view").dataset.mobilePane = state.mobilePane; document.querySelectorAll(".mobile-tabs button").forEach(item => item.classList.toggle("active", item === button)); persistView(); }));
document.addEventListener("keydown", event => { if (event.key === "Escape") hideMentionMenu(); });

let refreshTimer = 0;
async function refreshOpenRoom() {
  if (document.hidden || (!state.projectDir && !state.roomId)) return;
  clearTimeout(refreshTimer);
  if (!state.models.length && !state.modelsLoading && state.modelsForProject !== state.projectDir) await refreshModels(false);
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

mountProjectPicker();

let readyGeneration = 0;
host.onReady(async ctx => {
  applyHostReady(ctx, document.documentElement);
  const generation = ++readyGeneration;
  const directoryChanged = ctx.directory !== state.directory;
  const previousProjectDir = state.projectDir;
  state.directory = ctx.directory;
  mountProjectPicker();
  if (!projectsLoaded) {
    projectsLoaded = true;
    subscribeProjects();
    void loadProjects();
  }
  if (directoryChanged) {
    if (!state.projectManual) { state.projectDir = ctx.directory; state.projectId = null; }
    else if (state.projectId === "current-workspace") state.projectDir = ctx.directory;
    resolveProjectSelection();
    updateProjectPicker();
  }
  if (state.projectDir === previousProjectDir) return;
  const context = ++state.contextGeneration;
  state.roomId = null; state.rooms = []; state.pendingView = null;
  if (state.projectDir) {
    try {
      const saved = await host.storage.get("discussion-view");
      if (generation !== readyGeneration || context !== state.contextGeneration) return;
      if (saved?.roomId) { state.roomId = saved.roomId; state.pendingView = saved; }
      if (saved?.questionStatus) state.questionStatus = saved.questionStatus;
      if (saved?.mobilePane) state.mobilePane = saved.mobilePane;
      const meta = await request("GET", "/meta");
      if (generation !== readyGeneration || context !== state.contextGeneration) return;
      state.createHumanName = meta.humanName || state.createHumanName;
    } catch (error) { showError(error); }
    if (generation !== readyGeneration || context !== state.contextGeneration) return;
    await Promise.all([refreshModels(true, context), loadRooms(null, context)]);
  } else {
    await refreshModels(true, context);
    if (generation !== readyGeneration || context !== state.contextGeneration) return;
    if (!state.creating) {
      $("#create-view").hidden = false;
      $("#room-view").hidden = true;
      renderCreate();
    }
  }
});
