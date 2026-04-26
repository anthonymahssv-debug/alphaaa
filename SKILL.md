---
name: santa-fe-ci-builder
optimized_for: perplexity-computer
version: 1.0.0
description: Autonomously upgrade the uploaded Santa Fe CI vanilla JavaScript SPA into a premium, static-host-ready, API-ready real-estate leasing intelligence platform. Use this skill when the user asks to build, enhance, audit, repair, self-grade, package, or deliver the Santa Fe CI files: index.html, app.js, bot.js, data.json, base.css, style.css, map.css, tracking.css, and enhancements.css. The skill preserves the existing premium design system and intelligence model while fixing deployment mismatches, alerts, freshness, event-handler stability, score normalization, bot bloat, and QA gaps. It must not stop until the build self-grades 10/10 under the included decision-grade rubric, unless a true external blocker is documented with exact evidence and a remediation plan.
---

# Santa Fe CI Builder — Perplexity Computer Skill

Autonomous upgrade workflow for **Santa Fe CI — Decision Engine for High-Value Leasing in Santa Fe, CDMX**.

This skill operates directly on the user-uploaded files and turns the current executive prototype into a clean, static-host-ready, API-ready intelligence platform. It preserves the product’s existing premium UI, rich real-estate intelligence model, map system, tracking/source verification layer, and negotiation framing while fixing the known audit gaps.

The end goal is not a cosmetic patch. The end goal is a premium, defensible, executive-grade leasing intelligence system that can become the best API-backed platform in its category.

---

## When this fires

Use this skill whenever the user asks to:

- enhance, build, repair, finish, package, deploy, audit, or self-grade Santa Fe CI;
- work on the uploaded SPA files;
- create or improve the alerts system;
- make the app static-host-ready;
- convert the previous prompt into a Perplexity Computer-ready workflow;
- apply the audit strengths/weaknesses;
- continue improving until a 10/10 self-grade is reached;
- produce a `SKILL.md` or Perplexity Computer execution instruction for this project.

Do **not** use this skill for unrelated real-estate apps unless the user explicitly maps them to the Santa Fe CI architecture.

---

## Project files in scope

Work from the existing uploaded files. Do not rebuild from scratch unless files are missing or unrecoverable.

Canonical target filenames:

- `index.html`
- `app.js`
- `bot.js`
- `data.json`
- `base.css`
- `style.css`
- `map.css`
- `tracking.css`
- `enhancements.css`

The upload may contain suffixed filenames such as:

- `index(26).html`
- `app(24).js`
- `bot(5).js`
- `data(8).json`
- `base(8).css`
- `style(18).css`
- `map(8).css`
- `tracking(6).css`
- `enhancements(5).css`

First normalize these to the canonical names or update references consistently. Prefer canonical clean names.

---

## Hard constraints

- Vanilla JavaScript only.
- No React.
- No Vue.
- No framework.
- No npm.
- No build tools.
- No bundler.
- No TypeScript.
- No dependency installation.
- Must remain deployable by dragging static files to any web server.
- Do not fake live data, data freshness, historical price drops, alerts, API success, or production readiness.

---

## Product identity

Build and preserve a premium executive intelligence terminal for high-value leasing in Santa Fe, CDMX.

The UI should feel:

- expensive;
- precise;
- operational;
- data-dense;
- executive-grade;
- negotiation-focused;
- trustworthy.

Avoid:

- generic SaaS styling;
- childish gradients;
- random color systems;
- Bootstrap/Material imitation;
- decorative clutter;
- fake AI claims;
- vague “dashboard” language.

User-facing Spanish should use a professional Mexican business register. Preferred terms include:

- oportunidad;
- apalancamiento;
- verificación;
- vigencia;
- comparables;
- banda justa;
- rango de cierre;
- riesgo de ghost listing;
- prioridad operativa;
- costo total de ocupación.

---

## Current project audit

Initial grade: **B+ / 86 out of 100**.

Interpretation:

