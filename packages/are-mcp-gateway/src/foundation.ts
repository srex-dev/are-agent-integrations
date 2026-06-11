import { redactText } from "./redaction.js";
import type { AreDecision, AreGatewayConfig, CheckResult, DecisionEffect, ToolAction, ToolCall } from "./types.js";

type Json = Record<string, unknown>;

export async function evaluateToolCall(call: ToolCall, config: AreGatewayConfig): Promise<AreDecision> {
  const mode = config.mode ?? "enforce";
  const requestId = config.requestIdFactory?.() ?? `are-mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const action = normalizeAction(await config.mapToolCall(call));
  const checks: CheckResult[] = [];

  try {
    const client = new FoundationClient(config, requestId);
    const passportId = action.passportId ?? config.passportId;

    if (passportId) {
      const passport = await client.verifyPassport(config.agentId, passportId);
      checks.push(passport);
      if (passport.effect !== "ALLOW") {
        return finalizeDecision("DENY", passport.reason, mode, requestId, action, checks, config);
      }
    }

    const scope = await client.evaluateScope(config.agentId, action, passportId);
    checks.push(scope);
    if (scope.effect !== "ALLOW") {
      return finalizeDecision("DENY", scope.reason, mode, requestId, action, checks, config);
    }

    const policy = await client.evaluatePolicy(config.agentId, action);
    checks.push(policy);
    if (policy.effect !== "ALLOW") {
      return finalizeDecision(policy.effect, policy.reason, mode, requestId, action, checks, config);
    }

    return finalizeDecision("ALLOW", "ARE Foundation allowed the tool call.", mode, requestId, action, checks, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "gateway",
      effect: "ERROR",
      reason: redactText(message),
      requestId,
      executed: false
    });
    return finalizeDecision("ERROR", `ARE Foundation unavailable or invalid: ${redactText(message)}`, mode, requestId, action, checks, config);
  }
}

export function asMcpToolResult(decision: AreDecision): { content: Array<{ type: "text"; text: string }>; isError: true; _meta: { areDecision: AreDecision } } {
  const label = decision.effect === "ESCALATE" ? "requires approval" : "denied";
  return {
    content: [
      {
        type: "text",
        text: `ARE ${label} this tool call: ${decision.reason}`
      }
    ],
    isError: true,
    _meta: { areDecision: decision }
  };
}

class FoundationClient {
  private readonly foundationUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token: string;
  private readonly callerAgentId: string;
  private readonly timeoutMs: number;
  private readonly idempotencyKeyFactory?: (purpose: string) => string;

  constructor(config: AreGatewayConfig, private readonly requestId: string) {
    this.foundationUrl = config.foundationUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.token = config.token;
    this.callerAgentId = config.agentId;
    this.timeoutMs = config.timeoutMs ?? 2500;
    this.idempotencyKeyFactory = config.idempotencyKeyFactory;
  }

  async verifyPassport(agentId: string, passportId: string): Promise<CheckResult> {
    const response = await this.postJson("/v1/passports:verify", "passport", {
      agent_id: agentId,
      passport_id: passportId
    });
    const verified = Boolean(response.verified);
    return {
      name: "passport",
      effect: verified ? "ALLOW" : "DENY",
      reason: String(response.reason ?? (verified ? "passport verified" : "passport not verified")),
      requestId: String(response.request_id ?? this.requestId),
      executed: false
    };
  }

  async evaluateScope(agentId: string, action: ToolAction, passportId?: string): Promise<CheckResult> {
    const body: Json = {
      agent_id: agentId,
      action_class: action.actionType,
      resource: action.resource
    };
    if (passportId) {
      body.passport_id = passportId;
    }
    const response = await this.postJson("/v1/enforcement/scope:evaluate", "scope", body);
    const decision = (response.decision ?? {}) as Json;
    const effect = normalizeEffect(String(decision.effect ?? "DENY"));
    return {
      name: "scope",
      effect,
      reason: String(decision.reason ?? "scope did not allow the action"),
      requestId: String(response.request_id ?? this.requestId),
      executed: false
    };
  }

  async evaluatePolicy(agentId: string, action: ToolAction): Promise<CheckResult> {
    const response = await this.postJson("/v1/policy/evaluations", "policy", {
      decision_id: action.decisionId ?? `${this.requestId}-policy`,
      agent_id: agentId,
      action_class: action.actionType,
      resource: action.resource
    });
    const decision = (response.decision ?? {}) as Json;
    return {
      name: "policy",
      effect: normalizeEffect(String(decision.effect ?? "DENY")),
      reason: String(decision.reason ?? "policy did not allow the action"),
      requestId: this.requestId,
      executed: false
    };
  }

  private async postJson(path: string, purpose: string, body: Json): Promise<Json> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.foundationUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "X-Request-ID": this.requestId,
          "X-ARE-Agent-ID": this.callerAgentId,
          "Idempotency-Key": this.idempotencyKeyFactory?.(purpose) ?? `${this.requestId}-${purpose}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as Json) : {};
      if (!response.ok) {
        const error = (parsed.error ?? {}) as Json;
        throw new Error(`${response.status} ${String(error.message ?? response.statusText)}`);
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeAction(action: ToolAction): ToolAction {
  if (!action.actionType || !action.resource) {
    throw new Error("mapToolCall must return actionType and resource");
  }
  return {
    ...action,
    actionType: redactText(action.actionType),
    resource: redactText(action.resource)
  };
}

function normalizeEffect(effect: string): DecisionEffect {
  if (effect === "ALLOW" || effect === "DENY" || effect === "ESCALATE" || effect === "ERROR") {
    return effect;
  }
  return "DENY";
}

function finalizeDecision(
  effect: DecisionEffect,
  reason: string,
  mode: "enforce" | "observe",
  requestId: string,
  action: ToolAction,
  checks: CheckResult[],
  config: AreGatewayConfig
): AreDecision {
  const decision: AreDecision = {
    effect,
    enforcedEffect: mode === "observe" ? "ALLOW" : effect,
    reason,
    requestId,
    mode,
    action,
    checks,
    executed: false
  };
  void config.onDecision?.(decision);
  return decision;
}
