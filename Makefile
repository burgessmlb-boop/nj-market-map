VENV := .venv
PY := $(VENV)/bin/python

.PHONY: setup refresh boundaries dev build

# One-time: create the Python environment and install web dependencies.
setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r pipeline/requirements.txt
	cd web && npm install

# Data refresh: download latest data, recompute all levels, validate.
# (Runs automatically every week via .github/workflows/refresh.yml.)
refresh:
	cd pipeline && ../$(PY) run.py

# Rebuild zip/town/county boundary shapes (rarely needed; outputs are committed).
boundaries:
	cd pipeline && ../$(PY) boundaries.py

# Run the site locally at http://localhost:5173
dev:
	cd web && npm run dev

# Production build (output in web/dist).
build:
	cd web && npm run build