The uploaded files are well above a normal prototype. The app already has the bones of a premium real-estate intelligence product: serious design language, rich listing intelligence, negotiation logic, map UX, source verification, and a substantial vanilla-JS SPA. It is not yet production-grade and must not be called client-ready until the audit gaps below are fixed.

Use this audit as a mandatory implementation compass:

- Preserve the strengths.
- Fix the weaknesses.
- Do not rebuild from scratch.
- Do not flatten the product into a generic dashboard.
- Do not remove advanced intelligence features unless replacing them with something stronger.

---

## Strengths to preserve

### 1. Product concept

Preserve the commercial thesis:

Santa Fe leasing intelligence, high-value rental comparables, negotiation leverage, source verification, agent/counterparty tracking, and executive decision support.

Do not reduce the app to a simple listing board.

### 2. Premium visual identity

Preserve the current executive design system:

- dark/light mode;
- restrained steel-teal primary color;
- aged brass and violet building identity colors;
- dense KPI rhythm;
- professional cards;
- strong map styling;
- Inter + JetBrains Mono typography;
- tabular numeric presentation;
- mature spacing and surface hierarchy.

### 3. CSS foundation

Use and extend the existing CSS stack:

- `base.css` — reset, accessibility primitives, focus states, typography smoothing, reduced motion;
- `style.css` — core design system, layout, dashboards, cards, tokens, components;
- `map.css` — MapLibre markers, popups, legends, controls, responsive map behavior;
- `tracking.css` — alert/feed/watch-state/scorecard styles;
- `enhancements.css` — premium polish, hierarchy, rhythm, micro-interactions.

Do not create unnecessary new CSS files. Add alert/freshness/system-health styles to `tracking.css` or `enhancements.css` unless there is a strong reason otherwise.

### 4. HTML structure

Preserve the existing SPA structure and IDs.

The current `index.html` is expected to include:

- market pulse bar;
- sticky app header;
- search;
- main navigation;
- overview view;
- detail view;
- operator view;
- compare view;
- agents view;
- dashboard view;
- map view;
- tracking/Fuentes view;
- bot button;
- export button;
- theme toggle;
- Chart.js and MapLibre CDN wiring.

Do not rename IDs unless all references in `app.js` are updated accordingly.

### 5. JavaScript product surface

Preserve the existing `app.js` scope:

- API-first loading;
- static data fallback;
- data status badge;
- in-memory TTL cache;
- chart registry and chart destruction;
- search;
- filters;
- navigation;
- sort;
- KPI rendering;
- building rendering;
- listing rendering;
- detail view logic;
- market chart logic;
- tracking/source-related functionality;
- dashboard/operator/compare/map flows.

Refactor carefully. Do not delete working functionality.

### 6. Data model

Preserve the current rich `data.json` schema:

- `buildings`;
- `tower_summary`;
- `market_summary`;
- `listings`;
- `source_profile`;
- `price_per_sqm`;
- `history`;
- `first_seen_at`;
- `last_seen_at`;
- `intel.peer_group`;
- `intel.building_context`;
- `intel.pricing`;
- `intel.scores`;
- `intel.predictive`;
- `intel.status`;
- `required_proof`;
- `battle_card`;
- `script`;
- `counterparty_playbook`;
- `negotiation_timeline`;
- `watch_state`.

Do not simplify this into plain listing cards.

### 7. Negotiation intelligence

Preserve and better surface:

- battle cards;
- fair bands;
- opening anchors;
- target close values;
- walk-away levels;
- proof requirements;
- counterparty playbooks;
- scripts;
- source verification.

These should feed detail views, operator views, and alerts.

### 8. Map system

Preserve the existing map system:

- tower markers;
- listing bubble markers;
- confidence color accents;
- fast-move/verify visual states;
- metric popups;
- compact legend;
- responsive layout.

Do not replace it with generic map markers.

### 9. Bot concept

Preserve the Santa Fe leasing intelligence assistant if stable. Refactor performance issues without removing useful behavior.

