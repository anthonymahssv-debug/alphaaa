from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import math

def clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    try:
        return max(lo, min(hi, float(v)))
    except Exception:
        return lo

def nested(d: Dict[str, Any], path: List[str], default=None):
    cur = d
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur

SCORE_KEYS = {
    "composite": ["composite_score", "compositeScore", "value_score", "valueScore"],
    "leverage": ["leverage_score", "leverageScore"],
    "confidence": ["confidence_score", "confidenceScore"],
    "ghost": ["ghost_probability", "ghostProbability"],
    "freshness": ["freshness_score", "freshnessScore"],
    "action": ["action_score", "actionScore"],
}

def get_score_value(listing: Dict[str, Any], key: str, default=None):
    scores = nested(listing, ["intel", "scores"], {}) or {}
    for k in SCORE_KEYS.get(key, [key]):
        if k in scores and scores[k] is not None:
            return scores[k]
    return default

def get_num(listing: Dict[str, Any], *keys, default=0):
    for key in keys:
        if key in listing and listing[key] is not None:
            try:
                return float(listing[key])
            except Exception:
                pass
    return default

def price_history(listing: Dict[str, Any]) -> List[Dict[str, Any]]:
    hist = listing.get("history") or listing.get("priceHistory") or []
    ws_hist = nested(listing, ["watch_state", "price_history"], []) or []
    return hist + ws_hist

def calculate_freshness_score(listing: Dict[str, Any]) -> float:
    ts = listing.get("last_seen_at") or listing.get("lastSeenAt") or listing.get("first_seen_at") or listing.get("firstSeenAt")
    if not ts:
        return 20
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - dt).total_seconds() / 86400
    except Exception:
        return 20
    if age_days < 1: return 100
    if age_days < 7: return 90
    if age_days < 14: return 75
    if age_days < 30: return 60
    if age_days < 60: return 40
    return 20

def similar_listings(listing: Dict[str, Any], market: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    b = listing.get("building")
    beds = listing.get("beds")
    sqm = get_num(listing, "sqm", default=0)
    lid = listing.get("id")
    sim = []
    for l in market:
        if l.get("id") == lid: continue
        if l.get("building") != b: continue
        if l.get("beds") != beds: continue
        l_sqm = get_num(l, "sqm", default=0)
        if sqm and l_sqm and abs(l_sqm - sqm) > 20: continue
        sim.append(l)
    return sim

def median(vals: List[float], default: float = 0) -> float:
    vals = sorted([float(v) for v in vals if v is not None])
    if not vals: return default
    n = len(vals)
    return vals[n//2] if n % 2 else (vals[n//2-1] + vals[n//2]) / 2

def calculate_price_score(listing: Dict[str, Any], market: List[Dict[str, Any]]) -> float:
    price = get_num(listing, "price", default=0)
    if not price:
        return 50
    sim = similar_listings(listing, market)
    ref = median([get_num(l, "price", default=0) for l in sim if get_num(l, "price", default=0)], default=0)
    if len(sim) < 3 or not ref:
        ref = nested(listing, ["intel", "peer_group", "median_price"], None) or nested(listing, ["intel", "building_context", "median_price"], None) or 0
    if not ref:
        return 50
    diff = (float(ref) - price) / float(ref)
    return clamp(50 + diff * 250)

def calculate_leverage_score_fallback(listing: Dict[str, Any]) -> float:
    score = 50
    dom = get_num(listing, "days_on_market", "daysOnMarket", default=0)
    if dom > 90: score += 30
    elif dom > 60: score += 20
    elif dom > 30: score += 10
    hist = price_history(listing)
    drops = 0
    for i in range(1, len(hist)):
        try:
            if float(hist[i].get("price")) < float(hist[i-1].get("price")):
                drops += 1
        except Exception:
            pass
    score += drops * 5
    cred = listing.get("agentCredibility") or nested(listing, ["intel", "source_profile", "trust"], None) or nested(listing, ["source_profile", "trust"], 70)
    if cred and cred < 70: score += 10
    ws = listing.get("watch_state") or {}
    if ws.get("source_missing_detected") or ws.get("off_market_detected") or ws.get("last_check_status") in {"blocked", "not_found"}:
        score += 5
    proof = nested(listing, ["intel", "availability", "proof_score"], 0) or 0
    if proof < 20: score += 5
    return clamp(score)

def calculate_confidence_score_fallback(listing: Dict[str, Any]) -> float:
    fields = ["price", "sqm", "beds", "baths", "source", "title", "agent_name"]
    complete = sum(1 for f in fields if listing.get(f))
    score = (complete / len(fields)) * 35
    trust = nested(listing, ["source_profile", "trust"], None) or nested(listing, ["intel", "source_profile", "trust"], 50)
    score += float(trust or 50) * 0.35
    score += calculate_freshness_score(listing) * 0.15
    proof = nested(listing, ["intel", "availability", "proof_score"], 0) or 0
    score += min(10, proof / 6)
    contradictions = nested(listing, ["intel", "availability", "contradictions"], 0) or 0
    score -= contradictions * 10
    return clamp(score)

def calculate_ghost_probability_fallback(listing: Dict[str, Any], market: List[Dict[str, Any]]) -> float:
    score = 0
    dom = get_num(listing, "days_on_market", "daysOnMarket", default=0)
    if dom > 180: score += 40
    elif dom > 120: score += 25
    elif dom > 90: score += 15
    trust = nested(listing, ["source_profile", "trust"], None) or nested(listing, ["intel", "source_profile", "trust"], 80)
    if trust < 60: score += 20
    elif trust < 75: score += 10
    if len(price_history(listing)) > 5: score += 15
    if not listing.get("title"): score += 10
    if not listing.get("source"): score += 10
    price = get_num(listing, "price", default=0)
    sim = similar_listings(listing, market)
    avg = sum(get_num(l, "price", default=0) for l in sim) / len(sim) if sim else 0
    if price and avg and price < avg * 0.7:
        score += 25
    ws = listing.get("watch_state") or {}
    if ws.get("source_missing_detected") or ws.get("off_market_detected"):
        score += 25
    if ws.get("consecutive_block_count", 0) > 0:
        score += 10
    return clamp(score)

def calculate_composite_score_fallback(listing: Dict[str, Any], market: List[Dict[str, Any]]) -> float:
    price_score = calculate_price_score(listing, market)
    lev = get_score_value(listing, "leverage", None)
    leverage = lev if lev is not None else calculate_leverage_score_fallback(listing)
    conf = get_score_value(listing, "confidence", None)
    confidence = conf if conf is not None else calculate_confidence_score_fallback(listing)
    ghostv = get_score_value(listing, "ghost", None)
    ghost = ghostv if ghostv is not None else calculate_ghost_probability_fallback(listing, market)
    fresh = calculate_freshness_score(listing)
    return round(clamp(price_score * 0.30 + leverage * 0.25 + confidence * 0.20 + (100 - ghost) * 0.15 + fresh * 0.10), 1)

def get_listing_score(listing: Dict[str, Any], key: str, market: List[Dict[str, Any]] = None):
    v = get_score_value(listing, key, None)
    if v is not None:
        return v
    market = market or []
    if key == "composite": return calculate_composite_score_fallback(listing, market)
    if key == "leverage": return calculate_leverage_score_fallback(listing)
    if key == "confidence": return calculate_confidence_score_fallback(listing)
    if key == "ghost": return calculate_ghost_probability_fallback(listing, market)
    if key == "freshness": return calculate_freshness_score(listing)
    return None
