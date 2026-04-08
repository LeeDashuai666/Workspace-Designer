const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bus = require("./messageBus");
const store = require("./store");
const { createAdapter } = require("./adapters");

function topologicalSort(nodes) {
  const indegree = new Map();
  const edges = new Map();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    edges.set(node.id, []);
  }

  for (const node of nodes) {
    for (const parentId of node.dependsOn || []) {
      if (!indegree.has(parentId)) {
        throw new Error(`Node ${node.id} depends on missing node ${parentId}`);
      }
      indegree.set(node.id, indegree.get(node.id) + 1);
      edges.get(parentId).push(node.id);
    }
  }

  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const result = [];

  while (queue.length) {
    const nodeId = queue.shift();
    result.push(nodeId);

    for (const nextId of edges.get(nodeId)) {
      indegree.set(nextId, indegree.get(nextId) - 1);
      if (indegree.get(nextId) === 0) {
        queue.push(nextId);
      }
    }
  }

  if (result.length !== nodes.length) {
    throw new Error("Workflow must be a DAG with no cyclic dependencies");
  }

  return result;
}

function safeWorkspacePath(workspacePath, relativeTarget) {
  const resolved = path.resolve(workspacePath, relativeTarget);
  const base = path.resolve(workspacePath);
  if (!resolved.startsWith(base)) {
    throw new Error(`Output target "${relativeTarget}" is outside the workspace`);
  }
  return resolved;
}

function formatWriteError(error, outputPath, workspacePath) {
  if (!error) {
    return `Failed to write output file "${outputPath}"`;
  }

  if (error.code === "EPERM" || error.code === "EACCES") {
    return [
      `Cannot write output file "${outputPath}" (${error.code}).`,
      `Windows denied access to the selected workspace folder "${workspacePath}".`,
      "Choose a different workspace folder such as one under Documents or a project folder you created yourself, or close any app currently locking that file.",
    ].join(" ");
  }

  return `Failed to write output file "${outputPath}": ${error.message}`;
}

function writeNodeOutputs(workspace, node, content) {
  if (!workspace?.folderPath || !node?.outputTargets?.length || node.outputMode === "text") {
    return [];
  }

  return node.outputTargets.map((target) => {
    const outputPath = safeWorkspacePath(workspace.folderPath, target);
    try {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, content, "utf8");
    } catch (error) {
      throw new Error(formatWriteError(error, outputPath, workspace.folderPath));
    }
    return outputPath;
  });
}

function collectUpstreamContext(run, node) {
  const dependencyIds = node.dependsOn || [];
  const upstreamOutputs = dependencyIds
    .map((dependencyId) => run.outputs.find((item) => item.nodeId === dependencyId))
    .filter(Boolean)
    .map((item) => ({
      nodeId: item.nodeId,
      nodeTitle: item.nodeTitle,
      agentId: item.agentId,
      content: item.content,
      writtenFiles: item.writtenFiles || [],
    }));

  const upstreamSummary = upstreamOutputs.length
    ? upstreamOutputs
        .map((item, index) => [
          `Upstream ${index + 1}: ${item.nodeTitle}`,
          `Agent: ${item.agentId}`,
          `Content:`,
          item.content,
          item.writtenFiles.length ? `Written files: ${item.writtenFiles.join(", ")}` : "",
        ].filter(Boolean).join("\n"))
        .join("\n\n")
    : "";

  return {
    dependencyIds,
    upstreamOutputs,
    upstreamSummary,
  };
}

function summarizeOutputItems(items = []) {
  const upstreamOutputs = items
    .filter(Boolean)
    .map((item) => ({
      nodeId: item.nodeId,
      nodeTitle: item.nodeTitle,
      agentId: item.agentId,
      content: item.content,
      writtenFiles: item.writtenFiles || [],
    }));

  const upstreamSummary = upstreamOutputs.length
    ? upstreamOutputs
        .map((item, index) => [
          `Upstream ${index + 1}: ${item.nodeTitle}`,
          `Agent: ${item.agentId}`,
          "Content:",
          item.content,
          item.writtenFiles.length ? `Written files: ${item.writtenFiles.join(", ")}` : "",
        ].filter(Boolean).join("\n"))
        .join("\n\n")
    : "";

  return {
    dependencyIds: upstreamOutputs.map((item) => item.nodeId),
    upstreamOutputs,
    upstreamSummary,
  };
}