### 10. Executive data density

The product’s advantage is dense, operational, decision-useful information. Keep the interface compact, analytical, and action-oriented.

---

## Weaknesses to fix

### 1. Deployment mismatch

Critical issue:

Uploaded filenames may contain suffixes while `index.html` expects canonical names.

Fix before claiming deployability:

- ensure final filenames exactly match references;
- or update references consistently;
- prefer canonical clean names without parentheses.

### 2. Incomplete alerts system

Current alert/tracking styles are a foundation, not the full command center.

Build:

- bell button;
- unread badge;
- right-side slide-in alert panel;
- tabs: Todas / No leídas / Urgentes;
- computed alert generation;
- localStorage read/unread persistence;
- deduplication;
- CTA navigation;
- alert lifecycle functions;
- mobile behavior;
- accessibility behavior.

Do not rely only on `events[]`, because sample events may be empty. Generate alerts from available listing intelligence.

### 3. Data freshness honesty

Static data must not be presented as live.

Fix:

- surface `generated_at`;
- show “Actualizado hace X”;
- show Demo / En vivo / Sin conexión honestly;
- warning if data age > 1 hour;
- danger if data age > 4 hours;
- do not show “En vivo” unless API feed succeeds;
- track API status separately from data mode.

### 4. Duplicate event listeners

Prevent listener stacking after refresh/reload.

Fix with:

- idempotent setup guards;
- delegated listeners;
- or explicit listener cleanup.

Confirm refresh does not double-trigger navigation, charts, alerts, or panel actions.

### 5. Monolithic JavaScript

Make `app.js` easier to audit without breaking static hosting.

Use a stable namespace:

```js
window.SFCI = window.SFCI || {};
```

Recommended structure:

```js
window.SFCI = {
  data: {},
  scores: {},
  alerts: {},
  health: {},
  market: {},
  economics: {},
  ui: {}
};
```

Expose stable internal methods:

```js
SFCI.scores.getScoreValue(listing, key)
SFCI.scores.calculateCompositeScoreFallback(listing, market)
SFCI.alerts.generateAlerts(listings, events, previousState)
SFCI.market.compareToMarket(listing, listings)
SFCI.market.predictPrice(listing, daysAhead)
SFCI.economics.calculateOccupancyCost(listing, assumptions)
SFCI.health.getFreshnessState()
SFCI.health.getSystemHealth()
```

### 6. Bot payload bloat

If `bot.js` embeds a large base64 avatar, move it to `/img/` and reference it as an asset. Keep `bot.js` behavior-focused.

### 7. Score compatibility risk

Support both snake_case and camelCase.

Current data may use:

- `composite_score`
- `leverage_score`
- `ghost_probability`
- `confidence_score`
- `price_per_sqm`
- `days_on_market`
- `first_seen_at`
- `last_seen_at`

Future data may use:

- `compositeScore`
- `leverageScore`
- `ghostProbability`
- `confidenceScore`
- `pricePerSqm`
- `daysOnMarket`
- `firstSeenAt`
- `lastSeenAt`

Create helpers so both work. Never break current `data.json`.

### 8. Alert data scarcity

If `events[]` is empty or `total_alerts` is zero, still generate computed alerts from available data.

Rules:

- Do not fabricate price drops without history.
- Do not fabricate previous ghost scores.
- For price prediction, return null when history has fewer than 3 points.
- For new listing, use `first_seen_at`.
- For high-value/high-leverage, use `intel.scores` or fallback calculations.

### 9. Leasing economics confusion

Do not treat monthly rent as purchase price.

Fix:

- Replace regular ROI language with “Costo total de ocupación”.
- Treat `listing.price` as monthly rent.
- Calculate first-month cash out, total lease cost, effective monthly cost, annualized cost, cost per sqm, and negotiation savings.
- Only show investment/sublease ROI if explicitly labeled as a separate optional scenario.

### 10. Production readiness gap

Do not call the build production-ready until all critical checks pass:

