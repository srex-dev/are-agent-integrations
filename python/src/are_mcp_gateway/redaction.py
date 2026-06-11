from __future__ import annotations

import re
from typing import Any

SECRET_PATTERNS = [
    re.compile(r"bearer\s+[a-z0-9._\-]+", re.IGNORECASE),
    re.compile(r"sk_[a-z0-9_]{16,}", re.IGNORECASE),
    re.compile(r"(api[_-]?key|token|credential|password|secret|signature)\s*[:=]\s*[\"']?[^\"',\s]+", re.IGNORECASE),
    re.compile(r"(authorization|cookie|set-cookie)\s*[:=]\s*[\"']?[^\"',\n]+", re.IGNORECASE),
]


def redact_text(value: str) -> str:
    current = value
    for pattern in SECRET_PATTERNS:
        current = pattern.sub("[REDACTED]", current)
    return current


def safe_resource_label(value: Any) -> str:
    if value is None:
        return "unknown"
    if isinstance(value, str):
        return _truncate(redact_text(value), 96)
    if isinstance(value, bool) or isinstance(value, int) or isinstance(value, float):
        return str(value)
    if isinstance(value, list):
        return f"array/{len(value)}"
    if isinstance(value, dict):
        safe_keys = [
            key
            for key in value.keys()
            if not re.search(r"token|secret|password|credential|authorization|cookie|signature", str(key), re.IGNORECASE)
        ][:4]
        return "object/" + ",".join(map(str, safe_keys)) if safe_keys else "object"
    return "unknown"


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 3] + "..."
