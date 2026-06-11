# Local Agent Passport Example

This is the local-use shape for tools such as OpenClaw-style agents:

1. register an actor in ARE Foundation
2. issue a passport with scoped actions
3. wrap local tools with `are-mcp-gateway`
4. allow/deny tool calls before execution

Example action types:

| Local agent action | ARE action type |
|---|---|
| read project files | `file.read` |
| edit project files | `file.write` |
| call local model | `model.local_infer` |
| run shell command | `shell.safe`, `shell.network`, `shell.critical` |

Use policy for department alignment: which actor may use which tool, against
which resource, under which risk path.
