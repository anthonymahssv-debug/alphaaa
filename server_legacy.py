#!/usr/bin/env python3
from __future__ import annotations

import csv
import io
import json
import subprocess
import sys
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote
from zoneinfo import ZoneInfo

try:
    from intelligence import slugify
except ModuleNotFoundError:
    from .intelligence import slugify

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
FRONTEND = ROOT / "frontend"
DATA_DIR = BACKEND / "data"
SEED_FILE = DATA_DIR / "listings.seed.json"
LIVE_FILE = DATA_DIR / "listings.live.json"
INQUIRIES_FILE = DATA_DIR / "inquiries.json"
SCRAPER = BACKEND / "scraper.py"
MX_TZ = ZoneInfo("America/Mexico_City")


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_payload():
    if LIVE_FILE.exists():
        return read_json(LIVE_FILE, {})
    return read_json(SEED_FILE, {})


def load_seed():
    return read_json(SEED_FILE, {"buildings": {}, "listings": []})


def load_inquiries():
    data = read_json(INQUIRIES_FILE, [])
    return data if isinstance(data, list) else []


def save_inquiries(items):
    write_json(INQUIRIES_FILE, items)


def run_refresh():
    proc = subprocess.run(
        [sys.executable, str(SCRAPER)],
        capture_output=True,
        text=True,
        cwd=str(BACKEND),
    )
    return proc


def ensure_live_file():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not INQUIRIES_FILE.exists():
        save_inquiries([])
    if LIVE_FILE.exists():
        return
    proc = run_refresh()
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "Failed to create live file")


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def json_error(message: str, code: int = 400, extra: dict | None = None):
    payload = {"ok": False, "error": message}
    if extra:
        payload.update(extra)
    return payload, code


def sanitize_inquiry(data: dict, existing: dict | None = None) -> dict:
    existing = dict(existing or {})
    base = {
        "id": existing.get("id"),
        "timestamp": existing.get("timestamp"),
        "listing_id": str(data.get("listing_id") or existing.get("listing_id") or "").strip(),
        "channel": str(data.get("channel") or existing.get("channel") or "whatsapp").strip() or "whatsapp",
        "contact_name": str(data.get("contact_name") or existing.get("contact_name") or "").strip(),
        "company": str(data.get("company") or existing.get("company") or "").strip(),
        "claimed_status": str(data.get("claimed_status") or existing.get("claimed_status") or "available").strip(),
        "response_hours": data.get("response_hours", existing.get("response_hours")),
        "price_quoted": data.get("price_quoted", existing.get("price_quoted")),
        "provided_unit_number": parse_bool(data.get("provided_unit_number", existing.get("provided_unit_number"))),
        "provided_video": parse_bool(data.get("provided_video", existing.get("provided_video"))),
        "provided_cost_breakdown": parse_bool(data.get("provided_cost_breakdown", existing.get("provided_cost_breakdown"))),
        "notes": str(data.get("notes") or existing.get("notes") or "").strip(),
    }

    if base["claimed_status"] not in {"available", "unavailable", "no_response", "changed_offer"}:
        base["claimed_status"] = "available"
    base["response_hours"] = parse_float(base["response_hours"])
    base["price_quoted"] = parse_float(base["price_quoted"])
    return base


def listing_rank(listing):
    intel = listing.get("intel", {})
    scores = intel.get("scores", {})
    pricing = intel.get("pricing", {})
    peer = intel.get("peer_group", {})
    return (
        scores.get("value_score", 0)
        + scores.get("confidence_score", 0) * 0.2
        + max(-pricing.get("delta_to_peer_price_pct", 0), 0) * 1.4
        + min(listing.get("days_on_market", 0), 60) * 0.3
        - scores.get("ghost_probability", 0) * 0.9
        + min(peer.get("credible_count", 0), 3) * 4
    )


