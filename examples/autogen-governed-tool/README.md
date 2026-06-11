# AutoGen Governed Tool Example

Intercept a function call before the function executes.

```python
from are_mcp_gateway import govern_tool, safe_resource_label

def call_internal_api(path: str) -> str:
    return "api result"

guarded_call_internal_api = govern_tool(
    call_internal_api,
    foundation_url="http://localhost:18085",
    token="test-token",
    agent_id="agt-smoke-agent",
    passport_id="ppt-smoke-passport",
    map_tool_call=lambda call: {
        "action_type": "api.call",
        "resource": safe_resource_label(call["args"]),
    },
)
```

This pattern keeps AutoGen orchestration intact while ARE governs the side
effect boundary.
