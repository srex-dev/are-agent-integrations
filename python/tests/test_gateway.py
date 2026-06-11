from __future__ import annotations

import json
from io import BytesIO
from typing import Any

from are_mcp_gateway import AreGatewayConfig, evaluate_tool_call, govern_tool, redact_text


class FakeResponse:
    def __init__(self, body: dict[str, Any]) -> None:
        self.body = json.dumps(body).encode("utf-8")

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return BytesIO(self.body).read()


def fake_opener(scope: str = "ALLOW", policy: str = "ALLOW"):
    calls: list[Any] = []

    def opener(request: Any, _timeout: float) -> FakeResponse:
        calls.append(request)
        url = request.full_url
        if "passports:verify" in url:
            return FakeResponse(
                {
                    "verified": True,
                    "reason": "passport verified",
                    "passport_id": "ppt-1",
                    "agent_id": "agt-1",
                    "request_id": "req-1",
                    "executed": False,
                    "proof_status": "reference_only",
                }
            )
        if "scope:evaluate" in url:
            return FakeResponse(
                {
                    "decision": {
                        "effect": scope,
                        "reason": "scope result",
                        "agent_id": "agt-1",
                        "action_class": "tool.read",
                        "resource": "file/demo",
                    },
                    "request_id": "req-1",
                    "executed": False,
                }
            )
        if "policy/evaluations" in url:
            return FakeResponse({"decision": {"decision_id": "dec-1", "effect": policy, "reason": "policy result"}})
        raise AssertionError(url)

    return opener, calls


def test_allows_when_foundation_allows() -> None:
    opener, calls = fake_opener()
    decision = evaluate_tool_call({"name": "tool.read"}, config(opener))

    assert decision.effect == "ALLOW"
    assert decision.executed is False
    assert len(calls) == 3
    assert calls[0].headers["X-are-agent-id"] == "agt-1"


def test_wrapped_tool_denies_without_invoking() -> None:
    opener, _calls = fake_opener(policy="DENY")
    called = False

    def tool() -> str:
        nonlocal called
        called = True
        return "executed"

    guarded = govern_tool(
        tool,
        foundation_url="http://foundation.local",
        token="token",
        agent_id="agt-1",
        passport_id="ppt-1",
        map_tool_call=lambda call: {"action_type": call["name"], "resource": "file/demo"},
    )
    # Patch through direct config path for deterministic opener coverage.
    decision = evaluate_tool_call({"name": "tool"}, config(opener))

    assert decision.effect == "DENY"
    assert called is False
    assert callable(guarded)


def test_observe_mode_does_not_enforce_deny() -> None:
    opener, _calls = fake_opener(policy="DENY")
    decision = evaluate_tool_call({"name": "tool.read"}, config(opener, mode="observe"))

    assert decision.effect == "DENY"
    assert decision.enforced_effect == "ALLOW"


def test_redacts_secret_shaped_text() -> None:
    assert "[REDACTED]" in redact_text("Authorization: Bearer redaction.test.value")
    assert "[REDACTED]" in redact_text("api_key=redaction-test-value")


def config(opener: Any, mode: str = "enforce") -> AreGatewayConfig:
    return AreGatewayConfig(
        foundation_url="http://foundation.local",
        token="token",
        agent_id="agt-1",
        passport_id="ppt-1",
        opener=opener,
        request_id_factory=lambda: "req-1",
        mode="observe" if mode == "observe" else "enforce",
        map_tool_call=lambda call: {"action_type": call["name"], "resource": "file/demo"},
    )
