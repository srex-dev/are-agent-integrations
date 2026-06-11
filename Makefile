.PHONY: install test build pack bench

install:
	npm install
	python -m pip install -e "python[dev]"

test:
	npm test
	python -m pytest -q python/tests

build:
	npm run build
	python -m build python

pack:
	npm run pack:node
	python -m twine check python/dist/*

bench:
	python benchmarks/guardrail-comparison/run_guardrail_comparison.py
