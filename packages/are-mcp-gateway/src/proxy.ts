import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { asMcpToolResult, evaluateToolCall } from "./foundation.js";
import { safeResourceLabel } from "./redaction.js";
import type { AreGatewayConfig } from "./types.js";

export interface ProxyOptions {
  upstream: string;
  foundationUrl: string;
  token: string;
  agentId: string;
  passportId?: string;
  mode?: "enforce" | "observe";
}

export async function runStdioProxy(options: ProxyOptions): Promise<void> {
  const [command, ...args] = splitCommand(options.upstream);
  if (!command) {
    throw new Error("--upstream is required");
  }

  const upstream = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
  upstream.stderr.pipe(process.stderr);

  const config: AreGatewayConfig = {
    foundationUrl: options.foundationUrl,
    token: options.token,
    agentId: options.agentId,
    passportId: options.passportId,
    mode: options.mode ?? "enforce",
    mapToolCall: ({ name, args: toolArgs }) => ({
      actionType: name,
      resource: safeResourceLabel(toolArgs)
    })
  };

  createInterface({ input: upstream.stdout }).on("line", (line) => {
    process.stdout.write(`${line}\n`);
  });

  createInterface({ input: process.stdin }).on("line", async (line) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      upstream.stdin.write(`${line}\n`);
      return;
    }

    if (message.method !== "tools/call") {
      upstream.stdin.write(`${line}\n`);
      return;
    }

    const params = (message.params ?? {}) as Record<string, unknown>;
    const name = String(params.name ?? "mcp.tool");
    const decision = await evaluateToolCall({ name, args: params.arguments }, config);
    if (decision.enforcedEffect !== "ALLOW") {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: asMcpToolResult(decision)
        })}\n`
      );
      return;
    }

    upstream.stdin.write(`${line}\n`);
  });
}

function splitCommand(commandLine: string): string[] {
  const matches = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return matches.map((part) => part.replace(/^"|"$/g, ""));
}
