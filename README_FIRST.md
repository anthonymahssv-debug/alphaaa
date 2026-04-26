# README_FIRST — Santa Fe CI Final Handoff v2

Use `project/` as the canonical deployable source.

This bundle is built from the latest uploaded `Archive.zip` because that archive contains the most complete API-backed structure: FastAPI backend files, SQLite database, seed data, frontend shell, CSS stack, docs, and API endpoints. Older/newer UI uploads are preserved in `reference_uploads/` and must be used only after the API is live.

## Fast mission for Perplexity Computer

1. Upload this ZIP to Perplexity Computer.
2. Open `instructions/PROMPT_TO_PASTE_IN_PERPLEXITY.md`.
3. Deploy `project/` to Replit first, no GitHub required.
4. Verify these endpoints:
   - `/api/health`
   - `/api/system/health`
   - `/api/feed`
   - `/api/alerts`
   - `/api/listings`
   - `/api/openapi.json`
5. Only after API works, use `reference_uploads/` to polish UI/i18n.

## Start commands

Install/build:

```bash
pip install -r backend/requirements.txt && python -m backend.seed
```

Run:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

For Render/Railway:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

## Critical warning

Do not turn this into static-only. `frontend/data.json` is seed/fallback data. API mode must be served by `backend/main.py`.
