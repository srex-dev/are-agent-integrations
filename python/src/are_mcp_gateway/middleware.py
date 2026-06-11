from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Mapping

from .client import AreDecision, AreGatewayConfig, evaluate_tool_call


def govern_tool(
    tool: Callable[..., Any],
    *,
    foundation_url: str,
    token: str,
    agent_id: str,
    map_tool_call: Callable[[Mapping[str, Any]], Mapping[str, Any]],
    passport_id: str | None = None,
    mode: str = "enforce",
    timeout_seconds: float = 2.5,
) -> Callable[..., Any]:
    config = AreGatewayConfig(
        foundation_url=foundation_url,
        token=token,
        agent_id=agent_id,
        passport_id=passport_id,
        mode="observe" if mode == "observe" else "enforce",
        timeout_seconds=timeout_seconds,
        map_tool_call=map_tool_call,
    )

    @wraps(tool)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        call = {"name": getattr(tool, "__name__", "mcp.tool"), "args": {"args": args, "kwargs": kwargs}}
        decision = evaluate_tool_call(call, config)
        if decision.enforced_effect != "ALLOW":
            return as_tool_error(decision)
        return tool(*args, **kwargs)

    return wrapped


def run_governed_tool(call: Mapping[str, Any], config: AreGatewayConfig, invoke: Callable[[], Any]) -> Any:
    decision = evaluate_tool_call(call, config)
    if decision.enforced_effect != "ALLOW":
        return as_tool_error(decision)
    return invoke()


def as_tool_error(decision: AreDecision) -> dict[str, Any]:
    label = "requires approval" if decision.effect == "ESCALATE" else "denied"
    return {
        "is_error": True,
        "content": [{"type": "text", "text": f"ARE {label} this tool call: {decision.reason}"}],
        "are_decision": {
            "effect": decision.effect,
            "enforced_effect": decision.enforced_effect,
            "reason": decision.reason,
            "request_id": decision.request_id,
            "executed": False,
        },
    }
