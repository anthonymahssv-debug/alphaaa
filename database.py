from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
DATA_JSON = FRONTEND_DIR / "data.json"
DB_PATH = ROOT / "santa_fe_ci.db"

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with connect() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS listings (
            id TEXT PRIMARY KEY,
            building TEXT,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS buildings (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            unread INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL
        );
        """)
        conn.commit()

def read_seed_json() -> Dict[str, Any]:
    if not DATA_JSON.exists():
        return {"mode": "offline", "buildings": {}, "tower_summary": {}, "market_summary": {}, "events": [], "listings": []}
    return json.loads(DATA_JSON.read_text(encoding="utf-8"))

def seed_from_json(force: bool = False) -> Dict[str, Any]:
    init_db()
    data = read_seed_json()
    now = utcnow_iso()
    with connect() as conn:
        existing = conn.execute("SELECT COUNT(*) c FROM listings").fetchone()["c"]
        if existing and not force:
            return load_feed() or data
        conn.execute("DELETE FROM listings")
        conn.execute("DELETE FROM buildings")
        for b_id, payload in (data.get("buildings") or {}).items():
            conn.execute("INSERT OR REPLACE INTO buildings(id,payload,updated_at) VALUES(?,?,?)", (b_id, json.dumps(payload, ensure_ascii=False), now))
        for listing in data.get("listings") or []:
            conn.execute(
                "INSERT OR REPLACE INTO listings(id,building,payload,updated_at) VALUES(?,?,?,?)",
                (listing.get("id"), listing.get("building"), json.dumps(listing, ensure_ascii=False), now)
            )
        for key in ["tower_summary", "market_summary", "events", "agent_summary", "mode", "generated_at", "generated_at_label", "signature"]:
            conn.execute(
                "INSERT OR REPLACE INTO meta(key,value,updated_at) VALUES(?,?,?)",
                (key, json.dumps(data.get(key), ensure_ascii=False), now)
            )
        conn.commit()
    return load_feed() or data

def load_feed() -> Optional[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        listings = [json.loads(r["payload"]) for r in conn.execute("SELECT payload FROM listings ORDER BY id").fetchall()]
        buildings_rows = conn.execute("SELECT id,payload FROM buildings ORDER BY id").fetchall()
        buildings = {r["id"]: json.loads(r["payload"]) for r in buildings_rows}
        if not listings and not buildings:
            return None
        meta_rows = conn.execute("SELECT key,value FROM meta").fetchall()
        meta = {r["key"]: json.loads(r["value"]) for r in meta_rows}
    return {
        "mode": meta.get("mode") or "api_seeded",
        "generated_at": meta.get("generated_at"),
        "generated_at_label": meta.get("generated_at_label"),
        "signature": meta.get("signature") or "api-seeded",
        "buildings": buildings,
        "tower_summary": meta.get("tower_summary") or {},
        "market_summary": meta.get("market_summary") or {},
        "events": meta.get("events") or [],
        "agent_summary": meta.get("agent_summary") or [],
        "listings": listings,
    }

def save_alerts(alerts: List[Dict[str, Any]]) -> None:
    init_db()
    now = utcnow_iso()
    with connect() as conn:
        for alert in alerts:
            existing = conn.execute("SELECT unread FROM alerts WHERE id=?", (alert["id"],)).fetchone()
            unread = int(existing["unread"]) if existing else int(alert.get("unread", True))
            payload = dict(alert)
            payload["unread"] = bool(unread)
            conn.execute(
                "INSERT OR REPLACE INTO alerts(id,payload,unread,updated_at) VALUES(?,?,?,?)",
                (alert["id"], json.dumps(payload, ensure_ascii=False), unread, now)
            )
        conn.commit()

def load_alerts() -> List[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        rows = conn.execute("SELECT payload, unread FROM alerts ORDER BY updated_at DESC").fetchall()
    out = []
    for r in rows:
        payload = json.loads(r["payload"])
        payload["unread"] = bool(r["unread"])
        out.append(payload)
    return out

def mark_alert_read(alert_id: str) -> bool:
    with connect() as conn:
        row = conn.execute("SELECT payload FROM alerts WHERE id=?", (alert_id,)).fetchone()
        if not row:
            return False
        payload = json.loads(row["payload"])
        payload["unread"] = False
        conn.execute("UPDATE alerts SET unread=0, payload=?, updated_at=? WHERE id=?", (json.dumps(payload, ensure_ascii=False), utcnow_iso(), alert_id))
        conn.commit()
        return True

def mark_all_alerts_read() -> int:
    with connect() as conn:
        rows = conn.execute("SELECT id,payload FROM alerts").fetchall()
        for r in rows:
            payload = json.loads(r["payload"])
            payload["unread"] = False
            conn.execute("UPDATE alerts SET unread=0, payload=?, updated_at=? WHERE id=?", (json.dumps(payload, ensure_ascii=False), utcnow_iso(), r["id"]))
        conn.commit()
        return len(rows)

def db_health() -> Dict[str, Any]:
    init_db()
    start = datetime.now()
    try:
        with connect() as conn:
            listings = conn.execute("SELECT COUNT(*) c FROM listings").fetchone()["c"]
            alerts = conn.execute("SELECT COUNT(*) c FROM alerts").fetchone()["c"]
            buildings = conn.execute("SELECT COUNT(*) c FROM buildings").fetchone()["c"]
        latency = (datetime.now() - start).total_seconds() * 1000
        return {
            "connected": True,
            "type": "sqlite",
            "path": str(DB_PATH),
            "latencyMs": round(latency, 2),
            "sizeMb": round(DB_PATH.stat().st_size / (1024 * 1024), 3) if DB_PATH.exists() else 0,
            "listingsTableCount": listings,
            "alertsTableCount": alerts,
            "buildingsTableCount": buildings,
            "watchStateTableCount": listings,
            "seedStatus": "seeded" if listings else "not_seeded",
            "lastErrorAt": None,
            "lastErrorMessage": None,
        }
    except Exception as exc:
        return {
            "connected": False,
            "type": "sqlite",
            "path": str(DB_PATH),
            "latencyMs": None,
            "sizeMb": 0,
            "listingsTableCount": 0,
            "alertsTableCount": 0,
            "buildingsTableCount": 0,
            "watchStateTableCount": 0,
            "seedStatus": "failed",
            "lastErrorAt": utcnow_iso(),
            "lastErrorMessage": str(exc),
        }
