# Contributing

Thanks for helping make governed agent integrations easier to adopt.

## Ground Rules

- Keep examples public-safe and runnable.
- Do not include tokens, credentials, raw prompts, protected payloads, raw
  headers, signatures, private proof bundles, or customer data.
- Keep claims falsifiable. If a README says a benchmark denied a percentage of
  calls, the report must be generated from `benchmarks/`.
- Prefer small examples over broad abstractions.

## Local Development

```bash
npm install
npm test

python -m pip install -e "python[dev]"
python -m pytest -q python/tests
```

For integration tests, run ARE Foundation locally first:

```bash
cd ../are-foundation
make certs
make up
make smoke
```
