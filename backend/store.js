const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const WORKSPACES_DIR = path.join(__dirname, "..", "workspaces");

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function validateWorkspaceWriteAccess(folderPath) {
  const resolvedFolderPath = path.resolve(String(folderPath || "").trim());
  if (!resolvedFolderPath) {
    return { ok: false, code: "INVALID_PATH", error: "workspace folder path is required" };
  }

  try {
    ensureDir(resolvedFolderPath);
    const tempPath = path.join(resolvedFolderPath, `.agentcanvas-write-test-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(tempPath, "write-test", "utf8");
    fs.unlinkSync(tempPath);
    return { ok: true, folderPath: resolvedFolderPath };
  } catch (error) {
    return {
      ok: false,
      folderPath: resolvedFolderPath,
      code: error.code || "WRITE_TEST_FAILED",
      error: error.message,
    };
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";
}

function normalizeFolderName(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .replace(/[\\/:"*?<>|]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return normalized || fallback;
}

function normalizeAgent(agent = {}, index = 0) {
  const configuredId = String(agent.configuredId || agent.id || "").trim();
  const name = String(agent.name || "").trim();
  return {
    instanceId: String(agent.instanceId || `agent_${crypto.randomUUID()}`),
    configuredId,
    name,
    enabled: Boolean(agent.enabled),
    baseUrl: String(agent.baseUrl || "").trim(),
    apiKey: String(agent.apiKey || "").trim(),
    model: String(agent.model || "").trim(),
    provider: "openai-compatible",
    sortOrder: Number.isFinite(agent.sortOrder) ? agent.sortOrder : index,
  };
}

function normalizeOutputTargets(targets) {
  return Array.isArray(targets)
    ? targets
        .map((target) => String(target || "").trim())
        .filter(Boolean)
    : [];
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
      return { sourceMode: "upstreamSummary", matchType: "contains", matchValue: "", evaluatorNodeId: "", trueTargetIds: [], falseTargetIds: [] };
    case "switch":
      return { sourceMode: "upstreamSummary", caseRules: "", defaultTargetIds: [] };
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

function normalizeFunctionConfig(functionType, config = {}) {
  const base = defaultFunctionConfig(functionType);
  const sourceMode = ["upstreamSummary", "upstreamText", "latestUpstream"].includes(config.sourceMode) ? config.sourceMode : base.sourceMode;
  const matchType = ["contains", "equals", "regex", "exists"].includes(config.matchType) ? config.matchType : base.matchType;
  const joinMode = ["all"].includes(config.joinMode) ? config.joinMode : base.joinMode;
  const mergeMode = ["sections", "bullets", "paragraph"].includes(config.mergeMode) ? config.mergeMode : base.mergeMode;

  switch (String(functionType || "start")) {
    case "trigger":
      return { delayMs: Number.isFinite(Number(config.delayMs)) ? Math.max(0, Number(config.delayMs)) : 0, targetIds: normalizeIdArray(config.targetIds) };
    case "condition":
      return { sourceMode, matchType, matchValue: String(config.matchValue || "").trim(), evaluatorNodeId: String(config.evaluatorNodeId || "").trim(), trueTargetIds: normalizeIdArray(config.trueTargetIds), falseTargetIds: normalizeIdArray(config.falseTargetIds) };
    case "switch":
      return { sourceMode, caseRules: String(config.caseRules || "").trim(), defaultTargetIds: normalizeIdArray(config.defaultTargetIds) };
    case "fork":
      return { targetIds: normalizeIdArray(config.targetIds) };
    case "join":
      return { joinMode };
    case "merge":
      return { mergeMode };
    case "retry":
      return { targetNodeId: String(config.targetNodeId || "").trim(), maxAttempts: Number.isFinite(Number(config.maxAttempts)) ? Math.min(5, Math.max(1, Number(config.maxAttempts))) : 1 };
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

function normalizeNode(node = {}, index = 0) {
  const nodeKind = node.nodeKind === "function" ? "function" : "agent";
  return {
    id: String(node.id || `node_${crypto.randomUUID()}`),
    nodeKind,
    functionType: nodeKind === "function" ? String(node.functionType || "start").trim() : "",
    agentId: nodeKind === "agent" ? String(node.agentId || "").trim() : "",
    config: nodeKind === "function" ? normalizeFunctionConfig(node.functionType || "start", node.config || {}) : {},
    title: String(node.title || `Node ${index + 1}`).trim(),
    description: String(node.description || "").trim(),
    dependsOn: Array.isArray(node.dependsOn) ? node.dependsOn.map((item) => String(item)) : [],
    x: Number.isFinite(node.x) ? node.x : undefined,
    y: Number.isFinite(node.y) ? node.y : undefined,
    output: String(node.output || ""),
    outputMode: ["text", "file", "files"].includes(node.outputMode) ? node.outputMode : "text",
    outputTargets: normalizeOutputTargets(node.outputTargets),
  };
}

function normalizeWorkspace(workspace = {}, index = 0) {
  const id = String(workspace.id || `ws_${crypto.randomUUID()}`);
  const name = String(workspace.name || `Workspace ${index + 1}`).trim();
  const defaultFolderName = `${slugify(name)}-${id.slice(-6)}`;
  const requestedFolderPath = String(workspace.folderPath || "").trim();
  const resolvedFolderPath = requestedFolderPath ? path.resolve(requestedFolderPath) : "";
  const derivedFolderName = resolvedFolderPath ? path.basename(resolvedFolderPath) : "";
  const folderName = normalizeFolderName(workspace.folderName || derivedFolderName, defaultFolderName);
  const folderPath = resolvedFolderPath || path.join(WORKSPACES_DIR, folderName);

  return {
    id,
    name,
    description: String(workspace.description || "").trim(),
    folderName,
    folderPath,
    nodes: Array.isArray(workspace.nodes) ? workspace.nodes.map(normalizeNode) : [],
    createdAt: workspace.createdAt || new Date().toISOString(),
    updatedAt: workspace.updatedAt || new Date().toISOString(),
  };
}

function normalizeAgentSettings(input = {}) {
  const sourceAgents = Array.isArray(input.agents) ? input.agents : [];
  return {
    agents: sourceAgents.map(normalizeAgent).filter((agent) => agent.instanceId),
  };
}

function normalizeStore(input = {}) {
  return {
    templates: [],
    workflows: [],
    workspaces: Array.isArray(input.workspaces) ? input.workspaces.map(normalizeWorkspace) : [],
    runHistory: Array.isArray(input.runHistory) ? input.runHistory : [],
    busMessages: Array.isArray(input.busMessages) ? input.busMessages : [],
    agentSettings: normalizeAgentSettings(input.agentSettings),
  };
}

function writeStore(data) {
  ensureDir(DATA_DIR);
  ensureDir(WORKSPACES_DIR);
  fs.writeFileSync(STORE_PATH, JSON.stringify(normalizeStore(data), null, 2), "utf8");
}

function ensureStore() {
  ensureDir(DATA_DIR);
  ensureDir(WORKSPACES_DIR);

  if (!fs.existsSync(STORE_PATH)) {
    writeStore({});
    return;
  }

  const current = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  const normalized = normalizeStore(current);
  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    writeStore(normalized);
  }

  normalized.workspaces.forEach((workspace) => ensureDir(workspace.folderPath));
}

function readStore() {
  ensureStore();
  return normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, "utf8")));
}

function listTemplates() {
  return [];
}

function listWorkflows() {
  return [];
}

function listWorkspaces() {
  return readStore().workspaces;
}

function saveWorkspace(workspace) {
  const store = readStore();
  const now = new Date().toISOString();
  const current = store.workspaces.find((item) => item.id === workspace.id) || null;
  const normalized = normalizeWorkspace({
    ...current,
    ...workspace,
    folderPath: workspace.folderPath || current?.folderPath,
    folderName: workspace.folderName || current?.folderName,
    createdAt: workspace.createdAt || now,
    updatedAt: now,
  });

  const index = store.workspaces.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    store.workspaces[index] = { ...store.workspaces[index], ...normalized, updatedAt: now };
  } else {
    store.workspaces.push(normalized);
  }

  writeStore(store);
  ensureDir(normalized.folderPath);
  return normalized;
}

function saveWorkflow(workflow) {
  return saveWorkspace(workflow);
}

function getWorkspace(workspaceId) {
  return readStore().workspaces.find((workspace) => workspace.id === workspaceId) || null;
}

function getWorkflow(workflowId) {
  return getWorkspace(workflowId);
}

function deleteWorkspace(workspaceId) {
  const store = readStore();
  store.workspaces = store.workspaces.filter((workspace) => workspace.id !== workspaceId);
  writeStore(store);
}

function deleteWorkflow(workflowId) {
  deleteWorkspace(workflowId);
}

function appendBusMessage(message) {
  const store = readStore();
  store.busMessages.push(message);
  if (store.busMessages.length > 500) {
    store.busMessages = store.busMessages.slice(-500);
  }
  writeStore(store);
}

function listBusMessages() {
  return readStore().busMessages;
}

function clearBusMessages() {
  const store = readStore();
  store.busMessages = [];
  writeStore(store);
  return [];
}

function appendRunHistory(run) {
  const store = readStore();
  store.runHistory.push(run);
  if (store.runHistory.length > 100) {
    store.runHistory = store.runHistory.slice(-100);
  }
  writeStore(store);
}

function listRunHistory() {
  return readStore().runHistory;
}

function getAgentSettings() {
  return readStore().agentSettings;
}

function listConfiguredAgents() {
  return getAgentSettings().agents.map((agent) => ({
    id: agent.instanceId,
    configuredId: agent.configuredId,
    name: agent.name,
    enabled: agent.enabled,
    baseUrl: agent.baseUrl,
    apiKey: agent.apiKey,
    model: agent.model,
    provider: agent.provider,
    agentType: "api",
    transport: "https",
  }));
}

function saveAgentSettings(agentSettings) {
  const store = readStore();
  store.agentSettings = normalizeAgentSettings(agentSettings);
  writeStore(store);
  return store.agentSettings;
}

module.exports = {
  ensureStore,
  validateWorkspaceWriteAccess,
  listTemplates,
  listWorkflows,
  listWorkspaces,
  saveWorkflow,
  saveWorkspace,
  getWorkflow,
  getWorkspace,
  deleteWorkflow,
  deleteWorkspace,
  appendBusMessage,
  listBusMessages,
  clearBusMessages,
  appendRunHistory,
  listRunHistory,
  getAgentSettings,
  listConfiguredAgents,
  saveAgentSettings,
};
