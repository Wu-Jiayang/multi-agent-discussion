(() => {
  // node_modules/@openchamber/sdk/dist/api-version.js
  var OPENCHAMBER_SDK_CHANNEL = "openchamber.sdk";
  var OPENCHAMBER_SDK_API_VERSION = 1;

  // node_modules/@openchamber/sdk/dist/scrollbar-style.js
  var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
  var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
  function installGuestScrollbarActivity(doc) {
    const root = doc.documentElement;
    if (root.hasAttribute("data-oc-scrollbar-activity"))
      return;
    root.setAttribute("data-oc-scrollbar-activity", "");
    const timers = /* @__PURE__ */ new WeakMap();
    doc.addEventListener("scroll", (event) => {
      const target = event.target === doc ? root : event.target;
      if (!(target instanceof Element))
        return;
      if (!target.hasAttribute("data-oc-scrolling"))
        target.setAttribute("data-oc-scrolling", "");
      const pending = timers.get(target);
      if (pending !== void 0)
        clearTimeout(pending);
      timers.set(target, setTimeout(() => {
        timers.delete(target);
        target.removeAttribute("data-oc-scrolling");
      }, 1e3));
    }, { capture: true, passive: true });
  }
  var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;

  // node_modules/@openchamber/sdk/dist/workspace.js
  var GUEST_STORAGE_KEY_MAX = 128;
  var GUEST_STORAGE_VALUE_BYTES = 65536;

  // node_modules/@openchamber/sdk/dist/shells.js
  var GUEST_SHELL_ID_MAX = 128;
  var GUEST_SHELL_OUTPUT_TAIL_MAX = 65536;

  // node_modules/@openchamber/sdk/dist/microphone.js
  var GUEST_MICROPHONE_SAMPLE_RATE_MIN = 8e3;
  var GUEST_MICROPHONE_SAMPLE_RATE_MAX = 192e3;
  var GUEST_MICROPHONE_OPEN_TIMEOUT_MS = 12e4;
  var createSampleQueue = (capacity) => {
    const chunks = [];
    let offset = 0;
    let queued = 0;
    return {
      push: (samples) => {
        chunks.push(samples);
        queued += samples.length;
        while (queued - offset > capacity && chunks.length > 1) {
          const dropped = chunks.shift();
          queued -= dropped?.length ?? 0;
          offset = 0;
        }
      },
      pull: (out) => {
        let written = 0;
        while (written < out.length && chunks.length > 0) {
          const head = chunks[0];
          const count = Math.min(out.length - written, head.length - offset);
          out.set(head.subarray(offset, offset + count), written);
          written += count;
          offset += count;
          if (offset >= head.length) {
            chunks.shift();
            queued -= head.length;
            offset = 0;
          }
        }
        out.fill(0, written);
      },
      clear: () => {
        chunks.length = 0;
        offset = 0;
        queued = 0;
      },
      get size() {
        return queued - offset;
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/status-controls.js
  var GUEST_STATUS_CONTROLS_MAX = 4;
  var GUEST_STATUS_CONTROL_ID = /^[a-z][a-z0-9-]{0,39}$/;
  var GUEST_STATUS_CONTROL_LABEL_MAX = 60;
  var GUEST_STATUS_CONTROL_OPTIONS_MAX = 16;
  var GUEST_STATUS_CONTROL_VALUE_MAX = 80;
  var isControlObject = (value) => Object(value) === value && !Array.isArray(value);
  var hasOnlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
  var isLabel = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_LABEL_MAX;
  var isValue = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_VALUE_MAX;
  var isGuestStatusControls = (controls) => {
    if (!Array.isArray(controls) || controls.length > GUEST_STATUS_CONTROLS_MAX)
      return false;
    const ids = /* @__PURE__ */ new Set();
    for (const control of controls) {
      if (!isControlObject(control) || !GUEST_STATUS_CONTROL_ID.test(control.id) || !isLabel(control.label))
        return false;
      if (control.disabled !== void 0 && control.disabled !== true && control.disabled !== false)
        return false;
      if (ids.has(control.id))
        return false;
      ids.add(control.id);
      if (control.kind === "button") {
        if (!hasOnlyKeys(control, ["kind", "id", "label", "disabled"]))
          return false;
        continue;
      }
      if (control.kind !== "select" || !hasOnlyKeys(control, ["kind", "id", "label", "value", "options", "disabled"]))
        return false;
      if (!isValue(control.value) || !Array.isArray(control.options) || control.options.length < 1 || control.options.length > GUEST_STATUS_CONTROL_OPTIONS_MAX)
        return false;
      const values = /* @__PURE__ */ new Set();
      for (const option of control.options) {
        if (!isControlObject(option) || !hasOnlyKeys(option, ["value", "label"]) || !isValue(option.value) || !isLabel(option.label) || values.has(option.value))
          return false;
        values.add(option.value);
      }
      if (!values.has(control.value))
        return false;
    }
    return true;
  };

  // node_modules/@openchamber/sdk/dist/manifest.js
  var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
  var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
  var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);

  // node_modules/@openchamber/sdk/dist/session-events.js
  var GUEST_SESSION_EVENT_TYPES = [
    "turn-finished",
    "turn-failed",
    "permission-asked",
    "question-asked",
    "turn-started",
    "session-created",
    "session-archived",
    "session-deleted"
  ];
  var SESSION_EVENTS_IDLE_MS = 10 * 6e4;
  var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);

  // node_modules/@openchamber/sdk/dist/service-host.js
  var SERVICE_SCHEDULE_IDLE_MS = 10 * 6e4;
  var MENTIONS_IDLE_MS = 10 * 6e4;

  // node_modules/@openchamber/sdk/dist/file-editor.js
  var GUEST_FILE_EDITOR_CONTENT_MAX = 2e7;
  var GUEST_FILE_EDITOR_VERSION_MAX = 256;
  var fileEditorPayloadSize = (value) => "bytes" in value ? value.bytes.byteLength : value.content.length;
  var sameFileEditorDocument = (left, right) => {
    if (left.path !== right.path || left.readOnly !== right.readOnly)
      return false;
    if (left.encoding === "text" || right.encoding === "text") {
      return left.encoding === "text" && right.encoding === "text" && left.content === right.content;
    }
    if (left.bytes.byteLength !== right.bytes.byteLength)
      return false;
    for (let index = 0; index < left.bytes.byteLength; index += 1) {
      if (left.bytes[index] !== right.bytes[index])
        return false;
    }
    return true;
  };

  // node_modules/@openchamber/sdk/dist/popover.js
  var GUEST_POPOVER_ID = /^[A-Za-z0-9_-]{1,80}$/;
  var GUEST_POPOVER_COORDINATE_MAX = 1e5;
  var GUEST_POPOVER_WIDTH_MIN = 160;
  var GUEST_POPOVER_WIDTH_MAX = 640;
  var GUEST_POPOVER_HEIGHT_MIN = 48;
  var GUEST_POPOVER_HEIGHT_MAX = 480;
  var GUEST_POPOVER_DATA_MAX = 16e3;
  var GUEST_POPOVER_DATA_DEPTH_MAX = 32;
  var GUEST_POPOVER_SIDES = ["left", "right", "top", "bottom"];
  var hasBoundedJsonTree = (value, depth = 0, budget = { remaining: GUEST_POPOVER_DATA_MAX }) => {
    if (--budget.remaining < 0 || depth >= GUEST_POPOVER_DATA_DEPTH_MAX)
      return false;
    if (value === null)
      return true;
    const children = Array.isArray(value) ? value : Object(value) === value ? Object.values(value) : [];
    for (const item of children) {
      if (!hasBoundedJsonTree(item, depth + 1, budget))
        return false;
    }
    return true;
  };
  var isFiniteJson = (value) => {
    if (value === null || value === true || value === false)
      return true;
    if (Array.isArray(value))
      return Object.keys(value).every((key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length) && value.every(isFiniteJson);
    if (Object(value) === value) {
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype) && Object.values(value).every(isFiniteJson);
    }
    return String(value) === value || Number.isFinite(value);
  };
  var isGuestPopoverRequest = (request2) => {
    try {
      if (String(request2.id) !== request2.id || !GUEST_POPOVER_ID.test(request2.id) || !Number.isFinite(request2.anchor.x) || Math.abs(request2.anchor.x) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request2.anchor.y) || Math.abs(request2.anchor.y) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request2.anchor.width) || !Number.isFinite(request2.anchor.height) || request2.anchor.width <= 0 || request2.anchor.height <= 0 || request2.anchor.width > GUEST_POPOVER_COORDINATE_MAX || request2.anchor.height > GUEST_POPOVER_COORDINATE_MAX || !Number.isInteger(request2.width) || request2.width < GUEST_POPOVER_WIDTH_MIN || request2.width > GUEST_POPOVER_WIDTH_MAX || !Number.isInteger(request2.height) || request2.height < GUEST_POPOVER_HEIGHT_MIN || request2.height > GUEST_POPOVER_HEIGHT_MAX || request2.side !== void 0 && !GUEST_POPOVER_SIDES.includes(request2.side) || request2.focus !== void 0 && request2.focus !== true && request2.focus !== false || !hasBoundedJsonTree(request2.data) || !isFiniteJson(request2.data))
        return false;
      return JSON.stringify(request2.data).length <= GUEST_POPOVER_DATA_MAX;
    } catch {
      return false;
    }
  };

  // node_modules/@openchamber/sdk/dist/navigation.js
  var GUEST_COMMIT_SHA = /^[0-9a-f]{7,64}$/i;
  var isGuestCommitSha = (value) => GUEST_COMMIT_SHA.test(value);
  var GUEST_WALKTHROUGH_BASE_MAX = 255;
  var guestNavigationCalls = (request2, nextId2, refuse) => ({
    openCommit: (sha) => isGuestCommitSha(sha) ? request2({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "open-commit", id: nextId2(), payload: { sha } }) : refuse("Commit id must be 7 to 64 hex characters."),
    openWalkthrough: ({ base }) => {
      const trimmed = base.trim();
      if (!trimmed || trimmed.length > GUEST_WALKTHROUGH_BASE_MAX)
        return refuse(`Base must contain 1 to ${GUEST_WALKTHROUGH_BASE_MAX} characters.`);
      return request2({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "open-walkthrough", id: nextId2(), payload: { base: trimmed } });
    }
  });

  // node_modules/@openchamber/sdk/dist/contract.js
  var GUEST_BLOCK_ANSWER_MAX = 2e3;
  var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
  var isStartSessionResult = (value) => Boolean(value && "sessionId" in value);
  var isPromptResult = (value) => Boolean(value && "sent" in value && !("sessionId" in value));
  var GUEST_TOAST_MAX = 500;
  var GUEST_CLIPBOARD_TEXT_MAX = 32e3;
  var GUEST_COMPOSE_TEXT_MAX = 16e3;
  var GUEST_ATTACH_ID_MAX = 128;
  var GUEST_ATTACH_TITLE_MAX = 200;
  var GUEST_ATTACH_URL_MAX = 2e3;
  var GUEST_ATTACH_TEXT_MAX = 16e3;
  var GUEST_ATTACH_AUTHOR_MAX = 80;
  var GUEST_ATTACH_BRANCH_MAX = 200;
  var GUEST_ATTACH_DATA_MAX = 16e3;
  var GUEST_REQUEST_PATH_MAX = 2e3;
  var GUEST_REQUEST_TIMEOUT_MS = 2e4;
  var GUEST_FILE_PATH_MAX = 1024;
  var GUEST_FILE_CONTENT_MAX = 2e6;
  var GUEST_GENERATE_PROMPT_MAX = 64e3;
  var GUEST_GENERATE_SYSTEM_MAX = 8e3;
  var GUEST_GENERATE_OUTPUT_TOKENS_MAX = 4e3;
  var GUEST_GENERATE_TIMEOUT_MS = 96e4;
  var GUEST_GENERATE_LATE_KEEP_MS = 60 * 6e4;
  var GUEST_BADGE_MAX = 999;
  var GUEST_FRAME_HEIGHT_MAX = 1e4;
  var GUEST_RESOLVE_ERROR_MAX = 500;
  var HOST_REQUEST_ERROR_CODES = [
    "HOST_UNAVAILABLE",
    "HOST_TIMEOUT",
    "HOST_REJECTED",
    "DISCONNECTED",
    "DISABLED",
    "BAD_PATH",
    "NO_INTEGRATION",
    "NO_SERVICE",
    "SERVICE_FAILED",
    "REQUEST_FAILED",
    "RESPONSE_TOO_LARGE",
    "NO_SESSION",
    "SESSION_BUSY",
    "NOT_GRANTED",
    "NO_DIRECTORY",
    "NOT_FOUND",
    "FILE_TOO_LARGE",
    "DENIED",
    "NO_MODEL",
    "MODEL_FAILED",
    "UNSUPPORTED"
  ];
  var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
  var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
  var isHostRequestErrorCode = (value) => hostRequestErrorCodeSet.has(value);
  var resolveHostRequestErrorCode = (value) => value && isHostRequestErrorCode(value) ? value : "HOST_REJECTED";
  var isJsonValue = (value) => {
    if (value === void 0)
      return false;
    if (value === null || value === true || value === false)
      return true;
    if (String(value) === value)
      return true;
    if (Number(value) === value)
      return Number.isFinite(value);
    if (Array.isArray(value))
      return value.every(isJsonValue);
    if (Object(value) === value)
      return Object.values(value).every(isJsonValue);
    return false;
  };
  var isAttachData = (value) => isJsonValue(value) && JSON.stringify(value).length <= GUEST_ATTACH_DATA_MAX;
  var clampBranch = (value) => value?.trim().slice(0, GUEST_ATTACH_BRANCH_MAX) ?? "";
  var clampAttachRequest = (request2) => {
    const id = request2.id.trim().slice(0, GUEST_ATTACH_ID_MAX);
    const title = request2.title.trim().slice(0, GUEST_ATTACH_TITLE_MAX);
    const url = request2.url.trim().slice(0, GUEST_ATTACH_URL_MAX);
    const text = request2.text?.trim().slice(0, GUEST_ATTACH_TEXT_MAX);
    const author = request2.author?.trim().slice(0, GUEST_ATTACH_AUTHOR_MAX);
    const kind = request2.kind === "pull" ? "pull" : "issue";
    const next = {
      providerId: request2.providerId.trim(),
      id,
      title: title || id,
      url,
      kind
    };
    if (text) {
      next.text = text;
    }
    if (author) {
      next.author = author;
    }
    if (kind === "pull") {
      const head = clampBranch(request2.branches?.head);
      const base = clampBranch(request2.branches?.base);
      if (head && base) {
        next.branches = { head, base };
      }
    }
    if (isAttachData(request2.data)) {
      next.data = request2.data;
    }
    return next;
  };
  var clampStartSessionRequest = (request2) => {
    const next = clampAttachRequest(request2);
    if (request2.projectId)
      next.projectId = request2.projectId;
    if (request2.navigation)
      next.navigation = request2.navigation;
    if (request2.worktree) {
      next.worktree = request2.worktree;
    }
    return next;
  };
  var clampPromptRequest = (request2) => {
    const next = {
      text: request2.text.trim().slice(0, GUEST_COMPOSE_TEXT_MAX)
    };
    if (request2.send) {
      next.send = true;
    }
    return next;
  };
  var clampBadgeCount = (count) => {
    if (count === null || !Number.isFinite(count))
      return null;
    return Math.min(GUEST_BADGE_MAX, Math.max(0, Math.round(count)));
  };
  var clampFrameHeight = (height) => {
    if (!Number.isFinite(height))
      return 0;
    return Math.min(GUEST_FRAME_HEIGHT_MAX, Math.max(0, Math.ceil(height)));
  };
  var isGuestFilePath = (value) => value.length > 0 && value.length <= GUEST_FILE_PATH_MAX && !value.includes("\0") && !value.includes("\\");
  var isGuestRequestPath = (value) => {
    if (!value.startsWith("/") || value.includes("\0") || value.includes("\\") || value.includes("://")) {
      return false;
    }
    if (value.length > GUEST_REQUEST_PATH_MAX) {
      return false;
    }
    const segments = value.split("/");
    return !segments.some((segment) => segment === "." || segment === "..");
  };
  var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
  var isServiceStatusResult = (value) => Boolean(value && "status" in value && serviceStatusSet.has(String(value.status)) && !("body" in value));
  var isGuestRequestResult = (value) => Boolean(value && "status" in value && "body" in value && Number.isInteger(value.status));
  var isFileReadResult = (value) => Boolean(value && "content" in value && String(value.content) === value.content);
  var isFileWriteResult = (value) => Boolean(value && "written" in value && value.written === true);
  var isFileListResult = (value) => Boolean(value && "entries" in value && Array.isArray(value.entries));
  var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
  var isFileStatResult = (value) => Boolean(value && "kind" in value && "size" in value && fileStatKindSet.has(String(value.kind)) && Number.isFinite(value.size));
  var isGenerateResult = (value) => Boolean(value && "text" in value && String(value.text) === value.text && !("status" in value));
  var HOST_PUSH_TYPES = /* @__PURE__ */ new Set([
    "workspace",
    "shells",
    "ready",
    "directory",
    "session",
    "connection",
    "settings",
    "session-lifecycle",
    "item",
    "resolve",
    "action",
    "service-event",
    "status-control-event",
    "popover-closed",
    "file-open",
    "file-snapshot",
    "file-saved",
    "generate-late",
    "microphone-audio",
    "microphone-ended"
  ]);
  var asWireRecord = (data) => Object(data) === data ? data : null;
  var isNonEmptyString = (value) => String(value) === value && value.length > 0;
  var readResultMessage = (wire) => {
    if (!isNonEmptyString(wire.id))
      return null;
    if (wire.ok === true) {
      const message = {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: true
      };
      if (Object(wire.payload) === wire.payload) {
        message.payload = wire.payload;
      }
      return message;
    }
    if (wire.ok === false && isNonEmptyString(wire.error)) {
      return {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: false,
        error: wire.error,
        code: resolveHostRequestErrorCode(isNonEmptyString(wire.code) ? wire.code : void 0)
      };
    }
    return null;
  };
  var readHostMessage = (data) => {
    const wire = asWireRecord(data);
    if (!wire || wire.channel !== OPENCHAMBER_SDK_CHANNEL || wire.v !== OPENCHAMBER_SDK_API_VERSION)
      return null;
    if (wire.type === "result")
      return readResultMessage(wire);
    if (!HOST_PUSH_TYPES.has(String(wire.type)) || Object(wire.payload) !== wire.payload)
      return null;
    return wire;
  };

  // node_modules/@openchamber/sdk/dist/host.js
  var isKeyEvent = (event) => "key" in event && "metaKey" in event && "ctrlKey" in event;
  var isSaveShortcut = (event) => (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s";
  var HostRequestError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "HostRequestError";
      this.code = code;
    }
  };
  var rejectBadPath = () => Promise.reject(new HostRequestError("BAD_PATH", 'Request path must start with "/" and stay on the declared origin.'));
  var rejectBadFilePath = () => Promise.reject(new HostRequestError("BAD_PATH", `File path must be 1 to ${GUEST_FILE_PATH_MAX} characters without NUL or backslash.`));
  var deviceStorageScope = (options) => {
    if (options === void 0)
      return void 0;
    if (Object(options) !== options || Array.isArray(options) || options.scope !== void 0 && options.scope !== "instance" && options.scope !== "device") {
      throw new HostRequestError("HOST_REJECTED", 'Storage scope must be "instance" or "device".');
    }
    return options.scope === "device" ? "device" : void 0;
  };
  var nextId = (n) => {
    n.value += 1;
    return `oc-${n.value}`;
  };
  var connectHost = (options = {}) => {
    const target = options.target ?? ("window" in globalThis ? window : null);
    if (!target) {
      throw new HostRequestError("HOST_UNAVAILABLE", "No window. connectHost runs in a browser frame.");
    }
    const acceptSource = options.acceptSource ?? ((source) => source === target.parent);
    const requestTimeoutMs = options.requestTimeoutMs ?? GUEST_REQUEST_TIMEOUT_MS;
    const readyListeners = /* @__PURE__ */ new Set();
    const directoryListeners = /* @__PURE__ */ new Set();
    const sessionListeners = /* @__PURE__ */ new Set();
    const lifecycleListeners = /* @__PURE__ */ new Set();
    const connectionListeners = /* @__PURE__ */ new Set();
    const settingsListeners = /* @__PURE__ */ new Set();
    const itemListeners = /* @__PURE__ */ new Set();
    const blockListeners = /* @__PURE__ */ new Set();
    const serviceEventListeners = /* @__PURE__ */ new Set();
    const statusControlListeners = /* @__PURE__ */ new Set();
    const popoverClosedListeners = /* @__PURE__ */ new Set();
    const lateGenerateListeners = /* @__PURE__ */ new Set();
    const unclaimedLateGenerate = [];
    let resolveHandler = null;
    let actionHandler = null;
    const fileOpenListeners = /* @__PURE__ */ new Set();
    const fileSavedListeners = /* @__PURE__ */ new Set();
    let fileSnapshotHandler = null;
    let lastFile = null;
    let saveShortcutInstalled = false;
    const pending = /* @__PURE__ */ new Map();
    const workspaceListeners = /* @__PURE__ */ new Map();
    const shellsListeners = /* @__PURE__ */ new Map();
    let disposed = false;
    const ids = { value: 0 };
    let lastReady = null;
    let lastLifecycle = null;
    let popoverPointerActive = false;
    let popoverFocusActive = false;
    let popoverActivityReported = null;
    let microphone = null;
    const lifecycleFromSession = (session) => {
      if (!session)
        return null;
      return {
        sessionId: session.id,
        phase: session.busy ? "started" : "completed"
      };
    };
    const post = (message) => {
      target.parent.postMessage(message, "*");
    };
    const listenForLateGenerate = () => {
      if (disposed || target.parent === target || lateGenerateListeners.size === 0 || lastReady?.features?.lateGenerateResults !== true)
        return;
      post({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "generate-late-listen" });
    };
    const emit = (listeners, value) => {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          console.error(error);
        }
      }
    };
    const onMessage = (event) => {
      if (!(event instanceof MessageEvent))
        return;
      if (!acceptSource(event.source))
        return;
      const message = readHostMessage(event.data);
      if (!message)
        return;
      if (message.type === "workspace") {
        const listener = workspaceListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "shells") {
        const listener = shellsListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "microphone-audio") {
        microphone?.queue.push(message.payload.samples);
        return;
      }
      if (message.type === "microphone-ended") {
        const open = microphone;
        if (!open)
          return;
        microphone = null;
        open.release();
        emit(open.endedListeners, message.payload.reason);
        return;
      }
      if (message.type === "ready") {
        lastReady = message.payload;
        lastLifecycle = lifecycleFromSession(message.payload.session);
        emit(readyListeners, message.payload);
        emit(directoryListeners, message.payload.directory);
        emit(sessionListeners, message.payload.session);
        if (lastLifecycle) {
          emit(lifecycleListeners, lastLifecycle);
        }
        emit(connectionListeners, message.payload.connection);
        emit(settingsListeners, message.payload.settings);
        emit(itemListeners, message.payload.item);
        if (message.payload.block)
          emit(blockListeners, message.payload.block);
        listenForLateGenerate();
        return;
      }
      if (message.type === "service-event") {
        emit(serviceEventListeners, message.payload);
        return;
      }
      if (message.type === "generate-late") {
        if (lateGenerateListeners.size === 0)
          unclaimedLateGenerate.push(message.payload);
        else
          emit(lateGenerateListeners, message.payload);
        return;
      }
      if (message.type === "directory") {
        if (lastReady) {
          lastReady = { ...lastReady, directory: message.payload.directory };
        }
        emit(directoryListeners, message.payload.directory);
        return;
      }
      if (message.type === "session") {
        if (lastReady) {
          lastReady = { ...lastReady, session: message.payload.session };
        }
        if (!message.payload.session) {
          lastLifecycle = null;
        } else if (lastLifecycle?.sessionId !== message.payload.session.id) {
          lastLifecycle = lifecycleFromSession(message.payload.session);
        }
        emit(sessionListeners, message.payload.session);
        return;
      }
      if (message.type === "session-lifecycle") {
        lastLifecycle = message.payload;
        emit(lifecycleListeners, message.payload);
        return;
      }
      if (message.type === "connection") {
        if (lastReady) {
          lastReady = { ...lastReady, connection: message.payload.connection };
        }
        emit(connectionListeners, message.payload.connection);
        return;
      }
      if (message.type === "settings") {
        if (lastReady) {
          lastReady = { ...lastReady, settings: message.payload.settings };
        }
        emit(settingsListeners, message.payload.settings);
        return;
      }
      if (message.type === "item") {
        if (lastReady) {
          lastReady = { ...lastReady, item: message.payload.item };
        }
        emit(itemListeners, message.payload.item);
        return;
      }
      if (message.type === "status-control-event") {
        emit(statusControlListeners, message.payload);
        return;
      }
      if (message.type === "popover-closed") {
        emit(popoverClosedListeners, message.payload);
        return;
      }
      if (message.type === "action") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "action-result",
              id: message.id,
              payload
            });
        };
        const handler = actionHandler;
        if (!handler) {
          answer({ ok: false, error: "This extension does not handle background actions." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then(() => answer({ ok: true }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ ok: false, error: (text || "Action failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      if (message.type === "file-open") {
        const next = message.payload;
        if (lastFile && sameFileEditorDocument(lastFile, next))
          return;
        lastFile = next;
        emit(fileOpenListeners, message.payload);
        return;
      }
      if (message.type === "file-saved") {
        emit(fileSavedListeners, message.payload.version);
        return;
      }
      if (message.type === "file-snapshot") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "file-snapshot-result",
              id: message.id,
              payload
            });
        };
        const fail = (text) => answer({ error: (text.trim() || "Could not read the edited file.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        const handler = fileSnapshotHandler;
        if (!handler) {
          fail("This extension does not edit files.");
          return;
        }
        Promise.resolve().then(() => handler(message.payload.purpose)).then((snapshot) => {
          if (fileEditorPayloadSize(snapshot) > GUEST_FILE_EDITOR_CONTENT_MAX) {
            fail(`The file is over ${GUEST_FILE_EDITOR_CONTENT_MAX} ${"bytes" in snapshot ? "bytes" : "characters"}.`);
            return;
          }
          if (snapshot.version.length > GUEST_FILE_EDITOR_VERSION_MAX) {
            fail(`The snapshot version is over ${GUEST_FILE_EDITOR_VERSION_MAX} characters.`);
            return;
          }
          answer({ snapshot: "bytes" in snapshot ? { bytes: snapshot.bytes, version: snapshot.version } : { content: snapshot.content, version: snapshot.version } });
        }, (error) => fail(error instanceof Error ? error.message : String(error)));
        return;
      }
      if (message.type === "resolve") {
        const answer = (payload) => {
          post({
            channel: OPENCHAMBER_SDK_CHANNEL,
            v: OPENCHAMBER_SDK_API_VERSION,
            type: "resolve-result",
            id: message.id,
            payload
          });
        };
        const handler = resolveHandler;
        if (!handler) {
          answer({ error: "This extension does not resolve commands." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then((item) => answer({ item: item ? clampAttachRequest(item) : null }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ error: (text || "Command failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter)
        return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.ok) {
        waiter.resolve(message.payload);
        return;
      }
      waiter.reject(new HostRequestError(message.code, message.error));
    };
    target.addEventListener("message", onMessage);
    post({
      channel: OPENCHAMBER_SDK_CHANNEL,
      v: OPENCHAMBER_SDK_API_VERSION,
      type: "hello"
    });
    const send = (message, timeoutMs = requestTimeoutMs) => {
      if (disposed || target.parent === target) {
        return Promise.reject(new HostRequestError("HOST_UNAVAILABLE", "No host frame. This page is not in an iframe."));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.id);
          reject(new HostRequestError("HOST_TIMEOUT", "Host did not answer in time."));
        }, timeoutMs);
        pending.set(message.id, { resolve, reject, timer });
        post(message);
      });
    };
    const request2 = (message) => send(message).then(() => void 0);
    const envelope = { channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION };
    const notify = (message) => {
      if (!disposed && target.parent !== target)
        post(message);
    };
    const requestFileSave = () => notify({ ...envelope, type: "file-save" });
    const postMicrophoneClose = () => {
      if (!disposed && target.parent !== target)
        post({ ...envelope, type: "microphone-close", id: nextId(ids) });
    };
    const openMicrophone = async () => {
      if (microphone)
        throw new HostRequestError("HOST_REJECTED", "The microphone is already open in this frame.");
      if (lastReady?.features?.microphone !== true) {
        throw new HostRequestError("UNSUPPORTED", "This OpenChamber cannot share the microphone with extensions.");
      }
      const AudioContextCtor = globalThis.AudioContext;
      if (typeof AudioContextCtor !== "function")
        throw new HostRequestError("UNSUPPORTED", "This frame has no Web Audio.");
      const context = new AudioContextCtor();
      if (context.sampleRate < GUEST_MICROPHONE_SAMPLE_RATE_MIN || context.sampleRate > GUEST_MICROPHONE_SAMPLE_RATE_MAX) {
        void context.close().catch(() => void 0);
        throw new HostRequestError("UNSUPPORTED", `Audio at ${context.sampleRate} Hz is not supported.`);
      }
      const resumed = context.state === "suspended" ? context.resume().catch(() => void 0) : void 0;
      const queue = createSampleQueue(Math.round(context.sampleRate / 4));
      const processor = context.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => queue.pull(event.outputBuffer.getChannelData(0));
      const destination = context.createMediaStreamDestination();
      processor.connect(destination);
      const endedListeners = /* @__PURE__ */ new Set();
      const open = {
        queue,
        endedListeners,
        release: () => {
          processor.onaudioprocess = null;
          processor.disconnect();
          queue.clear();
          for (const track of destination.stream.getTracks())
            track.stop();
          void context.close().catch(() => void 0);
        }
      };
      microphone = open;
      try {
        const result = await send({ ...envelope, type: "microphone-open", id: nextId(ids), payload: { sampleRate: context.sampleRate } }, GUEST_MICROPHONE_OPEN_TIMEOUT_MS);
        if (!result || !("opened" in result) || result.opened !== true) {
          throw new HostRequestError("HOST_REJECTED", "Host did not open the microphone.");
        }
        await resumed;
        if (microphone !== open)
          throw new HostRequestError("DISCONNECTED", "The microphone closed while it was opening.");
      } catch (error) {
        if (microphone === open)
          microphone = null;
        open.release();
        postMicrophoneClose();
        throw error;
      }
      return {
        stream: destination.stream,
        close: () => {
          if (microphone !== open)
            return;
          microphone = null;
          open.release();
          postMicrophoneClose();
        },
        onEnded: (listener) => {
          endedListeners.add(listener);
          return () => {
            endedListeners.delete(listener);
          };
        }
      };
    };
    const onSaveShortcut = (event) => {
      if (!isKeyEvent(event) || !isSaveShortcut(event))
        return;
      event.preventDefault();
      requestFileSave();
    };
    const onPopoverEscape = (event) => {
      if (!isKeyEvent(event) || event.key !== "Escape" || lastReady?.surface !== "popover" || !lastReady.popover)
        return;
      event.preventDefault();
      void closePopover(lastReady.popover.id, "escape").catch(() => void 0);
    };
    const reportPopoverActivity = () => {
      const popover = lastReady?.surface === "popover" ? lastReady.popover : void 0;
      if (!popover)
        return;
      const active2 = popoverPointerActive || popoverFocusActive;
      if (popoverActivityReported === active2)
        return;
      popoverActivityReported = active2;
      void setPopoverAnchorActive(popover.id, active2).catch(() => void 0);
    };
    const onPopoverPointerOver = () => {
      if (lastReady?.surface !== "popover" || popoverPointerActive)
        return;
      popoverPointerActive = true;
      reportPopoverActivity();
    };
    const onPopoverPointerOut = (event) => {
      if (lastReady?.surface !== "popover" || event.relatedTarget !== null || !popoverPointerActive)
        return;
      popoverPointerActive = false;
      reportPopoverActivity();
    };
    const onPopoverFocus = () => {
      if (lastReady?.surface !== "popover" || popoverFocusActive)
        return;
      popoverFocusActive = true;
      reportPopoverActivity();
    };
    const onPopoverBlur = () => {
      if (lastReady?.surface !== "popover" || !popoverFocusActive)
        return;
      popoverFocusActive = false;
      reportPopoverActivity();
    };
    const requireIdentity = (value, maximum = 1024) => {
      if (!value.trim() || value.length > maximum)
        throw new HostRequestError("HOST_REJECTED", `Identity must contain 1 to ${maximum} characters.`);
    };
    const readWorkspace = async (query) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const result = await send({ ...envelope, type: "workspace-read", id: nextId(ids), payload: query });
      if (!result || !("kind" in result) || !("state" in result) || result.kind !== query.kind) {
        throw new HostRequestError("HOST_REJECTED", "Host did not return workspace data.");
      }
      return result;
    };
    const subscribeWorkspace = async (query, listener) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const subscriptionId = nextId(ids);
      workspaceListeners.set(subscriptionId, listener);
      try {
        await request2({ ...envelope, type: "workspace-subscribe", id: nextId(ids), payload: { subscriptionId, query } });
      } catch (error) {
        workspaceListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!workspaceListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const subscribeShells = async (scope, listener) => {
      if (scope.kind === "session")
        requireIdentity(scope.sessionId);
      if (scope.kind === "project")
        requireIdentity(scope.projectId);
      const subscriptionId = nextId(ids);
      shellsListeners.set(subscriptionId, listener);
      try {
        await request2({ ...envelope, type: "shells-subscribe", id: nextId(ids), payload: { subscriptionId, scope } });
      } catch (error) {
        shellsListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!shellsListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const storage = async (payload) => {
      if ("key" in payload && (payload.key.length === 0 || payload.key.length > GUEST_STORAGE_KEY_MAX)) {
        throw new HostRequestError("HOST_REJECTED", "Storage key must contain 1 to 128 characters.");
      }
      if (payload.op === "set" && !isJsonValue(payload.value)) {
        throw new HostRequestError("HOST_REJECTED", "Storage values must be JSON.");
      }
      if (payload.op === "set" && new TextEncoder().encode(JSON.stringify(payload.value)).length > GUEST_STORAGE_VALUE_BYTES) {
        throw new HostRequestError("HOST_REJECTED", "Storage value exceeds 64 KiB.");
      }
      if (payload.scope === "device" && lastReady?.features?.deviceStorage !== true) {
        throw new HostRequestError("UNSUPPORTED", "This host does not support device storage.");
      }
      const result = await send({ ...envelope, type: "storage", id: nextId(ids), payload });
      if (!result || !("storage" in result) || result.op !== payload.op)
        throw new HostRequestError("HOST_REJECTED", "Host did not return storage data.");
      return result;
    };
    const closePopover = (id, reason) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request2({ ...envelope, type: "popover-close", id: nextId(ids), payload: reason ? { id, reason } : { id } });
    const setPopoverAnchorActive = (id, active2) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request2({ ...envelope, type: "popover-anchor", id: nextId(ids), payload: { id, active: active2 } });
    target.addEventListener("keydown", onPopoverEscape, true);
    target.addEventListener("pointerover", onPopoverPointerOver);
    target.addEventListener("pointermove", onPopoverPointerOver);
    target.addEventListener("pointerout", onPopoverPointerOut);
    target.addEventListener("focus", onPopoverFocus);
    target.addEventListener("blur", onPopoverBlur);
    return {
      onAction: (handler) => {
        actionHandler = handler;
        return () => {
          if (actionHandler === handler)
            actionHandler = null;
        };
      },
      listProjects: async () => {
        const result = await readWorkspace({ kind: "projects" });
        if (result.kind !== "projects")
          throw new HostRequestError("HOST_REJECTED", "Expected projects.");
        return result;
      },
      listWorktrees: async (projectId) => {
        const result = await readWorkspace({ kind: "worktrees", projectId });
        if (result.kind !== "worktrees")
          throw new HostRequestError("HOST_REJECTED", "Expected worktrees.");
        return result;
      },
      listSessions: async (projectId) => {
        const result = await readWorkspace({ kind: "sessions", projectId });
        if (result.kind !== "sessions")
          throw new HostRequestError("HOST_REJECTED", "Expected sessions.");
        return result;
      },
      onProjects: (listener) => subscribeWorkspace({ kind: "projects" }, (snapshot) => {
        if (snapshot.kind === "projects")
          listener(snapshot);
      }),
      onWorktrees: (projectId, listener) => subscribeWorkspace({ kind: "worktrees", projectId }, (snapshot) => {
        if (snapshot.kind === "worktrees")
          listener(snapshot);
      }),
      onSessions: (projectId, listener) => subscribeWorkspace({ kind: "sessions", projectId }, (snapshot) => {
        if (snapshot.kind === "sessions")
          listener(snapshot);
      }),
      onRunningShells: (scope, listener) => subscribeShells(scope, listener),
      readShellOutput: async (shellId, options2) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const cursor = options2?.cursor;
        if (cursor !== void 0 && (!Number.isInteger(cursor) || cursor < 0)) {
          throw new HostRequestError("HOST_REJECTED", "Shell output cursor must be a non-negative integer.");
        }
        const tailBytes = options2?.tailBytes;
        if (tailBytes !== void 0 && (!Number.isInteger(tailBytes) || tailBytes < 1 || tailBytes > GUEST_SHELL_OUTPUT_TAIL_MAX)) {
          throw new HostRequestError("HOST_REJECTED", `Shell output tailBytes must be an integer between 1 and ${GUEST_SHELL_OUTPUT_TAIL_MAX}.`);
        }
        const result = await send({ ...envelope, type: "shell-output", id: nextId(ids), payload: { shellId, cursor, tailBytes } });
        const output = result;
        if (!output || typeof output.output !== "string" || !Number.isFinite(output.cursor)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return shell output.");
        }
        return output;
      },
      stopShell: async (shellId) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const result = await send({ ...envelope, type: "shell-stop", id: nextId(ids), payload: { shellId } });
        if (result?.stopped !== true)
          throw new HostRequestError("HOST_REJECTED", "Host did not stop the shell.");
        return { stopped: true };
      },
      openSession: async (sessionId) => {
        requireIdentity(sessionId);
        await request2({ ...envelope, type: "open-session", id: nextId(ids), payload: { sessionId } });
      },
      storage: {
        get: async (key, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "get", key };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          return result.op === "get" && result.found ? result.value : void 0;
        },
        set: async (key, value, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "set", key, value };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        delete: async (key, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "delete", key };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        keys: async (options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "keys" };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          if (result.op !== "keys")
            throw new HostRequestError("HOST_REJECTED", "Expected storage keys.");
          return result.keys;
        }
      },
      onReady: (listener) => {
        readyListeners.add(listener);
        if (lastReady)
          listener(lastReady);
        return () => {
          readyListeners.delete(listener);
        };
      },
      onDirectory: (listener) => {
        directoryListeners.add(listener);
        if (lastReady)
          listener(lastReady.directory);
        return () => {
          directoryListeners.delete(listener);
        };
      },
      onSession: (listener) => {
        sessionListeners.add(listener);
        if (lastReady)
          listener(lastReady.session);
        return () => {
          sessionListeners.delete(listener);
        };
      },
      onSessionLifecycle: (listener) => {
        lifecycleListeners.add(listener);
        if (lastLifecycle)
          listener(lastLifecycle);
        return () => {
          lifecycleListeners.delete(listener);
        };
      },
      onConnection: (listener) => {
        connectionListeners.add(listener);
        if (lastReady)
          listener(lastReady.connection);
        return () => {
          connectionListeners.delete(listener);
        };
      },
      onSettings: (listener) => {
        settingsListeners.add(listener);
        if (lastReady)
          listener(lastReady.settings);
        return () => {
          settingsListeners.delete(listener);
        };
      },
      onItem: (listener) => {
        itemListeners.add(listener);
        if (lastReady)
          listener(lastReady.item);
        return () => {
          itemListeners.delete(listener);
        };
      },
      onBlock: (listener) => {
        blockListeners.add(listener);
        if (lastReady?.block)
          listener(lastReady.block);
        return () => {
          blockListeners.delete(listener);
        };
      },
      onServiceEvent: (listener) => {
        serviceEventListeners.add(listener);
        return () => {
          serviceEventListeners.delete(listener);
        };
      },
      onStatusControl: (listener) => {
        statusControlListeners.add(listener);
        return () => {
          statusControlListeners.delete(listener);
        };
      },
      onPopoverClosed: (listener) => {
        popoverClosedListeners.add(listener);
        return () => {
          popoverClosedListeners.delete(listener);
        };
      },
      setStatusControls: (controls) => {
        if (lastReady?.features?.statusControls !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support status controls."));
        }
        if (!isGuestStatusControls(controls)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Status controls must have unique bounded ids and valid selected options."));
        }
        return request2({ ...envelope, type: "status-controls", id: nextId(ids), payload: { controls } });
      },
      openPopover: (payload) => {
        if (lastReady?.features?.popovers !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers."));
        }
        if (!isGuestPopoverRequest(payload)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Popover requests need bounded geometry and JSON data."));
        }
        return request2({ ...envelope, type: "popover-open", id: nextId(ids), payload });
      },
      closePopover,
      setPopoverAnchorActive,
      onResolve: (handler) => {
        resolveHandler = handler;
        return () => {
          if (resolveHandler === handler)
            resolveHandler = null;
        };
      },
      toast: (payload) => {
        const message = payload.message.trim();
        if (!message || message.length > GUEST_TOAST_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast message must contain 1 to ${GUEST_TOAST_MAX} characters.`));
        }
        if (payload.copy && payload.copy !== true && (!payload.copy.text.length || payload.copy.text.length > GUEST_CLIPBOARD_TEXT_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast copy text must contain 1 to ${GUEST_CLIPBOARD_TEXT_MAX} characters.`));
        }
        return request2({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "toast",
          id: nextId(ids),
          payload: { ...payload, message }
        });
      },
      openUrl: (url) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-url",
        id: nextId(ids),
        payload: { url }
      }),
      ...guestNavigationCalls(request2, () => nextId(ids), (message) => Promise.reject(new HostRequestError("HOST_REJECTED", message))),
      answerBlock: (text) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "block-answer",
        id: nextId(ids),
        payload: { text: text.trim().slice(0, GUEST_BLOCK_ANSWER_MAX) }
      }),
      openSurface: (surfaceId) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-surface",
        id: nextId(ids),
        payload: { surfaceId }
      }),
      writeClipboard: (text) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "clipboard-write",
        id: nextId(ids),
        payload: { text }
      }),
      compose: (payload) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "compose",
        id: nextId(ids),
        payload
      }),
      attach: (payload) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "attach",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      startSession: async (payload) => {
        if (payload.projectId !== void 0)
          requireIdentity(payload.projectId);
        const worktree = payload.worktree;
        if (worktree && worktree !== true) {
          if (worktree.kind === "existing")
            requireIdentity(worktree.directory);
          else {
            if (worktree.name !== void 0)
              requireIdentity(worktree.name, 200);
            if (worktree.baseBranch !== void 0)
              requireIdentity(worktree.baseBranch, 200);
          }
        }
        const result = await send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "start-session",
          id: nextId(ids),
          payload: clampStartSessionRequest(payload)
        }, options.requestTimeoutMs ?? 18e4);
        if (!isStartSessionResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a session.");
        }
        return result;
      },
      prompt: (payload) => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "prompt",
        id: nextId(ids),
        payload: clampPromptRequest(payload)
      }).then((result) => {
        if (!isPromptResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a prompt result.");
        }
        return result;
      }),
      sessionLink: (payload) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "session-link",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      close: () => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "close",
        id: nextId(ids)
      }),
      oauthStart: () => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-start",
        id: nextId(ids)
      }),
      oauthDisconnect: () => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-disconnect",
        id: nextId(ids)
      }),
      request: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host request result was empty.");
        }
        return result;
      }),
      serviceRequest: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host service request result was empty.");
        }
        return result;
      }),
      serviceStatus: () => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-status",
        id: nextId(ids)
      }).then((result) => {
        if (!isServiceStatusResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return service status.");
        }
        return result;
      }),
      readFile: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-read",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileReadResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file content.");
        }
        return result;
      }),
      writeFile: (path, content) => {
        if (!isGuestFilePath(path)) {
          return rejectBadFilePath();
        }
        if (content.length > GUEST_FILE_CONTENT_MAX) {
          return Promise.reject(new HostRequestError("FILE_TOO_LARGE", `Content is over ${GUEST_FILE_CONTENT_MAX} characters.`));
        }
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "file-write",
          id: nextId(ids),
          payload: { path, content }
        }).then((result) => {
          if (!isFileWriteResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not confirm the write.");
          }
          return result;
        });
      },
      listDir: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-list",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileListResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return directory entries.");
        }
        return result;
      }),
      stat: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-stat",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileStatResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file status.");
        }
        return result;
      }),
      generate: (input) => {
        const prompt2 = input.prompt.trim();
        const system = input.system?.trim();
        if (prompt2.length === 0 || prompt2.length > GUEST_GENERATE_PROMPT_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Prompt must be 1 to ${GUEST_GENERATE_PROMPT_MAX} characters.`));
        }
        if (system !== void 0 && (system.length === 0 || system.length > GUEST_GENERATE_SYSTEM_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `System prompt must be 1 to ${GUEST_GENERATE_SYSTEM_MAX} characters.`));
        }
        const maxOutputTokens = input.maxOutputTokens === void 0 ? void 0 : Math.min(GUEST_GENERATE_OUTPUT_TOKENS_MAX, Math.max(1, Math.floor(input.maxOutputTokens)));
        if (maxOutputTokens !== void 0 && !Number.isFinite(maxOutputTokens)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "maxOutputTokens must be a number."));
        }
        const payload = { prompt: prompt2 };
        if (system !== void 0)
          payload.system = system;
        if (maxOutputTokens !== void 0)
          payload.maxOutputTokens = maxOutputTokens;
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "generate",
          id: nextId(ids),
          payload
        }, options.requestTimeoutMs ?? GUEST_GENERATE_TIMEOUT_MS).then((result) => {
          if (!isGenerateResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not return generated text.");
          }
          return result;
        });
      },
      onLateGenerateResult: (listener) => {
        lateGenerateListeners.add(listener);
        for (const result of unclaimedLateGenerate.splice(0))
          emit([listener], result);
        listenForLateGenerate();
        return () => {
          lateGenerateListeners.delete(listener);
        };
      },
      openMicrophone,
      setBadge: (count) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "badge",
        id: nextId(ids),
        payload: { count: clampBadgeCount(count) }
      }),
      setHeight: (height) => request2({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "resize",
        id: nextId(ids),
        payload: { height: clampFrameHeight(height) }
      }),
      onFileOpen: (listener) => {
        fileOpenListeners.add(listener);
        if (!saveShortcutInstalled) {
          saveShortcutInstalled = true;
          target.addEventListener("keydown", onSaveShortcut, true);
        }
        if (lastFile)
          listener(lastFile);
        return () => {
          fileOpenListeners.delete(listener);
        };
      },
      onFileSnapshot: (handler) => {
        fileSnapshotHandler = handler;
        return () => {
          if (fileSnapshotHandler === handler)
            fileSnapshotHandler = null;
        };
      },
      onFileSaved: (listener) => {
        fileSavedListeners.add(listener);
        return () => {
          fileSavedListeners.delete(listener);
        };
      },
      reportFileChange: (change) => notify({ ...envelope, type: "file-change", payload: { dirty: change.dirty, edited: change.edited } }),
      requestFileSave,
      reportFileUnsupported: () => notify({ ...envelope, type: "file-unsupported" }),
      dispose: () => {
        for (const subscriptionId of workspaceListeners.keys()) {
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        workspaceListeners.clear();
        for (const subscriptionId of shellsListeners.keys()) {
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        shellsListeners.clear();
        if (microphone) {
          postMicrophoneClose();
          microphone.release();
          microphone = null;
        }
        disposed = true;
        resolveHandler = null;
        actionHandler = null;
        fileSnapshotHandler = null;
        fileOpenListeners.clear();
        fileSavedListeners.clear();
        if (saveShortcutInstalled)
          target.removeEventListener("keydown", onSaveShortcut, true);
        target.removeEventListener("message", onMessage);
        target.removeEventListener("keydown", onPopoverEscape, true);
        target.removeEventListener("pointerover", onPopoverPointerOver);
        target.removeEventListener("pointermove", onPopoverPointerOver);
        target.removeEventListener("pointerout", onPopoverPointerOut);
        target.removeEventListener("focus", onPopoverFocus);
        target.removeEventListener("blur", onPopoverBlur);
        for (const waiter of pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(new HostRequestError("HOST_UNAVAILABLE", "Host client was disposed."));
        }
        pending.clear();
        readyListeners.clear();
        directoryListeners.clear();
        sessionListeners.clear();
        lifecycleListeners.clear();
        connectionListeners.clear();
        settingsListeners.clear();
        itemListeners.clear();
        blockListeners.clear();
        serviceEventListeners.clear();
        statusControlListeners.clear();
        popoverClosedListeners.clear();
        lateGenerateListeners.clear();
        unclaimedLateGenerate.length = 0;
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/service-providers.js
  var BROWSER_CONTROL_ACTIONS = [
    "browser.open",
    "browser.snapshot",
    "browser.click",
    "browser.type",
    "browser.select",
    "browser.scroll",
    "browser.back",
    "browser.forward",
    "browser.inspect",
    "browser.capture",
    "browser.resize",
    "browser.close"
  ];
  var BROWSER_PROVIDER_IDLE_MS = 10 * 6e4;
  var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
  var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 6e4;
  var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 6e4;
  var TRACKER_PROVIDER_IDLE_MS = 10 * 6e4;
  var QUOTA_PROVIDER_IDLE_MS = 10 * 6e4;

  // node_modules/@openchamber/sdk/dist/service-surface.js
  var SURFACE_CONTROLLERS = ["none", "agent", "user"];
  var CONTROLLERS = new Set(SURFACE_CONTROLLERS);

  // node_modules/@openchamber/sdk/dist/ui/theme.js
  var TOKEN_VARS = [
    ["--oc-bg", "background"],
    ["--oc-elevated", "elevated"],
    ["--oc-fg", "foreground"],
    ["--oc-muted", "muted"],
    ["--oc-subtle", "subtle"],
    ["--oc-border", "border"],
    ["--oc-hover", "hover"],
    ["--oc-selection", "selection"],
    ["--oc-focus", "focus"],
    ["--oc-primary", "primary"],
    ["--oc-muted-surface", "mutedSurface"],
    ["--oc-elevated-fg", "elevatedForeground"],
    ["--oc-active", "active"],
    ["--oc-selection-fg", "selectionForeground"],
    ["--oc-primary-fg", "primaryForeground"],
    ["--oc-primary-text", "primaryText"],
    ["--oc-success-text", "successText"],
    ["--oc-warning-text", "warningText"],
    ["--oc-error-text", "errorText"],
    ["--oc-info-text", "infoText"],
    ["--oc-success", "success"],
    ["--oc-warning", "warning"],
    ["--oc-error", "error"],
    ["--oc-info", "info"],
    ["--oc-font", "font"],
    ["--oc-mono", "mono"],
    ["--oc-radius", "radius"],
    ["--surface-background", "background"],
    ["--surface-elevated", "elevated"],
    ["--surface-foreground", "foreground"],
    ["--surface-muted-foreground", "muted"],
    ["--surface-subtle", "subtle"],
    ["--interactive-border", "border"],
    ["--interactive-hover", "hover"],
    ["--interactive-selection", "selection"],
    ["--interactive-focus-ring", "focus"],
    ["--primary", "primary"],
    ["--surface-muted", "mutedSurface"],
    ["--surface-elevated-foreground", "elevatedForeground"],
    ["--interactive-active", "active"],
    ["--interactive-selection-foreground", "selectionForeground"],
    ["--primary-foreground", "primaryForeground"],
    ["--primary-text", "primaryText"],
    ["--success-text", "successText"],
    ["--warning-text", "warningText"],
    ["--error-text", "errorText"],
    ["--info-text", "infoText"],
    ["--status-success", "success"],
    ["--status-warning", "warning"],
    ["--status-error", "error"],
    ["--status-info", "info"],
    ["--font-sans", "font"],
    ["--font-mono", "mono"],
    ["--radius", "radius"]
  ];
  var SYNTAX_TOKEN_VARS = [
    ["--oc-syntax-keyword", "--syntax-keyword", "syntaxKeyword"],
    ["--oc-syntax-string", "--syntax-string", "syntaxString"],
    ["--oc-syntax-number", "--syntax-number", "syntaxNumber"],
    ["--oc-syntax-function", "--syntax-function", "syntaxFunction"],
    ["--oc-syntax-type", "--syntax-type", "syntaxType"],
    ["--oc-syntax-comment", "--syntax-comment", "syntaxComment"],
    ["--oc-syntax-variable", "--syntax-variable", "syntaxVariable"],
    ["--oc-syntax-operator", "--syntax-operator", "syntaxOperator"]
  ];
  var applyHostTheme = (theme, root) => {
    root.style.colorScheme = theme.mode;
    for (const [name, key] of TOKEN_VARS) {
      root.style.setProperty(name, theme.tokens[key]);
    }
    for (const [alias, hostName, key] of SYNTAX_TOKEN_VARS) {
      const value = theme.tokens[key] ?? "";
      root.style.setProperty(alias, value);
      root.style.setProperty(hostName, value);
    }
    root.style.setProperty("font-family", theme.tokens.font);
    root.style.setProperty("font-size", theme.tokens.fontSize ?? "0.875rem");
    root.style.setProperty("line-height", "1.45");
    root.style.setProperty("color", theme.tokens.foreground);
  };
  var applyHostReady = (ctx, root) => {
    applyHostTheme(ctx.theme, root);
    if (root.dataset) {
      root.dataset.ocSurface = ctx.surface;
      root.dataset.ocTheme = ctx.theme.mode;
    }
  };

  // node_modules/@openchamber/sdk/dist/ui/style.js
  var OC_ALIAS = {
    "surface-background": "bg",
    "surface-elevated": "elevated",
    "surface-elevated-foreground": "elevated-fg",
    "surface-foreground": "fg",
    "surface-muted-foreground": "muted",
    "surface-muted": "muted-surface",
    "surface-subtle": "subtle",
    "interactive-border": "border",
    "interactive-hover": "hover",
    "interactive-active": "active",
    "interactive-selection": "selection",
    "interactive-selection-foreground": "selection-fg",
    "interactive-focus-ring": "focus",
    "primary": "primary",
    "primary-foreground": "primary-fg",
    "primary-text": "primary-text",
    "success-text": "success-text",
    "warning-text": "warning-text",
    "error-text": "error-text",
    "info-text": "info-text",
    "status-success": "success",
    "status-warning": "warning",
    "status-error": "error",
    "status-info": "info",
    "font-sans": "font",
    "font-mono": "mono",
    "radius": "radius"
  };
  var v = (name, fallback) => `var(--${name}, var(--oc-${OC_ALIAS[name]}, ${fallback}))`;
  var bg = v("surface-background", "transparent");
  var elevated = v("surface-elevated", "transparent");
  var elevatedFg = v("surface-elevated-foreground", "inherit");
  var fg = v("surface-foreground", "inherit");
  var muted = v("surface-muted-foreground", "gray");
  var secondary = v("surface-muted", "transparent");
  var border = v("interactive-border", "currentColor");
  var hover = v("interactive-hover", "transparent");
  var active = v("interactive-active", "transparent");
  var selection = v("interactive-selection", "transparent");
  var selectionFg = v("interactive-selection-foreground", "inherit");
  var primary = v("primary", "currentColor");
  var primaryText = v("primary-text", "inherit");
  var errorText = v("error-text", "inherit");
  var font = v("font-sans", "inherit");
  var mono = v("font-mono", "monospace");
  var radius = v("radius", "9px");
  var controlRadius = `calc(${radius} - 2px)`;
  var smallRadius = `calc(${radius} - 4px)`;
  var mix = (color, pct, base = "transparent") => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
  var focusFill = `background-image: linear-gradient(${hover}, ${hover});`;
  var field = (edge, width = "0.5px") => `box-shadow: inset 0 0 0 ${width} ${edge}, var(--oc-sdk-field-lift);`;
  var raised = "border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);";
  var litButton = "box-shadow: var(--oc-sdk-lit);";
  var darkLift = `inset 0 0.5px 0 0 ${mix(fg, 8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`;
  var THEME_VARS = `
:root {
  --oc-sdk-edge: ${mix(fg, 16)};
  --oc-sdk-field-bg: ${elevated};
  --oc-sdk-raised-bg: ${bg};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${mix(fg, 14)};
  --oc-sdk-field-bg: ${mix(bg, 50, elevated)};
  --oc-sdk-raised-bg: ${elevated};
  --oc-sdk-field-lift: ${darkLift};
  --oc-sdk-raised-lift: ${darkLift};
  --oc-sdk-lit: ${darkLift};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`;
  var tone = (name) => {
    const color = v(`status-${name}`, "currentColor");
    return `
.oc-sdk[data-tone="${name}"], .oc-sdk [data-tone="${name}"] { --oc-sdk-tone: ${color}; --oc-sdk-tone-text: ${v(`${name}-text`, "inherit")}; }`;
  };
  var len = (px) => `calc(${px}rem / 14)`;
  var UI_SIZE_CSS = `
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: ${len(8)}; height: ${len(32)}; padding: 0 ${len(12)}; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: ${len(6)}; height: ${len(28)}; padding: 0 ${len(10)}; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: ${len(4)}; height: ${len(24)}; padding: 0 ${len(8)}; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: ${len(14)}; height: ${len(14)}; }

.oc-sdk-field { display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: ${len(32)}; padding: 0 ${len(10)}; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: ${len(8)} ${len(10)}; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: ${len(34)}; padding-right: ${len(34)}; }
.oc-sdk-search-icon { position: absolute; left: ${len(11)}; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: ${len(6)}; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: ${len(24)}; height: ${len(24)}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: ${len(6)}; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: ${len(28)}; padding: 0 ${len(10)}; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: ${len(2)}; min-width: ${len(160)}; max-width: calc(100vw - ${len(16)}); max-height: min(${len(320)}, calc(100vh - ${len(16)})); overflow: auto; padding: ${len(4)}; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: ${len(2)} ${len(2)} ${len(4)}; }
.oc-sdk-popup-search .oc-sdk-input { height: ${len(28)}; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: ${len(8)}; width: 100%; padding: ${len(6)} ${len(8)}; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: ${len(14)}; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: ${len(8)}; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: ${len(8)}; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: ${len(14)}; height: ${len(14)}; margin-top: ${len(3)}; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: ${len(36)}; height: ${len(20)}; --oc-sdk-thumb-travel: ${len(16)}; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: ${len(2)}; left: ${len(2)}; width: ${len(16)}; height: ${len(16)}; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: ${len(2)}; padding: ${len(2)}; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: ${len(6)}; height: ${len(28)}; padding: 0 ${len(10)}; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: ${len(1)} ${len(6)}; font-size: ${len(11)}; font-weight: 500; line-height: ${len(16)}; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: ${len(8)}; width: 100%; padding: ${len(6)} ${len(8)}; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: ${len(64)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: ${len(16)} ${len(8)}; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${len(4)}; padding: ${len(40)} ${len(16)}; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: ${len(12)}; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: ${len(8)}; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: ${len(16)}; height: ${len(16)}; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: ${len(12)}; height: ${len(12)}; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: ${len(12)}; padding: ${len(8)} ${len(12)}; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: ${len(2)}; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: ${len(8)}; width: 100%; margin: ${len(8)} 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: ${len(4)} 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: ${len(6)}; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }
.oc-sdk-progress-value { display: inline-flex; align-items: center; gap: ${len(2)}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { font-weight: 600; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: ${len(8)} 0; }

/* Under a finger the controls reach the app's touch sizes: rows and options 44px like its sheets, every other
   control at least 36px. Inputs keep 16px text, below which iOS zooms the page on focus. */
@media (pointer: coarse) {
  .oc-sdk-btn, .oc-sdk-input { height: ${len(40)}; }
  .oc-sdk-btn[data-size="sm"], .oc-sdk-btn[data-size="xs"], .oc-sdk-trigger, .oc-sdk-tab, .oc-sdk-popup-search .oc-sdk-input { height: ${len(36)}; }
  .oc-sdk-input, .oc-sdk-popup-search .oc-sdk-input { font-size: max(16px, 0.875rem); }
  .oc-sdk-search-clear { width: ${len(36)}; height: ${len(36)}; right: 0; }
  .oc-sdk-row, .oc-sdk-option { min-height: ${len(44)}; }
  .oc-sdk-check { min-height: ${len(36)}; padding: ${len(8)} 0; }
}
`;
  var GUEST_UI_LOOK_CSS = `${THEME_VARS}
.oc-sdk { color: ${fg}; font-family: ${font}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${focusFill} }
.oc-sdk-mono { font-family: ${mono}; }
.oc-sdk-muted { color: ${muted}; }
${tone("success")}${tone("warning")}${tone("error")}${tone("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${primary}; --oc-sdk-tone-text: ${primaryText}; }

.oc-sdk-btn { border-radius: ${controlRadius}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${smallRadius}; }
.oc-sdk-btn[data-variant="default"] { color: ${primaryText}; background: ${mix(primary, 10, bg)}; border-color: ${mix(primary, 12)}; ${litButton} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${mix(primary, 16, bg)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${mix(primary, 22, bg)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${secondary}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${elevatedFg}; ${raised} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${active}, ${active}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${hover}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${active}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${v("status-error", "red")}; color: ${errorText}; background: ${mix("var(--oc-sdk-tone)", 7, bg)}; border-color: ${mix("var(--oc-sdk-tone)", 12)}; ${litButton} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${mix("var(--oc-sdk-tone)", 9, bg)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${mix("var(--oc-sdk-tone)", 11, bg)}; box-shadow: none; }

.oc-sdk-field-note { color: ${muted}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${errorText}; }
.oc-sdk-input { border-radius: ${controlRadius}; background: var(--oc-sdk-field-bg); color: ${elevatedFg}; ${field("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${muted}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${field(mix(fg, 26), "1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${field(v("status-error", "red"), "1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${mono}; }

.oc-sdk-search-icon { color: ${muted}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${primary}; }
.oc-sdk-search-clear { border-radius: ${smallRadius}; color: ${muted}; }
.oc-sdk-search-clear:hover { background: ${hover}; color: ${fg}; }

.oc-sdk-trigger { border-radius: ${controlRadius}; background: var(--oc-sdk-raised-bg); color: ${elevatedFg}; ${raised} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${muted}; }
.oc-sdk-trigger-chevron { color: ${muted}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${elevatedFg}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${elevated}; background-clip: padding-box; color: ${elevatedFg}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${hover}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-option-check { color: ${fg}; }
.oc-sdk-option[data-destructive="true"] { color: ${errorText}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${mix(v("status-error", "red"), 10)}; }
.oc-sdk-option-hint { color: ${muted}; }
.oc-sdk-popup-empty { color: ${muted}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${border}; border-radius: 4px; color: ${fg}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${mix(fg, 60, border)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${border}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${bg}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${primary}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(var(--oc-sdk-thumb-travel, 16px)); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${focusFill} }
.oc-sdk-check-desc { color: ${muted}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${mix(fg, 4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${muted}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${fg}; }
.oc-sdk-tab[aria-selected="true"] { color: ${selectionFg}; background: ${selection}; border-color: ${border}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${elevatedFg}; background: var(--oc-sdk-raised-bg); ${raised} }
.oc-sdk-tab-count { color: ${muted}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${mix(fg, 6)}; color: ${muted}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${mix("var(--oc-sdk-tone)", 15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${hover}; }
.oc-sdk-row[aria-selected="true"] { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-row-lead { font-family: ${mono}; color: ${muted}; }
.oc-sdk-row-sub { color: ${muted}; }
.oc-sdk-row-meta { color: ${muted}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${muted}; }

.oc-sdk-empty-body { color: ${muted}; }

.oc-sdk-spinner { color: ${muted}; }
.oc-sdk-spinner-ring { border-color: ${border}; border-top-color: ${primary}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${mix("var(--oc-sdk-tone)", 10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${muted}; }

.oc-sdk-separator { color: ${muted}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${mix(border, 40)}; }

.oc-sdk-progress-label { color: ${muted}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${mix(fg, 6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${primary}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${v("status-success", "currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${v("success-text", "inherit")}; }

.oc-sdk-text a { color: ${primaryText}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${mix(border, 60)}; }
`;
  var UI_CSS = `
${GUEST_SCROLLBAR_CSS}
${UI_SIZE_CSS}
${GUEST_UI_LOOK_CSS}`;

  // src/panel/main.mjs
  var host = connectHost();
  var $ = (selector) => document.querySelector(selector);
  var app = $("#app");
  var state = {
    directory: null,
    rooms: [],
    models: [],
    room: null,
    roomId: null,
    creating: false,
    createAgents: [],
    createHumanName: "\u623F\u4E3B",
    timeline: [],
    timelineCursor: null,
    timelineSignature: "",
    questions: [],
    questionStatus: "pending",
    questionSignature: "",
    questionFirstSignature: "",
    questionCursor: null,
    selectedQuestionId: null,
    chatAnchor: null,
    followLatest: true,
    search: "",
    author: "",
    replyTo: null,
    mentions: /* @__PURE__ */ new Set(),
    mentionAll: false,
    answerDrafts: {},
    composerDraft: "",
    composerDraftRestored: false,
    mobilePane: "chat",
    chatScroll: 0,
    questionScroll: 0,
    pendingView: null,
    loading: false,
    generation: 0
  };
  var roleLabels = { generic: "\u901A\u7528", proposer: "\u63D0\u6848\u8005", reviewer: "\u5BA1\u67E5\u8005", moderator: "\u4E3B\u6301\u4EBA" };
  var statusLabels = {
    idle: "\u7A7A\u95F2",
    running: "\u8FD0\u884C\u4E2D",
    "waiting-human": "\u7B49\u5F85\u4EBA\u5DE5\u8F93\u5165",
    "waiting-question": "\u7B49\u5F85\u539F\u751F\u63D0\u95EE",
    "waiting-permission": "\u7B49\u5F85\u6743\u9650\u786E\u8BA4",
    unknown: "\u72B6\u6001\u672A\u77E5\uFF0F\u4E0D\u53EF\u8FBE"
  };
  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function time(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }
  function showError(error) {
    const el2 = $("#error");
    el2.textContent = error?.message || String(error);
    el2.hidden = false;
  }
  function clearError() {
    $("#error").hidden = true;
  }
  async function request(method, path, body, query) {
    const result = await host.serviceRequest({ method, path, query: query && Object.fromEntries(Object.entries(query).filter(([, value]) => value != null && value !== "").map(([key, value]) => [key, String(value)])), body: body == null ? void 0 : JSON.stringify(body) });
    let data = null;
    try {
      data = result.body ? JSON.parse(result.body) : null;
    } catch {
    }
    if (result.status >= 400) {
      const error = new Error(data?.error?.message || `\u8BF7\u6C42\u5931\u8D25\uFF08${result.status}\uFF09`);
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }
    return data;
  }
  function toast(message, kind = "info") {
    host.toast({ kind, message }).catch(() => {
    });
  }
  function persistView() {
    const view = { roomId: state.roomId, chatAnchor: state.chatAnchor, search: state.search, author: state.author, questionStatus: state.questionStatus, selectedQuestionId: state.selectedQuestionId, mobilePane: state.mobilePane, composerDraft: state.composerDraft, followLatest: state.followLatest, chatScroll: state.chatScroll, questionScroll: state.questionScroll };
    host.storage.set("discussion-view", view).catch(() => {
    });
  }
  var viewPersistTimer;
  function persistViewSoon() {
    clearTimeout(viewPersistTimer);
    viewPersistTimer = setTimeout(persistView, 200);
  }
  function renderRoomSelect() {
    const select = $("#room-select");
    select.innerHTML = `<option value="">\u9009\u62E9\u8BA8\u8BBA\u5BA4</option>${state.rooms.map((room) => `<option value="${escape(room.roomId)}">${escape(room.title)} \xB7 ${escape(room.status === "ready" ? "\u8FDB\u884C\u4E2D" : room.status === "paused" ? "\u5DF2\u6682\u505C" : room.status === "ended" ? "\u5DF2\u7ED3\u675F" : "\u521B\u5EFA\u4E2D")}</option>`).join("")}`;
    select.value = state.roomId || "";
    $("#new-room").textContent = state.creating ? "\u53D6\u6D88\u65B0\u5EFA" : "\u65B0\u5EFA\u623F\u95F4";
  }
  async function refreshModels(force = false) {
    if (!state.directory || !force && state.models.length) return;
    try {
      const catalog = await request("GET", "/models", null, { directory: state.directory });
      const signature = JSON.stringify(catalog.models);
      if (signature === JSON.stringify(state.models)) return;
      state.models = catalog.models;
      if (!state.createAgents.length) resetCreateAgents();
      else {
        const available = new Set(state.models.map(modelKey));
        const missing = state.createAgents.some((row) => row.modelKey && !available.has(row.modelKey));
        if (missing) {
          for (const row of state.createAgents) if (!available.has(row.modelKey)) row.modelKey = "";
          showError(new Error("\u6A21\u578B\u76EE\u5F55\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u53D7\u5F71\u54CD\u7684\u6210\u5458\u6A21\u578B\u3002"));
        }
      }
      if (state.creating) renderCreate();
    } catch (error) {
      showError(error);
    }
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
  function modelKey(model) {
    return model ? JSON.stringify([model.providerID, model.id, model.variant || ""]) : "";
  }
  function modelOptions(selected) {
    const providers = [...new Set(state.models.map((model) => model.providerID))];
    return `<option value="" ${selected ? "" : "selected"}>\u8BF7\u9009\u62E9\u6A21\u578B</option>` + providers.map((provider) => `<optgroup label="${escape(provider)}">${state.models.filter((model) => model.providerID === provider).map((model) => `<option value="${escape(modelKey(model))}" ${selected === modelKey(model) ? "selected" : ""}>${escape(model.name)}${model.variant ? ` (${escape(model.variant)})` : ""}</option>`).join("")}</optgroup>`).join("");
  }
  function renderCreate() {
    const preset = state.createPreset || "generic";
    $("#create-view").innerHTML = `
    <h1>\u65B0\u5EFA\u8BA8\u8BBA\u5BA4</h1>
    <p class="intro">\u4E3A\u6BCF\u4E2A\u89D2\u8272\u521B\u5EFA\u72EC\u7ACB OpenCode \u4F1A\u8BDD\u3002\u786E\u8BA4\u524D\u53EF\u6539\u663E\u793A\u540D\uFF1B\u5EFA\u623F\u672C\u8EAB\u4E0D\u4F1A\u8C03\u7528\u6A21\u578B\u3002</p>
    <div class="form-grid">
      <div class="field"><label>\u623F\u95F4\u540D\u79F0</label><input id="create-title" value="${escape(state.createTitle || "\u65B0\u7684\u8BA8\u8BBA\u5BA4")}" maxlength="120"></div>
      <div class="field"><label>\u9884\u8BBE</label><select id="create-preset"><option value="generic" ${preset === "generic" ? "selected" : ""}>\u666E\u901A\u8BA8\u8BBA</option><option value="debate" ${preset === "debate" ? "selected" : ""}>\u53CC\u6A21\u578B\u8FA9\u8BBA</option></select></div>
      <div class="field"><label>\u623F\u4E3B\u663E\u793A\u540D</label><input id="create-human" value="${escape(state.createHumanName)}" maxlength="80"></div>
    </div>
    ${preset === "debate" ? `<div class="warning">\u53CC\u6A21\u578B\u8FA9\u8BBA\u9884\u8BBE\u5171\u4EAB 12 \u6B21\u81EA\u52A8\u5524\u9192\u3002\u521D\u59CB\u7ACB\u573A\u4F1A\u5199\u8FDB\u4F1A\u8BDD\u6307\u4EE4\uFF0C\u5141\u8BB8\u968F\u8BC1\u636E\u4FEE\u6539\u3002</div>` : ""}
    <div id="agent-rows">${state.createAgents.map((row, index) => `
      <div class="agent-editor" data-agent="${index}">
        <div class="agent-title"><strong>\u6210\u5458 ${index + 1}</strong><button class="button ghost danger" data-action="remove-agent" ${state.createAgents.length <= 2 ? "disabled" : ""}>\u79FB\u9664</button></div>
        <div class="agent-fields">
          <div class="field"><label>\u663E\u793A\u540D</label><input data-field="displayName" value="${escape(row.displayName)}" maxlength="80"></div>
          <div class="field"><label>\u89D2\u8272</label><select data-field="role">${Object.entries(roleLabels).map(([value, label]) => `<option value="${value}" ${row.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="field"><label>\u6A21\u578B</label><select data-field="model">${state.models.length ? modelOptions(row.modelKey) : `<option>\u6B63\u5728\u8BFB\u53D6\u53EF\u7528\u6A21\u578B\u2026</option>`}</select></div>
        </div>
      </div>`).join("")}</div>
    <button class="button secondary" data-action="add-agent">\u6DFB\u52A0\u6210\u5458</button>
    <div class="warning">\u65B0\u4F1A\u8BDD\u4F7F\u7528\u5F53\u524D\u9879\u76EE\u5DE5\u4F5C\u533A\uFF0C\u9ED8\u8BA4\u5B8C\u5168\u6267\u884C\u6743\u9650\uFF0C\u5E76\u5728\u4F1A\u8BDD\u7EA7\u7981\u7528\u539F\u751F\u63D0\u95EE\u5DE5\u5177\u3002\u591A\u4E2A Agent \u540C\u65F6\u5199\u540C\u4E00\u5DE5\u4F5C\u533A\u53EF\u80FD\u4E92\u76F8\u8986\u76D6\u6587\u4EF6\uFF1B\u8BA8\u8BBA\u6587\u6863\u8BF7\u5199\u623F\u95F4\u4E34\u65F6\u76EE\u5F55\u3002\u4E0D\u4F1A\u4FEE\u6539\u5168\u5C40\u6743\u9650\uFF0C\u4E0D\u521B\u5EFA worktree\u3002</div>
    <div class="create-actions"><button class="button primary" data-action="create-room" ${!state.models.length || !state.directory || state.createAgents.some((row) => !row.modelKey) ? "disabled" : ""}>\u521B\u5EFA\u623F\u95F4</button><button class="button secondary" data-action="cancel-create">\u53D6\u6D88</button></div>
    ${!state.directory ? `<p class="intro">\u8BF7\u5148\u5728 OpenChamber \u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u3002</p>` : ""}
  `;
  }
  function resetCreateAgents() {
    state.createPreset = "generic";
    state.createTitle = "\u65B0\u7684\u8BA8\u8BBA\u5BA4";
    state.createAgents = [0, 1].map((index) => ({ role: "generic", displayName: `Agent ${index + 1}`, modelKey: modelKey(state.models[Math.min(index, Math.max(0, state.models.length - 1))]), autoName: true }));
  }
  async function loadRooms(preferred) {
    const data = await request("GET", "/rooms", null, { projectDir: state.directory });
    state.rooms = data.rooms;
    const requested = preferred || state.roomId;
    let next = state.rooms.some((room) => room.roomId === requested) ? requested : state.rooms[0]?.roomId || null;
    if (state.creating) next = null;
    renderRoomSelect();
    if (next && state.rooms.some((room) => room.roomId === next)) await selectRoom(next, state.pendingView);
    else if (!state.creating) {
      state.room = null;
      state.roomId = null;
      $("#create-view").hidden = false;
      $("#room-view").hidden = true;
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
    state.timelineSignature = "";
    state.questionSignature = "";
    state.questionFirstSignature = "";
    state.questionCursor = null;
    state.followLatest = view?.followLatest ?? true;
    state.search = view?.search || "";
    state.author = view?.author || "";
    state.replyTo = null;
    state.mentions.clear();
    state.mentionAll = false;
    state.composerDraft = view?.composerDraft || "";
    state.composerDraftRestored = !!view;
    state.pendingView = null;
    $("#create-view").hidden = true;
    $("#room-view").hidden = false;
    $("#room-view").dataset.mobilePane = state.mobilePane;
    $("#question-status").value = state.questionStatus;
    document.querySelectorAll(".mobile-tabs button").forEach((button2) => button2.classList.toggle("active", button2.dataset.pane === state.mobilePane));
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
    <div><div class="room-title">${escape(room.title)}</div><div class="member-list"><span class="member-chip"><span>${escape(room.human.displayName)}</span><span class="pill">\u4EBA\u7C7B \xB7 \u623F\u4E3B</span></span>${room.members.map((member) => `<span class="member-chip"><span>${escape(member.displayName)}</span>${member.creationStatus === "failed" || member.creationError ? `<span class="pill error">\u521B\u5EFA\u5931\u8D25\uFF1A${escape(member.creationError || "\u672A\u77E5\u539F\u56E0")}</span>` : member.taskError ? `<span class="pill waiting-human">\u6307\u4EE4\u540C\u6B65\u5931\u8D25\uFF1A${escape(member.taskError)}</span><span class="pill ${escape(member.sessionStatus)}">${escape(statusLabels[member.sessionStatus] || member.sessionStatus)}</span>` : `<span class="pill ${escape(member.sessionStatus)}">${escape(statusLabels[member.sessionStatus] || member.sessionStatus)}</span>`}${member.sessionId ? `<button data-action="open-session" data-session="${escape(member.sessionId)}">\u4F1A\u8BDD</button>` : ""}</span>`).join("")}</div></div>
    <div class="room-controls">
      <span class="pill budget">\u4F59\u989D ${room.budget.remaining}/${room.budget.limit} \xB7 \u7B2C ${room.budget.period} \u6BB5</span>
      ${room.status === "creating" ? `<button class="button secondary" data-action="retry">\u91CD\u8BD5\u7F3A\u5931\u4F1A\u8BDD</button>` : room.status !== "ended" ? `${paused ? `<button class="button primary" data-action="resume">\u7EE7\u7EED\u623F\u95F4</button>` : `<button class="button secondary" data-action="pause">\u6682\u505C\u5524\u9192</button>`}<button class="button ghost danger" data-action="end">\u7ED3\u675F\u623F\u95F4</button>` : ""}
    </div>
    ${paused && room.status !== "creating" ? `<div class="composer-hint">\u81EA\u52A8\u5524\u9192\u5DF2\u6682\u505C\uFF08${escape(room.pausedReason === "budget" ? "\u989D\u5EA6\u7528\u5C3D" : "\u624B\u52A8\u6682\u505C")}\uFF09\u3002\u53D1\u5E16\u3001\u9605\u8BFB\u548C\u63D0\u95EE\u4ECD\u53EF\u4F7F\u7528\u3002</div>` : ""}
  `;
  }
  function renderAuthorFilter() {
    const room = state.room;
    if (!room) return;
    const select = $("#author-filter");
    const previous = state.author;
    select.innerHTML = `<option value="">\u5168\u90E8\u4F5C\u8005</option><option value="${escape(room.human.memberId)}">${escape(room.human.displayName)} \xB7 \u4EBA\u7C7B</option>${room.members.map((member) => `<option value="${escape(member.memberId)}">${escape(member.displayName)} \xB7 Agent</option>`).join("")}`;
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
      if (at < 0) {
        output += escaped.slice(cursor);
        break;
      }
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
    const question = message.questionId ? `<div class="question-card"><span class="pill">\u95EE\u9898 \xB7 ${escape(message.questionStatus || "pending")}</span>${message.options?.length ? `<ol class="options">${message.options.map((option) => `<li>${escape(option)}</li>`).join("")}</ol>` : ""}${message.answerMessageId ? `<button class="button ghost" data-action="open-message" data-message="${escape(message.answerMessageId)}">\u6253\u5F00\u7B54\u6848</button>` : ""}</div>` : "";
    const quote = message.replyTo ? `<div class="quote" data-action="open-message" data-message="${escape(message.replyTo.messageId)}" ${message.replyTo.full ? `data-full-message-id="${escape(message.replyTo.messageId)}"` : ""}><div class="quote-label">${escape(message.replyTo.label)}</div><div class="quote-text">${renderText(message.replyTo.text || "\u539F\u5E16\u4E0D\u53EF\u7528\u6216\u5DF2\u5220\u9664\u3002")}</div></div>` : "";
    const mentions = message.mentions?.length || message.mentionAll ? `<span class="mentions">${message.mentionAll ? `<span class="mention">@\u6240\u6709\u4EBA</span>` : ""}${(message.mentions || []).map((member) => `<span class="mention">@${escape(member.display_name)}</span>`).join("")}</span>` : "";
    return `<article class="message ${message.author.kind} ${own} ${anchor}" data-message-row="${escape(message.messageId)}">
    <div class="avatar">${escape(message.author.displayName.slice(0, 1))}</div>
    <div class="message-body">
      <div class="message-meta"><span class="message-author">${escape(message.author.displayName)} \xB7 ${message.author.kind === "agent" ? "Agent" : "\u4EBA\u7C7B"}${message.isOwn ? " \xB7 \u4F60" : ""}</span><span class="message-seq">#${message.roomSeq}</span><span class="message-time">${escape(time(message.createdAt))}</span>${mentions}</div>
      <div class="message-text" ${message.full ? `data-full-message-id="${escape(message.messageId)}"` : ""}>${renderText(message.text)}</div>
      ${message.preview ? `<div class="composer-hint">\u9884\u89C8 \xB7 \u6253\u5F00\u5168\u6587\u540E\u624D\u8BB0\u5DF2\u8BFB</div>` : ""}
      ${quote}${question}
      <div class="message-actions"><button data-action="reply" data-message="${escape(message.messageId)}">\u5F15\u7528\u56DE\u590D</button><button data-action="open-message" data-message="${escape(message.messageId)}">\u5B9A\u4F4D</button><button data-action="receipts" data-message="${escape(message.messageId)}">\u5DF2\u8BFB\u8BE6\u60C5</button><button data-action="copy-locator" data-message="${escape(message.messageId)}" data-seq="${message.roomSeq}">\u590D\u5236\u5B9A\u4F4D</button></div>
    </div>
  </article>`;
  }
  function renderTimeline() {
    const el2 = $("#timeline");
    const oldHeight = el2.scrollHeight;
    const oldTop = el2.scrollTop;
    el2.innerHTML = state.timeline.length ? state.timeline.map(renderMessage).join("") : `<div class="empty">${state.chatAnchor ? "\u8FD9\u4E2A\u6D88\u606F\u4E0D\u53EF\u7528\u3002" : "\u8FD8\u6CA1\u6709\u6D88\u606F\u3002\u5168\u90E8\u4F1A\u8BDD\u5C31\u7EEA\u540E\uFF0C\u53D1\u51FA\u7B2C\u4E00\u6761\u8BAE\u9898\u3002"}</div>`;
    if (state.chatAnchor) {
      const target = el2.querySelector(`[data-message-row="${CSS.escape(state.chatAnchor)}"]`);
      target?.scrollIntoView({ block: "center" });
    } else if (state.followLatest) el2.scrollTop = el2.scrollHeight;
    else el2.scrollTop = oldTop + (el2.scrollHeight - oldHeight);
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
    const ready = (room?.status === "ready" || room?.status === "paused") && room.members.every((member) => member.creationStatus === "ready");
    if (state.composerRoomId !== state.roomId) {
      state.composerRoomId = state.roomId;
      if (!state.composerDraftRestored) state.composerDraft = room?.preset === "debate" && !room.startedAt ? room.title : "";
      state.composerDraftRestored = false;
    }
    const composer = $("#composer");
    composer.innerHTML = `
    <div class="composer-chips" id="composer-chips"></div>
    <textarea id="composer-text" placeholder="${ready ? "\u8BF4\u70B9\u4EC0\u4E48\uFF1B\u8F93\u5165 @ \u9009\u62E9\u6210\u5458\u624D\u4F1A\u771F\u6B63\u70B9\u540D" : "\u4F1A\u8BDD\u5168\u90E8\u5C31\u7EEA\u540E\u624D\u80FD\u53D1\u9001"}" maxlength="60000" ${ready ? "" : "disabled"}>${escape(state.composerDraft)}</textarea>
    <div class="composer-bottom"><button id="mention-button" class="button ghost" ${ready ? "" : "disabled"}>@ \u70B9\u540D</button><span id="width-hint" class="composer-hint"></span><span class="spacer"></span><button id="send-button" class="button primary" ${ready ? "" : "disabled"}>${room?.startedAt ? "\u53D1\u9001" : "\u5F00\u59CB\u8BA8\u8BBA"}</button></div>
  `;
    renderComposerChips();
    $("#composer-text").addEventListener("input", onComposerInput);
    $("#composer-text").addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendMessage();
    });
    $("#mention-button").addEventListener("click", () => showMentionMenu(""));
    $("#send-button").addEventListener("click", sendMessage);
  }
  function renderComposerChips() {
    const chips = $("#composer-chips");
    if (!chips) return;
    chips.innerHTML = `${state.replyTo ? `<span class="mention">\u5F15\u7528 #${state.replyTo.roomSeq}<button data-action="remove-reply" style="border:0;background:transparent;color:inherit">\xD7</button></span>` : ""}${[...state.mentions].map((id) => `<span class="mention">@${escape(state.room.members.find((member) => member.memberId === id)?.displayName || id)}<button data-action="remove-mention" data-member="${escape(id)}" style="border:0;background:transparent;color:inherit">\xD7</button></span>`).join("")}${state.mentionAll ? `<span class="mention">@\u6240\u6709\u4EBA<button data-action="remove-all" style="border:0;background:transparent;color:inherit">\xD7</button></span>` : ""}`;
  }
  function onComposerInput() {
    const text = $("#composer-text").value;
    state.composerDraft = text;
    persistViewSoon();
    $("#width-hint").textContent = `${text.length} \u5B57\u7B26`;
    const match = text.match(/@([^@\s]*)$/);
    if (match) showMentionMenu(match[1]);
    else hideMentionMenu();
  }
  function showMentionMenu(query) {
    hideMentionMenu();
    if (!state.room) return;
    const items = [
      ...state.room.members.map((member) => ({ id: member.memberId, label: member.displayName, kind: "agent" })),
      { id: "@all", label: "\u6240\u6709\u4EBA", kind: "all" }
    ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
    if (!items.length) return;
    const menu = document.createElement("div");
    menu.id = "mention-menu";
    menu.className = "mention-menu";
    menu.innerHTML = items.map((item) => `<button data-action="pick-mention" data-member="${escape(item.id)}">@${escape(item.label)} <span class="composer-hint">${item.kind === "all" ? "\u7D27\u6025\u901A\u77E5\u5176\u4ED6\u5168\u5458" : "Agent"}</span></button>`).join("");
    document.body.append(menu);
    const rect = $("#composer-text").getBoundingClientRect();
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 250)}px`;
    menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 220)}px`;
  }
  function hideMentionMenu() {
    $("#mention-menu")?.remove();
  }
  async function sendMessage() {
    const textarea = $("#composer-text");
    const text = textarea.value.trim();
    if (!text || !state.roomId) return;
    try {
      await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/messages`, { text, replyToMessageId: state.replyTo?.messageId, mentionMemberIds: [...state.mentions], mentionAll: state.mentionAll });
      textarea.value = "";
      state.composerDraft = "";
      state.replyTo = null;
      state.mentions.clear();
      state.mentionAll = false;
      renderComposerChips();
      state.chatAnchor = null;
      state.followLatest = true;
      await Promise.all([refreshRoom(), loadTimeline(true), loadQuestions()]);
    } catch (error) {
      showError(error);
    }
  }
  async function loadQuestions(append = false) {
    if (!state.roomId) return;
    const data = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/questions`, null, { status: state.questionStatus, limit: 50, cursor: append ? state.questionCursor : null });
    const signature = JSON.stringify(data.items);
    if (!append && signature === state.questionFirstSignature) return;
    if (append) {
      const known = new Set(state.questions.map((question) => question.questionId));
      state.questions.push(...data.items.filter((question) => !known.has(question.questionId)));
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
    list.innerHTML = (state.questions.length ? state.questions.map((question) => {
      const selected = question.questionId === state.selectedQuestionId;
      const draft = state.answerDrafts[question.questionId] || { answer: question.options?.[0] || "", note: "" };
      return `<article class="question-item ${selected ? "selected" : ""}" data-action="select-question" data-question="${escape(question.questionId)}" data-message="${escape(question.messageId)}">
      <div class="q-meta">#${question.roomSeq} \xB7 ${escape(question.asker.displayName)} \xB7 ${escape(time(question.createdAt))}</div>
      <div class="q-text">${escape(question.text)}</div>
      ${question.options?.length ? `<ol class="options">${question.options.map((option) => `<li>${escape(option)}</li>`).join("")}</ol>` : ""}
      ${question.status === "answered" ? `<button class="button ghost" data-action="open-message" data-message="${escape(question.answerMessageId)}">\u6253\u5F00\u7B54\u6848</button>` : ""}
      ${question.status === "withdrawn" ? `<div class="q-meta">\u5DF2\u64A4\u56DE${question.withdrawNote ? `\uFF1A${escape(question.withdrawNote)}` : ""}</div>` : ""}
      ${selected && question.status === "pending" ? `<form class="answer-form" data-question-form="${escape(question.questionId)}">
        ${question.options?.length ? `<select data-answer-field="answer">${question.options.map((option) => `<option ${draft.answer === option ? "selected" : ""}>${escape(option)}</option>`).join("")}</select>` : `<textarea data-answer-field="answer" placeholder="\u6B63\u5F0F\u56DE\u7B54" maxlength="60000">${escape(draft.answer)}</textarea>`}
        <textarea data-answer-field="note" placeholder="\u8865\u5145\u8BF4\u660E\uFF08\u53EF\u9009\uFF09" maxlength="60000">${escape(draft.note)}</textarea>
        <div><button class="button primary" type="submit">\u56DE\u7B54\u5E76\u5E7F\u64AD</button><button class="button ghost danger" type="button" data-action="withdraw-question" data-question="${escape(question.questionId)}">\u64A4\u56DE\u95EE\u9898</button></div>
      </form>` : ""}
    </article>`;
    }).join("") : `<div class="empty">\u5F53\u524D\u7B5B\u9009\u4E0B\u6CA1\u6709\u95EE\u9898\u3002</div>`) + (state.questionCursor ? `<button class="button secondary" data-action="more-questions" style="width:100%;margin-top:8px">\u52A0\u8F7D\u540E\u9762\u7684\u95EE\u9898</button>` : "");
    list.scrollTop = oldTop;
  }
  async function selectQuestion(questionId, messageId) {
    state.selectedQuestionId = questionId;
    state.chatAnchor = messageId;
    state.mobilePane = "chat";
    $("#room-view").dataset.mobilePane = "chat";
    document.querySelectorAll(".mobile-tabs button").forEach((button2) => button2.classList.toggle("active", button2.dataset.pane === "chat"));
    renderQuestions();
    await loadTimeline(false, null, messageId);
    persistView();
  }
  async function submitAnswer(form) {
    const questionId = form.dataset.questionForm;
    const answer = form.querySelector('[data-answer-field="answer"]')?.value || "";
    const note = form.querySelector('[data-answer-field="note"]')?.value || "";
    if (!answer.trim()) return showError(new Error("\u8BF7\u5148\u586B\u5199\u6B63\u5F0F\u7B54\u6848\u3002"));
    try {
      await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/questions/${encodeURIComponent(questionId)}/answer`, { answer, note });
      delete state.answerDrafts[questionId];
      state.questionSignature = "";
      state.questionFirstSignature = "";
      state.questionCursor = null;
      await Promise.all([refreshRoom(), loadQuestions(), state.chatAnchor ? loadTimeline(false, null, state.chatAnchor) : loadTimeline(true)]);
      toast("\u7B54\u6848\u5DF2\u5199\u5165\u623F\u95F4\u5E76\u5E7F\u64AD\u3002", "success");
    } catch (error) {
      showError(error);
      if (error.code === "ROOM_QUESTION_CONFLICT") {
        state.questionSignature = "";
        state.questionFirstSignature = "";
        state.questionCursor = null;
        await Promise.all([refreshRoom(), loadQuestions()]);
      }
    }
  }
  async function openMessage(messageId) {
    state.chatAnchor = messageId;
    await loadTimeline(false, null, messageId);
    persistView();
  }
  function showModal(title, content) {
    $("#modal-content").innerHTML = `<h2>${escape(title)}</h2>${content}<div class="modal-actions"><button class="button secondary" data-action="close-modal">\u5173\u95ED</button></div>`;
    $("#modal").showModal();
  }
  async function openFile(path) {
    try {
      const file = await request("POST", "/workspace/read", { roomId: state.roomId, path });
      showModal(file.path, `<pre>${escape(file.content)}</pre>`);
    } catch (error) {
      showError(error);
    }
  }
  async function showReceipts(messageId) {
    const receipts = await request("GET", `/rooms/${encodeURIComponent(state.roomId)}/messages/${encodeURIComponent(messageId)}/receipts`);
    showModal("\u5DF2\u8BFB\u8BE6\u60C5", `<p>\u4EBA\u7C7B\uFF1A${receipts.human ? `${escape(receipts.human.displayName)} \xB7 ${escape(time(receipts.human.readAt))}` : "\u672A\u8BFB"}</p><p>Agent\uFF1A</p><ul>${receipts.agents.length ? receipts.agents.map((item) => `<li>${escape(item.displayName)} \xB7 ${escape(time(item.readAt))} \xB7 ${escape(item.source)}</li>`).join("") : "<li>\u6682\u65E0</li>"}</ul>`);
  }
  var readObserver;
  var readBatchTimer;
  var visibleMessages = /* @__PURE__ */ new Set();
  var sentReads = /* @__PURE__ */ new Set();
  function observeReads() {
    readObserver?.disconnect();
    clearTimeout(readBatchTimer);
    visibleMessages.clear();
    readObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.fullMessageId;
        if (!id) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visibleMessages.add(id);
        else visibleMessages.delete(id);
      }
      if (!visibleMessages.size && readBatchTimer) {
        clearTimeout(readBatchTimer);
        readBatchTimer = null;
      }
      if (visibleMessages.size && !readBatchTimer) readBatchTimer = setTimeout(async () => {
        readBatchTimer = null;
        const ids = [...visibleMessages].filter((id) => !sentReads.has(id));
        if (!ids.length || !state.roomId) return;
        for (const id of ids) sentReads.add(id);
        try {
          await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/read`, { messageIds: ids });
        } catch {
          for (const id of ids) sentReads.delete(id);
        }
      }, 500);
    }, { threshold: [0.5] });
    document.querySelectorAll("#timeline [data-full-message-id]").forEach((el2) => readObserver.observe(el2));
  }
  app.addEventListener("click", async (event) => {
    const button2 = event.target.closest("[data-action]");
    if (!button2) return;
    const action = button2.dataset.action;
    if (action === "select-question" && event.target.closest("form,button,select,textarea,input")) return;
    if (action === "cancel-create") {
      if (state.rooms[0]) {
        hideCreate();
        await selectRoom(state.rooms[0].roomId);
      } else showCreate();
      return;
    }
    if (action === "add-agent" && state.createAgents.length < 8) {
      const index = state.createAgents.length;
      state.createAgents.push({ role: "generic", displayName: "", modelKey: modelKey(state.models[0]), autoName: true });
      state.createAgents[index].displayName = defaultName("generic", index, state.createAgents);
      renderCreate();
      return;
    }
    if (action === "remove-agent") {
      state.createAgents.splice(Number(button2.closest("[data-agent]").dataset.agent), 1);
      renderCreate();
      return;
    }
    if (action === "create-room") {
      try {
        clearError();
        const members = state.createAgents.map((row) => {
          const model = state.models.find((item) => modelKey(item) === row.modelKey);
          if (!model) throw new Error("\u8BF7\u4E3A\u6BCF\u4E2A\u6210\u5458\u9009\u62E9\u6709\u6548\u6A21\u578B\u3002");
          return { role: row.role, displayName: row.displayName.trim(), model };
        });
        const room = await request("POST", "/rooms", { projectDir: state.directory, title: $("#create-title").value, preset: $("#create-preset").value, humanName: $("#create-human").value, members });
        state.creating = false;
        await loadRooms(room.roomId);
        toast("\u623F\u95F4\u5DF2\u521B\u5EFA\uFF0C\u6B63\u5728\u51C6\u5907\u72EC\u7ACB\u4F1A\u8BDD\u3002", "success");
      } catch (error) {
        showError(error);
      }
      return;
    }
    if (action === "pause" || action === "resume" || action === "retry" || action === "end") {
      try {
        if (action === "end" && !confirm("\u7ED3\u675F\u623F\u95F4\uFF1F\u4F1A\u505C\u6B62\u540E\u7EED\u81EA\u52A8\u5524\u9192\u5E76\u79FB\u9664\u672C\u6269\u5C55\u6DFB\u52A0\u7684\u4F1A\u8BDD\u6307\u4EE4\uFF0C\u4F46\u4FDD\u7559\u8BA8\u8BBA\u8BB0\u5F55\u548C\u4F1A\u8BDD\u3002")) return;
        await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/${action}`, action === "resume" ? { budgetLimit: state.room?.budget.limit || 50 } : void 0);
        await refreshRoom();
        if (action === "resume") await loadTimeline(true);
        if (action === "end") renderComposer();
      } catch (error) {
        showError(error);
      }
      return;
    }
    if (action === "open-session") {
      persistView();
      await host.openSession(button2.dataset.session);
      return;
    }
    if (action === "reply") {
      const message = state.timeline.find((item) => item.messageId === button2.dataset.message);
      state.replyTo = message;
      renderComposerChips();
      $("#composer-text")?.focus();
      return;
    }
    if (action === "remove-reply") {
      state.replyTo = null;
      renderComposerChips();
      return;
    }
    if (action === "remove-mention") {
      state.mentions.delete(button2.dataset.member);
      renderComposerChips();
      return;
    }
    if (action === "remove-all") {
      state.mentionAll = false;
      renderComposerChips();
      return;
    }
    if (action === "pick-mention") {
      const textarea = $("#composer-text");
      textarea.value = textarea.value.replace(/@([^@\s]*)$/, "");
      state.composerDraft = textarea.value;
      if (button2.dataset.member === "@all") state.mentionAll = true;
      else state.mentions.add(button2.dataset.member);
      hideMentionMenu();
      renderComposerChips();
      textarea.focus();
      return;
    }
    if (action === "open-message") {
      event.stopPropagation();
      await openMessage(button2.dataset.message);
      return;
    }
    if (action === "select-question") {
      await selectQuestion(button2.dataset.question, button2.dataset.message);
      return;
    }
    if (action === "receipts") {
      await showReceipts(button2.dataset.message);
      return;
    }
    if (action === "copy-locator") {
      await host.writeClipboard(`\u8BA8\u8BBA\u5BA4 ${state.room.title} \xB7 #${button2.dataset.seq} \xB7 ${button2.dataset.message}`);
      toast("\u5DF2\u590D\u5236\u7A33\u5B9A\u5B9A\u4F4D\u4FE1\u606F\u3002", "success");
      return;
    }
    if (action === "open-file") {
      await openFile(button2.dataset.path);
      return;
    }
    if (action === "more-questions") {
      await loadQuestions(true);
      return;
    }
    if (action === "withdraw-question") {
      const note = prompt("\u64A4\u56DE\u8BF4\u660E\uFF08\u53EF\u7559\u7A7A\uFF09", "");
      if (note == null) return;
      try {
        await request("POST", `/rooms/${encodeURIComponent(state.roomId)}/questions/${encodeURIComponent(button2.dataset.question)}/withdraw`, { note });
        state.questionSignature = "";
        state.questionFirstSignature = "";
        state.questionCursor = null;
        await loadQuestions();
      } catch (error) {
        showError(error);
        if (error.code === "ROOM_QUESTION_CONFLICT") {
          state.questionSignature = "";
          state.questionFirstSignature = "";
          state.questionCursor = null;
          await Promise.all([refreshRoom(), loadQuestions()]);
        }
      }
      return;
    }
    if (action === "close-modal") {
      $("#modal").close();
    }
  });
  app.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.id === "create-preset") {
      state.createPreset = target.value;
      state.createTitle = target.value === "debate" ? "\u547D\u4EE4\u884C\u8BF7\u6C42\u8D85\u65F6\uFF1A\u5E94\u9ED8\u8BA4\u91CD\u8BD5\u5417\uFF1F" : "\u65B0\u7684\u8BA8\u8BBA\u5BA4";
      renderCreate();
      return;
    }
    const field2 = target.dataset.field;
    const row = target.closest("[data-agent]");
    if (row && field2) {
      const index = Number(row.dataset.agent);
      const item = state.createAgents[index];
      if (field2 === "role") {
        const oldDefault = defaultName(item.role, index, state.createAgents);
        item.role = target.value;
        if (item.autoName || !item.displayName || item.displayName === oldDefault) {
          item.displayName = defaultName(item.role, index, state.createAgents);
          item.autoName = true;
        }
      } else if (field2 === "model") item.modelKey = target.value;
      else {
        item.displayName = target.value;
        item.autoName = false;
      }
      if (field2 !== "displayName") renderCreate();
      return;
    }
    if (target.id === "question-status") {
      state.questionStatus = target.value;
      state.selectedQuestionId = null;
      state.questionSignature = "";
      state.questionFirstSignature = "";
      state.questionCursor = null;
      await loadQuestions();
    }
  });
  app.addEventListener("input", (event) => {
    if (event.target.id === "create-title") state.createTitle = event.target.value;
    if (event.target.id === "create-human") state.createHumanName = event.target.value;
    const field2 = event.target.dataset.answerField;
    if (field2) {
      const form = event.target.closest("[data-question-form]");
      const draft = state.answerDrafts[form.dataset.questionForm] ||= { answer: "", note: "" };
      draft[field2] = event.target.value;
    }
  });
  app.addEventListener("submit", (event) => {
    if (event.target.matches("[data-question-form]")) {
      event.preventDefault();
      submitAnswer(event.target);
    }
  });
  $("#new-room").addEventListener("click", () => state.creating ? (hideCreate(), state.rooms[0] && selectRoom(state.rooms[0].roomId)) : (resetCreateAgents(), showCreate()));
  $("#room-select").addEventListener("change", (event) => event.target.value && selectRoom(event.target.value));
  $("#question-status").addEventListener("change", () => {
  });
  $("#history-search").addEventListener("change", async () => {
    state.search = $("#history-search").value.trim();
    state.chatAnchor = null;
    state.followLatest = true;
    await loadTimeline(true);
  });
  $("#author-filter").addEventListener("change", async () => {
    state.author = $("#author-filter").value;
    state.chatAnchor = null;
    state.followLatest = true;
    await loadTimeline(true);
  });
  $("#older-button").addEventListener("click", async () => {
    if (state.timelineCursor) {
      state.followLatest = false;
      await loadTimeline(false, state.timelineCursor);
    }
  });
  $("#latest-button").addEventListener("click", async () => {
    state.chatAnchor = null;
    state.search = "";
    state.author = "";
    $("#history-search").value = "";
    renderAuthorFilter();
    state.followLatest = true;
    await loadTimeline(true);
  });
  $("#timeline").addEventListener("scroll", () => {
    state.chatScroll = $("#timeline").scrollTop;
    if (!state.chatAnchor) state.followLatest = $("#timeline").scrollHeight - $("#timeline").scrollTop - $("#timeline").clientHeight < 100;
    persistViewSoon();
  });
  $("#question-list").addEventListener("scroll", () => {
    state.questionScroll = $("#question-list").scrollTop;
    persistViewSoon();
  });
  $("#modal").addEventListener("click", (event) => {
    if (event.target === $("#modal")) $("#modal").close();
  });
  document.querySelectorAll(".mobile-tabs button").forEach((button2) => button2.addEventListener("click", () => {
    state.mobilePane = button2.dataset.pane;
    $("#room-view").dataset.mobilePane = state.mobilePane;
    document.querySelectorAll(".mobile-tabs button").forEach((item) => item.classList.toggle("active", item === button2));
    persistView();
  }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideMentionMenu();
  });
  var refreshTimer = 0;
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
      } catch {
      }
    }
    if (!state.roomId || state.creating) return;
    refreshTimer = setTimeout(async () => {
      try {
        await refreshRoom();
        if (!state.chatAnchor && state.followLatest) await loadTimeline();
        await loadQuestions();
      } catch (error) {
        showError(error);
      }
    }, 80);
  }
  host.onServiceEvent((event) => {
    if (event.topic === "room:changed") void refreshOpenRoom();
    if (event.topic === "models:changed") void refreshModels(true);
  });
  setInterval(() => void refreshOpenRoom(), 1800);
  var readyGeneration = 0;
  host.onReady(async (ctx) => {
    applyHostReady(ctx, document.documentElement);
    const generation = ++readyGeneration;
    if (ctx.directory !== state.directory) {
      state.directory = ctx.directory;
      state.roomId = null;
      state.rooms = [];
      if (ctx.directory) {
        try {
          const saved = await host.storage.get("discussion-view");
          if (saved?.roomId) {
            state.roomId = saved.roomId;
            state.pendingView = saved;
          }
          if (saved?.questionStatus) state.questionStatus = saved.questionStatus;
          if (saved?.mobilePane) state.mobilePane = saved.mobilePane;
          const [catalog, meta] = await Promise.all([
            request("GET", "/models", null, { directory: state.directory }),
            request("GET", "/meta")
          ]);
          state.createHumanName = meta.humanName || state.createHumanName;
          state.models = catalog.models;
          if (!state.createAgents.length) resetCreateAgents();
          await loadRooms();
        } catch (error) {
          showError(error);
        }
      }
    }
    if (generation !== readyGeneration) return;
  });
})();
