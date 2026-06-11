# ARE Agent Integrations

Govern your MCP tool calls in about 20 lines.

This repo is the integration beachhead for
[ARE Foundation](https://github.com/srex-dev/are-foundation): small packages and
runnable examples that wrap agent tool calls with passport, scope, and policy
checks before tools execute.

```ts
import { governMcpTool } from "@srex/are-mcp-gateway";

const guardedTool = governMcpTool(tool, {
  foundationUrl: "http://localhost:18085",
  token: process.env.ARE_TOKEN!,
  agentId: "demo-agent",
  mode: "enforce",
  mapToolCall: ({ name, args }) => ({
    actionType: name,
    resource: safeResourceLabel(args),
    risk: inferRisk(name),
  }),
});
```

Python follows the same shape:

```python
from are_mcp_gateway import govern_tool

guarded_tool = govern_tool(
    tool,
    foundation_url="http://localhost:18085",
    token=os.environ["ARE_TOKEN"],
    agent_id="demo-agent",
    mode="enforce",
    map_tool_call=map_tool_call,
)
```

## What It Does

For every governed tool call:

1. map the tool call to public-safe action metadata
2. verify passport authority when a passport is supplied
3. evaluate scope
4. evaluate policy
5. allow, deny, or return `requires_approval`

`enforce` mode fails closed. `observe` mode records the decision but lets local
experiments continue.

## Packages

| Package | Purpose |
|---|---|
| `@srex/are-mcp-gateway` | TypeScript middleware and stdio MCP proxy. |
| `are-mcp-gateway` | Python middleware for MCP-style and agent framework tools. |

CLI helpers:

```bash
are-mcp-gateway proxy --upstream "node ./server.js"
are-mcp-gateway smoke --foundation-url http://localhost:18085
are-mcp-gateway bench --matrix ../are-foundation/reports/foundation-pressure-matrix/latest-matrix.json
```

## Examples

- `examples/mcp-filesystem-governed`: allow reads, deny unsafe writes/deletes.
- `examples/mcp-shell-governed`: allow safe shell actions, deny destructive commands.
- `examples/langgraph-governed-tool`: wrap a graph tool with ARE checks.
- `examples/crewai-governed-tool`: wrap a CrewAI tool call.
- `examples/autogen-governed-tool`: intercept an AutoGen function/tool call.
- `examples/local-agent-passport`: local agent passport + scope + policy pattern.

## Safety Defaults

- Raw tool args are not sent to ARE Foundation by default.
- Resource labels should be safe strings or hashes.
- Tokens, headers, credentials, signatures, raw prompts, protected payloads, and
  evidence bodies must never be logged or exported.
- v0.1 does not execute actions, activate policy, or provide a durable HITL queue.

## Benchmarks And Claims

Run the comparison harness before making public claims:

```bash
npm run bench:guardrail
```

It writes public-safe reports under `reports/guardrail-comparison/` with the
measured percentage of tool calls that ARE denied while a prompt-only guardrail
allowed them. Do not quote numbers that are not in a generated report.

Pressure-matrix p95/p99 numbers come from `are-foundation`:

```bash
cd ../are-foundation
make pressure-matrix
cd ../are-agent-integrations
are-mcp-gateway bench --matrix ../are-foundation/reports/foundation-pressure-matrix/latest-matrix.json
```

## Local Development

```bash
npm install
npm test
npm run build

python -m pip install -e "python[dev]"
python -m pytest -q python/tests
```

## Boundary

This repository is integration glue for ARE Foundation. It intentionally does
not include the commercial Command Center, visual RAG, private proof packets,
advanced governance-strata internals, or S2-S6 adaptive systems.