- canonical filenames;
- static demo loads without API;
- no console errors;
- alerts work;
- freshness works;
- search works;
- filters work;
- navigation works;
- detail view works;
- tracking view works;
- map view works;
- theme toggle works;
- refresh does not duplicate handlers;
- mobile layout is checked.

### 11. Accessibility gap

The alert panel must be fully accessible:

- ARIA labels on bell, close, tabs, CTA buttons;
- Esc closes panel;
- click outside closes panel;
- focus moves into panel on open;
- focus returns to bell on close;
- no keyboard trap;
- visible focus state;
- screen-reader-friendly empty states.

### 12. Client-sale polish gap

A buyer will punish:

- broken filenames;
- empty alerts;
- stale data labeled as live;
- duplicated event handlers;
- console errors;
- bot bloat;
- generic UI regression;
- unclear scoring logic.

Fix these before delivery.

---

## Implementation phases

### Phase 1 — Triage and file hygiene

1. Canonicalize filenames.
2. Verify all references in `index.html`.
3. Fix CSS/script load order if necessary.
4. Strip bot bloat by extracting embedded base64 assets to `/img/` when feasible.
5. Run a baseline smoke test:
   - static load;
   - no console errors;
   - no missing CSS/JS;
   - no broken core IDs.

### Phase 2 — Intelligence core

Add or upgrade helpers in `app.js` without corrupting existing computed data.

Required helpers:

```js
normalizeListing(listing)
getScoreValue(listing, key)
getListingTimestamp(listing, key)
getPriceHistory(listing)
calculateCompositeScoreFallback(listing, market)
calculatePriceScore(listing, market)
calculateLeverageScoreFallback(listing)
calculateConfidenceScoreFallback(listing)
calculateGhostProbabilityFallback(listing, market)
calculateFreshnessScore(listing)
predictPrice(listing, daysAhead)
compareToMarket(listing, allListings)
getTimingRecommendation(listing)
calculateOccupancyCost(listing, assumptions)
```

Rules:

- Existing `intel.scores` are primary.
- Fallback calculations run only when scores are missing.
- Support snake_case and camelCase.
- Ghost probability is risk; lower is better.
- Price prediction returns null when fewer than 3 real price points exist.
- Leasing math treats `listing.price` as monthly rent.

### Phase 3 — Alerts command center

Build a complete operational alerts system.

Alert types:

1. High-value opportunity — `composite_score >= 85`.
2. Price drop — current price dropped `>= 5%` from previous price or `watch_state.price_history`.
3. New listing — `first_seen_at` within last 24 hours.
4. Fast-move status — `intel.status.key === "fast_move"` or urgent timing score.
5. High leverage — `leverage_score >= 70`.
6. Ghost probability drop — `ghost_probability < 30` and previous ghost value was `>= 30` if historical value exists.
7. Watchlist update — `watch_state` changes, off-market detection, source missing, blocked source, redirect, or price-history update.

Required alert functions:

```js
initAlerts()
generateAlerts(listings, events, previousState)
normalizeAlert(alert)
getUnreadAlerts()
markAlertRead(alertId)
markAllAlertsRead()
filterAlerts(mode)
sortAlerts(alerts)
renderAlertBell()
openAlertPanel()
closeAlertPanel()
renderAlertPanel(filter)
renderAlertCard(alert)
navigateFromAlert(alert)
```

Alert object shape:

```js
{
  id: string,
  type: "high_value" | "price_drop" | "new_listing" | "fast_move" | "high_leverage" | "ghost_drop" | "watchlist_update",
  severity: "critical" | "high" | "medium" | "low",
  title: string,
  detail: string,
  listingId: string | null,
  building: string | null,
  timestamp: ISO string,
  metricBefore: number | null,
  metricAfter: number | null,
  unread: boolean,
  urgent: boolean,
  actionLabel: string,
  actionView: "detail" | "tracking" | "operator" | "overview",
  source: "computed" | "watch_state" | "event" | "history"
}
```

Persistence:

