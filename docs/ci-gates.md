# CI Gates

The initial public repo keeps CI commands documented here because the current
GitHub token used to bootstrap the repository cannot push workflow files without
the `workflow` scope.

Recommended GitHub Actions gates:

```bash
npm ci
npm test
npm run build
npm run pack:node

python -m pip install -e "python[dev]"
python -m pytest -q python/tests
python -m build python
python -m twine check python/dist/*
```

Add `.github/workflows/ci.yml` after repository automation has a token with
workflow-file permission.
