# API

Required endpoints implemented:

- `GET /api/health`
- `GET /api/system/health`
- `GET /api/feed`
- `GET /api/listings`
- `GET /api/listings/{id}`
- `GET /api/buildings`
- `GET /api/market/summary`
- `GET /api/alerts`
- `POST /api/alerts/{id}/read`
- `POST /api/alerts/read-all`
- `POST /api/scores/recalculate`
- `POST /api/refresh`
- `GET /api/openapi.json`

Compatibility endpoints used by existing `app.js`:

- `GET /api/agents`
- `POST /api/inquiries`
- `GET /api/watch-state`
- `GET /api/event-log`
- `GET /api/snapshots`
- `POST /api/collect`
