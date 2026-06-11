from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict

from .client import AreGatewayConfig, evaluate_tool_call


def main() -> None:
    parser = argparse.ArgumentParser(description="Govern tool calls with ARE Foundation checks.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    smoke = subparsers.add_parser("smoke")
    smoke.add_argument("--foundation-url", default="http://localhost:18085")
    smoke.add_argument("--token", default=os.environ.get("ARE_TOKEN", "test-token"))
    smoke.add_argument("--agent-id", default=os.environ.get("ARE_AGENT_ID", "agt-smoke-agent"))
    smoke.add_argument("--passport-id", default=os.environ.get("ARE_PASSPORT_ID"))
    smoke.add_argument("--action", default="model.promote_to_production")
    smoke.add_argument("--resource", default="model/champion")

    args = parser.parse_args()
    if args.command == "smoke":
        config = AreGatewayConfig(
            foundation_url=args.foundation_url,
            token=args.token,
            agent_id=args.agent_id,
            passport_id=args.passport_id,
            map_tool_call=lambda _call: {"action_type": args.action, "resource": args.resource},
        )
        decision = evaluate_tool_call({"name": args.action}, config)
        print(json.dumps(asdict(decision), indent=2))
        raise SystemExit(0 if decision.enforced_effect == "ALLOW" else 2)
