import { safeResourceLabel } from "@srex/are-mcp-gateway";

export function mapFilesystemTool(call: { name: string; args?: unknown }) {
  return {
    actionType: call.name,
    resource: safeResourceLabel(call.args),
    risk: call.name.includes("delete") || call.name.includes("write") ? "high" : "low"
  };
}
