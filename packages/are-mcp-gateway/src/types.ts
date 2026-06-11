export type AreMode = "enforce" | "observe";
export type DecisionEffect = "ALLOW" | "DENY" | "ESCALATE" | "ERROR";

export interface ToolCall {
  name: string;
  args?: unknown;
  caller?: string;
  context?: Record<string, unknown>;
}

export interface ToolAction {
  actionType: string;
  resource: string;
  risk?: string;
  decisionId?: string;
  passportId?: string;
  safeSummary?: Record<string, string | number | boolean | null>;
}

export interface AreGatewayConfig {
  foundationUrl: string;
  token: string;
  agentId: string;
  passportId?: string;
  mode?: AreMode;
  timeoutMs?: number;
  mapToolCall: (call: ToolCall) => ToolAction | Promise<ToolAction>;
  fetchImpl?: typeof fetch;
  requestIdFactory?: () => string;
  idempotencyKeyFactory?: (purpose: string) => string;
  onDecision?: (decision: AreDecision) => void | Promise<void>;
}

export interface CheckResult {
  name: "passport" | "scope" | "policy" | "gateway";
  effect: DecisionEffect;
  reason: string;
  requestId?: string;
  executed: false;
}

export interface AreDecision {
  effect: DecisionEffect;
  enforcedEffect: DecisionEffect;
  reason: string;
  requestId: string;
  mode: AreMode;
  action: ToolAction;
  checks: CheckResult[];
  executed: false;
}

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
};
