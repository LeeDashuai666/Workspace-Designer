const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const store = require("./backend/store");
const bus = require("./backend/messageBus");
const orchestrator = require("./backend/orchestrator");
const { scanAgents } = require("./backend/processScanner");

function resolvePort() {
  const argvPort = process.argv
    .find((arg) => arg.startsWith("--port="))
    ?.split("=")[1];
  const rawPort = argvPort || process.env.PORT || "4173";
  const parsed = Number.parseInt(rawPort, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4173;
}

const PORT = resolvePort();
const ROOT = __dirname;

store.ensureStore();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error("invalid json body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "agentcanvas-backend",
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && pathname === "/api/agents/scan") {
    const result = await scanAgents();
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && pathname === "/api/templates") {
    return sendJson(res, 200, { templates: store.listTemplates() });
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    return sendJson(res, 200, { agentSettings: store.getAgentSettings() });
  }

  if (req.method === "POST" && pathname === "/api/settings") {
    const body = await readBody(req);
    const agentSettings = store.saveAgentSettings(body.agentSettings || {});
    return sendJson(res, 200, { agentSettings });
  }

  if (req.method === "GET" && pathname === "/api/workflows") {
    return sendJson(res, 200, { workflows: store.listWorkflows() });
  }

  if (req.method === "GET" && pathname === "/api/workspaces") {
    return sendJson(res, 200, { workspaces: store.listWorkspaces() });
  }

  if (req.method === "POST" && pathname === "/api/workspaces") {
    const body = await readBody(req);
    const workspace = store.saveWorkspace(body);
    return sendJson(res, 201, { workspace });
  }

  if (req.method === "POST" && pathname === "/api/workspaces/validate-write") {
    const body = await readBody(req);
    return sendJson(res, 200, store.validateWorkspaceWriteAccess(body.folderPath));
  }

  if (req.method === "POST" && pathname === "/api/workflows") {
    const body = await readBody(req);
    const workflow = store.saveWorkflow(body);
    return sendJson(res, 201, { workflow });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/workspaces/")) {
    const workspaceId = pathname.split("/").pop();
    store.deleteWorkspace(workspaceId);
    return sendJson(res, 200, { deleted: true, workspaceId });
  }

  if (req.method === "GET" && pathname.startsWith("/api/workspaces/")) {
    const workspaceId = pathname.split("/").pop();
    const workspace = store.getWorkspace(workspaceId);
    if (!workspace) {
      return sendJson(res, 404, { error: "workspace not found" });
    }
    return sendJson(res, 200, { workspace });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/workflows/")) {
    const workflowId = pathname.split("/").pop();
    store.deleteWorkflow(workflowId);
    return sendJson(res, 200, { deleted: true, workflowId });
  }

  if (req.method === "GET" && pathname.startsWith("/api/workflows/")) {
    const workflowId = pathname.split("/").pop();
    const workflow = store.getWorkflow(workflowId);
    if (!workflow) {
      return sendJson(res, 404, { error: "workflow not found" });
    }
    return sendJson(res, 200, { workflow });
  }

  if (req.method === "GET" && pathname === "/api/bus/messages") {
    return sendJson(res, 200, { messages: bus.list() });
  }

  if (req.method === "DELETE" && pathname === "/api/bus/messages") {
    store.clearBusMessages();
    return sendJson(res, 200, { cleared: true, messages: [] });
  }

  if (req.method === "GET" && pathname === "/api/runs") {
    return sendJson(res, 200, {
      activeRuns: orchestrator.listRuns(),
      history: store.listRunHistory(),
    });
  }

  if (req.method === "GET" && pathname.startsWith("/api/runs/")) {
    const runId = pathname.split("/").pop();
    const run = orchestrator.getRun(runId) || store.listRunHistory().find((item) => item.id === runId);
    if (!run) {
      return sendJson(res, 404, { error: "run not found" });
    }
    return sendJson(res, 200, { run });
  }

  if (req.method === "POST" && pathname === "/api/runs") {
    const body = await readBody(req);
    const workspace =
      (body.workspaceId && store.getWorkspace(body.workspaceId)) ||
      (body.workflowId && store.getWorkflow(body.workflowId)) ||
      (body.workspace && store.saveWorkspace(body.workspace)) ||
      body.workflow ||
      null;

    if (!workspace || !Array.isArray(workspace.nodes)) {
      return sendJson(res, 400, { error: "workspace is required" });
    }

    const run = orchestrator.startWorkflow(workspace, store.listConfiguredAgents());
    return sendJson(res, 202, { run });
  }

  return sendJson(res, 404, { error: "api route not found" });
}

function serveStatic(req, res, pathname) {
  const urlPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT, decodeURIComponent(urlPath));

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, {
      error: "internal server error",
      message: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`AgentCanvas demo running at http://localhost:${PORT}`);
  console.log(`Backend API ready at http://localhost:${PORT}/api/health`);
});