function upsertRunOutput(run, output) {
  const index = run.outputs.findIndex((item) => item.nodeId === output.nodeId);
  if (index >= 0) {
    run.outputs[index] = output;
    return;
  }
  run.outputs.push(output);
}

function compressText(input, maxLength = 1200) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function listDownstreamNodeIds(workspace, sourceNodeId) {
  return (workspace.nodes || [])
    .filter((node) => (node.dependsOn || []).includes(sourceNodeId))
    .map((node) => node.id);
}

function resolveTargetTokens(workspace, tokens = []) {
  const result = [];
  for (const rawToken of tokens) {
    const token = String(rawToken || "").trim();
    if (!token) continue;
    const matched = (workspace.nodes || []).find((node) => node.id === token || node.title === token);
    if (matched && !result.includes(matched.id)) {
      result.push(matched.id);
    }
  }
  return result;
}

function sourceTextFromContext(config = {}, upstreamContext = {}) {
  const mode = String(config.sourceMode || "upstreamSummary");
  const upstream = upstreamContext.upstreamOutputs || [];
  if (mode === "latestUpstream") {
    return String(upstream[upstream.length - 1]?.content || "");
  }
  if (mode === "upstreamText") {
    return upstream.map((item) => item.content).join("\n\n");
  }
  return String(upstreamContext.upstreamSummary || "");
}

function evaluateMatch(sourceText, matchType, matchValue) {
  const source = String(sourceText || "");
  const normalizedValue = String(matchValue || "");

  switch (String(matchType || "contains")) {
    case "equals":
      return source.trim().toLowerCase() === normalizedValue.trim().toLowerCase();
    case "regex":
      try {
        return normalizedValue ? new RegExp(normalizedValue, "i").test(source) : false;
      } catch {
        return false;
      }
    case "exists":
      return source.trim().length > 0;
    case "contains":
    default:
      return normalizedValue ? source.toLowerCase().includes(normalizedValue.toLowerCase()) : false;
  }
}

function parseSwitchRules(caseRulesText, workspace) {
  return String(caseRulesText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [matchPart, targetsPart = ""] = line.split("=>");
      const matchValue = String(matchPart || "").trim();
      const targetTokens = String(targetsPart || "").split(",").map((item) => item.trim()).filter(Boolean);
      return {
        matchValue,
        targetIds: resolveTargetTokens(workspace, targetTokens),
      };
    })
    .filter((rule) => rule.matchValue);
}

function collectRetryPolicies(workspace) {
  const policies = new Map();
  for (const node of workspace.nodes || []) {
    if (node.nodeKind !== "function" || node.functionType !== "retry") continue;
    const targetNodeId = String(node.config?.targetNodeId || "").trim();
    const maxAttempts = Math.min(5, Math.max(1, Number(node.config?.maxAttempts || 1)));
    if (!targetNodeId) continue;
    policies.set(targetNodeId, Math.max(maxAttempts, policies.get(targetNodeId) || 0));
  }
  return policies;
}

function shouldSkipNode(run, node) {
  for (const dependencyId of node.dependsOn || []) {
    const dependencyState = run.nodeStates[dependencyId];
    if (dependencyState?.status === "skipped") {
      return `Dependency ${dependencyId} was skipped`;
    }
    const allowedTargets = run.controlTargets?.get(dependencyId);
    if (allowedTargets && !allowedTargets.has(node.id)) {
      return `Control flow from ${dependencyId} did not select this node`;
    }
  }
  return "";
}

function findWorkspaceNode(workspace, nodeId) {
  return (workspace.nodes || []).find((node) => node.id === nodeId) || null;
}

async function invokeEvaluatorNode(evaluatorNode, conditionNode, upstreamContext, helpers) {
  const evaluatorTarget = findAgentForNode(evaluatorNode, helpers.agentCatalog);
  const taskEnvelope = bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: "condition",
    to: evaluatorTarget.id,
    role: "task",
    content: [
      evaluatorNode.description || evaluatorNode.title || "Make a decision.",
      "",
      `This is a condition callback for node: ${conditionNode.title || conditionNode.id}`,
      "Return a short decision string that can be matched by the condition rule.",
    ].join("\n"),
    metadata: {
      nodeId: evaluatorNode.id,
      nodeTitle: `${evaluatorNode.title} (Condition Review)`,
      agentRole: evaluatorNode.agentId,
      dependsOn: upstreamContext.dependencyIds,
      upstreamOutputs: upstreamContext.upstreamOutputs,
      upstreamSummary: upstreamContext.upstreamSummary,
    },
  });

  const result = await runAgentNode(taskEnvelope, evaluatorTarget);
  bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: evaluatorTarget.id,
    to: "condition",
    role: "result",
    content: result.content,
    metadata: {
      nodeId: conditionNode.id,
      adapter: result.metadata?.adapter || "AgentEvaluator",
      evaluatorNodeId: evaluatorNode.id,
    },
  });
  return result;
}

