# Governed MCP Filesystem Example

Pattern: let reads through, deny unsafe writes/deletes unless ARE Foundation
passport, scope, and policy all allow.

```bash
npm install
npm run build
ARE_TOKEN=test-token are-mcp-gateway proxy --upstream "node ./toy-filesystem-server.js"
```

Tool mapping:

| MCP tool | ARE action type | Resource |
|---|---|---|
| `file.read` | `file.read` | safe path label |
| `file.write` | `file.write` | safe path label |
| `file.delete` | `file.delete` | safe path label |

No raw file contents are sent to ARE Foundation.
