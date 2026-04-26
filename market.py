from __future__ import annotations
from typing import Dict, Any, List, Optional
import math
from .scoring import get_num, median, similar_listings

def compare_to_market(listing: Dict[str, Any], all_listings: List[Dict[str, Any]]) -> Dict[str, Any]:
    similar = similar_listings(listing, all_listings)
    if not similar:
        similar = [l for l in all_listings if l.get("id") != listing.get("id") and l.get("beds") == listing.get("beds")]
    prices = [get_num(l, "price", default=0) for l in similar if get_num(l, "price", default=0)]
    psms = [get_num(l, "price_per_sqm", "pricePerSqm", default=0) for l in similar if get_num(l, "price_per_sqm", "pricePerSqm", default=0)]
    price = get_num(listing, "price", default=0)
    psm = get_num(listing, "price_per_sqm", "pricePerSqm", default=0)
    if not prices:
        pg = (listing.get("intel") or {}).get("peer_group") or {}
        bc = (listing.get("intel") or {}).get("building_context") or {}
        return {
            "sampleSize": 0,
            "avgPrice": pg.get("median_price") or bc.get("median_price"),
            "avgPricePerSqm": pg.get("median_price_per_sqm") or bc.get("median_price_per_sqm"),
            "medianPrice": pg.get("median_price") or bc.get("median_price"),
            "medianPricePerSqm": pg.get("median_price_per_sqm") or bc.get("median_price_per_sqm"),
            "pricePercentile": None,
            "psmPercentile": None,
            "priceVsAvg": None,
            "psmVsAvg": None,
            "recommendation": "VERIFY",
        }
    avg_price = sum(prices) / len(prices)
    avg_psm = sum(psms) / len(psms) if psms else None
    price_pct = (sum(1 for p in prices if p < price) / len(prices)) * 100 if prices else None
    psm_pct = (sum(1 for p in psms if p < psm) / len(psms)) * 100 if psms else None
    price_vs = ((price - avg_price) / avg_price) * 100 if avg_price else None
    psm_vs = ((psm - avg_psm) / avg_psm) * 100 if avg_psm else None
    recommendation = "FAIR"
    if price_pct is not None and price_pct < 30: recommendation = "DEAL"
    if price_pct is not None and price_pct > 70: recommendation = "OVERPRICED"
    return {
        "sampleSize": len(similar),
        "avgPrice": round(avg_price),
        "avgPricePerSqm": round(avg_psm) if avg_psm else None,
        "medianPrice": round(median(prices)),
        "medianPricePerSqm": round(median(psms)) if psms else None,
        "pricePercentile": round(price_pct) if price_pct is not None else None,
        "psmPercentile": round(psm_pct) if psm_pct is not None else None,
        "priceVsAvg": round(price_vs, 1) if price_vs is not None else None,
        "psmVsAvg": round(psm_vs, 1) if psm_vs is not None else None,
        "recommendation": recommendation,
    }

def predict_price(listing: Dict[str, Any], days_ahead: int = 30) -> Optional[Dict[str, Any]]:
    hist = listing.get("history") or listing.get("priceHistory") or []
    hist = [h for h in hist if h.get("price") is not None]
    if len(hist) < 3:
        return None
    y = [float(h["price"]) for h in hist]
    x = list(range(len(y)))
    n = len(x)
    sx = sum(x); sy = sum(y)
    sxy = sum(xi*yi for xi, yi in zip(x,y))
    sx2 = sum(xi*xi for xi in x)
    denom = n*sx2 - sx*sx
    if denom == 0:
        return None
    slope = (n*sxy - sx*sy) / denom
    intercept = (sy - slope*sx) / n
    future = n + (days_ahead/30)
    pred = max(0, round(slope*future + intercept))
    mean = sy/n
    ss_total = sum((yi-mean)**2 for yi in y)
    ss_res = sum((yi-(slope*i+intercept))**2 for i, yi in enumerate(y))
    r2 = 1 - ss_res/ss_total if ss_total else 0
    return {
        "price": pred,
        "confidence": max(0, min(100, round(r2*100))),
        "trend": "up" if slope > 100 else "down" if slope < -100 else "stable",
        "slope": round(slope, 2),
        "rSquared": round(r2, 4),
    }
