# LangGraph Governed Tool Example

Wrap the tool before adding it to the graph.

```python
from are_mcp_gateway import govern_tool, safe_resource_label

def read_model_card(model_id: str) -> str:
    return "public model card"

guarded_read_model_card = govern_tool(
    read_model_card,
    foundation_url="http://localhost:18085",
    token="test-token",
    agent_id="agt-smoke-agent",
    passport_id="ppt-smoke-passport",
    map_tool_call=lambda call: {
        "action_type": "model.read",
        "resource": safe_resource_label(call["args"]),
    },
)
```

The same wrapper can be used wherever a LangGraph node invokes external tools.
