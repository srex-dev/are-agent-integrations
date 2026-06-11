# Guardrail Comparison Benchmark

This harness compares a deliberately simple prompt-only guardrail with a
deterministic ARE-style policy classifier for tool calls.

It is not a claim generator by itself. It produces evidence you can quote only
after running it.

```bash
python benchmarks/guardrail-comparison/run_guardrail_comparison.py
```

Outputs:

- `reports/guardrail-comparison/<timestamp>/matrix.json`
- `reports/guardrail-comparison/<timestamp>/summary.md`
- `reports/guardrail-comparison/<timestamp>/public-summary.md`
