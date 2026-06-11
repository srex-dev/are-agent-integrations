#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { evaluateToolCall } from "./foundation.js";
import { runStdioProxy } from "./proxy.js";

const program = new Command();

program
  .name("are-mcp-gateway")
  .description("Govern MCP tool calls with ARE Foundation checks.")
  .version("0.1.0-alpha.0");

program
  .command("smoke")
  .option("--foundation-url <url>", "ARE Foundation gateway URL", "http://localhost:18085")
  .option("--token <token>", "Bearer token", process.env.ARE_TOKEN ?? "test-token")
  .option("--agent-id <id>", "ARE agent ID", process.env.ARE_AGENT_ID ?? "agt-smoke-agent")
  .option("--passport-id <id>", "Passport ID", process.env.ARE_PASSPORT_ID)
  .option("--action <action>", "Action class", "model.promote_to_production")
  .option("--resource <resource>", "Resource label", "model/champion")
  .action(async (options) => {
    const decision = await evaluateToolCall(
      { name: options.action, args: { resource: options.resource } },
      {
        foundationUrl: options.foundationUrl,
        token: options.token,
        agentId: options.agentId,
        passportId: options.passportId,
        mapToolCall: () => ({
          actionType: options.action,
          resource: options.resource
        })
      }
    );
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    process.exitCode = decision.enforcedEffect === "ALLOW" ? 0 : 2;
  });

program
  .command("bench")
  .requiredOption("--matrix <path>", "ARE Foundation pressure matrix JSON")
  .action((options) => {
    const matrix = JSON.parse(readFileSync(options.matrix, "utf-8")) as Record<string, unknown>;
    const rows = Array.isArray(matrix.rows) ? (matrix.rows as Array<Record<string, unknown>>) : [];
    for (const row of rows) {
      const latency = (row.latency ?? {}) as Record<string, unknown>;
      process.stdout.write(
        `target=${row.target_rps} achieved=${row.achieved_rps} p95=${latency.p95_ms}ms p99=${latency.p99_ms}ms errors=${row.errors}\n`
      );
    }
    process.stdout.write(`verdict=${matrix.verdict ?? "unknown"}\n`);
  });

program
  .command("proxy")
  .requiredOption("--upstream <command>", "Upstream stdio MCP server command")
  .option("--foundation-url <url>", "ARE Foundation gateway URL", "http://localhost:18085")
  .option("--token <token>", "Bearer token", process.env.ARE_TOKEN ?? "test-token")
  .option("--agent-id <id>", "ARE agent ID", process.env.ARE_AGENT_ID ?? "agt-smoke-agent")
  .option("--passport-id <id>", "Passport ID", process.env.ARE_PASSPORT_ID)
  .option("--mode <mode>", "enforce or observe", "enforce")
  .action(async (options) => {
    await runStdioProxy({
      upstream: options.upstream,
      foundationUrl: options.foundationUrl,
      token: options.token,
      agentId: options.agentId,
      passportId: options.passportId,
      mode: options.mode === "observe" ? "observe" : "enforce"
    });
  });

await program.parseAsync();
