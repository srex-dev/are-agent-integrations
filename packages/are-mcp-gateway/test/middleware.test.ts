import { describe, expect, it, vi } from "vitest";
import { evaluateToolCall, governMcpTool, redactText } from "../src/index.js";

function fakeFetch(effects: { scope?: string; policy?: string } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).includes("passports:verify")) {
      return jsonResponse({ verified: true, reason: "passport verified", passport_id: "ppt-1", agent_id: "agt-1", request_id: "req-1", executed: false, proof_status: "reference_only" });
    }
    if (String(url).includes("scope:evaluate")) {
      return jsonResponse({ decision: { effect: effects.scope ?? "ALLOW", reason: "scope result", agent_id: "agt-1", action_class: "tool.read", resource: "file/demo" }, request_id: "req-1", executed: false });
    }
    if (String(url).includes("policy/evaluations")) {
      return jsonResponse({ decision: { decision_id: "dec-1", effect: effects.policy ?? "ALLOW", reason: "policy result" } });
    }
    return jsonResponse({}, 404);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("ARE MCP middleware", () => {
  it("allows a tool call when passport, scope, and policy allow", async () => {
    const { fetchImpl, calls } = fakeFetch();
    const decision = await evaluateToolCall(
      { name: "tool.read", args: { path: "README.md" } },
      config(fetchImpl)
    );

    expect(decision.effect).toBe("ALLOW");
    expect(decision.executed).toBe(false);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: "Bearer token",
      "X-ARE-Agent-ID": "agt-1"
    });
  });

  it("denies and does not invoke a wrapped tool when policy denies", async () => {
    const { fetchImpl } = fakeFetch({ policy: "DENY" });
    const tool = vi.fn(async () => "executed");
    const guarded = governMcpTool(tool, config(fetchImpl));

    const result = await guarded({ path: "secret.txt" });

    expect(tool).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
  });

  it("fails closed in enforce mode when foundation is unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network token=redaction-test-value");
    }) as unknown as typeof fetch;
    const decision = await evaluateToolCall({ name: "tool.read" }, config(fetchImpl));

    expect(decision.effect).toBe("ERROR");
    expect(decision.enforcedEffect).toBe("ERROR");
    expect(JSON.stringify(decision)).not.toContain("redaction-test-value");
  });

  it("does not block in observe mode", async () => {
    const { fetchImpl } = fakeFetch({ policy: "DENY" });
    const decision = await evaluateToolCall({ name: "tool.read" }, { ...config(fetchImpl), mode: "observe" });

    expect(decision.effect).toBe("DENY");
    expect(decision.enforcedEffect).toBe("ALLOW");
  });

  it("redacts secret-shaped text", () => {
    expect(redactText("Authorization: Bearer redaction.test.value")).toContain("[REDACTED]");
    expect(redactText("api_key=redaction-test-value")).toContain("[REDACTED]");
  });
});

function config(fetchImpl: typeof fetch) {
  return {
    foundationUrl: "http://foundation.local",
    token: "token",
    agentId: "agt-1",
    passportId: "ppt-1",
    fetchImpl,
    requestIdFactory: () => "req-1",
    mapToolCall: ({ name }: { name: string }) => ({
      actionType: name,
      resource: "file/demo"
    })
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
