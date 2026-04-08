const STORAGE_KEY = "agentcanvas-ui-state-v7";
const BASE_SURFACE_WIDTH = 3200;
const BASE_SURFACE_HEIGHT = 2200;
const SURFACE_MARGIN = 360;

const FUNCTION_NODE_GROUPS = [
  {
    id: "entry",
    title: "起止节点",
    subtitle: "Start · End · Trigger",
    nodes: [
      {
        id: "start",
        name: "Start",
        short: "Workflow entry point",
        description: "Start the workflow with the initial brief or task statement.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#6fd3ff", soft: "rgba(111, 211, 255, 0.18)", border: "rgba(111, 211, 255, 0.38)" },
      },
      {
        id: "end",
        name: "End",
        short: "Workflow finalizer",
        description: "Collect the final result and mark the workflow as completed.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#8adbb7", soft: "rgba(138, 219, 183, 0.18)", border: "rgba(138, 219, 183, 0.38)" },
      },
      {
        id: "trigger",
        name: "Trigger",
        short: "Kick off downstream nodes",
        description: "Generate a trigger event or activation signal for the next step.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#9ba6ff", soft: "rgba(155, 166, 255, 0.16)", border: "rgba(155, 166, 255, 0.36)" },
      },
    ],
  },
  {
    id: "branching",
    title: "条件分支",
    subtitle: "Condition · Switch",
    nodes: [
      {
        id: "condition",
        name: "Condition",
        short: "Evaluate a branch condition",
        description: "Check whether the current context meets a branch condition.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#ffcf7a", soft: "rgba(255, 207, 122, 0.16)", border: "rgba(255, 207, 122, 0.38)" },
      },
      {
        id: "switch",
        name: "Switch",
        short: "Route to multiple cases",
        description: "Route downstream execution based on a selected branch case.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#ff9f72", soft: "rgba(255, 159, 114, 0.16)", border: "rgba(255, 159, 114, 0.36)" },
      },
    ],
  },
  {
    id: "parallel",
    title: "并行同步",
    subtitle: "Fork · Join",
    nodes: [
      {
        id: "fork",
        name: "Fork",
        short: "Fan out to parallel branches",
        description: "Duplicate upstream context into multiple parallel branches.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#7cf0b2", soft: "rgba(124, 240, 178, 0.18)", border: "rgba(124, 240, 178, 0.38)" },
      },
      {
        id: "join",
        name: "Join",
        short: "Wait and synchronize branches",
        description: "Synchronize multiple branches before sending a merged context forward.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#79d4ff", soft: "rgba(121, 212, 255, 0.16)", border: "rgba(121, 212, 255, 0.36)" },
      },
    ],
  },
  {
    id: "merging",
    title: "汇合节点",
    subtitle: "Merge",
    nodes: [
      {
        id: "merge",
        name: "Merge",
        short: "Combine multiple upstream outputs",
        description: "Merge multiple upstream results into one combined output.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#c59cff", soft: "rgba(197, 156, 255, 0.16)", border: "rgba(197, 156, 255, 0.38)" },
      },
    ],
  },
  {
    id: "recovery",
    title: "重试",
    subtitle: "Retry · Review Loop",
    nodes: [
      {
        id: "retry",
        name: "Retry",
        short: "Retry a failed execution step",
        description: "Re-run a failed step with preserved upstream context.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#ff8fb0", soft: "rgba(255, 143, 176, 0.16)", border: "rgba(255, 143, 176, 0.38)" },
      },
      {
        id: "review_loop",
        name: "Review Loop",
        short: "Reviewer feedback and rework loop",
        description: "Ask a reviewer agent for approval, then send feedback back to selected rework nodes until approved.",
        outputMode: "text",
        outputTargets: [],
        color: { accent: "#ffb57f", soft: "rgba(255, 181, 127, 0.16)", border: "rgba(255, 181, 127, 0.38)" },
      },
    ],
  },
];

const state = {
  agents: [],
  workspaces: [],
  logs: [],
  busMessages: [],
  selectedNodeId: null,
  workspaceId: null,
  workspaceName: "Untitled Workspace",
  workspaceDescription: "",
  workspaceFolderName: "",
  workspaceFolderPath: "",
  agentSettings: { agents: [] },
  nodes: [],
  activeRun: null,
  loading: false,
  running: false,
  runPollTimer: null,
  permissionPromptRunId: null,
  settingsModalOpen: false,
  workspaceModalOpen: false,
  leftPanelVisible: true,
  rightPanelVisible: true,
  statusStripVisible: true,
  miniMapVisible: true,
  libraryView: "agents",
  openFunctionGroupIds: ["entry"],
  editingAgentInstanceId: null,
  contextMenu: null,
  miniMapPosition: null,
  autosaveTimer: null,
};

const el = {
  settingsForm: document.getElementById("settings-form"),
  agentLibrary: document.getElementById("agent-library"),
  templateList: document.getElementById("template-list"),
  statusStrip: document.getElementById("status-strip"),
  canvasSurface: document.getElementById("canvas-surface"),
  canvasNodes: document.getElementById("canvas-nodes"),
  canvasLinks: document.getElementById("canvas-links"),
  panelLeft: document.getElementById("panel-left"),
  panelRight: document.getElementById("panel-right"),
  librarySwitch: document.getElementById("library-switch"),
  libraryTitle: document.getElementById("library-title"),
  libraryHelper: document.getElementById("library-helper"),
  nodeForm: document.getElementById("node-form"),
  logPanel: document.getElementById("log-panel"),
  clearLogBtn: document.getElementById("clear-log-btn"),
  toggleStatusStripBtn: document.getElementById("toggle-status-strip-btn"),
  toggleMinimapBtn: document.getElementById("toggle-minimap-btn"),
  hideMinimapBtn: document.getElementById("hide-minimap-btn"),
  runAllBtn: document.getElementById("run-all-btn"),
  stepBtn: document.getElementById("step-btn"),
  saveBtn: document.getElementById("save-btn"),
  resetBtn: document.getElementById("reset-btn"),
  newWorkspaceBtn: document.getElementById("new-workspace-btn"),
  addNodeBtn: document.getElementById("add-node-btn"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  agentSettingsBtn: document.getElementById("agent-settings-btn"),
  workspaceManagerBtn: document.getElementById("workspace-manager-btn"),
  newAgentBtn: document.getElementById("new-agent-btn"),
  statusCardTemplate: document.getElementById("status-card-template"),
  canvas: document.getElementById("canvas"),
  workspaceTabbar: document.getElementById("workspace-tabbar"),
  canvasMinimap: document.getElementById("canvas-minimap"),
  miniMapSurface: document.getElementById("mini-map-surface"),
  miniMapNodes: document.getElementById("mini-map-nodes"),
  miniMapViewport: document.getElementById("mini-map-viewport"),
  settingsModal: document.getElementById("settings-modal"),
  settingsBackdrop: document.getElementById("settings-backdrop"),
  closeSettingsBtn: document.getElementById("close-settings-btn"),
  workspaceModal: document.getElementById("workspace-modal"),
  workspaceBackdrop: document.getElementById("workspace-backdrop"),
  closeWorkspaceBtn: document.getElementById("close-workspace-btn"),
  contextMenu: document.getElementById("context-menu"),
  leftEdgeToggle: document.getElementById("left-edge-toggle"),
  rightEdgeToggle: document.getElementById("right-edge-toggle"),
  toggleLeftPanelBtn: document.getElementById("toggle-left-panel-btn"),
  toggleRightPanelBtn: document.getElementById("toggle-right-panel-btn"),
  leftResizer: document.getElementById("left-resizer"),
  rightResizer: document.getElementById("right-resizer"),
  bottomResizer: document.getElementById("bottom-resizer"),
};

function loadUiState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUiState() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      workspaceId: state.workspaceId,
      workspaceName: state.workspaceName,
      workspaceDescription: state.workspaceDescription,
      workspaceFolderName: state.workspaceFolderName,
      workspaceFolderPath: state.workspaceFolderPath,
      nodes: state.nodes,
      selectedNodeId: state.selectedNodeId,
      leftPanelVisible: state.leftPanelVisible,
      rightPanelVisible: state.rightPanelVisible,
      statusStripVisible: state.statusStripVisible,
      miniMapVisible: state.miniMapVisible,
      libraryView: state.libraryView,
      openFunctionGroupIds: state.openFunctionGroupIds,
      miniMapPosition: state.miniMapPosition,
      canvasScrollLeft: el.canvas?.scrollLeft || 0,
      canvasScrollTop: el.canvas?.scrollTop || 0,
      leftPanelWidth: document.documentElement.style.getPropertyValue("--left-panel-width"),
      rightPanelWidth: document.documentElement.style.getPropertyValue("--right-panel-width"),
      bottomDockHeight: document.documentElement.style.getPropertyValue("--bottom-dock-height"),
    }),
  );
}

