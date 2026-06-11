# @srex/are-mcp-gateway

TypeScript middleware and stdio MCP proxy for ARE Foundation.

```bash
npm install @srex/are-mcp-gateway
```

```ts
import { governMcpTool } from "@srex/are-mcp-gateway";

const guarded = governMcpTool(tool, {
  foundationUrl: "http://localhost:18085",
  token: process.env.ARE_TOKEN!,
  agentId: "demo-agent",
  mode: "enforce",
  mapToolCall: ({ name }) => ({
    actionType: name,
    resource: "demo/resource",
  }),
});
```

CLI:

```bash
are-mcp-gateway proxy --upstream "node ./server.js"
are-mcp-gateway smoke --foundation-url http://localhost:18085
```