async function invokeReviewerNode(reviewerNode, reviewNode, upstreamContext, helpers, round) {
  const reviewerTarget = findAgentForNode(reviewerNode, helpers.agentCatalog);
  const taskEnvelope = bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: "review_loop",
    to: reviewerTarget.id,
    role: "task",
    content: [
      reviewerNode.description || reviewerNode.title || "Review the current work.",
      "",
      `This is review round ${round} for node: ${reviewNode.title || reviewNode.id}`,
      "Decide whether the current work should be approved or rejected.",
      "If rejected, include concrete revision feedback for the rework nodes.",
      "Respond in plain text and include a stable decision token such as 'decision: approved' or 'decision: reject'.",
    ].join("\n"),
    metadata: {
      nodeId: reviewerNode.id,
      nodeTitle: `${reviewerNode.title} (Review Loop)`,
      agentRole: reviewerNode.agentId,
      dependsOn: upstreamContext.dependencyIds,
      upstreamOutputs: upstreamContext.upstreamOutputs,
      upstreamSummary: upstreamContext.upstreamSummary,
      reviewRound: round,
      reviewNodeId: reviewNode.id,
    },
  });

  const result = await runAgentNode(taskEnvelope, reviewerTarget);
  bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: reviewerTarget.id,
    to: "review_loop",
    role: "result",
    content: result.content,
    metadata: {
      nodeId: reviewNode.id,
      adapter: result.metadata?.adapter || "ReviewLoop",
      reviewerNodeId: reviewerNode.id,
      reviewRound: round,
    },
  });
  return result;
}

async function invokeReworkNode(reworkNode, reviewNode, feedbackText, upstreamContext, helpers, round) {
  const reworkTarget = findAgentForNode(reworkNode, helpers.agentCatalog);
  const taskEnvelope = bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: "review_loop",
    to: reworkTarget.id,
    role: "task",
    content: [
      reworkNode.description || reworkNode.title || "Revise the current work.",
      "",
      `Reviewer feedback from ${reviewNode.title || reviewNode.id}:`,
      feedbackText || "No feedback provided.",
      "",
      "Revise your previous output to address the feedback above.",
    ].join("\n"),
    metadata: {
      nodeId: reworkNode.id,
      nodeTitle: `${reworkNode.title} (Rework)`,
      agentRole: reworkNode.agentId,
      dependsOn: upstreamContext.dependencyIds,
      upstreamOutputs: upstreamContext.upstreamOutputs,
      upstreamSummary: upstreamContext.upstreamSummary,
      reviewRound: round,
      reviewNodeId: reviewNode.id,
      reviewFeedback: feedbackText,
    },
  });

  const result = await runAgentNode(taskEnvelope, reworkTarget);
  const writtenFiles = writeNodeOutputs(helpers.workspace, reworkNode, result.content);
  const outputEnvelope = bus.publish({
    runId: helpers.run.id,
    workflowId: helpers.workspace.id,
    from: reworkTarget.id,
    to: "review_loop",
    role: "result",
    content: result.content,
    metadata: {
      nodeId: reworkNode.id,
      adapter: result.metadata?.adapter || "ReviewLoop",
      writtenFiles,
      reviewRound: round,
      reviewNodeId: reviewNode.id,
    },
  });

  helpers.run.nodeStates[reworkNode.id] = {
    ...(helpers.run.nodeStates[reworkNode.id] || {}),
    status: "done",
    agentId: reworkTarget.id,
    startedAt: helpers.run.nodeStates[reworkNode.id]?.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    outputMessageId: outputEnvelope.id,
    revisedBy: reviewNode.id,
    reviewRound: round,
  };

  const output = {
    nodeId: reworkNode.id,
    nodeTitle: reworkNode.title,
    agentId: reworkTarget.id,
    content: result.content,
    outputMode: reworkNode.outputMode,
    writtenFiles,
  };
  upsertRunOutput(helpers.run, output);
  return output;
}

