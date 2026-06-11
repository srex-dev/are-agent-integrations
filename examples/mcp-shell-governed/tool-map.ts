import { redactText, safeResourceLabel } from "@srex/are-mcp-gateway";

export function mapShellTool(call: { name: string; args?: unknown }) {
  const label = safeResourceLabel(call.args);
  const raw = redactText(JSON.stringify(call.args ?? {})).toLowerCase();
  const critical = /\brm\s+-rf\b|credential|secret|token|shutdown|restart/.test(raw);
  const network = /\bcurl\b|\bwget\b|\bdeploy\b|\bpublish\b/.test(raw);
  return {
    actionType: critical ? "shell.critical" : network ? "shell.network" : "shell.safe",
    resource: label,
    risk: critical ? "critical" : network ? "medium" : "low"
  };
}