function applyStoredPanelWidths() {
  const persisted = loadUiState();
  if (typeof persisted.leftPanelVisible === "boolean") {
    state.leftPanelVisible = persisted.leftPanelVisible;
  }
  if (typeof persisted.rightPanelVisible === "boolean") {
    state.rightPanelVisible = persisted.rightPanelVisible;
  }
  if (typeof persisted.statusStripVisible === "boolean") {
    state.statusStripVisible = persisted.statusStripVisible;
  }
  if (typeof persisted.miniMapVisible === "boolean") {
    state.miniMapVisible = persisted.miniMapVisible;
  }
  if (persisted.libraryView === "functions" || persisted.libraryView === "agents") {
    state.libraryView = persisted.libraryView;
  }
  if (Array.isArray(persisted.openFunctionGroupIds)) {
    const validGroupIds = persisted.openFunctionGroupIds.filter((groupId) => FUNCTION_NODE_GROUPS.some((group) => group.id === groupId));
    state.openFunctionGroupIds = validGroupIds.length ? validGroupIds : ["entry"];
  }
  if (persisted.miniMapPosition && Number.isFinite(persisted.miniMapPosition.x) && Number.isFinite(persisted.miniMapPosition.y)) {
    state.miniMapPosition = persisted.miniMapPosition;
  }
  if (persisted.leftPanelWidth) {
    document.documentElement.style.setProperty("--left-panel-width", persisted.leftPanelWidth);
  }
  if (persisted.rightPanelWidth) {
    document.documentElement.style.setProperty("--right-panel-width", persisted.rightPanelWidth);
  }
  if (persisted.bottomDockHeight) {
    document.documentElement.style.setProperty("--bottom-dock-height", persisted.bottomDockHeight);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clearRunPolling() {
  if (state.runPollTimer) {
    window.clearTimeout(state.runPollTimer);
    state.runPollTimer = null;
  }
}

function buildCurrentWorkspaceSnapshot() {
  return {
    id: state.workspaceId || null,
    name: state.workspaceName,
    description: state.workspaceDescription,
    folderName: state.workspaceFolderName,
    folderPath: state.workspaceFolderPath,
    nodes: state.nodes.map((node) => ({
      id: node.id,
      nodeKind: node.nodeKind,
      functionType: node.functionType,
      agentId: node.agentId,
      config: structuredClone(node.config || {}),
      title: node.title,
      description: node.description,
      dependsOn: [...(node.dependsOn || [])],
      status: node.status,
      output: node.output,
      outputMode: node.outputMode,
      outputTargets: [...(node.outputTargets || [])],
      x: node.x,
      y: node.y,
    })),
  };
}

function syncCurrentWorkspaceDraft() {
  if (!state.workspaceId) return;
  const snapshot = buildCurrentWorkspaceSnapshot();
  const index = state.workspaces.findIndex((workspace) => workspace.id === state.workspaceId);
  if (index >= 0) {
    state.workspaces[index] = { ...state.workspaces[index], ...snapshot };
  } else {
    state.workspaces.unshift(snapshot);
  }
}

function isWorkspacePermissionError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("eperm")
    || text.includes("eacces")
    || text.includes("cannot write output file")
    || text.includes("windows denied access")
    || text.includes("access denied");
}

function tauriInvoke(command, payload = {}) {
  return window.__TAURI__?.core?.invoke?.(command, payload) || null;
}

function isTauriRuntime() {
  return Boolean(window.__TAURI__?.core?.invoke);
}

async function apiGet(pathname) {
  const response = await fetch(pathname);
  if (!response.ok) throw new Error(`${pathname} -> ${response.status}`);
  return response.json();
}

async function apiSend(pathname, method, payload) {
  const response = await fetch(pathname, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error((await response.text()) || `${pathname} -> ${response.status}`);
  return response.json();
}

async function clearCollaborationMessages() {
  await apiSend("/api/bus/messages", "DELETE", {});
  state.busMessages = [];
  state.logs = [];
}

function appendLog(title, message) {
  state.logs.push({ title, message, createdAt: new Date().toISOString() });
}

function syncLogsFromBus(messages) {
  state.busMessages = messages || [];
  state.logs = (messages || []).map((message) => ({
    title: `${message.from} -> ${message.to}`,
    message: message.content,
    createdAt: message.createdAt,
  }));
}

function cryptoRandom() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferWorkspaceNameFromPath(folderPath) {
  const normalized = String(folderPath || "").replace(/[\\/]+$/, "");
  const name = normalized.split(/[\\/]/).filter(Boolean).pop();
  return name || nextWorkspaceName();
}

function defaultPosition(index) {
  return {
    x: Math.round(BASE_SURFACE_WIDTH / 2 - 320 + (index % 3) * 270),
    y: Math.round(BASE_SURFACE_HEIGHT / 2 - 180 + Math.floor(index / 3) * 190),
  };
}

function getFunctionGroup(groupId) {
  return FUNCTION_NODE_GROUPS.find((group) => group.id === groupId) || null;
}

function getFunctionTemplate(functionType) {
  for (const group of FUNCTION_NODE_GROUPS) {
    const template = group.nodes.find((item) => item.id === functionType);
    if (template) {
      return { ...template, groupId: group.id, groupTitle: group.title };
    }
  }
  return null;
}

function getDefaultFunctionType() {
  const activeGroup = getFunctionGroup(state.openFunctionGroupIds[0]);
  if (activeGroup?.nodes?.length) {
    return activeGroup.nodes[0].id;
  }
  return FUNCTION_NODE_GROUPS[0]?.nodes?.[0]?.id || "start";
}

function normalizeIdArray(input) {
  return Array.isArray(input)
    ? input.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function defaultFunctionConfig(functionType) {
  switch (String(functionType || "start")) {
    case "trigger":
      return { delayMs: 0, targetIds: [] };
    case "condition":
      return {
        sourceMode: "upstreamSummary",
        matchType: "contains",
        matchValue: "",
        trueTargetIds: [],
        falseTargetIds: [],
      };
    case "switch":
      return {
        sourceMode: "upstreamSummary",
        caseRules: "",
        defaultTargetIds: [],
      };
    case "fork":
      return { targetIds: [] };
    case "join":
      return { joinMode: "all" };
    case "merge":
      return { mergeMode: "sections" };
    case "retry":
      return { targetNodeId: "", maxAttempts: 1 };
    case "review_loop":
      return {
        sourceMode: "upstreamSummary",
        reviewerNodeId: "",
        matchType: "contains",
        matchValue: "decision: approved",
        maxRounds: 2,
        reworkTargetIds: [],
        approvedTargetIds: [],
      };
    default:
      return {};
  }
}

function scheduleWorkspaceAutosave() {
  if (!state.workspaceId) return;
  if (state.autosaveTimer) {
    window.clearTimeout(state.autosaveTimer);
  }
  state.autosaveTimer = window.setTimeout(async () => {
    state.autosaveTimer = null;
    try {
      await saveWorkspaceToBackend({ silent: true });
    } catch (error) {
      appendLog("Auto Save Failed", error.message || String(error));
      renderAll();
    }
  }, 700);
}

function persistWorkspaceDraft(options = {}) {
  const { autosave = true } = options;
  syncCurrentWorkspaceDraft();
  saveUiState();
  if (autosave) {
    scheduleWorkspaceAutosave();
  }
}

function normalizeFunctionConfig(functionType, config = {}) {
  const base = defaultFunctionConfig(functionType);
  const sourceMode = ["upstreamSummary", "upstreamText", "latestUpstream"].includes(config.sourceMode) ? config.sourceMode : base.sourceMode;
  const matchType = ["contains", "equals", "regex", "exists"].includes(config.matchType) ? config.matchType : base.matchType;
  const joinMode = ["all"].includes(config.joinMode) ? config.joinMode : base.joinMode;
  const mergeMode = ["sections", "bullets", "paragraph"].includes(config.mergeMode) ? config.mergeMode : base.mergeMode;

  switch (String(functionType || "start")) {
    case "trigger":
      return {
        delayMs: Number.isFinite(Number(config.delayMs)) ? Math.max(0, Number(config.delayMs)) : 0,
        targetIds: normalizeIdArray(config.targetIds),
      };
    case "condition":
      return {
        sourceMode,
        matchType,
        matchValue: String(config.matchValue || "").trim(),
        evaluatorNodeId: String(config.evaluatorNodeId || "").trim(),
        trueTargetIds: normalizeIdArray(config.trueTargetIds),
        falseTargetIds: normalizeIdArray(config.falseTargetIds),
      };
    case "switch":
      return {
        sourceMode,
        caseRules: String(config.caseRules || "").trim(),
        defaultTargetIds: normalizeIdArray(config.defaultTargetIds),
      };
    case "fork":
      return {
        targetIds: normalizeIdArray(config.targetIds),
      };
    case "join":
      return {
        joinMode,
      };
    case "merge":
      return {
        mergeMode,
      };
    case "retry":
      return {
        targetNodeId: String(config.targetNodeId || "").trim(),
        maxAttempts: Number.isFinite(Number(config.maxAttempts)) ? Math.min(5, Math.max(1, Number(config.maxAttempts))) : 1,
      };
    case "review_loop":
      return {
        sourceMode,
        reviewerNodeId: String(config.reviewerNodeId || "").trim(),
        matchType,
        matchValue: String(config.matchValue || "").trim(),
        maxRounds: Number.isFinite(Number(config.maxRounds)) ? Math.min(5, Math.max(1, Number(config.maxRounds))) : 2,
        reworkTargetIds: normalizeIdArray(config.reworkTargetIds),
        approvedTargetIds: normalizeIdArray(config.approvedTargetIds),
      };
    default:
      return {};
  }
}

function firstAgentId() {
  return state.agents[0]?.id || "";
}

function normalizeNode(node, index) {
  const pos = defaultPosition(index);
  const nodeKind = node.nodeKind === "function" ? "function" : "agent";
  const functionTemplate = getFunctionTemplate(node.functionType);
  return {
    id: node.id || `node_${cryptoRandom()}`,
    nodeKind,
    functionType: nodeKind === "function" ? (functionTemplate?.id || String(node.functionType || "start")) : "",
    agentId: nodeKind === "agent" ? (node.agentId || firstAgentId()) : "",
    title: node.title || functionTemplate?.name || `Node ${index + 1}`,
    description: node.description || "",
    dependsOn: Array.isArray(node.dependsOn) ? node.dependsOn : [],
    config: nodeKind === "function" ? normalizeFunctionConfig(functionTemplate?.id || node.functionType, node.config || {}) : {},
    status: node.status || "idle",
    output: node.output || "",
    outputMode: ["text", "file", "files"].includes(node.outputMode) ? node.outputMode : (functionTemplate?.outputMode || "text"),
    outputTargets: Array.isArray(node.outputTargets)
      ? node.outputTargets.map((item) => String(item)).filter(Boolean)
      : [...(functionTemplate?.outputTargets || [])],
    x: Number.isFinite(node.x) ? node.x : pos.x,
    y: Number.isFinite(node.y) ? node.y : pos.y,
  };
}

function normalizeNodes(nodes) {
  return (nodes || []).map(normalizeNode);
}

function getSelectedNode() {
  return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
}

function getAgent(agentId) {
  return state.agents.find((agent) => agent.id === agentId) || null;
}

function ensureWorkspaceState() {
  if (!state.workspaceName) {
    state.workspaceName = "Untitled Workspace";
  }
  if ((!state.workspaceFolderName || !state.workspaceFolderPath) && state.workspaceId) {
    const currentWorkspace = state.workspaces.find((workspace) => workspace.id === state.workspaceId);
    state.workspaceFolderName = currentWorkspace?.folderName || "";
    state.workspaceFolderPath = currentWorkspace?.folderPath || "";
  }
  if (!state.nodes.length) {
    state.selectedNodeId = null;
  } else if (!state.selectedNodeId || !state.nodes.find((node) => node.id === state.selectedNodeId)) {
    state.selectedNodeId = state.nodes[0].id;
  }
}

async function validateWorkspaceWriteAccess(folderPath) {
  return apiSend("/api/workspaces/validate-write", "POST", { folderPath });
}

async function promptForWritableWorkspaceFolder(errorMessage) {
  const confirmed = window.confirm(
    `${errorMessage}\n\nThe current workspace folder is not writable. Choose another folder and retry?`,
  );
  if (!confirmed) {
    return false;
  }

  if (!isTauriRuntime()) {
    appendLog("Writable Folder Needed", "Use the desktop build to pick a different folder automatically.");
    renderAll();
    return false;
  }

  try {
    const selectedPath = await tauriInvoke("pick_workspace_directory");
    if (!selectedPath) return false;

    state.workspaceFolderPath = String(selectedPath);
    state.workspaceFolderName = "";
    if (!state.workspaceName || state.workspaceName.startsWith("Untitled Workspace")) {
      state.workspaceName = inferWorkspaceNameFromPath(selectedPath);
    }

    const validation = await validateWorkspaceWriteAccess(state.workspaceFolderPath);
    if (!validation.ok) {
      appendLog("Folder Still Not Writable", validation.error || "The selected folder is still not writable.");
      renderAll();
      return false;
    }

    await saveWorkspaceToBackend({ silent: true });
    appendLog("Workspace Folder Updated", `Switched to writable folder ${state.workspaceFolderPath}`);
    renderAll();
    return true;
  } catch (error) {
    appendLog("Choose Folder Failed", error.message || String(error));
    renderAll();
    return false;
  }
}

async function ensureWorkspaceWritableForRun() {
  const requiresFileOutput = state.nodes.some((node) => node.outputMode === "file" || node.outputMode === "files");
  if (!requiresFileOutput) {
    return true;
  }

  await saveWorkspaceToBackend({ silent: true });
  const validation = await validateWorkspaceWriteAccess(state.workspaceFolderPath);
  if (validation.ok) {
    return true;
  }

  const fixed = await promptForWritableWorkspaceFolder(
    validation.error || `Cannot write to workspace folder "${state.workspaceFolderPath}"`,
  );
  if (!fixed) {
    return false;
  }

  const retryValidation = await validateWorkspaceWriteAccess(state.workspaceFolderPath);
  if (!retryValidation.ok) {
    appendLog("Workspace Not Writable", retryValidation.error || "The selected folder cannot be written.");
    renderAll();
    return false;
  }

  return true;
}

function statusLabel(status) {
  return { idle: "Not Started", running: "Running", done: "Done", blocked: "Blocked", skipped: "Skipped", ready: "Ready", disabled: "Disabled", "needs-config": "Needs Config" }[status] || "Unknown";
}

function markBlockedNodes() {
  const completed = new Set(state.activeRun?.outputs?.map((item) => item.nodeId) || []);
  state.nodes.forEach((node) => {
    if (completed.has(node.id)) return void (node.status = "done");
    if (state.activeRun?.nodeStates?.[node.id]?.status === "skipped") return void (node.status = "skipped");
    if (state.activeRun?.nodeStates?.[node.id]?.status === "running") return void (node.status = "running");
    node.status = (node.dependsOn || []).some((dep) => !completed.has(dep)) ? "blocked" : "idle";
  });
}

function hashColorSeed(value) {
  let hash = 0;
  const text = String(value || "agent");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 360;
  }
  return hash;
}

function agentTheme(agent) {
  const hue = hashColorSeed(agent?.instanceId || agent?.id || agent?.name || agent?.configuredId || "agent");
  return {
    hue,
    accent: `hsl(${hue} 86% 68%)`,
    soft: `hsla(${hue} 86% 68% / 0.16)`,
    border: `hsla(${hue} 86% 68% / 0.34)`,
  };
}

function nodeTheme(node) {
  if (node?.nodeKind === "function") {
    const template = getFunctionTemplate(node.functionType);
    if (template?.color) {
      return template.color;
    }
  }
  return agentTheme(getAgent(node?.agentId));
}

function createBlankAgent() {
  return { instanceId: `agent_${cryptoRandom()}`, configuredId: "", name: "", enabled: false, baseUrl: "", apiKey: "", model: "" };
}

function nextWorkspaceName() {
  const existingNames = new Set(
    [
      ...state.workspaces.map((workspace) => String(workspace.name || "").trim()),
      state.workspaceName,
    ].filter(Boolean),
  );

  if (!existingNames.has("Untitled Workspace")) {
    return "Untitled Workspace";
  }

  let index = 2;
  while (existingNames.has(`Untitled Workspace ${index}`)) {
    index += 1;
  }
  return `Untitled Workspace ${index}`;
}

async function createNewWorkspace() {
  if (isTauriRuntime()) {
    try {
      const selectedPath = await tauriInvoke("pick_workspace_directory");
      if (!selectedPath) return;

      state.workspaceId = null;
      state.workspaceName = inferWorkspaceNameFromPath(selectedPath);
      state.workspaceDescription = "";
      state.workspaceFolderName = "";
      state.workspaceFolderPath = String(selectedPath);
      state.nodes = [];
      state.selectedNodeId = null;
      state.activeRun = null;
      state.running = false;
      clearRunPolling();
      renderAll();
      window.requestAnimationFrame(centerCanvasViewport);

      await saveWorkspaceToBackend();
      appendLog("Workspace Created", `${state.workspaceName} is ready.`);
      renderAll();
      return;
    } catch (error) {
      appendLog("Create Workspace Failed", error.message || String(error));
      renderAll();
      return;
    }
  }

  state.workspaceId = null;
  state.workspaceName = nextWorkspaceName();
  state.workspaceDescription = "";
  state.workspaceFolderName = "";
  state.workspaceFolderPath = "";
  state.nodes = [];
  state.selectedNodeId = null;
  state.activeRun = null;
  state.running = false;
  clearRunPolling();
  renderAll();
  window.requestAnimationFrame(centerCanvasViewport);

  try {
    await saveWorkspaceToBackend();
    appendLog("Workspace Created", `${state.workspaceName} is ready.`);
    renderAll();
  } catch (error) {
    appendLog("Create Workspace Failed", error.message);
    saveUiState();
    renderAll();
  }
}

async function deleteWorkspace(workspaceId) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;

  const confirmed = window.confirm(`Delete workspace "${workspace.name}"?`);
  if (!confirmed) return;

  try {
    await apiSend(`/api/workspaces/${workspaceId}`, "DELETE", {});
    appendLog("Workspace Deleted", `${workspace.name} was removed from the list.`);
    await refreshWorkspaces();

    if (state.workspaceId === workspaceId) {
      const fallback = state.workspaces[0] || null;
      if (fallback) {
        setCurrentWorkspace(fallback);
      } else {
        state.workspaceId = null;
        state.workspaceName = "Untitled Workspace";
        state.workspaceDescription = "";
        state.workspaceFolderName = "";
        state.workspaceFolderPath = "";
        state.nodes = [];
        state.selectedNodeId = null;
        state.activeRun = null;
        state.running = false;
        clearRunPolling();
      }
    }

    saveUiState();
    renderAll();
  } catch (error) {
    appendLog("Delete Workspace Failed", error.message);
    renderAll();
  }
}

function setCurrentWorkspace(workspace) {
  state.workspaceId = workspace.id || null;
  state.workspaceName = workspace.name || "Untitled Workspace";
  state.workspaceDescription = workspace.description || "";
  state.workspaceFolderName = workspace.folderName || "";
  state.workspaceFolderPath = workspace.folderPath || "";
  state.nodes = normalizeNodes(workspace.nodes || []);
  state.activeRun = null;
  state.running = false;
  clearRunPolling();
  ensureWorkspaceState();
  saveUiState();
  renderAll();
  window.requestAnimationFrame(centerCanvasViewport);
}

async function switchWorkspace(workspaceId) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;

  if (state.workspaceId && state.workspaceId !== workspaceId) {
    try {
      await saveWorkspaceToBackend({ silent: true });
    } catch (error) {
      appendLog("Auto Save Failed", error.message);
    }
  }

  setCurrentWorkspace(workspace);
}

