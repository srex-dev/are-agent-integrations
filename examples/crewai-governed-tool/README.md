# CrewAI Governed Tool Example

Use ARE at the tool boundary.

```python
from are_mcp_gateway import run_governed_tool, AreGatewayConfig

config = AreGatewayConfig(
    foundation_url="http://localhost:18085",
    token="test-token",
    agent_id="agt-smoke-agent",
    passport_id="ppt-smoke-passport",
    map_tool_call=lambda call: {
        "action_type": call["name"],
        "resource": "customer/public-summary",
    },
)

result = run_governed_tool(
    {"name": "data.read", "args": {"dataset": "public-summary"}},
    config,
    lambda: "tool result",
)
```

The agent sees either the tool result or a structured ARE denial.
