class BaseAdapter {
  constructor(agent) {
    this.agent = agent;
  }

  async send(taskEnvelope) {
    return {
      adapter: this.constructor.name,
      accepted: true,
      taskEnvelope,
    };
  }

  async receive(taskEnvelope) {
    await delay(200);
    return {
      content: `${this.agent.name} processed node ${taskEnvelope.metadata.nodeTitle || "Untitled Node"}.`,
      metadata: {
        adapter: this.constructor.name,
      },
    };
  }
}

function buildApiMessages(taskEnvelope) {
  const nodeTitle = taskEnvelope.metadata.nodeTitle || "Untitled Node";
  const agentRole = taskEnvelope.metadata.agentRole || "unknown";
  const dependsOn = (taskEnvelope.metadata.dependsOn || []).join(", ") || "none";
  const upstreamSummary = String(taskEnvelope.metadata.upstreamSummary || "").trim();

  return [
    {
      role: "system",
      content:
        "You are executing one node inside an AgentCanvas workflow. Use upstream node outputs when they are provided. Return only the final answer for this node as plain text. Do not add markdown headings. Do not explain your process.",
    },
    {
      role: "user",
      content: [
        `Node title: ${nodeTitle}`,
        `Node role: ${agentRole}`,
        `Upstream dependencies: ${dependsOn}`,
        upstreamSummary ? "Upstream outputs:" : "",
        upstreamSummary || "",
        "",
        "Task:",
        String(taskEnvelope.content || "").trim() || "Produce a short execution result.",
      ].join("\n"),
    },
  ];
}

async function readErrorText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function postJson(url, payload, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: response.ok ? "" : await readErrorText(response),
      json: response.ok ? await response.json() : null,
    };
  } catch (error) {
    const cause = error?.cause?.message || error?.message || "unknown fetch error";
    return {
      ok: false,
      status: 0,
      statusText: "FETCH_ERROR",
      text: cause,
      json: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildNetworkHint(baseUrl, responsesResult, chatResult) {
  const combined = `${responsesResult?.text || ""}\n${chatResult?.text || ""}`.toLowerCase();
  if (combined.includes("connect timeout") || combined.includes("fetch failed") || combined.includes("econnrefused")) {
    return `Network connection to ${baseUrl} failed. Use a reachable OpenAI-compatible base URL, relay, or proxy, then try again.`;
  }
  return "";
}

function collectStringValues(value, results = []) {
  if (!value) {
    return results;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      results.push(trimmed);
    }
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, results));
    return results;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectStringValues(item, results));
  }

  return results;
}

function firstHttpUrl(values) {
  return values.find((value) => /^https?:\/\//i.test(value)) || "";
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    const text = payload.output
      .flatMap((item) => item?.content || [])
      .map((item) => item?.text || "")
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }

  if (Array.isArray(payload?.choices) && payload.choices[0]?.message?.content) {
    const content = payload.choices[0].message.content;
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) => item?.text || item?.output_text || item?.content || "")
        .join("")
        .trim();
      if (text) {
        return text;
      }

      const contentUrls = content.flatMap((item) => collectStringValues([
        item?.url,
        item?.image_url,
        item?.image_url?.url,
        item?.download_url,
        item?.file_url,
        item?.file?.url,
        item?.image?.url,
        item?.result?.url,
        item?.result?.image_url,
        item?.data?.[0]?.url,
        item?.data?.[0]?.image_url,
      ]));
      const firstContentUrl = firstHttpUrl(contentUrls);
      if (firstContentUrl) {
        return firstContentUrl;
      }
    }
  }

  const directUrl = firstHttpUrl([
    payload?.url,
    payload?.image_url,
    payload?.download_url,
    payload?.data?.[0]?.url,
    payload?.data?.[0]?.image_url,
    payload?.images?.[0]?.url,
    payload?.images?.[0]?.image_url,
    payload?.result?.url,
    payload?.result?.image_url,
  ]);
  if (directUrl) {
    return directUrl;
  }

  if (Array.isArray(payload?.output)) {
    const outputUrls = payload.output
      .flatMap((item) => item?.content || [])
      .flatMap((item) => collectStringValues([item?.url, item?.image_url, item?.file_id, item?.file_url]));
    const firstOutputUrl = firstHttpUrl(outputUrls);
    if (firstOutputUrl) {
      return firstOutputUrl;
    }
  }

  if (Array.isArray(payload?.choices)) {
    const choiceUrls = payload.choices.flatMap((choice) => collectStringValues([
      choice?.message?.url,
      choice?.message?.image_url,
      choice?.message?.image_url?.url,
      choice?.message?.images,
      choice?.message?.content,
      choice?.message?.tool_calls,
      choice?.message?.function_call,
      choice?.delta,
      choice?.delta?.content,
      choice?.delta?.image_url,
      choice?.delta?.image_url?.url,
      choice?.url,
      choice?.image_url,
      choice?.image_url?.url,
      choice?.data,
    ]));
    const firstChoiceUrl = firstHttpUrl(choiceUrls);
    if (firstChoiceUrl) {
      return firstChoiceUrl;
    }
  }

  return "";
}

class ApiAdapter extends BaseAdapter {
  async receive(taskEnvelope) {
    if (!this.agent.enabled) {
      throw new Error(`API agent "${this.agent.name}" is disabled`);
    }
    if (!this.agent.apiKey || !this.agent.baseUrl || !this.agent.model) {
      throw new Error(`API agent "${this.agent.name}" is missing base URL, API key, or model`);
    }

    const baseUrl = this.agent.baseUrl.replace(/\/+$/, "");
    const messages = buildApiMessages(taskEnvelope);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.agent.apiKey}`,
    };

    const responsesPayload = {
      model: this.agent.model,
      input: messages.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
    };

    const responsesResult = await postJson(`${baseUrl}/responses`, responsesPayload, headers);

    let payload = responsesResult.json;
    if (!responsesResult.ok) {
      const chatPayload = {
        model: this.agent.model,
        messages,
      };

      const chatResult = await postJson(`${baseUrl}/chat/completions`, chatPayload, headers);
      if (!chatResult.ok) {
        const networkHint = buildNetworkHint(baseUrl, responsesResult, chatResult);
        throw new Error(
          [
            `API request failed for agent "${this.agent.name}"`,
            `/responses -> ${responsesResult.status} ${responsesResult.statusText}: ${responsesResult.text || "unknown error"}`,
            `/chat/completions -> ${chatResult.status} ${chatResult.statusText}: ${chatResult.text || "unknown error"}`,
            networkHint,
          ].join("\n"),
        );
      }
      payload = chatResult.json;
    }

    const content = extractResponseText(payload);
    if (!content) {
      throw new Error(`API returned no readable text or image URL content. Top-level keys: ${Object.keys(payload || {}).join(", ") || "none"}`);
    }

    return {
      content,
      metadata: {
        adapter: this.constructor.name,
        provider: "http-api",
        model: this.agent.model,
      },
    };
  }
}

function isApiAgent(agent) {
  return agent.agentType === "api" || agent.transport === "https";
}

function createAdapter(agent) {
  if (isApiAgent(agent)) {
    return new ApiAdapter(agent);
  }
  throw new Error(`Unsupported agent type for ${agent?.name || agent?.id || "unknown agent"}`);
}

module.exports = {
  createAdapter,
};
