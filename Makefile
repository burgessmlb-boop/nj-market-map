VENV := .venv
PY := $(VENV)/bin/python

.PHONY: setup refresh boundaries dev build

# One-time: create the Python environment and install web dependencies.
setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r pipeline/requirements.txt
	cd web && npm install

# Monthly data refresh: download latest data, recompute scores, validate.
refresh:
	cd pipeline && ../$(PY) run.py

# Rebuild zip-code boundary shapes (rarely needed).
boundaries:
	cd pipeline && ../$(PY) boundaries.py

# Run the site locally at http://localhost:5173
dev:
	cd web && npm run dev

# Production build (output in web/dist).
build:
	cd web && npm run build
