from __future__ import annotations
from typing import Dict, Any

def calculate_occupancy_cost(listing: Dict[str, Any], assumptions: Dict[str, Any] | None = None) -> Dict[str, Any]:
    assumptions = assumptions or {}
    monthly_rent = float(assumptions.get("monthlyRent") or listing.get("price") or 0)
    sqm = float(listing.get("sqm") or 0)
    maintenance = float(assumptions.get("maintenanceMonthly") or 0)
    parking = float(assumptions.get("parkingCost") or 0)
    deposit_months = float(assumptions.get("depositMonths") or 1)
    policy = float(assumptions.get("policyCost") or 0)
    moving = float(assumptions.get("movingCost") or 0)
    term = int(assumptions.get("leaseTermMonths") or 12)
    target_close = (((listing.get("intel") or {}).get("pricing") or {}).get("target_close")) or monthly_rent
    opening_anchor = (((listing.get("intel") or {}).get("pricing") or {}).get("opening_anchor")) or monthly_rent

    monthly_total = monthly_rent + maintenance + parking
    first_month_cash_out = monthly_total + monthly_rent * deposit_months + policy + moving
    total_lease_cost = monthly_total * term + monthly_rent * deposit_months + policy + moving
    effective_monthly = total_lease_cost / term if term else monthly_total
    annualized = effective_monthly * 12
    cost_per_sqm = effective_monthly / sqm if sqm else None
    return {
        "monthlyRent": round(monthly_rent),
        "firstMonthCashOut": round(first_month_cash_out),
        "totalLeaseCost": round(total_lease_cost),
        "effectiveMonthlyCost": round(effective_monthly),
        "annualizedCost": round(annualized),
        "costPerSqmEffective": round(cost_per_sqm, 2) if cost_per_sqm else None,
        "negotiationSavingsAtTarget": round(max(0, monthly_rent - float(target_close)) * term),
        "negotiationSavingsAtOpening": round(max(0, monthly_rent - float(opening_anchor)) * term),
        "label": "Costo total de ocupación",
        "note": "listing.price is treated as monthly rent, not purchase price.",
    }
