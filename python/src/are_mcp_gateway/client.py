from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Mapping, MutableMapping, Sequence

from .redaction import redact_text

Mode = Literal["enforce", "observe"]
Effect = Literal["ALLOW", "DENY", "ESCALATE", "ERROR"]


@dataclass
class AreGatewayConfig:
    foundation_url: str
    token: str
    agent_id: str
    map_tool_call: Callable[[Mapping[str, Any]], Mapping[str, Any]]
    passport_id: str | None = None
    mode: Mode = "enforce"
    timeout_seconds: float = 2.5
    opener: Callable[[urllib.request.Request, float], Any] | None = None
    request_id_factory: Callable[[], str] | None = None
    idempotency_key_factory: Callable[[str], str] | None = None
    on_decision: Callable[["AreDecision"], None] | None = None


@dataclass
class CheckResult:
    name: Literal["passport", "scope", "policy", "gateway"]
    effect: Effect
    reason: str
    request_id: str | None = None
    executed: bool = False


@dataclass
class AreDecision:
    effect: Effect
    enforced_effect: Effect
    reason: str
    request_id: str
    mode: Mode
    action: Mapping[str, Any]
    checks: Sequence[CheckResult] = field(default_factory=list)
    executed: bool = False


def evaluate_tool_call(call: Mapping[str, Any], config: AreGatewayConfig) -> AreDecision:
    request_id = config.request_id_factory() if config.request_id_factory else f"are-mcp-{int(time.time() * 1000)}"
    action = _normalize_action(config.map_tool_call(call))
    checks: list[CheckResult] = []
    client = _FoundationClient(config, request_id)

    try:
        passport_id = str(action.get("passport_id") or config.passport_id or "")
        if passport_id:
            passport = client.verify_passport(config.agent_id, passport_id)
            checks.append(passport)
            if passport.effect != "ALLOW":
                return _finalize("DENY", passport.reason, request_id, action, checks, config)

        scope = client.evaluate_scope(config.agent_id, action, passport_id or None)
        checks.append(scope)
        if scope.effect != "ALLOW":
            return _finalize("DENY", scope.reason, request_id, action, checks, config)

        policy = client.evaluate_policy(config.agent_id, action)
        checks.append(policy)
        if policy.effect != "ALLOW":
            return _finalize(policy.effect, policy.reason, request_id, action, checks, config)

        return _finalize("ALLOW", "ARE Foundation allowed the tool call.", request_id, action, checks, config)
    except Exception as exc:  # noqa: BLE001 - fail-closed boundary.
        reason = f"ARE Foundation unavailable or invalid: {redact_text(str(exc))}"
        checks.append(CheckResult(name="gateway", effect="ERROR", reason=reason, request_id=request_id))
        return _finalize("ERROR", reason, request_id, action, checks, config)


class _FoundationClient:
    def __init__(self, config: AreGatewayConfig, request_id: str) -> None:
        self.config = config
        self.request_id = request_id
        self.base = config.foundation_url.rstrip("/")

    def verify_passport(self, agent_id: str, passport_id: str) -> CheckResult:
        response = self._post(
            "/v1/passports:verify",
            "passport",
            {"agent_id": agent_id, "passport_id": passport_id},
        )
        verified = bool(response.get("verified"))
        return CheckResult(
            name="passport",
            effect="ALLOW" if verified else "DENY",
            reason=str(response.get("reason") or ("passport verified" if verified else "passport not verified")),
            request_id=str(response.get("request_id") or self.request_id),
        )

    def evaluate_scope(self, agent_id: str, action: Mapping[str, Any], passport_id: str | None) -> CheckResult:
        body: MutableMapping[str, Any] = {
            "agent_id": agent_id,
            "action_class": action["action_type"],
            "resource": action["resource"],
        }
        if passport_id:
            body["passport_id"] = passport_id
        response = self._post("/v1/enforcement/scope:evaluate", "scope", body)
        decision = response.get("decision") if isinstance(response.get("decision"), dict) else {}
        effect = _normalize_effect(str(decision.get("effect") or "DENY"))
        return CheckResult(
            name="scope",
            effect=effect,
            reason=str(decision.get("reason") or "scope did not allow the action"),
            request_id=str(response.get("request_id") or self.request_id),
        )

    def evaluate_policy(self, agent_id: str, action: Mapping[str, Any]) -> CheckResult:
        response = self._post(
            "/v1/policy/evaluations",
            "policy",
            {
                "decision_id": str(action.get("decision_id") or f"{self.request_id}-policy"),
                "agent_id": agent_id,
                "action_class": action["action_type"],
                "resource": action["resource"],
            },
        )
        decision = response.get("decision") if isinstance(response.get("decision"), dict) else {}
        return CheckResult(
            name="policy",
            effect=_normalize_effect(str(decision.get("effect") or "DENY")),
            reason=str(decision.get("reason") or "policy did not allow the action"),
            request_id=self.request_id,
        )

    def _post(self, path: str, purpose: str, body: Mapping[str, Any]) -> Mapping[str, Any]:
        request = urllib.request.Request(
            f"{self.base}{path}",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.config.token}",
                "Content-Type": "application/json",
                "X-Request-ID": self.request_id,
                "X-ARE-Agent-ID": self.config.agent_id,
                "Idempotency-Key": (
                    self.config.idempotency_key_factory(purpose)
                    if self.config.idempotency_key_factory
                    else f"{self.request_id}-{purpose}"
                ),
            },
        )
        opener = self.config.opener or _default_open
        try:
            with opener(request, self.config.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"{exc.code} {message}") from exc


def _default_open(request: urllib.request.Request, timeout: float) -> Any:
    return urllib.request.urlopen(request, timeout=timeout)  # noqa: S310 - caller controls local ARE URL.


def _normalize_action(action: Mapping[str, Any]) -> Mapping[str, Any]:
    action_type = str(action.get("action_type") or action.get("actionType") or "")
    resource = str(action.get("resource") or "")
    if not action_type or not resource:
        raise ValueError("map_tool_call must return action_type/actionType and resource")
    normalized: dict[str, Any] = dict(action)
    normalized["action_type"] = redact_text(action_type)
    normalized["resource"] = redact_text(resource)
    return normalized


def _normalize_effect(effect: str) -> Effect:
    return effect if effect in {"ALLOW", "DENY", "ESCALATE", "ERROR"} else "DENY"  # type: ignore[return-value]


def _finalize(
    effect: Effect,
    reason: str,
    request_id: str,
    action: Mapping[str, Any],
    checks: Sequence[CheckResult],
    config: AreGatewayConfig,
) -> AreDecision:
    decision = AreDecision(
        effect=effect,
        enforced_effect="ALLOW" if config.mode == "observe" else effect,
        reason=reason,
        request_id=request_id,
        mode=config.mode,
        action=action,
        checks=checks,
    )
    if config.on_decision:
        config.on_decision(decision)
    return decision
