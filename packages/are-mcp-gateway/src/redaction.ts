const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._\-]+/gi,
  /sk_[a-z0-9_]{16,}/gi,
  /(api[_-]?key|token|credential|password|secret|signature)\s*[:=]\s*["']?[^"',\s]+/gi,
  /(authorization|cookie|set-cookie)\s*[:=]\s*["']?[^"',\n]+/gi
];

export function redactText(value: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[REDACTED]"), value);
}

export function safeResourceLabel(input: unknown): string {
  if (input === null || input === undefined) {
    return "unknown";
  }

  if (typeof input === "string") {
    return truncate(redactText(input), 96);
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  if (Array.isArray(input)) {
    return `array/${input.length}`;
  }

  if (typeof input === "object") {
    const keys = Object.keys(input as Record<string, unknown>)
      .filter((key) => !/token|secret|password|credential|authorization|cookie|signature/i.test(key))
      .slice(0, 4)
      .join(",");
    return keys ? `object/${keys}` : "object";
  }

  return "unknown";
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