async function refreshSettings() {
  state.agentSettings = (await apiGet("/api/settings")).agentSettings || { agents: [] };
}

async function refreshAgents() {
  state.agents = (await apiGet("/api/agents/scan")).agents || [];
}

async function refreshWorkspaces() {
  state.workspaces = (await apiGet("/api/workspaces")).workspaces || [];
}

async function refreshBusMessages() {
  syncLogsFromBus((await apiGet("/api/bus/messages")).messages || []);
}

async function refreshRuns() {
  const activeRuns = (await apiGet("/api/runs")).activeRuns || [];
  state.activeRun = activeRuns.length ? activeRuns[activeRuns.length - 1] : null;
  state.running = state.activeRun?.status === "running";
}

async function pollRunStatus(runId) {
  clearRunPolling();
  try {
    const data = await apiGet(`/api/runs/${runId}`);
    state.activeRun = data.run;
    state.running = data.run.status === "running";
    state.nodes.forEach((node) => {
      const output = data.run.outputs?.find((item) => item.nodeId === node.id);
      if (output) node.output = output.content;
    });
    markBlockedNodes();
    await refreshBusMessages();
    renderAll();
    if (!state.running && data.run.status === "failed" && isWorkspacePermissionError(data.run.error) && state.permissionPromptRunId !== runId) {
      state.permissionPromptRunId = runId;
      const fixed = await promptForWritableWorkspaceFolder(data.run.error);
      if (fixed) {
        await runWorkspace();
        return;
      }
    }
    if (state.running) state.runPollTimer = window.setTimeout(() => pollRunStatus(runId), 1200);
  } catch (error) {
    appendLog("Run Poll Failed", error.message);
    state.running = false;
    renderAll();
  }
}

function saveSettingsLocal() {
  const cards = [...el.settingsForm.querySelectorAll("[data-agent-card]")];
  state.agentSettings.agents = cards.map((card, index) => ({
    instanceId: card.dataset.instanceId || `agent_${cryptoRandom()}`,
    configuredId: String(card.querySelector("[name='configuredId']").value || "").trim(),
    name: String(card.querySelector("[name='name']").value || "").trim(),
    enabled: card.querySelector("[name='enabled']").checked,
    baseUrl: String(card.querySelector("[name='baseUrl']").value || "").trim(),
    apiKey: String(card.querySelector("[name='apiKey']").value || "").trim(),
    model: String(card.querySelector("[name='model']").value || "").trim(),
    sortOrder: index,
  }));
}

function renderSettingsForm() {
  const agents = state.agentSettings.agents || [];
  el.settingsForm.innerHTML = `
    <div class="details-actions">
      <button type="button" id="add-agent-instance-btn" class="secondary">Add Agent Instance</button>
      <button type="submit" class="primary">Save API Config</button>
    </div>
    ${agents.length ? agents.map((agent, index) => `
      <details class="agent-instance-card ${state.editingAgentInstanceId === agent.instanceId ? "editing" : ""}" data-agent-card data-instance-id="${escapeHtml(agent.instanceId)}" ${(state.editingAgentInstanceId ? state.editingAgentInstanceId === agent.instanceId : index === 0) ? "open" : ""}>
        <summary>
          <div class="agent-instance-meta">
            <strong>${escapeHtml(agent.name || `Instance ${index + 1}`)}</strong>
            <span class="helper-text">${escapeHtml(agent.configuredId || agent.instanceId)}</span>
          </div>
          <span class="tag ${agent.enabled ? "" : "neutral"}">${agent.enabled ? "enabled" : "disabled"}</span>
        </summary>
        <div class="agent-instance-body">
          <div class="field-group"><label class="field-label">Enable</label><label class="checkbox-item"><input type="checkbox" name="enabled" ${agent.enabled ? "checked" : ""} /><span>Active for workspace runs</span></label></div>
          <div class="field-group"><label class="field-label">Agent ID</label><input name="configuredId" type="text" value="${escapeHtml(agent.configuredId)}" placeholder="openai_codex" /></div>
          <div class="field-group"><label class="field-label">Agent Name</label><input name="name" type="text" value="${escapeHtml(agent.name)}" placeholder="OpenAI Codex" /></div>
          <div class="field-group"><label class="field-label">Base URL</label><input name="baseUrl" type="text" value="${escapeHtml(agent.baseUrl)}" placeholder="https://api.openai.com/v1" /></div>
          <div class="field-group"><label class="field-label">API Key</label><input name="apiKey" type="password" value="${escapeHtml(agent.apiKey)}" placeholder="sk-..." /></div>
          <div class="field-group"><label class="field-label">Model</label><input name="model" type="text" value="${escapeHtml(agent.model)}" placeholder="gpt-5.4" /></div>
          <div class="details-actions"><button type="button" class="ghost" data-remove-agent="${escapeHtml(agent.instanceId)}">Remove</button></div>
        </div>
      </details>
    `).join("") : '<p class="empty">No agent instances configured yet.</p>'}
  `;

  document.getElementById("add-agent-instance-btn").addEventListener("click", () => {
    createNewAgentInstance();
  });

  el.settingsForm.querySelectorAll("[data-remove-agent]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeAgentInstance(button.dataset.removeAgent);
    });
  });

  el.settingsForm.onsubmit = async (event) => {
    event.preventDefault();
    saveSettingsLocal();
    try {
      const data = await apiSend("/api/settings", "POST", { agentSettings: state.agentSettings });
      state.agentSettings = data.agentSettings;
      await refreshAgents();
      state.nodes = state.nodes.map((node) => (getAgent(node.agentId) ? node : { ...node, agentId: firstAgentId() }));
      appendLog("API Config Saved", "Saved agent instances.");
      renderAll();
    } catch (error) {
      appendLog("Save API Config Failed", error.message);
      renderAll();
    }
  };
}

function openSettingsModal() {
  state.settingsModalOpen = true;
  renderAll();
}

function closeSettingsModal() {
  state.settingsModalOpen = false;
  state.editingAgentInstanceId = null;
  renderAll();
}

function openWorkspaceModal() {
  state.workspaceModalOpen = true;
  renderAll();
}

function closeWorkspaceModal() {
  state.workspaceModalOpen = false;
  renderAll();
}

function showRightPanel() {
  state.rightPanelVisible = true;
  saveUiState();
}

function toggleLeftPanel(force) {
  state.leftPanelVisible = typeof force === "boolean" ? force : !state.leftPanelVisible;
  saveUiState();
  renderAll();
}

function toggleRightPanel(force) {
  state.rightPanelVisible = typeof force === "boolean" ? force : !state.rightPanelVisible;
  saveUiState();
  renderAll();
}

function openContextMenu(x, y, items) {
  state.contextMenu = {
    x,
    y,
    items: items.filter(Boolean),
  };
  renderAll();
}

function closeContextMenu() {
  if (!state.contextMenu) return;
  state.contextMenu = null;
  renderAll();
}

function createNewAgentInstance() {
  state.agentSettings.agents.push(createBlankAgent());
  state.editingAgentInstanceId = state.agentSettings.agents.at(-1)?.instanceId || null;
  openSettingsModal();
}

function editAgentInstance(instanceId) {
  state.editingAgentInstanceId = instanceId;
  openSettingsModal();
}

