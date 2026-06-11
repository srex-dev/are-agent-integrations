# Security Policy

## Supported Versions

This repository is pre-1.0. Security fixes target the latest commit on `main`
until versioned releases begin.

## Reporting A Vulnerability

Please do not open public issues for secrets, bypasses, or payload leakage.
Send a private report to the maintainers with:

- affected package and version
- minimal reproduction
- expected deny/fail-closed behavior
- observed behavior

## Security Boundaries

- This project wraps tool calls with ARE Foundation checks.
- It does not execute customer actions by itself.
- It does not activate policy or issue production authority.
- It must fail closed in `enforce` mode when ARE Foundation is unavailable.
- It must not log raw tool payloads, tokens, headers, credentials, signatures,
  protected evidence, or raw prompts.
