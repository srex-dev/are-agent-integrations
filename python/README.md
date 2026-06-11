# are-mcp-gateway

Python middleware for wrapping MCP-style or agent-framework tool calls with ARE
Foundation checks.

```bash
pip install are-mcp-gateway
```

```python
from are_mcp_gateway import govern_tool

guarded = govern_tool(
    tool,
    foundation_url="http://localhost:18085",
    token="test-token",
    agent_id="agt-smoke-agent",
    mode="enforce",
    map_tool_call=lambda call: {
        "action_type": call["name"],
        "resource": "demo/resource",
    },
)
```
