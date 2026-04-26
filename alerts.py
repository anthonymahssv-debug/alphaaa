from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import hashlib
from .scoring import get_listing_score, price_history

def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def parse_dt(s: Any):
    if not s: return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None

def alert_id(type_: str, listing_id: str | None, metric: Any, ts: str) -> str:
    bucket = ts[:10]
    raw = f"{type_}|{listing_id or 'market'}|{bucket}|{metric}"
    return "alert_" + hashlib.sha1(raw.encode()).hexdigest()[:16]

def make_alert(type_, severity, title, detail, listing=None, metric_before=None, metric_after=None, urgent=False, action_view="overview", action_label="Revisar mercado", source="computed"):
    ts = iso_now()
    lid = listing.get("id") if listing else None
    return {
        "id": alert_id(type_, lid, metric_after, ts),
        "type": type_,
        "severity": severity,
        "title": title,
        "detail": detail,
        "listingId": lid,
        "building": listing.get("building") if listing else None,
        "timestamp": ts,
        "metricBefore": metric_before,
        "metricAfter": metric_after,
        "unread": True,
        "urgent": bool(urgent or severity in {"critical", "high"}),
        "actionLabel": action_label,
        "actionView": action_view,
        "source": source,
    }

def detect_price_drop(listing: Dict[str, Any]):
    hist = price_history(listing)
    hist = [h for h in hist if h.get("price") is not None]
    if len(hist) < 2:
        return None
    try:
        prev = float(hist[-2]["price"])
        curr = float(hist[-1]["price"])
        if prev > 0 and curr <= prev * 0.95:
            pct = round(((prev - curr) / prev) * 100, 1)
            return prev, curr, pct
    except Exception:
        return None
    return None

def generate_alerts(listings: List[Dict[str, Any]], events: List[Dict[str, Any]] | None = None) -> List[Dict[str, Any]]:
    events = events or []
    now = datetime.now(timezone.utc)
    alerts: List[Dict[str, Any]] = []

    for l in listings:
        comp = get_listing_score(l, "composite", listings) or 0
        lev = get_listing_score(l, "leverage", listings) or 0
        ghost = get_listing_score(l, "ghost", listings)
        status_key = (((l.get("intel") or {}).get("status") or {}).get("key") or "").lower()

        if comp >= 85:
            alerts.append(make_alert(
                "high_value", "critical",
                "Oportunidad de alto valor",
                f"{l.get('id')} tiene composite score de {round(comp)}/100. Prioridad ejecutiva.",
                l, metric_after=round(comp), urgent=True, action_view="detail", action_label="Abrir unidad"
            ))

        pd = detect_price_drop(l)
        if pd:
            prev, curr, pct = pd
            alerts.append(make_alert(
                "price_drop", "high",
                "Baja de precio detectada",
                f"{l.get('id')} bajó {pct}%: de ${prev:,.0f} a ${curr:,.0f}.",
                l, metric_before=round(prev), metric_after=round(curr), urgent=True, action_view="detail", action_label="Abrir unidad", source="history"
            ))

        first = parse_dt(l.get("first_seen_at") or l.get("firstSeenAt"))
        if first:
            if first.tzinfo is None: first = first.replace(tzinfo=timezone.utc)
            if now - first <= timedelta(hours=24):
                alerts.append(make_alert(
                    "new_listing", "medium",
                    "Nuevo listado",
                    f"{l.get('id')} fue detectado dentro de las últimas 24 horas.",
                    l, metric_after=None, urgent=False, action_view="detail", action_label="Abrir unidad"
                ))

        if status_key == "fast_move":
            alerts.append(make_alert(
                "fast_move", "high",
                "Fast-move detectado",
                f"{l.get('id')} requiere movimiento rápido por señal operativa.",
                l, metric_after=None, urgent=True, action_view="operator", action_label="Ir a operador"
            ))

        if lev >= 70:
            alerts.append(make_alert(
                "high_leverage", "high",
                "Alto apalancamiento",
                f"{l.get('id')} tiene leverage score de {round(lev)}/100. Negociación favorable.",
                l, metric_after=round(lev), urgent=True, action_view="detail", action_label="Abrir unidad"
            ))

        # Ghost drop only if explicit previous ghost exists.
        prev_ghost = (((l.get("intel") or {}).get("previous_scores") or {}).get("ghost_probability"))
        if ghost is not None and prev_ghost is not None:
            try:
                if float(ghost) < 30 and float(prev_ghost) >= 30:
                    alerts.append(make_alert(
                        "ghost_drop", "medium",
                        "Riesgo ghost bajó",
                        f"{l.get('id')} bajó ghost probability de {round(float(prev_ghost))}% a {round(float(ghost))}%.",
                        l, metric_before=round(float(prev_ghost)), metric_after=round(float(ghost)), action_view="detail", action_label="Abrir unidad"
                    ))
            except Exception:
                pass

        ws = l.get("watch_state") or {}
        ws_flags = []
        if ws.get("off_market_detected"): ws_flags.append("off-market")
        if ws.get("source_missing_detected"): ws_flags.append("fuente no encontrada")
        if ws.get("last_check_status") in {"blocked", "not_found", "redirected", "access_error"}: ws_flags.append(str(ws.get("last_check_status")))
        if ws.get("price_history"): ws_flags.append("historial de precio actualizado")
        if ws_flags:
            alerts.append(make_alert(
                "watchlist_update", "medium",
                "Actualización de watchlist",
                f"{l.get('id')}: " + ", ".join(ws_flags) + ".",
                l, metric_after=None, urgent="off-market" in ws_flags, action_view="tracking", action_label="Ver fuentes", source="watch_state"
            ))

    # Event-based alerts are included but do not fabricate fields.
    for ev in events[:20]:
        alerts.append(make_alert(
            "watchlist_update", "low",
            ev.get("label") or ev.get("type") or "Evento reciente",
            ev.get("message") or "Evento detectado en el feed.",
            None, action_view="tracking", action_label="Ver fuentes", source="event"
        ))

    # Deduplicate by id and sort newest first
    seen = set()
    out = []
    for a in sorted(alerts, key=lambda x: x["timestamp"], reverse=True):
        if a["id"] in seen:
            continue
        seen.add(a["id"])
        out.append(a)
    return out[:20]