- Use localStorage only for read/unread state.
- Key: `sfci_alert_read_state_v1`.
- Do not persist sensitive data.

Deduplication:

Deduplicate by:

```text
type + listingId + date bucket + metricAfter
```

Panel UX:

- bell icon in header;
- unread badge;
- urgent severity state;
- right slide-in panel;
- 380px desktop width;
- near full-screen mobile width;
- tabs: Todas / No leídas / Urgentes;
- max 20 newest cards;
- card click marks read;
- CTA routes to correct view;
- Esc closes panel;
- outside click closes panel;
- focus moves into panel and returns to bell;
- no keyboard trap.

Every alert must answer:

- What happened?
- Why does it matter?
- Which listing/source does it affect?
- What should the operator do next?

### Phase 4 — Data freshness and system health

Extend the existing API/cache logic.

Required tracker:

```js
systemHealth = {
  apiCalls: number,
  failedRequests: number,
  responseTimes: number[],
  cacheHits: number,
  cacheMisses: number,
  lastSuccessfulUpdate: ISO string | null,
  online: boolean,
  dataSource: "live" | "demo" | "offline",
  generatedAt: ISO string | null
}
```

Required functions:

```js
trackApiCall(start, success, fromCache)
updateSystemHealthUI()
getDataAge()
getFreshnessState()
```

Freshness UI:

- show timestamp;
- show “Actualizado hace X”;
- warning if data age > 1 hour;
- danger if data age > 4 hours;
- refresh button invalidates cache and reloads;
- static fallback is labeled Demo / Datos estáticos;
- API failure is labeled Sin conexión or Demo, not En vivo.

Place indicator in:

- market pulse bar;
- tracking/Fuentes view;
- optional compact footer/status line.

### Phase 5 — Event-handling stability

Make setup idempotent.

Options:

- `document._sfXWired` guards;
- delegated listeners;
- one-time event setup;
- listener cleanup before reattach.

Confirm:

- refresh does not duplicate handlers;
- chart recreation remains safe;
- alert panel actions do not stack;
- navigation remains stable after data reload.

### Phase 6 — CSS additions

Add to `tracking.css` or `enhancements.css`:

- `.alert-bell-btn`
- `.alert-badge`
- `.alert-panel`
- `.alert-panel.open`
- `.alert-panel-backdrop`
- `.alert-panel-header`
- `.alert-tabs`
- `.alert-tab`
- `.alert-card`
- `.alert-card.unread`
- `.alert-card.urgent`
- `.alert-severity-badge`
- `.alert-metric-delta`
- `.alert-card-cta`
- `.freshness-indicator`
- `.freshness-indicator.warning`
- `.freshness-indicator.danger`
- `.system-health-card`

Match the existing steel-teal / aged brass / violet palette. No neon. No generic component-library imitation.

### Phase 7 — QA and delivery

Run the full checklist and produce a delivery bundle.

Deliver:

1. modified `index.html`;
2. modified `app.js`;
3. modified `tracking.css` or `enhancements.css`;
4. modified `bot.js` if necessary;
5. modified `data.json` only if necessary;
6. `CHANGELOG.md`;
7. final static bundle or zip.

If Perplexity Computer can publish previews, provide a private preview URL. If not, document that preview publishing is unavailable and provide the static bundle.

---

## Intelligence algorithms

### Score accessor

Create:

```js
getListingScore(listing, scoreName, fallbackCalculator)
```

Supported score keys:

- composite;
- leverage;
- confidence;
- ghost;
- freshness;
- value;
- action;
- offer.

Existing `intel.scores` are primary. Fallback calculators only fill missing values.

### Composite score fallback

Weights:

- Price: 30%
- Leverage: 25%
- Confidence: 20%
- Ghost inverse: 15%
- Freshness: 10%

Formula:

```text
composite =
priceScore * 0.30 +
leverageScore * 0.25 +
confidenceScore * 0.20 +
(100 - ghostProbability) * 0.15 +
freshnessScore * 0.10
```

