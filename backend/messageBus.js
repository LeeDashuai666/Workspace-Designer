const crypto = require("crypto");
const EventEmitter = require("events");
const store = require("./store");

class MessageBus extends EventEmitter {
  createEnvelope(input) {
    return {
      id: input.id || `msg_${crypto.randomUUID()}`,
      type: input.type || "agent.message",
      runId: input.runId || null,
      workflowId: input.workflowId || null,
      from: input.from || "system",
      to: input.to || "broadcast",
      role: input.role || "system",
      content: input.content || "",
      metadata: input.metadata || {},
      createdAt: input.createdAt || new Date().toISOString(),
    };
  }

  publish(input) {
    const envelope = this.createEnvelope(input);
    store.appendBusMessage(envelope);
    this.emit("message", envelope);
    return envelope;
  }

  list() {
    return store.listBusMessages();
  }
}

module.exports = new MessageBus();
