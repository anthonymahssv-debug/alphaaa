#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
from pathlib import Path
try:
    from intelligence import enrich_payload
except ModuleNotFoundError:
    from .intelligence import enrich_payload

BACKEND = Path(__file__).resolve().parent
DATA_DIR = BACKEND / "data"
SEED_FILE = DATA_DIR / "listings.seed.json"
LIVE_FILE = DATA_DIR / "listings.live.json"
INQUIRIES_FILE = DATA_DIR / "inquiries.json"


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


def main() -> int:
    seed_payload = read_json(SEED_FILE, {})
    if not isinstance(seed_payload, dict) or "listings" not in seed_payload or "buildings" not in seed_payload:
        raise SystemExit("Invalid seed payload")
    previous_payload = read_json(LIVE_FILE, {})
    inquiries = read_json(INQUIRIES_FILE, [])
    if not isinstance(inquiries, list):
        inquiries = []

    payload = enrich_payload(seed_payload, previous_payload=previous_payload, inquiries=inquiries)
    payload["signature"] = hashlib.sha1(
        (str(payload.get("generated_at")) + str(len(payload.get("listings", [])))).encode("utf-8")
    ).hexdigest()[:12]
    payload["mode"] = "live"

    write_json(LIVE_FILE, payload)
    print(f"wrote {len(payload.get('listings', []))} listings to {LIVE_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