async function removeAgentInstance(instanceId, options = {}) {
  const { skipConfirm = false } = options;
  const targetAgent = state.agentSettings.agents.find((agent) => agent.instanceId === instanceId)
    || state.agents.find((agent) => agent.id === instanceId);
  if (!targetAgent) return;

  const boundNodeIds = state.nodes.filter((node) => node.agentId === instanceId).map((node) => node.id);
  const confirmMessage = boundNodeIds.length
    ? `Delete agent "${targetAgent.name || targetAgent.configuredId || instanceId}" and remove ${boundNodeIds.length} canvas node(s)?`
    : `Delete agent "${targetAgent.name || targetAgent.configuredId || instanceId}"?`;

  if (!skipConfirm && !window.confirm(confirmMessage)) {
    return;
  }

  state.agentSettings.agents = state.agentSettings.agents.filter((agent) => agent.instanceId !== instanceId);
  if (state.editingAgentInstanceId === instanceId) {
    state.editingAgentInstanceId = null;
  }
  state.nodes = state.nodes
    .filter((node) => node.agentId !== instanceId)
    .map((node) => ({ ...node, dependsOn: node.dependsOn.filter((dep) => !boundNodeIds.includes(dep)) }));
  const affectedWorkspaceIds = [];
  state.workspaces = state.workspaces.map((workspace) => {
    const removedWorkspaceNodeIds = (workspace.nodes || [])
      .filter((node) => node.agentId === instanceId)
      .map((node) => node.id);
    if (!removedWorkspaceNodeIds.length) {
      return workspace;
    }
    affectedWorkspaceIds.push(workspace.id);
    return {
      ...workspace,
      nodes: (workspace.nodes || [])
        .filter((node) => node.agentId !== instanceId)
        .map((node) => ({
          ...node,
          dependsOn: (node.dependsOn || []).filter((dep) => !removedWorkspaceNodeIds.includes(dep)),
        })),
    };
  });

  ensureWorkspaceState();
  ensureCanvasExtent();
  syncCurrentWorkspaceDraft();
  saveUiState();

  try {
    const data = await apiSend("/api/settings", "POST", { agentSettings: state.agentSettings });
    state.agentSettings = data.agentSettings;
    if (affectedWorkspaceIds.length) {
      await Promise.all(
        state.workspaces
          .filter((workspace) => affectedWorkspaceIds.includes(workspace.id))
          .map((workspace) => apiSend("/api/workspaces", "POST", {
            id: workspace.id || undefined,
            name: workspace.name,
            description: workspace.description,
            folderPath: workspace.folderPath || undefined,
            folderName: workspace.folderPath ? undefined : workspace.folderName || undefined,
            nodes: workspace.nodes || [],
          })),
      );
    }
    await refreshAgents();
    if (state.workspaceId && !affectedWorkspaceIds.includes(state.workspaceId)) {
      await saveWorkspaceToBackend({ silent: true });
    } else {
      await refreshWorkspaces();
    }
    appendLog("Agent Deleted", `${targetAgent.name || targetAgent.configuredId || instanceId} was removed.`);
  } catch (error) {
    appendLog("Delete Agent Failed", error.message || String(error));
  }

  closeContextMenu();
  renderAll();
}

function renderLibrarySwitch() {
  if (!el.librarySwitch) return;
  el.librarySwitch.querySelectorAll("[data-library-view]").forEach((button) => {
    const isActive = button.dataset.libraryView === state.libraryView;
    button.classList.toggle("active", isActive);
  });
  if (el.libraryTitle) {
    el.libraryTitle.textContent = state.libraryView === "functions" ? "功能节点" : "Agents";
  }
  if (el.libraryHelper) {
    el.libraryHelper.textContent = state.libraryView === "functions" ? "点击大类后拖拽小节点" : "Drag agents to canvas";
  }
  if (el.newAgentBtn) {
    el.newAgentBtn.hidden = state.libraryView !== "agents";
  }
  if (el.addNodeBtn) {
    const isFunctionView = state.libraryView === "functions";
    el.addNodeBtn.textContent = isFunctionView ? "Add Function" : "Add Node";
    el.addNodeBtn.title = isFunctionView ? "Add function node" : "Add node";
  }
}

function renderAgentLibrary() {
  if (state.libraryView === "functions") {
    el.agentLibrary.innerHTML = FUNCTION_NODE_GROUPS.map((group) => {
      const isOpen = state.openFunctionGroupIds.includes(group.id);
      const children = group.nodes.map((template) => `
        <button
          type="button"
          class="function-node-item"
          data-function-type="${escapeHtml(template.id)}"
          style="--agent-accent:${template.color.accent}; --agent-soft:${template.color.soft}; --agent-border:${template.color.border};"
        >
          <div class="function-node-copy">
            <strong>${escapeHtml(template.name)}</strong>
            <span>${escapeHtml(template.short)}</span>
          </div>
          <span class="tag neutral">node</span>
        </button>
      `).join("");

      return `
        <section class="function-group ${isOpen ? "open" : ""}">
          <button type="button" class="function-group-toggle" data-function-group="${escapeHtml(group.id)}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="function-group-copy">
              <strong>${escapeHtml(group.title)}</strong>
              <span>${escapeHtml(group.subtitle)}</span>
            </span>
            <span class="function-group-caret">${isOpen ? "-" : "+"}</span>
          </button>
          <div class="function-group-items ${isOpen ? "open" : ""}">
            ${children}
          </div>
        </section>
      `;
    }).join("");

    el.agentLibrary.querySelectorAll("[data-function-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupId = button.dataset.functionGroup || FUNCTION_NODE_GROUPS[0]?.id || "entry";
        if (state.openFunctionGroupIds.includes(groupId)) {
          state.openFunctionGroupIds = state.openFunctionGroupIds.filter((item) => item !== groupId);
        } else {
          state.openFunctionGroupIds = [...state.openFunctionGroupIds, groupId];
        }
        saveUiState();
        renderAll();
      });
    });

    el.agentLibrary.querySelectorAll("[data-function-type]").forEach((card) => {
      card.addEventListener("pointerdown", (event) => startFunctionNodeDrag(event, card.dataset.functionType || ""));
    });
    return;
  }

  el.agentLibrary.innerHTML = state.agents.length
    ? state.agents.map((agent) => {
        const theme = agentTheme(agent);
        return `
        <button type="button" class="agent-library-item draggable-agent-card" data-agent-id="${escapeHtml(agent.id)}" style="--agent-accent:${theme.accent}; --agent-soft:${theme.soft}; --agent-border:${theme.border};">
          <div class="agent-library-main">
            <strong>${escapeHtml(agent.name)}</strong>
            <span class="agent-library-sub">${escapeHtml(agent.configuredId || agent.id)}</span>
            <span class="agent-library-sub muted">${escapeHtml(agent.model || agent.baseUrl || "")}</span>
          </div>
          <div class="agent-library-meta">
            <span class="tag">${escapeHtml(agent.status || "unknown")}</span>
          </div>
        </button>
      `;
      }).join("")
    : '<p class="empty">No saved agent instances.</p>';

  el.agentLibrary.querySelectorAll("[data-agent-id]").forEach((card) => {
    card.addEventListener("pointerdown", (event) => startAgentCanvasDrag(event, card.dataset.agentId || ""));
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const instanceId = card.dataset.agentId || "";
      openContextMenu(event.clientX, event.clientY, [
        {
          label: "Edit Agent",
          action: () => {
            editAgentInstance(instanceId);
            closeContextMenu();
          },
        },
        {
          label: "Delete Agent",
          destructive: true,
          action: async () => {
            await removeAgentInstance(instanceId);
          },
        },
      ]);
    });
  });
}

function renderWorkspaceList() {
  if (!state.workspaces.length) {
    el.templateList.innerHTML = '<p class="empty">No workspaces yet.</p>';
    return;
  }

  el.templateList.innerHTML = `
    <div>
      <div class="helper-text">Saved Workspaces</div>
      <div class="template-list">
        ${state.workspaces.map((workspace) => `
          <article class="template-card ${workspace.id === state.workspaceId ? "active" : ""}">
            <button type="button" class="template-select" data-workspace-id="${workspace.id}">
              <h3>${escapeHtml(workspace.name)}</h3>
              <p>${escapeHtml(workspace.description || workspace.folderPath || "")}</p>
              <div class="template-tags">
                <span class="tag neutral">${(workspace.nodes || []).length} nodes</span>
                <span class="tag neutral">${escapeHtml(workspace.folderName || "")}</span>
              </div>
            </button>
            <div class="template-actions">
              <button type="button" class="ghost small-button" data-delete-workspace="${workspace.id}">Delete</button>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
  el.templateList.querySelectorAll("[data-workspace-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await switchWorkspace(button.dataset.workspaceId);
      closeWorkspaceModal();
    });
  });
  el.templateList.querySelectorAll("[data-delete-workspace]").forEach((button) => {
    button.addEventListener("click", () => deleteWorkspace(button.dataset.deleteWorkspace));
  });
}

function workspaceTabEntries() {
  const entries = state.workspaces.map((workspace) => ({ ...workspace }));
  const snapshot = buildCurrentWorkspaceSnapshot();

  if (state.workspaceId) {
    const index = entries.findIndex((workspace) => workspace.id === state.workspaceId);
    if (index >= 0) {
      entries[index] = { ...entries[index], ...snapshot };
    } else {
      entries.unshift(snapshot);
    }
    return entries;
  }

  if (snapshot.name || snapshot.nodes.length) {
    entries.unshift({ ...snapshot, id: "__draft_workspace__" });
  }
  return entries;
}

function renderWorkspaceTabs() {
  if (!el.workspaceTabbar) return;
  const entries = workspaceTabEntries();

  el.workspaceTabbar.innerHTML = `
    <div class="workspace-tabs-track">
      ${entries.map((workspace) => {
        const isActive = workspace.id === state.workspaceId || (!state.workspaceId && workspace.id === "__draft_workspace__");
        const subtitle = workspace.folderPath || workspace.description || "Canvas workspace";
        return `
          <button
            type="button"
            class="workspace-tab ${isActive ? "active" : ""}"
            data-workspace-tab="${escapeHtml(workspace.id || "__draft_workspace__")}"
            title="${escapeHtml(subtitle)}"
          >
            <span class="workspace-tab-title">${escapeHtml(workspace.name || "Untitled Workspace")}</span>
            <span class="workspace-tab-meta">${escapeHtml(subtitle)}</span>
          </button>
        `;
      }).join("")}
      <button type="button" id="workspace-tab-plus" class="workspace-tab workspace-tab-plus" aria-label="New workspace" title="New workspace">+</button>
    </div>
  `;

  el.workspaceTabbar.querySelectorAll("[data-workspace-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      const workspaceId = button.dataset.workspaceTab;
      if (!workspaceId || workspaceId === "__draft_workspace__" || workspaceId === state.workspaceId) {
        return;
      }
      await switchWorkspace(workspaceId);
    });
  });

  document.getElementById("workspace-tab-plus")?.addEventListener("click", createNewWorkspace);
}

function renderMiniMap() {
  if (!el.canvas || !el.canvasSurface || !el.miniMapNodes || !el.miniMapViewport || !el.miniMapSurface) return;
  if (el.canvasMinimap) {
    el.canvasMinimap.classList.toggle("hidden", !state.miniMapVisible);
  }
  if (!state.miniMapVisible) {
    return;
  }

  if (el.canvasMinimap) {
    if (state.miniMapPosition && Number.isFinite(state.miniMapPosition.x) && Number.isFinite(state.miniMapPosition.y)) {
      el.canvasMinimap.style.left = `${state.miniMapPosition.x}px`;
      el.canvasMinimap.style.top = `${state.miniMapPosition.y}px`;
      el.canvasMinimap.style.right = "auto";
    } else {
      el.canvasMinimap.style.left = "";
      el.canvasMinimap.style.top = "";
      el.canvasMinimap.style.right = "";
    }
  }

  const mapWidth = el.miniMapSurface.clientWidth || 160;
  const mapHeight = el.miniMapSurface.clientHeight || 112;
  const surfaceWidth = Math.max(el.canvasSurface.clientWidth || BASE_SURFACE_WIDTH, 1);
  const surfaceHeight = Math.max(el.canvasSurface.clientHeight || BASE_SURFACE_HEIGHT, 1);
  const scaleX = mapWidth / surfaceWidth;
  const scaleY = mapHeight / surfaceHeight;

  el.miniMapNodes.innerHTML = state.nodes.map((node) => {
    const agent = getAgent(node.agentId);
    const theme = agentTheme(agent);
    const width = Math.max(6, Math.round(200 * scaleX));
    const height = Math.max(5, Math.round(118 * scaleY));
    const left = Math.round(node.x * scaleX);
    const top = Math.round(node.y * scaleY);
    return `
      <span
        class="mini-map-node ${state.selectedNodeId === node.id ? "selected" : ""}"
        style="left:${left}px; top:${top}px; width:${width}px; height:${height}px; --agent-accent:${theme.accent}; --agent-soft:${theme.soft};"
      ></span>
    `;
  }).join("");

  const viewportWidth = Math.max(20, Math.round(el.canvas.clientWidth * scaleX));
  const viewportHeight = Math.max(16, Math.round(el.canvas.clientHeight * scaleY));
  const viewportLeft = Math.max(0, Math.min(mapWidth - viewportWidth, Math.round(el.canvas.scrollLeft * scaleX)));
  const viewportTop = Math.max(0, Math.min(mapHeight - viewportHeight, Math.round(el.canvas.scrollTop * scaleY)));
  el.miniMapViewport.style.width = `${viewportWidth}px`;
  el.miniMapViewport.style.height = `${viewportHeight}px`;
  el.miniMapViewport.style.left = `${viewportLeft}px`;
  el.miniMapViewport.style.top = `${viewportTop}px`;
}