def filter_listings(payload: dict, query: dict) -> list[dict]:
    rows = list(payload.get("listings") or [])
    q = (query.get("q", [""])[0] or "").strip().lower()
    building = (query.get("building", [""])[0] or "").strip().lower()
    beds = parse_int(query.get("beds", [None])[0])
    status = (query.get("status", [""])[0] or "").strip().lower()
    min_price = parse_float(query.get("min_price", [None])[0])
    max_price = parse_float(query.get("max_price", [None])[0])
    min_value = parse_float(query.get("min_value_score", [None])[0])
    max_ghost = parse_float(query.get("max_ghost_probability", [None])[0])

    def keep(row):
        intel = row.get("intel", {})
        if building and row.get("building") != building:
            return False
        if beds is not None and int(row.get("beds", 0)) != beds:
            return False
        if status and intel.get("status", {}).get("key") != status:
            return False
        if min_price is not None and float(row.get("price", 0)) < min_price:
            return False
        if max_price is not None and float(row.get("price", 0)) > max_price:
            return False
        if min_value is not None and float(intel.get("scores", {}).get("value_score", 0)) < min_value:
            return False
        if max_ghost is not None and float(intel.get("scores", {}).get("ghost_probability", 0)) > max_ghost:
            return False
        if q:
            haystack = " ".join([
                str(row.get("id", "")),
                str(row.get("title", "")),
                str(row.get("description", "")),
                str(intel.get("source_profile", {}).get("label", "")),
                str(row.get("building", "")),
            ]).lower()
            return q in haystack
        return True

    rows = [row for row in rows if keep(row)]

    sort_key = (query.get("sort", ["rank"])[0] or "rank").strip().lower()
    reverse = True
    if sort_key == "price_asc":
        rows.sort(key=lambda row: (row.get("price", 0), row.get("id")))
        reverse = False
    elif sort_key == "price_desc":
        rows.sort(key=lambda row: (row.get("price", 0), row.get("id")), reverse=True)
    elif sort_key == "dom_desc":
        rows.sort(key=lambda row: (row.get("days_on_market", 0), row.get("id")), reverse=True)
    elif sort_key == "value_desc":
        rows.sort(key=lambda row: (row.get("intel", {}).get("scores", {}).get("value_score", 0), row.get("id")), reverse=True)
    elif sort_key == "ghost_desc":
        rows.sort(key=lambda row: (row.get("intel", {}).get("scores", {}).get("ghost_probability", 0), row.get("id")), reverse=True)
    elif sort_key == "leverage_desc":
        rows.sort(key=lambda row: (row.get("intel", {}).get("scores", {}).get("leverage_score", 0), row.get("id")), reverse=True)
    else:
        rows.sort(key=listing_rank, reverse=True)

    offset = max(0, parse_int(query.get("offset", [0])[0], 0))
    limit = parse_int(query.get("limit", [None])[0], None)
    if limit is not None:
        limit = max(1, min(limit, 500))
        paged = rows[offset: offset + limit]
    else:
        paged = rows[offset:]

    return paged, rows, offset, limit, sort_key


def find_listing(payload: dict, listing_id: str):
    for row in payload.get("listings") or []:
        if row.get("id") == listing_id:
            return row
    return None


def comparables_for(payload: dict, listing_id: str, limit: int = 5) -> dict | None:
    listing = find_listing(payload, listing_id)
    if not listing:
        return None
    rows = []
    for row in payload.get("listings") or []:
        if row.get("id") == listing_id:
            continue
        if row.get("building") != listing.get("building"):
            continue
        if int(row.get("beds", 0)) != int(listing.get("beds", 0)):
            continue
        intel = row.get("intel", {})
        closeness = abs(float(row.get("sqm", 0)) - float(listing.get("sqm", 0))) + abs(float(row.get("price", 0)) - float(listing.get("price", 0))) / 5000
        rows.append(
            {
                "listing_id": row.get("id"),
                "title": row.get("title"),
                "price": row.get("price"),
                "sqm": row.get("sqm"),
                "days_on_market": row.get("days_on_market"),
                "delta_to_peer_price_pct": intel.get("pricing", {}).get("delta_to_peer_price_pct"),
                "value_score": intel.get("scores", {}).get("value_score"),
                "_closeness": closeness,
            }
        )
    rows.sort(key=lambda row: (row["_closeness"], -float(row.get("value_score") or 0)))
    for row in rows:
        row.pop("_closeness", None)
    return {
        "subject": listing,
        "count": len(rows),
        "items": rows[:max(1, min(limit, 20))],
    }