### Price score

Compare similar units:

- same building;
- same beds;
- sqm within ±20m² when possible;
- exclude same ID.

If fewer than 3 comparable records:

- use `peer_group` median if available;
- use `building_context` median if available;
- otherwise return 50.

Lower price relative to comparable median = better score. Clamp 0–100.

### Leverage score

Base = 50.

Adjust:

- DOM > 90: +30;
- DOM > 60: +20;
- DOM > 30: +10;
- each price drop: +5;
- agent credibility < 70: +10;
- source blocked/missing: +5 but also increase ghost risk;
- incomplete proof: +5 negotiation leverage.

Clamp 0–100.

### Confidence score

Inputs:

- data completeness;
- source_profile.trust;
- agent credibility;
- listing freshness;
- image count if available;
- proof_score if available;
- contradictions penalty.

Confidence means trust in the decision, not attractiveness of the deal.

### Ghost probability

Inputs:

- long days on market;
- low agent credibility;
- excessive price changes;
- incomplete data;
- weak source profile;
- missing source / blocked portal;
- suspicious discount > 30% below market;
- no proof of current availability;
- duplicate listing confusion.

Ghost probability is risk. Lower is better. Clamp 0–100.

### Freshness score

- updated < 1 day: 100;
- < 7 days: 90;
- < 14 days: 75;
- < 30 days: 60;
- < 60 days: 40;
- older: 20.

### Price prediction

Use linear regression only if listing price history has at least 3 real price points.

If insufficient data:

```js
return null;
```

Show user-facing label:

```text
Historial insuficiente
```

Return:

```js
{
  price,
  confidence,
  trend: "up" | "down" | "stable",
  slope,
  rSquared
}
```

### Market comparison

Compare in this order:

1. same building + same beds + similar sqm;
2. same beds across towers;
3. building median;
4. market median.

Return:

```js
{
  sampleSize,
  avgPrice,
  avgPricePerSqm,
  medianPrice,
  medianPricePerSqm,
  pricePercentile,
  psmPercentile,
  priceVsAvg,
  psmVsAvg,
  recommendation: "DEAL" | "FAIR" | "OVERPRICED" | "VERIFY"
}
```

### Timing recommendation

Use:

- leverage_score;
- days_on_market;
- ghost_probability;
- confidence_score;
- freshness_score;
- price drop history;
- alert severity.

Actions:

| Internal | Spanish label |
|---|---|
| ACT NOW | Actuar ahora |
| MOVE FAST | Mover rápido |
| GOOD TIME | Buen momento |
| MONITOR | Monitorear |
| WAIT | Esperar |
| VERIFY FIRST | Verificar primero |

---

## Leasing economics module

This is a leasing intelligence platform, not a purchase underwriting model unless explicitly marked.

Create “Costo total de ocupación”.

Inputs:

- monthlyRent;
- maintenanceMonthly;
- parkingCost;
- depositMonths;
- policyCost;
- movingCost;
- leaseTermMonths.

Outputs:

- firstMonthCashOut;
- totalLeaseCost;
- effectiveMonthlyCost;
- annualizedCost;
- costPerSqmEffective;
- deltaToMarket;
- negotiationSavingsAtTarget;
- negotiationSavingsAtOpening.

Optional investment/sublease mode must be clearly labeled and separated.

---

## UI/UX requirements

Preserve:

- current design tokens;
- current layout;
- map styling;
- tracking styling;
- dark/light mode;
- executive density.

Add:

- alert bell;
- alert panel;
- data freshness indicator;
- system health mini-panel;
- explicit score explanations;
- better empty states;
- stronger operator action framing.

Numbers:

- MXN prices: `$62,000`;
- price/m²: `$674/m²`;
- percentages: `-5.2%`;
- scores: `85/100`;
- dates in Mexican Spanish where user-facing.

Tables:

- dense but readable;
- sticky header if scrollable;
- subtle row separation;
- right-align numeric columns;
- monospace numeric values;
- clear status badges;
- no weak generic tables.

