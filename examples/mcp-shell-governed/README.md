# Governed MCP Shell Example

Pattern: shell tools are mapped to safe action labels before execution.
Destructive commands should deny unless an explicit policy/passport allows them.

Example risk mapping:

| Command shape | Risk | Default |
|---|---|---|
| `pwd`, `ls`, `git status` | low | allow if scope/policy allow |
| `curl`, `npm publish`, deploy commands | medium/high | policy dependent |
| `rm -rf`, credential reads, service restarts | critical | deny or require approval |

The gateway sends command class and a redacted resource label, not the raw shell
payload.