function renderStatusStrip() {
  el.statusStrip?.classList.toggle("hidden", !state.statusStripVisible);
  if (!state.statusStripVisible) {
    if (el.statusStrip) {
      el.statusStrip.innerHTML = "";
    }
    return;
  }
  const done = state.nodes.filter((node) => node.status === "done").length;
  const outputTargets = state.nodes.reduce((count, node) => count + (node.outputTargets?.length || 0), 0);
  const readyAgents = state.agents.filter((agent) => agent.status === "ready").length;
  const activeNode = getSelectedNode();
  const nextNode = state.nodes.find((node) => node.status === "idle");
  const lastWritten = state.activeRun?.outputs?.flatMap((item) => item.writtenFiles || []).slice(-1) || [];
  const metrics = [
    { label: "Workspace", value: state.workspaceName, meta: state.workspaceFolderPath || "No folder selected" },
    { label: "Nodes", value: `${state.nodes.length}`, meta: activeNode ? `Selected: ${activeNode.title}` : "Canvas overview" },
    { label: "Agents", value: `${readyAgents}/${state.agents.length || 0}`, meta: "ready instances" },
    { label: "Run", value: state.activeRun?.status || (state.running ? "running" : "idle"), meta: `${done}/${state.nodes.length || 0} done · ${outputTargets} outputs` },
    { label: "Next", value: nextNode?.title || "None", meta: lastWritten[0] || "No recent file output" },
  ];
  el.statusStrip.innerHTML = `
    <div class="status-strip-bar" role="status" aria-label="Workspace status">
      <button type="button" id="hide-status-strip-btn" class="icon-button compact-icon-button status-strip-hide-btn" aria-label="Hide status" title="Hide status">×</button>
      ${metrics.map((metric) => `
        <article class="status-chip">
          <div class="status-chip-label">${escapeHtml(metric.label)}</div>
          <div class="status-chip-value">${escapeHtml(metric.value)}</div>
          <div class="status-chip-meta">${escapeHtml(metric.meta)}</div>
        </article>
      `).join("")}
    </div>
  `;
  document.getElementById("hide-status-strip-btn")?.addEventListener("click", () => {
    state.statusStripVisible = false;
    saveUiState();
    renderAll();
  });
}

function renderConnections() {
  el.canvasLinks.innerHTML = "";
  state.nodes.forEach((node) => {
    (node.dependsOn || []).forEach((parentId) => {
      const parent = state.nodes.find((item) => item.id === parentId);
      if (!parent) return;
      const startX = parent.x + 200;
      const startY = parent.y + 66;
      const endX = node.x;
      const endY = node.y + 66;
      const midX = (startX + endX) / 2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(99, 189, 255, 0.78)");
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-dasharray", "8 7");
      el.canvasLinks.appendChild(path);
    });
  });
}

function enableNodeDrag(element, nodeId) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const surfaceRect = el.canvasSurface.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offsetX = event.clientX - surfaceRect.left - node.x;
    const offsetY = event.clientY - surfaceRect.top - node.y;
    let moved = false;

    const onMove = (moveEvent) => {
      if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
      if (!moved) {
        moved = true;
        element.classList.add("dragging");
        element.setPointerCapture(event.pointerId);
      }
      const maxX = Math.max(0, el.canvasSurface.clientWidth - element.offsetWidth);
      const maxY = Math.max(0, el.canvasSurface.clientHeight - element.offsetHeight);
      node.x = Math.round(Math.max(0, Math.min(maxX, moveEvent.clientX - surfaceRect.left - offsetX)));
      node.y = Math.round(Math.max(0, Math.min(maxY, moveEvent.clientY - surfaceRect.top - offsetY)));
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
      renderConnections();
      renderMiniMap();
    };

    const onUp = () => {
      element.classList.remove("dragging");
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      if (moved) {
        persistWorkspaceDraft();
        renderAll();
      }
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
  });
}