def openapi_spec(base_url: str = "http://127.0.0.1:8000") -> dict:
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "Santa Fe REIS API",
            "version": "1.0.0",
            "description": "Real-estate intelligence API for Av. Santa Fe 546, CDMX.",
        },
        "servers": [{"url": base_url}],
        "paths": {
            "/api/health": {"get": {"summary": "Health check"}},
            "/api/status": {"get": {"summary": "Feed status"}},
            "/api/openapi.json": {"get": {"summary": "OpenAPI spec"}},
            "/api/feed": {"get": {"summary": "Full enriched payload"}},
            "/api/market-summary": {"get": {"summary": "Market summary"}},
            "/api/events": {"get": {"summary": "Event feed"}},
            "/api/buildings": {"get": {"summary": "Buildings and tower summaries"}},
            "/api/buildings/{building}": {"get": {"summary": "One building summary"}},
            "/api/buildings/{building}/listings": {"get": {"summary": "Listings for one building"}},
            "/api/listings": {
                "get": {
                    "summary": "Filtered listings",
                    "parameters": [
                        {"name": "q", "in": "query", "schema": {"type": "string"}},
                        {"name": "building", "in": "query", "schema": {"type": "string"}},
                        {"name": "beds", "in": "query", "schema": {"type": "integer"}},
                        {"name": "status", "in": "query", "schema": {"type": "string"}},
                        {"name": "min_price", "in": "query", "schema": {"type": "number"}},
                        {"name": "max_price", "in": "query", "schema": {"type": "number"}},
                        {"name": "sort", "in": "query", "schema": {"type": "string"}},
                        {"name": "limit", "in": "query", "schema": {"type": "integer"}},
                        {"name": "offset", "in": "query", "schema": {"type": "integer"}},
                    ],
                }
            },
            "/api/listings/{listing_id}": {"get": {"summary": "One listing"}},
            "/api/comparables": {"get": {"summary": "Comparables by listing_id"}},
            "/api/agents": {"get": {"summary": "Agent credibility table"}},
            "/api/agents/{agent_slug}": {"get": {"summary": "One agent"}},
            "/api/inquiries": {"get": {"summary": "List inquiries"}, "post": {"summary": "Create inquiry"}},
            "/api/inquiries/{inquiry_id}": {
                "get": {"summary": "Get inquiry"},
                "put": {"summary": "Update inquiry"},
                "delete": {"summary": "Delete inquiry"},
            },
            "/api/seed": {"get": {"summary": "Get raw seed"}, "post": {"summary": "Replace or merge raw seed"}},
            "/api/export/listings.csv": {"get": {"summary": "CSV export"}},
            "/api/refresh": {"post": {"summary": "Recompute live feed from seed + inquiries"}},
        },
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        super().end_headers()

    def _json(self, payload, code: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text(self, text: str, code: int = 200, content_type: str = "text/plain; charset=utf-8"):
        body = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        payload = load_payload()

        if path == "/api/health":
            return self._json({"ok": True, "now": datetime.now(MX_TZ).replace(microsecond=0).isoformat()})

        if path == "/api/status":
            return self._json(
                {
                    "ok": True,
                    "mode": payload.get("mode", "seed"),
                    "generated_at": payload.get("generated_at"),
                    "generated_at_label": payload.get("generated_at_label"),
                    "count": len(payload.get("listings", [])),
                    "signature": payload.get("signature"),
                    "source": LIVE_FILE.name if LIVE_FILE.exists() else SEED_FILE.name,
                }
            )

        if path == "/api/openapi.json":
            host = self.headers.get("Host") or "127.0.0.1:8000"
            scheme = "http"
            return self._json(openapi_spec(f"{scheme}://{host}"))

        if path == "/api/feed":
            return self._json(payload)

        if path == "/api/market-summary":
            return self._json(
                {
                    "ok": True,
                    "generated_at": payload.get("generated_at"),
                    "market_summary": payload.get("market_summary", {}),
                    "tower_summary": payload.get("tower_summary", {}),
                }
            )

        if path == "/api/events":
            items = list(payload.get("events", []))
            return self._json({"ok": True, "count": len(items), "items": items})

        if path == "/api/buildings":
            buildings = payload.get("buildings", {})
            tower_summary = payload.get("tower_summary", {})
            items = []
            for building_id, building in buildings.items():
                items.append(
                    {
                        "id": building_id,
                        "building": building,
                        "summary": tower_summary.get(building_id, {}),
                    }
                )
            return self._json({"ok": True, "count": len(items), "items": items})

        if path.startswith("/api/buildings/"):
            parts = [unquote(part) for part in path.split("/") if part]
            if len(parts) >= 3:
                building_id = parts[2]
                if building_id not in (payload.get("buildings") or {}):
                    return self._json(*json_error("building not found", 404))
                if len(parts) == 3:
                    items = [row for row in payload.get("listings", []) if row.get("building") == building_id]
                    return self._json(
                        {
                            "ok": True,
                            "id": building_id,
                            "building": payload["buildings"][building_id],
                            "summary": payload.get("tower_summary", {}).get(building_id, {}),
                            "listing_count": len(items),
                        }
                    )
                if len(parts) == 4 and parts[3] == "listings":
                    items = [row for row in payload.get("listings", []) if row.get("building") == building_id]
                    items.sort(key=listing_rank, reverse=True)
                    return self._json({"ok": True, "count": len(items), "items": items})
            return self._json(*json_error("unknown building endpoint", 404))

        if path == "/api/listings":
            paged, full_rows, offset, limit, sort_key = filter_listings(payload, query)
            return self._json(
                {
                    "ok": True,
                    "generated_at": payload.get("generated_at"),
                    "count": len(paged),
                    "total": len(full_rows),
                    "offset": offset,
                    "limit": limit,
                    "sort": sort_key,
                    "items": paged,
                }
            )

        if path.startswith("/api/listings/"):
            listing_id = unquote(path.split("/api/listings/", 1)[1]).strip("/")
            listing = find_listing(payload, listing_id)
            if not listing:
                return self._json(*json_error("listing not found", 404))
            return self._json({"ok": True, "item": listing})

        if path == "/api/comparables":
            listing_id = (query.get("listing_id", [""])[0] or "").strip()
            if not listing_id:
                return self._json(*json_error("listing_id is required", 400))
            limit = parse_int(query.get("limit", [5])[0], 5)
            data = comparables_for(payload, listing_id, limit=limit)
            if not data:
                return self._json(*json_error("listing not found", 404))
            return self._json({"ok": True, **data})

        if path == "/api/agents":
            rows = list(payload.get("agent_summary", []))
            sort_key = (query.get("sort", ["credibility_desc"])[0] or "credibility_desc").strip().lower()
            if sort_key == "interactions_desc":
                rows.sort(key=lambda row: (row.get("interactions", 0), row.get("credibility_score", 0)), reverse=True)
            elif sort_key == "contradictions_desc":
                rows.sort(key=lambda row: (row.get("contradictions", 0), -row.get("credibility_score", 0)), reverse=True)
            else:
                rows.sort(key=lambda row: (row.get("credibility_score", 0), row.get("interactions", 0)), reverse=True)
            return self._json({"ok": True, "count": len(rows), "items": rows})

        if path.startswith("/api/agents/"):
            agent_slug = unquote(path.split("/api/agents/", 1)[1]).strip("/")
            inquiries = load_inquiries()
            rows = list(payload.get("agent_summary", []))
            item = next((row for row in rows if row.get("slug") == agent_slug), None)
            if not item:
                return self._json(*json_error("agent not found", 404))
            agent_inquiries = [
                row for row in inquiries
                if slugify(row.get("company") or row.get("contact_name") or "Sin identificar") == agent_slug
            ]
            agent_inquiries.sort(key=lambda row: row.get("timestamp", ""), reverse=True)
            return self._json({"ok": True, "item": item, "inquiries": agent_inquiries})

        if path == "/api/inquiries":
            rows = load_inquiries()
            listing_id = (query.get("listing_id", [""])[0] or "").strip()
            claimed_status = (query.get("claimed_status", [""])[0] or "").strip()
            company = (query.get("company", [""])[0] or "").strip().lower()
            contact_name = (query.get("contact_name", [""])[0] or "").strip().lower()

            def keep(row):
                if listing_id and row.get("listing_id") != listing_id:
                    return False
                if claimed_status and row.get("claimed_status") != claimed_status:
                    return False
                if company and company not in (row.get("company") or "").lower():
                    return False
                if contact_name and contact_name not in (row.get("contact_name") or "").lower():
                    return False
                return True

            rows = [row for row in rows if keep(row)]
            rows.sort(key=lambda row: row.get("timestamp", ""), reverse=True)
            offset = max(0, parse_int(query.get("offset", [0])[0], 0))
            limit = parse_int(query.get("limit", [None])[0], None)
            if limit is not None:
                limit = max(1, min(limit, 500))
                paged = rows[offset: offset + limit]
            else:
                paged = rows[offset:]
            return self._json({"ok": True, "count": len(paged), "total": len(rows), "offset": offset, "limit": limit, "items": paged})

        if path.startswith("/api/inquiries/"):
            inquiry_id = unquote(path.split("/api/inquiries/", 1)[1]).strip("/")
            rows = load_inquiries()
            item = next((row for row in rows if row.get("id") == inquiry_id), None)
            if not item:
                return self._json(*json_error("inquiry not found", 404))
            return self._json({"ok": True, "item": item})

        if path == "/api/seed":
            seed = load_seed()
            return self._json({"ok": True, "count": len(seed.get("listings", [])), "payload": seed})

        if path == "/api/export/listings.csv":
            items, _, _, _, _ = filter_listings(payload, query)
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                "id", "building", "title", "price", "sqm", "beds", "days_on_market", "source",
                "status", "value_score", "leverage_score", "ghost_probability",
                "fair_low", "fair_high", "opening_anchor", "target_close", "walk_away",
            ])
            for row in items:
                intel = row.get("intel", {})
                pricing = intel.get("pricing", {})
                scores = intel.get("scores", {})
                writer.writerow([
                    row.get("id"),
                    row.get("building"),
                    row.get("title"),
                    row.get("price"),
                    row.get("sqm"),
                    row.get("beds"),
                    row.get("days_on_market"),
                    intel.get("source_profile", {}).get("label"),
                    intel.get("status", {}).get("key"),
                    scores.get("value_score"),
                    scores.get("leverage_score"),
                    scores.get("ghost_probability"),
                    pricing.get("fair_low"),
                    pricing.get("fair_high"),
                    pricing.get("opening_anchor"),
                    pricing.get("target_close"),
                    pricing.get("walk_away"),
                ])
            return self._text(buf.getvalue(), content_type="text/csv; charset=utf-8")

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/refresh":
            proc = run_refresh()
            if proc.returncode != 0:
                return self._json({"ok": False, "stdout": proc.stdout.strip(), "stderr": proc.stderr.strip()}, 500)
            payload = load_payload()
            return self._json(
                {
                    "ok": True,
                    "generated_at": payload.get("generated_at"),
                    "generated_at_label": payload.get("generated_at_label"),
                    "count": len(payload.get("listings", [])),
                    "signature": payload.get("signature"),
                }
            )

        if path == "/api/inquiries":
            data = self._read_json_body()
            inquiry = sanitize_inquiry(data)
            if not inquiry["listing_id"]:
                return self._json(*json_error("listing_id is required", 400))
            payload = load_payload()
            if not find_listing(payload, inquiry["listing_id"]):
                return self._json(*json_error("listing_id not found", 404))

            inquiries = load_inquiries()
            inquiry["id"] = f"inq_{len(inquiries) + 1}"
            inquiry["timestamp"] = datetime.now(MX_TZ).replace(microsecond=0).isoformat()
            inquiries.append(inquiry)
            save_inquiries(inquiries)

            proc = run_refresh()
            if proc.returncode != 0:
                return self._json({"ok": False, "error": "saved inquiry but refresh failed", "stderr": proc.stderr.strip()}, 500)

            return self._json({"ok": True, "item": inquiry}, 201)

        if path in {"/api/seed", "/api/listings/import"}:
            body = self._read_json_body()
            seed = load_seed()
            replace = parse_bool(body.get("replace"), False)
            incoming_buildings = body.get("buildings")
            incoming_listings = body.get("listings")
            if not isinstance(incoming_listings, list):
                return self._json(*json_error("listings array is required", 400))

            if replace:
                new_seed = {
                    "buildings": incoming_buildings if isinstance(incoming_buildings, dict) else seed.get("buildings", {}),
                    "listings": incoming_listings,
                }
            else:
                merged = {str(item.get("id")): item for item in seed.get("listings", []) if item.get("id")}
                for item in incoming_listings:
                    if not isinstance(item, dict) or not item.get("id"):
                        continue
                    merged[str(item["id"])] = item
                new_seed = {
                    "buildings": incoming_buildings if isinstance(incoming_buildings, dict) else seed.get("buildings", {}),
                    "listings": list(merged.values()),
                }

            write_json(SEED_FILE, new_seed)
            proc = run_refresh()
            if proc.returncode != 0:
                return self._json({"ok": False, "error": "seed saved but refresh failed", "stderr": proc.stderr.strip()}, 500)
            payload = load_payload()
            return self._json({"ok": True, "count": len(payload.get("listings", [])), "mode": "merged" if not replace else "replaced"})

        return self._json(*json_error("unknown endpoint", 404))

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/inquiries/"):
            inquiry_id = unquote(path.split("/api/inquiries/", 1)[1]).strip("/")
            data = self._read_json_body()
            inquiries = load_inquiries()
            index = next((i for i, row in enumerate(inquiries) if row.get("id") == inquiry_id), None)
            if index is None:
                return self._json(*json_error("inquiry not found", 404))

            updated = sanitize_inquiry(data, existing=inquiries[index])
            if not updated["listing_id"]:
                return self._json(*json_error("listing_id is required", 400))
            updated["id"] = inquiries[index]["id"]
            updated["timestamp"] = inquiries[index].get("timestamp")
            inquiries[index] = updated
            save_inquiries(inquiries)

            proc = run_refresh()
            if proc.returncode != 0:
                return self._json({"ok": False, "error": "updated inquiry but refresh failed", "stderr": proc.stderr.strip()}, 500)
            return self._json({"ok": True, "item": updated})

        return self._json(*json_error("unknown endpoint", 404))

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/inquiries/"):
            inquiry_id = unquote(path.split("/api/inquiries/", 1)[1]).strip("/")
            inquiries = load_inquiries()
            remaining = [row for row in inquiries if row.get("id") != inquiry_id]
            if len(remaining) == len(inquiries):
                return self._json(*json_error("inquiry not found", 404))
            save_inquiries(remaining)

            proc = run_refresh()
            if proc.returncode != 0:
                return self._json({"ok": False, "error": "deleted inquiry but refresh failed", "stderr": proc.stderr.strip()}, 500)
            return self._json({"ok": True, "deleted_id": inquiry_id})

        return self._json(*json_error("unknown endpoint", 404))


if __name__ == "__main__":
    ensure_live_file()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("Serving Santa Fe REIS API on http://127.0.0.1:8000")
    server.serve_forever()