Accessibility:

- WCAG 2.1 AA target;
- keyboard accessible;
- visible focus indicators;
- ARIA labels on icon buttons;
- semantic landmarks;
- skip link if missing;
- alert panel accessible;
- Escape closes overlays;
- no keyboard traps;
- sufficient contrast.

Mobile:

- header must not break;
- alert panel becomes near full-screen;
- cards stack correctly;
- map controls compress without overlap;
- KPI strip remains readable.

---

## Performance requirements

Targets:

- First Contentful Paint < 1s;
- Time to Interactive < 3s;
- Total load < 2s on reasonable static hosting;
- Lighthouse > 90 where possible.

Optimizations:

- debounced search;
- lazy-load noncritical charts if practical;
- avoid full rerender when opening alerts;
- avoid duplicate listeners;
- destroy Chart.js instances before recreation;
- use document fragments or safe string rendering;
- avoid layout thrash;
- keep alert generation O(n) or close;
- no console spam.

Critical:

- no console errors;
- no broken listeners;
- no duplicate alerts on rerender;
- no broken navigation after panel open/close.

---

## Static deploy checklist

A delivery is invalid until:

- canonical filenames are present;
- `index.html` references match actual files;
- app loads without API server;
- local `data.json` loads;
- CSS loads;
- JS loads;
- Chart.js and MapLibre load from CDN or fail gracefully;
- no console errors;
- no missing required DOM IDs;
- all major views are reachable.

---

## QA checklist

### Core app

- App loads with `data.json`.
- No API server required for static demo mode.
- No console errors.
- Navigation works.
- Theme toggle works.
- Search works.
- Filters work.
- Sort works.
- Listing cards open detail view.
- Dashboard renders.
- Map renders.
- Tracking/Fuentes renders.
- Bot opens if present.

### Alerts

- Bell appears in header.
- Badge count matches unread alerts.
- Clicking bell opens panel.
- Panel slides from right.
- Tabs work: Todas / No leídas / Urgentes.
- Alert cards render newest first.
- Max 20 cards.
- Clicking card marks read.
- Mark all read works.
- CTA navigation works.
- Esc closes panel.
- Outside click closes panel.
- Mobile panel works.
- No duplicate alerts after rerender.
- localStorage read state works.

### Data freshness

- Timestamp appears.
- Demo/live/offline state is honest.
- Warning appears if data > 1h old.
- Error appears if data > 4h old.
- Refresh invalidates cache and reloads.
- Failed requests increment health metrics.
- Cache hit rate updates.

### Algorithms

- Composite fallback works when scores are missing.
- Existing `intel.scores` are preserved when present.
- snake_case and camelCase are both supported.
- Ghost probability is treated as risk.
- Market comparison has sensible fallback when sample is small.
- Price prediction returns null when insufficient history.
- Timing recommendation displays meaningful action.
- Occupancy cost calculator treats monthly rent correctly.

### Accessibility

- Keyboard focus visible.
- Alert panel accessible.
- Buttons have labels.
- No keyboard trap.
- Contrast acceptable.
- Reduced motion respected.

### Performance

- No obvious slow rerenders.
- Charts are destroyed before recreation.
- Event listeners are not duplicated.
- Data refresh does not stack handlers.

---

## Mandatory self-grading gate

Do not stop after the first implementation pass.

Before delivery, run a formal self-grade using the discipline below. Treat the product as an API-ready intelligence platform and grade it like a serious decision-grade system, not like a cosmetic frontend.

Use a **10-point standard**. The build must reach **10/10** before final delivery.

### Self-grade dimensions

#### 1. Deployability

- Canonical filenames are correct.
- Static bundle loads by drag-and-drop deployment.
- No broken CSS/JS references.
- No API server required for demo mode.

#### 2. Alerts intelligence

- All seven alert types work.
- Alerts are computed from available data.
- No fake alerts.
- Deduplication works.
- localStorage read/unread state works.
- CTA routing works.