function renderCanvas() {
  el.canvasNodes.innerHTML = "";
  ensureCanvasExtent();
  renderConnections();
  state.nodes.forEach((node) => {
    const agent = getAgent(node.agentId);
    const functionTemplate = getFunctionTemplate(node.functionType);
    const theme = nodeTheme(node);
    const dependencyCount = node.dependsOn?.length || 0;
    const summary = escapeHtml(node.description || "No description");
    const sublabel = node.nodeKind === "function"
      ? functionTemplate?.name || "Function Node"
      : agent?.name || "Unbound Agent";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `canvas-node ${state.selectedNodeId === node.id ? "selected" : ""}`;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--agent-accent", theme.accent);
    button.style.setProperty("--agent-soft", theme.soft);
    button.style.setProperty("--agent-border", theme.border);
    button.innerHTML = `
      <div class="canvas-node-header">
        <div class="node-status-dot status-${node.status}" title="${escapeHtml(statusLabel(node.status))}"></div>
        <div class="canvas-node-title-wrap">
          <h3>${escapeHtml(node.title)}</h3>
          <span class="canvas-node-agent">${escapeHtml(sublabel)}</span>
        </div>
      </div>
      <p class="canvas-node-summary">${summary}</p>
      <div class="canvas-node-tags">
        <span class="tag neutral">${escapeHtml(node.nodeKind)}</span>
        <span class="tag neutral">${escapeHtml(node.outputMode)}</span>
        ${dependencyCount ? `<span class="tag neutral">${dependencyCount} deps</span>` : ""}
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedNodeId = node.id;
      showRightPanel();
      saveUiState();
      renderAll();
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, [
        {
          label: "Edit Node",
          action: () => {
            state.selectedNodeId = node.id;
            showRightPanel();
            closeContextMenu();
          },
        },
        {
          label: "Duplicate Node",
          action: () => {
            duplicateNode(node.id);
            closeContextMenu();
          },
        },
        {
          label: "Delete Node",
          destructive: true,
          action: () => {
            deleteNode(node.id);
            closeContextMenu();
          },
        },
      ]);
    });
    enableNodeDrag(button, node.id);
    el.canvasNodes.appendChild(button);
  });
}

function availableAgentOptions(selectedAgentId) {
  if (!state.agents.length) return '<option value="">No agents available</option>';
  return state.agents.map((agent) => `<option value="${agent.id}" ${agent.id === selectedAgentId ? "selected" : ""}>${escapeHtml(agent.name)} (${escapeHtml(agent.configuredId || agent.id)})</option>`).join("");
}

function nodeTargetCheckboxList(fieldName, selectedIds, currentNodeId) {
  const options = state.nodes
    .filter((item) => item.id !== currentNodeId)
    .map((item) => `<label class="checkbox-item"><input type="checkbox" name="${fieldName}" value="${item.id}" ${selectedIds.includes(item.id) ? "checked" : ""} /><span>${escapeHtml(item.title)}</span></label>`)
    .join("");
  return options || '<p class="empty">No target nodes available.</p>';
}

function agentTargetCheckboxList(fieldName, selectedIds, currentNodeId) {
  const options = state.nodes
    .filter((item) => item.id !== currentNodeId && item.nodeKind === "agent")
    .map((item) => `<label class="checkbox-item"><input type="checkbox" name="${fieldName}" value="${item.id}" ${selectedIds.includes(item.id) ? "checked" : ""} /><span>${escapeHtml(item.title)}</span></label>`)
    .join("");
  return options || '<p class="empty">No agent nodes available.</p>';
}

function functionNodeOptions(selectedNodeId, currentNodeId) {
  const options = state.nodes
    .filter((item) => item.id !== currentNodeId)
    .map((item) => `<option value="${item.id}" ${item.id === selectedNodeId ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
    .join("");
  return `<option value="">Select a node</option>${options}`;
}

function agentNodeOptions(selectedNodeId, currentNodeId) {
  const options = state.nodes
    .filter((item) => item.id !== currentNodeId && item.nodeKind === "agent")
    .map((item) => `<option value="${item.id}" ${item.id === selectedNodeId ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
    .join("");
  return `<option value="">Use direct text match only</option>${options}`;
}

function renderFunctionConfigFields(node) {
  const config = normalizeFunctionConfig(node.functionType, node.config || {});

  switch (node.functionType) {
    case "trigger":
      return `
        <div class="field-row">
          <div class="field-group"><label class="field-label">Delay (ms)</label><input name="config_delayMs" type="number" min="0" step="100" value="${config.delayMs}" /></div>
          <div class="field-group"><label class="field-label">Activation</label><input type="text" value="Release selected downstream targets after delay" disabled /></div>
        </div>
        <div class="field-group"><label class="field-label">Trigger Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_targetIds", config.targetIds, node.id)}</div></div>
      `;
    case "condition":
      return `
        <div class="field-row">
          <div class="field-group"><label class="field-label">Source</label><select name="config_sourceMode"><option value="upstreamSummary" ${config.sourceMode === "upstreamSummary" ? "selected" : ""}>Upstream summary</option><option value="upstreamText" ${config.sourceMode === "upstreamText" ? "selected" : ""}>All upstream text</option><option value="latestUpstream" ${config.sourceMode === "latestUpstream" ? "selected" : ""}>Latest upstream output</option></select></div>
          <div class="field-group"><label class="field-label">Match Type</label><select name="config_matchType"><option value="contains" ${config.matchType === "contains" ? "selected" : ""}>Contains</option><option value="equals" ${config.matchType === "equals" ? "selected" : ""}>Equals</option><option value="regex" ${config.matchType === "regex" ? "selected" : ""}>Regex</option><option value="exists" ${config.matchType === "exists" ? "selected" : ""}>Exists</option></select></div>
        </div>
        <div class="field-group"><label class="field-label">Decision Agent Node</label><select name="config_evaluatorNodeId">${agentNodeOptions(config.evaluatorNodeId, node.id)}</select></div>
        <div class="field-group"><label class="field-label">Match Value</label><input name="config_matchValue" type="text" value="${escapeHtml(config.matchValue)}" placeholder="approved / yes / true" /></div>
        <div class="field-group"><label class="field-label">True Branch Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_trueTargetIds", config.trueTargetIds, node.id)}</div></div>
        <div class="field-group"><label class="field-label">False Branch Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_falseTargetIds", config.falseTargetIds, node.id)}</div></div>
      `;
    case "switch":
      return `
        <div class="field-group"><label class="field-label">Source</label><select name="config_sourceMode"><option value="upstreamSummary" ${config.sourceMode === "upstreamSummary" ? "selected" : ""}>Upstream summary</option><option value="upstreamText" ${config.sourceMode === "upstreamText" ? "selected" : ""}>All upstream text</option><option value="latestUpstream" ${config.sourceMode === "latestUpstream" ? "selected" : ""}>Latest upstream output</option></select></div>
        <div class="field-group"><label class="field-label">Case Rules</label><textarea name="config_caseRules" placeholder="approved => Node A&#10;rejected => Node B, Node C">${escapeHtml(config.caseRules)}</textarea></div>
        <div class="field-group"><label class="field-label">Default Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_defaultTargetIds", config.defaultTargetIds, node.id)}</div></div>
      `;
    case "fork":
      return `
        <div class="field-group"><label class="field-label">Fork Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_targetIds", config.targetIds, node.id)}</div></div>
      `;
    case "join":
      return `
        <div class="field-group"><label class="field-label">Join Mode</label><select name="config_joinMode"><option value="all" ${config.joinMode === "all" ? "selected" : ""}>Wait for all dependencies</option></select></div>
      `;
    case "merge":
      return `
        <div class="field-group"><label class="field-label">Merge Mode</label><select name="config_mergeMode"><option value="sections" ${config.mergeMode === "sections" ? "selected" : ""}>Sections</option><option value="bullets" ${config.mergeMode === "bullets" ? "selected" : ""}>Bullets</option><option value="paragraph" ${config.mergeMode === "paragraph" ? "selected" : ""}>Paragraph</option></select></div>
      `;
    case "retry":
      return `
        <div class="field-row">
          <div class="field-group"><label class="field-label">Retry Target</label><select name="config_targetNodeId">${functionNodeOptions(config.targetNodeId, node.id)}</select></div>
          <div class="field-group"><label class="field-label">Max Attempts</label><input name="config_maxAttempts" type="number" min="1" max="5" value="${config.maxAttempts}" /></div>
        </div>
      `;
    case "review_loop":
      return `
        <div class="field-row">
          <div class="field-group"><label class="field-label">Review Agent Node</label><select name="config_reviewerNodeId">${agentNodeOptions(config.reviewerNodeId, node.id)}</select></div>
          <div class="field-group"><label class="field-label">Source</label><select name="config_sourceMode"><option value="upstreamSummary" ${config.sourceMode === "upstreamSummary" ? "selected" : ""}>Upstream summary</option><option value="upstreamText" ${config.sourceMode === "upstreamText" ? "selected" : ""}>All upstream text</option><option value="latestUpstream" ${config.sourceMode === "latestUpstream" ? "selected" : ""}>Latest upstream output</option></select></div>
        </div>
        <div class="field-row">
          <div class="field-group"><label class="field-label">Approval Match</label><select name="config_matchType"><option value="contains" ${config.matchType === "contains" ? "selected" : ""}>Contains</option><option value="equals" ${config.matchType === "equals" ? "selected" : ""}>Equals</option><option value="regex" ${config.matchType === "regex" ? "selected" : ""}>Regex</option><option value="exists" ${config.matchType === "exists" ? "selected" : ""}>Exists</option></select></div>
          <div class="field-group"><label class="field-label">Max Rounds</label><input name="config_maxRounds" type="number" min="1" max="5" value="${config.maxRounds}" /></div>
        </div>
        <div class="field-group"><label class="field-label">Approval Keyword / Rule</label><input name="config_matchValue" type="text" value="${escapeHtml(config.matchValue)}" placeholder="decision: approved" /></div>
        <div class="field-group"><label class="field-label">Rework Target Nodes</label><div class="checkbox-list">${agentTargetCheckboxList("config_reworkTargetIds", config.reworkTargetIds, node.id)}</div></div>
        <div class="field-group"><label class="field-label">Approved Targets</label><div class="checkbox-list">${nodeTargetCheckboxList("config_approvedTargetIds", config.approvedTargetIds, node.id)}</div></div>
      `;
    case "start":
      return `<div class="field-group"><label class="field-label">Start Node</label><input type="text" value="Use this node as the workflow entry point." disabled /></div>`;
    case "end":
      return `<div class="field-group"><label class="field-label">End Node</label><input type="text" value="Collect final upstream outputs here." disabled /></div>`;
    default:
      return "";
  }
}

function readFunctionConfigFromForm(node, formData) {
  switch (node.functionType) {
    case "trigger":
      return normalizeFunctionConfig(node.functionType, {
        delayMs: formData.get("config_delayMs"),
        targetIds: formData.getAll("config_targetIds"),
      });
    case "condition":
      return normalizeFunctionConfig(node.functionType, {
        sourceMode: formData.get("config_sourceMode"),
        matchType: formData.get("config_matchType"),
        evaluatorNodeId: formData.get("config_evaluatorNodeId"),
        matchValue: formData.get("config_matchValue"),
        trueTargetIds: formData.getAll("config_trueTargetIds"),
        falseTargetIds: formData.getAll("config_falseTargetIds"),
      });
    case "switch":
      return normalizeFunctionConfig(node.functionType, {
        sourceMode: formData.get("config_sourceMode"),
        caseRules: formData.get("config_caseRules"),
        defaultTargetIds: formData.getAll("config_defaultTargetIds"),
      });
    case "fork":
      return normalizeFunctionConfig(node.functionType, {
        targetIds: formData.getAll("config_targetIds"),
      });
    case "join":
      return normalizeFunctionConfig(node.functionType, {
        joinMode: formData.get("config_joinMode"),
      });
    case "merge":
      return normalizeFunctionConfig(node.functionType, {
        mergeMode: formData.get("config_mergeMode"),
      });
    case "retry":
      return normalizeFunctionConfig(node.functionType, {
        targetNodeId: formData.get("config_targetNodeId"),
        maxAttempts: formData.get("config_maxAttempts"),
      });
    case "review_loop":
      return normalizeFunctionConfig(node.functionType, {
        reviewerNodeId: formData.get("config_reviewerNodeId"),
        sourceMode: formData.get("config_sourceMode"),
        matchType: formData.get("config_matchType"),
        matchValue: formData.get("config_matchValue"),
        maxRounds: formData.get("config_maxRounds"),
        reworkTargetIds: formData.getAll("config_reworkTargetIds"),
        approvedTargetIds: formData.getAll("config_approvedTargetIds"),
      });
    default:
      return normalizeFunctionConfig(node.functionType, node.config || {});
  }
}

function renderNodeForm() {
  const node = getSelectedNode();
  if (!node) {
    el.nodeForm.innerHTML = `
      <div class="detail-banner">
        <div class="detail-banner-title">
          <span class="node-status-dot status-idle"></span>
          <strong>${escapeHtml(state.workspaceName)}</strong>
        </div>
        <span class="tag neutral">Workspace</span>
      </div>
      <div class="field-group"><label class="field-label">Workspace Name</label><input name="workspaceName" type="text" value="${escapeHtml(state.workspaceName)}" /></div>
      <div class="field-group"><label class="field-label">Workspace Folder</label><input name="workspaceFolderPath" type="text" value="${escapeHtml(state.workspaceFolderPath)}" placeholder="C:\\Projects\\essay-workspace" /></div>
      <div class="details-actions"><button type="button" id="pick-workspace-folder-btn" class="ghost">Choose Folder</button><span class="helper-text">${isTauriRuntime() ? "Use the system directory picker." : "System picker is available in the Tauri desktop build."}</span></div>
      <div class="field-group"><label class="field-label">Workspace Description</label><textarea name="workspaceDescription">${escapeHtml(state.workspaceDescription)}</textarea></div>
      <div class="details-actions"><button type="submit" class="primary">Save Workspace Fields</button></div>
    `;

    el.nodeForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(el.nodeForm);
      state.workspaceName = String(formData.get("workspaceName") || "").trim() || "Untitled Workspace";
      state.workspaceFolderPath = String(formData.get("workspaceFolderPath") || "").trim();
      if (state.workspaceFolderPath) {
        state.workspaceFolderName = "";
      }
      state.workspaceDescription = String(formData.get("workspaceDescription") || "").trim();
      persistWorkspaceDraft();
      renderAll();
    };

    document.getElementById("pick-workspace-folder-btn").addEventListener("click", async () => {
      if (!isTauriRuntime()) {
        appendLog("Folder Picker Unavailable", "Use the Tauri desktop build to open the system directory picker.");
        renderAll();
        return;
      }

      try {
        const selectedPath = await tauriInvoke("pick_workspace_directory");
        if (!selectedPath) return;
        state.workspaceFolderPath = String(selectedPath);
        state.workspaceFolderName = "";
        if (!state.workspaceName || state.workspaceName.startsWith("Untitled Workspace")) {
          state.workspaceName = inferWorkspaceNameFromPath(selectedPath);
        }
        persistWorkspaceDraft();
        renderAll();
      } catch (error) {
        appendLog("Choose Folder Failed", error.message || String(error));
        renderAll();
      }
    });
    return;
  }

  const agent = getAgent(node.agentId);
  const functionTemplate = getFunctionTemplate(node.functionType);
  const detailTag = node.nodeKind === "function"
    ? (functionTemplate?.name || "Function Node")
    : (agent?.name || "Unbound Agent");
  const functionConfigFields = node.nodeKind === "function" ? renderFunctionConfigFields(node) : "";

  const dependencyOptions = state.nodes
    .filter((item) => item.id !== node.id)
    .map((item) => `<label class="checkbox-item"><input type="checkbox" name="dependsOn" value="${item.id}" ${node.dependsOn.includes(item.id) ? "checked" : ""} /><span>${escapeHtml(item.title)}</span></label>`)
    .join("");

  el.nodeForm.innerHTML = `
    <div class="detail-banner">
      <div class="detail-banner-title">
        <span class="node-status-dot status-${node.status}" title="${escapeHtml(statusLabel(node.status))}"></span>
        <strong>${escapeHtml(node.title)}</strong>
      </div>
      <span class="tag neutral">${escapeHtml(detailTag)}</span>
    </div>
    <div class="field-group"><label class="field-label">Node Title</label><input name="title" type="text" value="${escapeHtml(node.title)}" /></div>
    <div class="field-group"><label class="field-label">Node Description</label><textarea name="description">${escapeHtml(node.description)}</textarea></div>
    ${node.nodeKind === "agent"
      ? `<div class="field-group"><label class="field-label">Bound Agent Instance</label><select name="agentId">${availableAgentOptions(node.agentId)}</select></div>`
      : `<div class="field-group"><label class="field-label">Function Type</label><input type="text" value="${escapeHtml(functionTemplate?.name || node.functionType || "Function Node")}" disabled /></div>`}
    ${functionConfigFields}
    <div class="field-row">
      <div class="field-group"><label class="field-label">X</label><input name="x" type="number" value="${node.x}" min="0" max="9999" /></div>
      <div class="field-group"><label class="field-label">Y</label><input name="y" type="number" value="${node.y}" min="0" max="9999" /></div>
    </div>
    <div class="field-group"><label class="field-label">Dependencies</label><div class="checkbox-list">${dependencyOptions || '<p class="empty">No dependencies available.</p>'}</div></div>
    <div class="field-group"><label class="field-label">Output Mode</label><select name="outputMode"><option value="text" ${node.outputMode === "text" ? "selected" : ""}>Text only</option><option value="file" ${node.outputMode === "file" ? "selected" : ""}>Write one file</option><option value="files" ${node.outputMode === "files" ? "selected" : ""}>Write multiple files</option></select></div>
    <div class="field-group"><label class="field-label">Output Targets</label><textarea name="outputTargets" placeholder="docs/result.md&#10;exports/summary.txt">${escapeHtml((node.outputTargets || []).join("\n"))}</textarea></div>
    <div class="field-group"><label class="field-label">Latest Output</label><textarea name="output">${escapeHtml(node.output)}</textarea></div>
    <div class="details-actions"><button type="submit" class="primary">Save Node</button><button type="button" id="duplicate-node-btn" class="ghost">Duplicate</button><button type="button" id="delete-node-btn" class="ghost">Delete</button></div>
  `;

  el.nodeForm.onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(el.nodeForm);
    node.title = String(formData.get("title") || "").trim() || "Untitled Node";
    node.description = String(formData.get("description") || "").trim();
    if (node.nodeKind === "agent") {
      node.agentId = String(formData.get("agentId") || "").trim();
    } else {
      node.config = readFunctionConfigFromForm(node, formData);
    }
    node.x = clampNumber(formData.get("x"), 0, 9999, node.x);
    node.y = clampNumber(formData.get("y"), 0, 9999, node.y);
    node.outputMode = String(formData.get("outputMode") || "text");
    node.outputTargets = String(formData.get("outputTargets") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    node.output = String(formData.get("output") || "").trim();
    node.dependsOn = formData.getAll("dependsOn").filter((id) => id !== node.id);
    persistWorkspaceDraft();
    renderAll();
  };

  document.getElementById("duplicate-node-btn").addEventListener("click", () => duplicateNode(node.id));
  document.getElementById("delete-node-btn").addEventListener("click", () => deleteNode(node.id));
}

function renderLogs() {
  el.logPanel.innerHTML = "";
  const items = state.busMessages.length
    ? [...state.busMessages].reverse().slice(0, 80).map((message) => {
        const upstreamOutputs = Array.isArray(message.metadata?.upstreamOutputs) ? message.metadata.upstreamOutputs : [];
        const dependencyLabel = Array.isArray(message.metadata?.dependsOn) && message.metadata.dependsOn.length
          ? `Depends on: ${message.metadata.dependsOn.join(", ")}`
          : "";
        const upstreamLabel = upstreamOutputs.length
          ? upstreamOutputs.map((item) => `${item.nodeTitle}: ${String(item.content || "").slice(0, 160)}`).join("\n\n")
          : "";

        return {
          title: `${message.from} -> ${message.to}`,
          meta: [message.role, message.metadata?.nodeTitle, dependencyLabel].filter(Boolean).join(" • "),
          message: message.content,
          upstreamLabel,
          createdAt: message.createdAt,
        };
      })
    : [...state.logs].reverse().slice(0, 80).map((log) => ({
        title: log.title,
        meta: "",
        message: log.message,
        upstreamLabel: "",
        createdAt: log.createdAt,
      }));

  items.forEach((log) => {
    const item = document.createElement("article");
    item.className = "log-item";
    item.innerHTML = [
      `<strong>${escapeHtml(log.title)}</strong>`,
      log.meta ? `<div class="log-meta">${escapeHtml(log.meta)}</div>` : "",
      `<span>${escapeHtml(log.message)}</span>`,
      log.upstreamLabel ? `<pre class="log-context">${escapeHtml(log.upstreamLabel)}</pre>` : "",
    ].join("");
    el.logPanel.appendChild(item);
  });
}

function renderContextMenu() {
  if (!el.contextMenu) return;
  const menu = state.contextMenu;
  if (!menu || !menu.items?.length) {
    el.contextMenu.hidden = true;
    el.contextMenu.innerHTML = "";
    return;
  }

  el.contextMenu.hidden = false;
  el.contextMenu.style.left = `${menu.x}px`;
  el.contextMenu.style.top = `${menu.y}px`;
  el.contextMenu.innerHTML = menu.items.map((item, index) => `
    <button type="button" class="context-menu-item ${item.destructive ? "destructive" : ""}" data-menu-index="${index}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");

  el.contextMenu.querySelectorAll("[data-menu-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = menu.items[Number(button.dataset.menuIndex)]?.action;
      if (typeof action === "function") {
        await action();
      }
    });
  });
}

