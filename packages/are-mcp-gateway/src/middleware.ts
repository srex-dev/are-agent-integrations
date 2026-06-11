import { asMcpToolResult, evaluateToolCall } from "./foundation.js";
import type { AreGatewayConfig, McpToolResult, ToolCall } from "./types.js";

type AnyFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export function governMcpTool<T extends AnyFunction>(tool: T, config: AreGatewayConfig): T {
  const governed = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | McpToolResult> => {
    const call: ToolCall = {
      name: tool.name || "mcp.tool",
      args: args.length <= 1 ? args[0] : args
    };
    const decision = await evaluateToolCall(call, config);
    if (decision.enforcedEffect !== "ALLOW") {
      return asMcpToolResult(decision);
    }
    return (await tool(...args)) as Awaited<ReturnType<T>>;
  };
  Object.defineProperty(governed, "name", { value: `governed_${tool.name || "tool"}` });
  return governed as T;
}

export async function runGovernedTool<T>(
  call: ToolCall,
  config: AreGatewayConfig,
  invoke: () => Promise<T> | T
): Promise<T | McpToolResult> {
  const decision = await evaluateToolCall(call, config);
  if (decision.enforcedEffect !== "ALLOW") {
    return asMcpToolResult(decision);
  }
  return await invoke();
}
