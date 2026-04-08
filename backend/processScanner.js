const os = require("os");
const store = require("./store");

function agentStatus(agent) {
  if (!agent.enabled) {
    return "disabled";
  }
  if (!agent.baseUrl || !agent.apiKey || !agent.model || !agent.configuredId || !agent.name) {
    return "needs-config";
  }
  return "ready";
}

async function scanAgents() {
  const settings = store.getAgentSettings();
  const agents = settings.agents.map((agent) => ({
    id: agent.instanceId,
    configuredId: agent.configuredId,
    name: agent.name,
    agentType: "api",
    transport: "https",
    provider: agent.provider,
    status: agentStatus(agent),
    confidence: "configured",
    detectionReason: "Configured from saved API settings",
    baseUrl: agent.baseUrl,
    model: agent.model,
    enabled: agent.enabled,
  }));

  return {
    platform: os.platform(),
    scannedAt: new Date().toISOString(),
    agents,
  };
}

module.exports = {
  scanAgents,
};