function renderAll() {
  ensureWorkspaceState();
  markBlockedNodes();
  el.runAllBtn.textContent = "";
  el.runAllBtn.title = state.running ? "Running..." : "Run Workspace";
  el.runAllBtn.setAttribute("aria-label", state.running ? "Running" : "Run Workspace");
  el.runAllBtn.classList.toggle("running", state.running);
  el.runAllBtn.disabled = state.running || state.loading || !state.nodes.length;
  renderSettingsForm();
  renderLibrarySwitch();
  renderAgentLibrary();
  renderWorkspaceList();
  renderWorkspaceTabs();
  renderStatusStrip();
  renderCanvas();
  renderMiniMap();
  renderNodeForm();
  el.panelLeft?.classList.toggle("collapsed", !state.leftPanelVisible);
  el.panelRight?.classList.toggle("collapsed", !state.rightPanelVisible);
  el.leftEdgeToggle?.classList.toggle("visible", !state.leftPanelVisible);
  el.rightEdgeToggle?.classList.toggle("visible", !state.rightPanelVisible);
  if (el.settingsModal) {
    el.settingsModal.hidden = !state.settingsModalOpen;
  }
  if (el.workspaceModal) {
    el.workspaceModal.hidden = !state.workspaceModalOpen;
  }
  renderContextMenu();
  renderLogs();
  el.toggleStatusStripBtn?.classList.toggle("active", state.statusStripVisible);
  el.toggleMinimapBtn?.classList.toggle("active", state.miniMapVisible);
  if (el.toggleStatusStripBtn) {
    el.toggleStatusStripBtn.title = state.statusStripVisible ? "Hide status strip" : "Show status strip";
  }
  if (el.toggleMinimapBtn) {
    el.toggleMinimapBtn.title = state.miniMapVisible ? "Hide minimap" : "Show minimap";
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function centerCurrentNodes() {
  if (!state.nodes.length) return;
  const bounds = state.nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.x),
    minY: Math.min(acc.minY, node.y),
    maxX: Math.max(acc.maxX, node.x + 200),
    maxY: Math.max(acc.maxY, node.y + 120),
  }), { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 });

  const contentCenterX = (bounds.minX + bounds.maxX) / 2;
  const contentCenterY = (bounds.minY + bounds.maxY) / 2;
  const targetCenterX = BASE_SURFACE_WIDTH / 2;
  const targetCenterY = BASE_SURFACE_HEIGHT / 2;
  const offsetX = Math.round(targetCenterX - contentCenterX);
  const offsetY = Math.round(targetCenterY - contentCenterY);

  state.nodes = state.nodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
  }));
}

function ensureCanvasExtent() {
  if (!el.canvasSurface) return;
  let width = BASE_SURFACE_WIDTH;
  let height = BASE_SURFACE_HEIGHT;

  if (state.nodes.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    state.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + 220);
      maxY = Math.max(maxY, node.y + 160);
    });

    if (minX < SURFACE_MARGIN) {
      const delta = SURFACE_MARGIN - minX;
      state.nodes.forEach((node) => { node.x += delta; });
      maxX += delta;
      width = Math.max(width, maxX + SURFACE_MARGIN);
    }

    if (minY < SURFACE_MARGIN) {
      const delta = SURFACE_MARGIN - minY;
      state.nodes.forEach((node) => { node.y += delta; });
      maxY += delta;
      height = Math.max(height, maxY + SURFACE_MARGIN);
    }

    width = Math.max(width, maxX + SURFACE_MARGIN);
    height = Math.max(height, maxY + SURFACE_MARGIN);
  }

  el.canvasSurface.style.width = `${width}px`;
  el.canvasSurface.style.height = `${height}px`;
}

function centerCanvasViewport() {
  if (!el.canvas || !el.canvasSurface) return;
  const targetLeft = Math.max(0, (el.canvasSurface.clientWidth - el.canvas.clientWidth) / 2);
  const targetTop = Math.max(0, (el.canvasSurface.clientHeight - el.canvas.clientHeight) / 2);
  el.canvas.scrollLeft = targetLeft;
  el.canvas.scrollTop = targetTop;
  renderMiniMap();
}

function restoreCanvasViewport(persisted = loadUiState()) {
  if (!el.canvas || !el.canvasSurface) return;
  const hasSavedViewport = Number.isFinite(Number(persisted.canvasScrollLeft)) && Number.isFinite(Number(persisted.canvasScrollTop));
  if (!hasSavedViewport) {
    centerCanvasViewport();
    return;
  }
  el.canvas.scrollLeft = Math.max(0, Number(persisted.canvasScrollLeft));
  el.canvas.scrollTop = Math.max(0, Number(persisted.canvasScrollTop));
  renderMiniMap();
}

function addNode() {
  if (state.libraryView === "functions") {
    addFunctionNode(getDefaultFunctionType());
    return;
  }

  const nextIndex = state.nodes.length;
  state.nodes.push(normalizeNode({ id: `node_${cryptoRandom()}`, agentId: firstAgentId(), title: `Node ${nextIndex + 1}`, description: "", dependsOn: [] }, nextIndex));
  ensureWorkspaceState();
  ensureCanvasExtent();
  persistWorkspaceDraft();
  renderAll();
}

function duplicateNode(nodeId) {
  const node = state.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  state.nodes.push(normalizeNode({ ...structuredClone(node), id: `node_${cryptoRandom()}`, title: `${node.title} Copy`, x: node.x + 40, y: node.y + 40, status: "idle" }, state.nodes.length));
  ensureWorkspaceState();
  ensureCanvasExtent();
  persistWorkspaceDraft();
  renderAll();
}

function deleteNode(nodeId) {
  state.nodes = state.nodes.filter((node) => node.id !== nodeId).map((node) => ({ ...node, dependsOn: node.dependsOn.filter((dep) => dep !== nodeId) }));
  ensureWorkspaceState();
  ensureCanvasExtent();
  persistWorkspaceDraft();
  renderAll();
}

function addNodeForAgent(agentId, position) {
  const agent = getAgent(agentId);
  const nextIndex = state.nodes.length;
  const base = normalizeNode({
    id: `node_${cryptoRandom()}`,
    nodeKind: "agent",
    agentId,
    title: agent?.name || `Node ${nextIndex + 1}`,
    description: "",
    dependsOn: [],
    x: position?.x,
    y: position?.y,
  }, nextIndex);
  state.nodes.push(base);
  state.selectedNodeId = base.id;
  ensureWorkspaceState();
  ensureCanvasExtent();
  persistWorkspaceDraft();
  renderAll();
}

function addFunctionNode(functionType, position) {
  const template = getFunctionTemplate(functionType);
  if (!template) return;
  const nextIndex = state.nodes.length;
  const base = normalizeNode({
    id: `node_${cryptoRandom()}`,
    nodeKind: "function",
    functionType: template.id,
    title: template.name,
    description: template.description,
    dependsOn: [],
    outputMode: template.outputMode,
    outputTargets: template.outputTargets,
    x: position?.x,
    y: position?.y,
  }, nextIndex);
  state.nodes.push(base);
  state.selectedNodeId = base.id;
  ensureWorkspaceState();
  ensureCanvasExtent();
  persistWorkspaceDraft();
  renderAll();
}