async function executeFunctionNode(node, upstreamContext, helpers) {
  const functionType = String(node.functionType || "start");
  const upstream = upstreamContext.upstreamOutputs || [];
  const config = node.config || {};
  const downstreamIds = listDownstreamNodeIds(helpers.workspace, node.id);
  const allDownstream = new Set(downstreamIds);

  switch (functionType) {
    case "start":
    case "task_input":
      return {
        content: node.description || node.title || "Task input",
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    case "trigger": {
      const delayMs = Math.max(0, Number(config.delayMs || 0));
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const selectedTargets = resolveTargetTokens(helpers.workspace, config.targetIds || []);
      return {
        content: [
          node.description || "Trigger activated.",
          delayMs ? `Delay applied: ${delayMs}ms` : "",
          upstreamContext.upstreamSummary || "",
        ].filter(Boolean).join("\n\n"),
        metadata: {
          adapter: "FunctionNode",
          provider: "local",
          functionType,
          selectedTargets: new Set(selectedTargets.length ? selectedTargets : downstreamIds),
        },
      };
    }
    case "fork":
    case "parallel_hub": {
      const selectedTargets = resolveTargetTokens(helpers.workspace, config.targetIds || []);
      return {
        content: [
          node.description ? `Instruction: ${node.description}` : "",
          upstreamContext.upstreamSummary || "No upstream content yet.",
        ].filter(Boolean).join("\n\n"),
        metadata: {
          adapter: "FunctionNode",
          provider: "local",
          functionType,
          selectedTargets: new Set(selectedTargets.length ? selectedTargets : downstreamIds),
        },
      };
    }
    case "condition": {
      let sourceText = sourceTextFromContext(config, upstreamContext);
      if (config.evaluatorNodeId) {
        const evaluatorNode = findWorkspaceNode(helpers.workspace, config.evaluatorNodeId);
        if (!evaluatorNode) {
          throw new Error(`Condition node "${node.title}" references missing evaluator node "${config.evaluatorNodeId}"`);
        }
        if (evaluatorNode.nodeKind !== "agent") {
          throw new Error(`Condition evaluator "${evaluatorNode.title}" must be an agent node`);
        }
        const evaluatorResult = await invokeEvaluatorNode(evaluatorNode, node, upstreamContext, helpers);
        sourceText = String(evaluatorResult.content || "");
      }
      const matched = evaluateMatch(sourceText, config.matchType, config.matchValue);
      const trueTargets = resolveTargetTokens(helpers.workspace, config.trueTargetIds || []);
      const falseTargets = resolveTargetTokens(helpers.workspace, config.falseTargetIds || []);
      const selectedTargets = matched
        ? (trueTargets.length ? trueTargets : downstreamIds)
        : falseTargets;
      return {
        content: [
          `Condition result: ${matched ? "true" : "false"}`,
          `Rule: ${config.matchType || "contains"} ${config.matchValue || "(empty)"}`,
          compressText(sourceText, 500) || "No source text",
        ].join("\n\n"),
        metadata: {
          adapter: "FunctionNode",
          provider: "local",
          functionType,
          matched,
          selectedTargets: new Set(selectedTargets),
        },
      };
    }
    case "switch": {
      const sourceText = sourceTextFromContext(config, upstreamContext);
      const rules = parseSwitchRules(config.caseRules, helpers.workspace);
      const matchedRule = rules.find((rule) => evaluateMatch(sourceText, "contains", rule.matchValue));
      const defaultTargets = resolveTargetTokens(helpers.workspace, config.defaultTargetIds || []);
      const selectedTargets = matchedRule?.targetIds?.length ? matchedRule.targetIds : defaultTargets;
      return {
        content: [
          `Switch case: ${matchedRule?.matchValue || "default"}`,
          compressText(sourceText, 500) || "No source text",
        ].join("\n\n"),
        metadata: {
          adapter: "FunctionNode",
          provider: "local",
          functionType,
          selectedTargets: new Set(selectedTargets),
          matchedCase: matchedRule?.matchValue || "default",
        },
      };
    }
    case "join":
      return {
        content: upstream.length
          ? upstream.map((item, index) => `## Joined ${index + 1}: ${item.nodeTitle}\n\n${item.content}`).join("\n\n")
          : (node.description || "No upstream outputs to join."),
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    case "merge":
    case "merge_summary": {
      let content = node.description || "No upstream outputs to merge.";
      if (upstream.length) {
        const mergeMode = String(config.mergeMode || "sections");
        if (mergeMode === "bullets") {
          content = upstream.map((item) => `- ${item.nodeTitle}: ${compressText(item.content, 240)}`).join("\n");
        } else if (mergeMode === "paragraph") {
          content = upstream.map((item) => item.content).join("\n\n");
        } else {
          content = upstream.map((item, index) => `## Source ${index + 1}: ${item.nodeTitle}\n\n${item.content}`).join("\n\n");
        }
      }
      return {
        content,
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    }
    case "end":
      return {
        content: upstream.length
          ? [
              `Workflow end: ${node.title || "End"}`,
              node.description || "",
              ...upstream.map((item) => `### ${item.nodeTitle}\n\n${item.content}`),
            ].filter(Boolean).join("\n\n")
          : `${node.title || "End"}\n\n${node.description || "No upstream outputs yet."}`,
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: new Set() },
      };
    case "retry": {
      const targetNodeId = String(config.targetNodeId || "").trim();
      const usedAttempts = helpers.run.retryAttempts.get(targetNodeId) || 0;
      return {
        content: [
          "Retry policy checkpoint",
          targetNodeId ? `Target node: ${targetNodeId}` : "No retry target configured.",
          `Attempts used in this run: ${usedAttempts}`,
          `Max attempts: ${Math.min(5, Math.max(1, Number(config.maxAttempts || 1)))}`,
        ].join("\n\n"),
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    }
    case "review_loop": {
      const reviewerNodeId = String(config.reviewerNodeId || "").trim();
      if (!reviewerNodeId) {
        throw new Error(`Review Loop node "${node.title}" requires a reviewer node`);
      }
      const reviewerNode = findWorkspaceNode(helpers.workspace, reviewerNodeId);
      if (!reviewerNode) {
        throw new Error(`Review Loop node "${node.title}" references missing reviewer node "${reviewerNodeId}"`);
      }
      if (reviewerNode.nodeKind !== "agent") {
        throw new Error(`Review Loop reviewer "${reviewerNode.title}" must be an agent node`);
      }

      const approvedTargets = resolveTargetTokens(helpers.workspace, config.approvedTargetIds || []);
      const reworkTargetIds = resolveTargetTokens(helpers.workspace, config.reworkTargetIds || [])
        .sort((left, right) => helpers.run.order.indexOf(left) - helpers.run.order.indexOf(right));
      const maxRounds = Math.min(5, Math.max(1, Number(config.maxRounds || 2)));
      let currentContext = {
        dependencyIds: upstreamContext.dependencyIds,
        upstreamOutputs: [...upstream],
        upstreamSummary: sourceTextFromContext(config, upstreamContext) || upstreamContext.upstreamSummary || "",
      };
      let lastReviewText = "";

      for (let round = 1; round <= maxRounds; round += 1) {
        const reviewerResult = await invokeReviewerNode(reviewerNode, node, currentContext, helpers, round);
        lastReviewText = String(reviewerResult.content || "");
        const approved = evaluateMatch(lastReviewText, config.matchType, config.matchValue);

        if (approved) {
          return {
            content: [
              `Review loop approved in round ${round}`,
              `Rule: ${config.matchType || "contains"} ${config.matchValue || "(empty)"}`,
              lastReviewText || "No review text returned.",
              currentContext.upstreamSummary || "",
            ].filter(Boolean).join("\n\n"),
            metadata: {
              adapter: "FunctionNode",
              provider: "local",
              functionType,
              matched: true,
              reviewRounds: round,
              reviewerNodeId,
              selectedTargets: new Set(approvedTargets.length ? approvedTargets : downstreamIds),
            },
          };
        }

        if (!reworkTargetIds.length || round === maxRounds) {
          return {
            content: [
              `Review loop rejected after ${round} round(s)`,
              `Rule: ${config.matchType || "contains"} ${config.matchValue || "(empty)"}`,
              lastReviewText || "No review text returned.",
            ].filter(Boolean).join("\n\n"),
            metadata: {
              adapter: "FunctionNode",
              provider: "local",
              functionType,
              matched: false,
              reviewRounds: round,
              reviewerNodeId,
              selectedTargets: new Set(),
            },
          };
        }

        const reworkOutputs = [];
        for (const reworkNodeId of reworkTargetIds) {
          const reworkNode = findWorkspaceNode(helpers.workspace, reworkNodeId);
          if (!reworkNode) {
            throw new Error(`Review Loop node "${node.title}" references missing rework node "${reworkNodeId}"`);
          }
          if (reworkNode.nodeKind !== "agent") {
            throw new Error(`Review Loop rework target "${reworkNode.title}" must be an agent node`);
          }
          const reworkOutput = await invokeReworkNode(reworkNode, node, lastReviewText, currentContext, helpers, round);
          reworkOutputs.push(reworkOutput);
        }

        currentContext = summarizeOutputItems(reworkOutputs);
      }

      return {
        content: lastReviewText || "Review loop completed with no final decision.",
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: new Set() },
      };
    }
    case "context_summary":
      return {
        content: upstream.length
          ? upstream.map((item) => `- ${item.nodeTitle}: ${compressText(item.content, 280)}`).join("\n")
          : compressText(node.description || "No upstream outputs to summarize.", 280),
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    case "document_collector":
      return {
        content: upstream.length
          ? [
              `# ${node.title || "Collected Document"}`,
              node.description || "",
              ...upstream.map((item) => `## ${item.nodeTitle}\n\n${item.content}`),
            ].filter(Boolean).join("\n\n")
          : `# ${node.title || "Collected Document"}\n\n${node.description || "No upstream outputs yet."}`,
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    case "human_review":
      return {
        content: [
          "Manual review checkpoint",
          node.description || "Review the upstream content before continuing.",
          upstreamContext.upstreamSummary || "",
        ].filter(Boolean).join("\n\n"),
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
    default:
      return {
        content: upstreamContext.upstreamSummary || node.description || node.title || "Function node completed.",
        metadata: { adapter: "FunctionNode", provider: "local", functionType, selectedTargets: allDownstream },
      };
  }
}

class Orchestrator {
  constructor() {
    this.activeRuns = new Map();
  }

  listRuns() {
    return Array.from(this.activeRuns.values());
  }

  getRun(runId) {
    return this.activeRuns.get(runId) || null;
  }

  startWorkflow(workspace, agentCatalog) {
    const runId = `run_${crypto.randomUUID()}`;
    const order = topologicalSort(workspace.nodes || []);
    const run = {
      id: runId,
      workflowId: workspace.id,
      workflowName: workspace.name,
      workspaceId: workspace.id,
      workspacePath: workspace.folderPath,
      status: "running",
      createdAt: new Date().toISOString(),
      order,
      nodeStates: {},
      outputs: [],
      controlTargets: new Map(),
      retryAttempts: new Map(),
    };

    this.activeRuns.set(runId, run);
    bus.publish({
      runId,
      workflowId: workspace.id,
      from: "orchestrator",
      to: "broadcast",
      role: "system",
      content: `Workflow ${workspace.name} started`,
      metadata: { event: "run.started" },
    });

    this.executeWorkflow(run, workspace, agentCatalog).catch(() => {
      // executeWorkflow already records the failure state and publishes a bus event.
    });

    return run;
  }

  async executeWorkflow(run, workspace, agentCatalog) {
    try {
      const retryPolicies = collectRetryPolicies(workspace);

      for (const nodeId of run.order) {
        const node = workspace.nodes.find((item) => item.id === nodeId);
        const skipReason = shouldSkipNode(run, node);
        if (skipReason) {
          run.nodeStates[node.id] = {
            status: "skipped",
            skippedAt: new Date().toISOString(),
            reason: skipReason,
          };
          bus.publish({
            runId: run.id,
            workflowId: workspace.id,
            from: "orchestrator",
            to: node.id,
            role: "system",
            content: `Node ${node.title} skipped: ${skipReason}`,
            metadata: { event: "node.skipped", nodeId: node.id },
          });
          continue;
        }

        const upstreamContext = collectUpstreamContext(run, node);
        const nodeTarget = node.nodeKind === "function"
          ? {
              id: `function:${node.functionType || "start"}`,
              name: node.title || node.functionType || "Function Node",
            }
          : findAgentForNode(node, agentCatalog);

        run.nodeStates[node.id] = {
          status: "running",
          startedAt: new Date().toISOString(),
          agentId: nodeTarget.id,
        };

        const taskEnvelope = bus.publish({
          runId: run.id,
          workflowId: workspace.id,
          from: "orchestrator",
          to: nodeTarget.id,
          role: "task",
          content: node.description || node.title,
          metadata: {
            nodeId: node.id,
            nodeTitle: node.title,
            agentRole: node.agentId,
            dependsOn: upstreamContext.dependencyIds,
            upstreamOutputs: upstreamContext.upstreamOutputs,
            upstreamSummary: upstreamContext.upstreamSummary,
          },
        });

        let result;
        let attempt = 0;
        const maxAttempts = retryPolicies.get(node.id) || 0;

        while (true) {
          try {
            result = node.nodeKind === "function"
              ? await executeFunctionNode(node, upstreamContext, { workspace, run, agentCatalog })
              : await runAgentNode(taskEnvelope, nodeTarget);
            break;
          } catch (error) {
            if (attempt < maxAttempts) {
              attempt += 1;
              run.retryAttempts.set(node.id, attempt);
              bus.publish({
                runId: run.id,
                workflowId: workspace.id,
                from: "orchestrator",
                to: nodeTarget.id,
                role: "system",
                content: `Retrying ${node.title} (${attempt}/${maxAttempts}) after error: ${error.message}`,
                metadata: { event: "node.retry", nodeId: node.id, attempt, maxAttempts },
              });
              continue;
            }
            throw error;
          }
        }

        if (result?.metadata?.selectedTargets instanceof Set) {
          run.controlTargets.set(node.id, result.metadata.selectedTargets);
        }
        const writtenFiles = writeNodeOutputs(workspace, node, result.content);

        const outputEnvelope = bus.publish({
          runId: run.id,
          workflowId: workspace.id,
          from: nodeTarget.id,
          to: "orchestrator",
          role: "result",
          content: result.content,
          metadata: {
            nodeId: node.id,
            adapter: result.metadata.adapter,
            writtenFiles,
          },
        });

        run.nodeStates[node.id] = {
          ...run.nodeStates[node.id],
          status: "done",
          completedAt: new Date().toISOString(),
          outputMessageId: outputEnvelope.id,
        };
        upsertRunOutput(run, {
          nodeId: node.id,
          nodeTitle: node.title,
          agentId: nodeTarget.id,
          content: result.content,
          outputMode: node.outputMode,
          writtenFiles,
        });
      }

      run.status = "done";
      run.completedAt = new Date().toISOString();
      store.appendRunHistory(snapshotRun(run));
      this.activeRuns.set(run.id, run);
      bus.publish({
        runId: run.id,
        workflowId: workspace.id,
        from: "orchestrator",
        to: "broadcast",
        role: "system",
        content: `Workflow ${workspace.name} completed`,
        metadata: { event: "run.completed" },
      });
      return run;
    } catch (error) {
      run.status = "failed";
      run.failedAt = new Date().toISOString();
      run.error = error.message;
      store.appendRunHistory(snapshotRun(run));
      this.activeRuns.set(run.id, run);
      bus.publish({
        runId: run.id,
        workflowId: workspace.id,
        from: "orchestrator",
        to: "broadcast",
        role: "system",
        content: `Workflow ${workspace.name} failed: ${error.message}`,
        metadata: { event: "run.failed" },
      });
      throw error;
    }
  }
}

function snapshotRun(run) {
  return {
    ...run,
    controlTargets: Array.from(run.controlTargets.entries()).map(([nodeId, targets]) => [nodeId, Array.from(targets)]),
    retryAttempts: Array.from(run.retryAttempts.entries()),
  };
}

async function runAgentNode(taskEnvelope, agent) {
  const adapter = createAdapter(agent);
  await adapter.send(taskEnvelope);
  return adapter.receive(taskEnvelope);
}

function findAgentForNode(node, agentCatalog) {
  const target = String(node.agentId || "").toLowerCase();
  const exact = agentCatalog.find((agent) => agent.id.toLowerCase() === target);
  if (exact) {
    return exact;
  }

  throw new Error(`Node "${node.title}" is bound to unknown agent "${node.agentId}"`);
}

module.exports = new Orchestrator();
