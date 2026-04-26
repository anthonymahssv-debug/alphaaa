# Deployment

## Local

```bash
cd santa-fe-ci-api-hotfix
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
python -m backend.seed
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Static-only fallback

You can still host the `frontend/` folder by itself, but that is demo/offline mode only.
For the intended product, run the backend and serve the frontend through FastAPI.