#### 3. Data freshness and system health

- Demo/live/offline labels are honest.
- `generated_at` is surfaced.
- stale and critical warnings work.
- API calls, failed requests, cache hits, and response timing are tracked.

#### 4. Scoring and intelligence logic

- Existing `intel.scores` are preserved.
- snake_case and camelCase are supported.
- Fallback score calculators work only when needed.
- Ghost probability is treated as risk.
- Timing recommendations are explainable.

#### 5. Leasing economics correctness

- `listing.price` is treated as monthly rent.
- ROI language is replaced with “Costo total de ocupación”.
- Investment/sublease mode is clearly separated if present.

#### 6. UI/UX quality

- Premium executive intelligence-terminal feel is preserved.
- No generic SaaS regression.
- Spanish UI is professional.
- Tables and numbers use dense, clear, accountant-style formatting.

#### 7. Accessibility

- Alert panel is keyboard accessible.
- Esc closes overlays.
- Focus moves correctly.
- ARIA labels exist.
- No keyboard trap.
- Focus states remain visible.

#### 8. Performance

- No duplicate event listeners after refresh.
- Charts are destroyed before recreation.
- Alert generation remains efficient.
- No console spam.
- No obvious slow rerenders.

#### 9. Maintainability

- SFCI namespace is clean.
- Helpers are grouped logically.
- `app.js` is easier to audit.
- `bot.js` bloat is reduced if possible.
- No global chaos.

#### 10. Product readiness

- The final result feels like a serious, sellable, executive-grade Santa Fe leasing intelligence platform.
- It is not merely a working prototype.
- Remaining limitations are explicitly documented.

### Scoring rule

- **10/10** = delivery allowed.
- **9/10 or below** = continue self-enhancement.
- Any critical failure in deployability, alerts, freshness honesty, duplicate handlers, or console errors automatically caps the grade at **8/10**.
- Any fake live data, fake price history, fake alert, or fake production-readiness claim automatically fails the grade.
- Do not deliver until the product self-grades **10/10** or a true external blocker is documented with exact evidence and a remediation plan.

### Required final self-grade report

Include a section named `FINAL SELF-GRADE` in `CHANGELOG.md` with:

- Overall score: X/10;
- per-dimension scores;
- evidence for each score;
- fixes completed after the first self-grade;
- remaining gaps, if any;
- explicit statement: `Delivery approved` only if score is 10/10.

If the score is not 10/10, continue improving the build and re-grade. Repeat until 10/10.

---

## CHANGELOG requirements

Create or update `CHANGELOG.md` with:

1. Audit result:

```text
Initial uploaded project assessed as B+ / 86: strong executive prototype, not production-ready.
```

2. Strengths preserved:

- Premium design system;
- existing SPA structure;
- rich listing intelligence model;
- map system;
- tracking/source verification concept;
- negotiation intelligence.

3. Weaknesses fixed:

- Filename/deployment mismatch;
- missing full alert command center;
- data freshness honesty;
- duplicate listener risk;
- score normalization;
- static/demo state labeling;
- bot payload bloat, if fixed.

4. Remaining limitations:

Be explicit. Do not hide gaps.

5. FINAL SELF-GRADE:

Use the mandatory self-grading gate above.

---

## Final instruction for Perplexity Computer

Execute immediately.

This is not a cosmetic cleanup. Treat this as the flagship build for the best real-estate intelligence system of its kind: a premium Santa Fe leasing decision engine with an API-ready intelligence layer, not just a dashboard.

Proceed through the phases and do not stop at “working.” Implement, self-grade, improve, and re-grade until the build reaches **10/10** under the mandatory self-grading gate.

If it does not reach 10/10, continue self-enhancement.

Final delivery is only approved after `FINAL SELF-GRADE` confirms **10/10** or documents a true external blocker with exact evidence and a remediation plan.

Do not fake live data, freshness, historical changes, alerts, API success, or production readiness.

Start with Phase 1 now.
