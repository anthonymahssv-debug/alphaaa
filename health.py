from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, Any, List
import statistics
import time

STARTED_AT = time.time()
REQUEST_TIMES: List[float] = []
TOTAL_REQUESTS = 0
FAILED_REQUESTS = 0
CACHE_HITS = 0
CACHE_MISSES = 0
LAST_REQUEST_AT = None
LAST_ERROR_AT = None
LAST_ERROR_MESSAGE = None
LAST_REFRESH = {
    "status": "never",
    "startedAt": None,
    "finishedAt": None,
    "durationMs": None,
    "count": 0,
    "failureCount": 0,
}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def percentile(vals: List[float], pct: float):
    if not vals: return 0
    vals = sorted(vals)
    k = int(round((len(vals)-1) * pct))
    return vals[k]

def record_request(duration_ms: float, success: bool, error: str | None = None):
    global TOTAL_REQUESTS, FAILED_REQUESTS, LAST_REQUEST_AT, LAST_ERROR_AT, LAST_ERROR_MESSAGE
    TOTAL_REQUESTS += 1
    REQUEST_TIMES.append(duration_ms)
    if len(REQUEST_TIMES) > 500:
        REQUEST_TIMES.pop(0)
    LAST_REQUEST_AT = now_iso()
    if not success:
        FAILED_REQUESTS += 1
        LAST_ERROR_AT = now_iso()
        LAST_ERROR_MESSAGE = error

def freshness_from_generated(generated_at: str | None, data_source: str) -> Dict[str, Any]:
    if data_source in {"demo", "offline"}:
        state_default = "demo" if data_source == "demo" else "offline"
    else:
        state_default = "fresh"
    if not generated_at:
        return {"dataAgeMinutes": None, "freshnessState": state_default}
    try:
        dt = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - dt).total_seconds() / 60
        if data_source in {"demo", "offline"}:
            state = "critical" if age > 240 else "stale" if age > 60 else state_default
        else:
            state = "critical" if age > 240 else "stale" if age > 60 else "fresh"
        return {"dataAgeMinutes": round(age, 1), "freshnessState": state}
    except Exception:
        return {"dataAgeMinutes": None, "freshnessState": state_default}

def api_health() -> Dict[str, Any]:
    avg = sum(REQUEST_TIMES)/len(REQUEST_TIMES) if REQUEST_TIMES else 0
    err = FAILED_REQUESTS / TOTAL_REQUESTS if TOTAL_REQUESTS else 0
    return {
        "online": True,
        "uptimeSeconds": round(time.time() - STARTED_AT),
        "totalRequests": TOTAL_REQUESTS,
        "successfulRequests": max(0, TOTAL_REQUESTS - FAILED_REQUESTS),
        "failedRequests": FAILED_REQUESTS,
        "errorRate": round(err, 4),
        "averageResponseTimeMs": round(avg, 2),
        "p50ResponseTimeMs": round(percentile(REQUEST_TIMES, .50), 2),
        "p95ResponseTimeMs": round(percentile(REQUEST_TIMES, .95), 2),
        "p99ResponseTimeMs": round(percentile(REQUEST_TIMES, .99), 2),
        "lastRequestAt": LAST_REQUEST_AT,
        "lastErrorAt": LAST_ERROR_AT,
        "lastErrorMessage": LAST_ERROR_MESSAGE,
    }

def cache_health() -> Dict[str, Any]:
    total = CACHE_HITS + CACHE_MISSES
    return {
        "enabled": True,
        "type": "memory",
        "hits": CACHE_HITS,
        "misses": CACHE_MISSES,
        "hitRate": round(CACHE_HITS/total, 3) if total else 0,
        "entryCount": 0,
        "ttlSeconds": 60,
        "lastCacheBustAt": None,
        "cacheBustCount": 0,
    }