function startLibraryDrag(event, options) {
  const { label, theme, onDrop } = options;
  if (event.button !== 0 || !el.canvas) return;
  event.preventDefault();

  const preview = document.createElement("div");
  preview.className = "drag-agent-preview";
  preview.style.setProperty("--agent-accent", theme.accent);
  preview.style.setProperty("--agent-soft", theme.soft);
  preview.style.setProperty("--agent-border", theme.border);
  preview.textContent = label;
  document.body.appendChild(preview);
  document.body.style.userSelect = "none";

  const updatePreview = (clientX, clientY) => {
    preview.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
    const rect = el.canvas.getBoundingClientRect();
    const inCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    preview.classList.toggle("valid-drop", inCanvas);
    el.canvas.classList.toggle("drop-target", inCanvas);
  };

  updatePreview(event.clientX, event.clientY);

  const onMove = (moveEvent) => {
    updatePreview(moveEvent.clientX, moveEvent.clientY);
  };

  const onUp = (upEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    preview.remove();
    document.body.style.userSelect = "";

    const rect = el.canvas.getBoundingClientRect();
    const inCanvas = upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom;
    el.canvas.classList.remove("drop-target");
    if (!inCanvas) return;

    const surfaceRect = el.canvasSurface.getBoundingClientRect();
    const x = Math.max(0, Math.round(upEvent.clientX - surfaceRect.left - 100));
    const y = Math.max(0, Math.round(upEvent.clientY - surfaceRect.top - 56));
    onDrop({ x, y });
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function startAgentCanvasDrag(event, agentId) {
  const agent = getAgent(agentId);
  if (!agent) return;
  startLibraryDrag(event, {
    label: agent.name || "New Agent Node",
    theme: agentTheme(agent),
    onDrop: (position) => addNodeForAgent(agentId, position),
  });
}

function startFunctionNodeDrag(event, functionType) {
  const template = getFunctionTemplate(functionType);
  if (!template) return;
  startLibraryDrag(event, {
    label: template.name,
    theme: template.color,
    onDrop: (position) => addFunctionNode(functionType, position),
  });
}

async function saveWorkspaceToBackend(options = {}) {
  const { silent = false } = options;
  const data = await apiSend("/api/workspaces", "POST", {
    id: state.workspaceId || undefined,
    name: state.workspaceName,
    description: state.workspaceDescription,
    folderPath: state.workspaceFolderPath || undefined,
    folderName: state.workspaceFolderPath ? undefined : state.workspaceFolderName || undefined,
    nodes: state.nodes,
  });
  state.workspaceId = data.workspace.id;
  state.workspaceName = data.workspace.name;
  state.workspaceDescription = data.workspace.description || "";
  state.workspaceFolderName = data.workspace.folderName || "";
  state.workspaceFolderPath = data.workspace.folderPath || "";
  if (!silent) {
    appendLog("Workspace Saved", `${data.workspace.name} saved to ${data.workspace.folderPath}`);
  }
  await refreshWorkspaces();
  saveUiState();
  renderAll();
}

async function runWorkspace() {
  if (state.running || !state.nodes.length) return;
  try {
    const writable = await ensureWorkspaceWritableForRun();
    if (!writable) {
      appendLog("Run Cancelled", "Workspace run was cancelled before submission.");
      renderAll();
      return;
    }

    state.running = true;
    state.permissionPromptRunId = null;
    appendLog("Workspace Submitted", "Backend accepted the run request.");
    renderAll();

    const data = await apiSend("/api/runs", "POST", {
      workspace: {
        id: state.workspaceId || `ws_${cryptoRandom()}`,
        name: state.workspaceName,
        description: state.workspaceDescription,
        folderPath: state.workspaceFolderPath || undefined,
        folderName: state.workspaceFolderPath ? undefined : state.workspaceFolderName || undefined,
        nodes: state.nodes.map((node) => ({
          id: node.id,
          nodeKind: node.nodeKind,
          functionType: node.functionType,
          agentId: node.agentId,
          config: structuredClone(node.config || {}),
          title: node.title,
          description: node.description,
          dependsOn: node.dependsOn,
          outputMode: node.outputMode,
          outputTargets: node.outputTargets,
        })),
      },
    });
    state.activeRun = data.run;
    state.nodes.forEach((node) => { node.status = node.dependsOn.length ? "blocked" : "idle"; });
    saveUiState();
    renderAll();
    pollRunStatus(data.run.id);
  } catch (error) {
    appendLog("Run Failed", error.message || String(error));
    clearRunPolling();
    state.running = false;
    renderAll();
  }
}

function exportWorkspace() {
  const payload = { id: state.workspaceId, name: state.workspaceName, description: state.workspaceDescription, folderName: state.workspaceFolderName, folderPath: state.workspaceFolderPath, nodes: state.nodes };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.workspaceName || "workspace"}.json`;
  link.click();
}

function importWorkspace(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state.workspaceId = parsed.id || null;
      state.workspaceName = parsed.name || "Imported Workspace";
      state.workspaceDescription = parsed.description || "";
      state.workspaceFolderName = parsed.folderName || "";
      state.workspaceFolderPath = parsed.folderPath || "";
      state.nodes = normalizeNodes(parsed.nodes || []);
      state.activeRun = null;
      state.running = false;
      clearRunPolling();
      ensureWorkspaceState();
      saveUiState();
      renderAll();
      window.requestAnimationFrame(centerCanvasViewport);
    } catch (error) {
      appendLog("Import Failed", error.message);
      renderAll();
    }
  };
  reader.readAsText(file, "utf8");
}

async function bootstrap() {
  state.loading = true;
  applyStoredPanelWidths();
  renderAll();
  const persisted = loadUiState();
  try {
    await Promise.all([refreshSettings(), refreshAgents(), refreshWorkspaces(), refreshBusMessages(), refreshRuns()]);
    const savedWorkspace = persisted.workspaceId ? state.workspaces.find((workspace) => workspace.id === persisted.workspaceId) : null;
    if (savedWorkspace) {
      setCurrentWorkspace(savedWorkspace);
    } else {
      state.workspaceId = null;
      state.workspaceName = persisted.workspaceName || "Untitled Workspace";
      state.workspaceDescription = persisted.workspaceDescription || "";
      state.workspaceFolderName = persisted.workspaceFolderName || "";
      state.workspaceFolderPath = persisted.workspaceFolderPath || "";
      state.nodes = normalizeNodes(persisted.nodes || []);
      state.selectedNodeId = persisted.selectedNodeId || null;
      ensureWorkspaceState();
    }
  } catch (error) {
    appendLog("Bootstrap Failed", error.message);
  } finally {
    state.loading = false;
    renderAll();
    window.requestAnimationFrame(() => restoreCanvasViewport(persisted));
  }
}

function bindPanelResize(handle, side) {
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 1280) return;
    event.preventDefault();
    const startX = event.clientX;
    const computed = getComputedStyle(document.documentElement);
    const property = side === "left" ? "--left-panel-width" : "--right-panel-width";
    const initialWidth = parseInt(computed.getPropertyValue(property), 10);
    const min = side === "left" ? 260 : 300;
    const max = 560;

    const onMove = (moveEvent) => {
      const delta = side === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      document.documentElement.style.setProperty(property, `${Math.max(min, Math.min(max, initialWidth + delta))}px`);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveUiState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function bindBottomResize(handle) {
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 1280) return;
    event.preventDefault();
    const startY = event.clientY;
    const computed = getComputedStyle(document.documentElement);
    const initialHeight = parseInt(computed.getPropertyValue("--bottom-dock-height"), 10);
    const min = 140;
    const max = Math.floor(window.innerHeight * 0.45);

    const onMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY;
      document.documentElement.style.setProperty("--bottom-dock-height", `${Math.max(min, Math.min(max, initialHeight + delta))}px`);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveUiState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

let lastCanvasPanAt = 0;

function bindCanvasPan(canvas) {
  if (!canvas) return;

  canvas.addEventListener("scroll", () => {
    renderMiniMap();
  });

  canvas.addEventListener("dragover", (event) => {
    const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
    if (types.includes("text/agent-id") || types.includes("text/plain")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  });

  canvas.addEventListener("drop", (event) => {
    const agentId = event.dataTransfer?.getData("text/agent-id") || event.dataTransfer?.getData("text/plain");
    if (!agentId) return;
    event.preventDefault();
    const surfaceRect = el.canvasSurface.getBoundingClientRect();
    const x = Math.round(event.clientX - surfaceRect.left - 100);
    const y = Math.round(event.clientY - surfaceRect.top - 56);
    addNodeForAgent(agentId, { x, y });
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) return;
    const targetId = target.id || "";
    if (!["canvas", "canvas-surface", "canvas-links", "canvas-nodes"].includes(targetId)) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initialScrollLeft = canvas.scrollLeft;
    const initialScrollTop = canvas.scrollTop;
    let moved = false;

    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!moved && Math.hypot(deltaX, deltaY) < 4) return;
      if (!moved) {
        moved = true;
        canvas.classList.add("panning");
        canvas.setPointerCapture(event.pointerId);
      }
      canvas.scrollLeft = initialScrollLeft - deltaX;
      canvas.scrollTop = initialScrollTop - deltaY;
    };

    const onUp = () => {
      canvas.classList.remove("panning");
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      if (moved) {
        lastCanvasPanAt = Date.now();
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  });
}

function bindMiniMapNavigation() {
  if (!el.miniMapSurface || !el.canvas || !el.canvasSurface) return;

  el.miniMapSurface.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = el.miniMapSurface.getBoundingClientRect();
    const mapX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const mapY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const surfaceWidth = Math.max(el.canvasSurface.clientWidth || BASE_SURFACE_WIDTH, 1);
    const surfaceHeight = Math.max(el.canvasSurface.clientHeight || BASE_SURFACE_HEIGHT, 1);
    const targetX = (mapX / Math.max(rect.width, 1)) * surfaceWidth;
    const targetY = (mapY / Math.max(rect.height, 1)) * surfaceHeight;

    el.canvas.scrollLeft = Math.max(0, targetX - el.canvas.clientWidth / 2);
    el.canvas.scrollTop = Math.max(0, targetY - el.canvas.clientHeight / 2);
    renderMiniMap();
  });
}

function bindMiniMapDrag() {
  if (!el.canvasMinimap) return;

  const handle = el.canvasMinimap.querySelector(".canvas-minimap-header");
  if (!handle) return;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const rect = el.canvasMinimap.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;

    const onMove = (moveEvent) => {
      const nextLeft = Math.max(12, Math.min(window.innerWidth - rect.width - 12, initialLeft + (moveEvent.clientX - startX)));
      const nextTop = Math.max(84, Math.min(window.innerHeight - rect.height - 12, initialTop + (moveEvent.clientY - startY)));
      state.miniMapPosition = {
        x: Math.round(nextLeft),
        y: Math.round(nextTop),
      };
      renderMiniMap();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveUiState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

if (el.canvas) {
  el.canvas.addEventListener("scroll", () => {
    saveUiState();
    renderMiniMap();
  });

  el.canvas.addEventListener("click", (event) => {
    if (Date.now() - lastCanvasPanAt < 120) return;
    const target = event.target;
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) return;
    const targetId = target.id || "";
    if (!["canvas", "canvas-surface", "canvas-links", "canvas-nodes"].includes(targetId)) return;
    if (state.selectedNodeId) {
      state.selectedNodeId = null;
      saveUiState();
      renderAll();
    }
  });
}

el.runAllBtn.addEventListener("click", runWorkspace);
el.agentSettingsBtn?.addEventListener("click", openSettingsModal);
el.closeSettingsBtn?.addEventListener("click", closeSettingsModal);
el.settingsBackdrop?.addEventListener("click", closeSettingsModal);
el.workspaceManagerBtn?.addEventListener("click", openWorkspaceModal);
el.closeWorkspaceBtn?.addEventListener("click", closeWorkspaceModal);
el.workspaceBackdrop?.addEventListener("click", closeWorkspaceModal);
el.newAgentBtn?.addEventListener("click", createNewAgentInstance);
el.librarySwitch?.querySelectorAll("[data-library-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.libraryView = button.dataset.libraryView || "agents";
    saveUiState();
    renderAll();
  });
});
el.toggleStatusStripBtn?.addEventListener("click", () => {
  state.statusStripVisible = !state.statusStripVisible;
  saveUiState();
  renderAll();
});
el.toggleMinimapBtn?.addEventListener("click", () => {
  state.miniMapVisible = !state.miniMapVisible;
  saveUiState();
  renderAll();
});
el.hideMinimapBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  state.miniMapVisible = false;
  saveUiState();
  renderAll();
});
el.toggleLeftPanelBtn?.addEventListener("click", () => toggleLeftPanel(false));
el.toggleRightPanelBtn?.addEventListener("click", () => toggleRightPanel(false));
el.leftEdgeToggle?.addEventListener("click", () => toggleLeftPanel(true));
el.rightEdgeToggle?.addEventListener("click", () => toggleRightPanel(true));
if (el.stepBtn) {
  el.stepBtn.addEventListener("click", () => { appendLog("Info", "Step execution is not implemented."); renderAll(); });
}
el.clearLogBtn?.addEventListener("click", async () => {
  try {
    await clearCollaborationMessages();
    renderAll();
  } catch (error) {
    appendLog("Clear Failed", error.message || String(error));
    renderAll();
  }
});
el.saveBtn.addEventListener("click", async () => {
  try { await saveWorkspaceToBackend(); } catch (error) { appendLog("Save Failed", error.message); renderAll(); }
});
el.resetBtn.addEventListener("click", createNewWorkspace);
el.newWorkspaceBtn.addEventListener("click", createNewWorkspace);
el.addNodeBtn.addEventListener("click", addNode);
el.exportBtn.addEventListener("click", exportWorkspace);
el.importInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importWorkspace(file);
  event.target.value = "";
});

bindPanelResize(el.leftResizer, "left");
bindPanelResize(el.rightResizer, "right");
bindBottomResize(el.bottomResizer);
bindCanvasPan(el.canvas);
bindMiniMapNavigation();
bindMiniMapDrag();

el.panelLeft?.addEventListener("contextmenu", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("[data-agent-id]")) {
    return;
  }
  event.preventDefault();
  openContextMenu(event.clientX, event.clientY, [
    {
      label: state.libraryView === "functions" ? "Switch to Agents to create instances" : "New Agent Instance",
      action: () => {
        if (state.libraryView === "functions") {
          state.libraryView = "agents";
          saveUiState();
          renderAll();
          return;
        }
        createNewAgentInstance();
        closeContextMenu();
      },
    },
  ]);
});

window.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest("#context-menu")) return;
  closeContextMenu();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.settingsModalOpen) {
      closeSettingsModal();
    }
    if (state.workspaceModalOpen) {
      closeWorkspaceModal();
    }
    closeContextMenu();
  }
});

window.addEventListener("resize", () => {
  renderMiniMap();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  saveUiState();
  if (state.workspaceId) {
    saveWorkspaceToBackend({ silent: true }).catch(() => {});
  }
});

window.addEventListener("beforeunload", () => {
  saveUiState();
});

bootstrap();
