// ══════════════════════════════════════════════════════════════
//  Santa Fe CI Platform — app.js
//  Comprehensive intelligence frontend — wired to /api/* endpoints
// ══════════════════════════════════════════════════════════════

'use strict';

// ── Theme ─────────────────────────────────────────────────────
(function initTheme() {
  var toggle = document.querySelector('[data-theme-toggle]');
  var root = document.documentElement;
  var theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  if (toggle) {
    renderToggleIcon(toggle, theme);
    toggle.addEventListener('click', function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      renderToggleIcon(toggle, theme);
      // Re-render charts that depend on theme colors
      if (currentView === 'detail' && currentListing) renderDetailView(currentListing);
      if (currentView === 'compare' && activeComparison) renderComparisonChart(activeComparison);
      if (currentView === 'overview') renderMarketChart(activeMarketChart);
      if (currentView === 'dashboard') renderDashboardView();
    });
  }

  function renderToggleIcon(btn, t) {
    var _ti = window.i18n;
    btn.setAttribute('aria-label', _ti ? _ti.t(t === 'dark' ? 'status.theme-dark' : 'status.theme-light') : (t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'));
    btn.innerHTML = t === 'dark'
      ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
})();

// ── State ─────────────────────────────────────────────────────
var listingsData    = [];
var buildingsData   = {};
var towerSummary    = {};
var marketSummary   = {};
var eventsData      = [];
var agentsData      = [];
var currentView     = 'overview';
var currentListing  = null;
var activeComparison = null;
var activeFilter    = 'all';
var activeOpFilter  = 'all';
var activeMarketChart = 'price_distribution';
var sortMode        = 'composite_score';
var dataSource      = 'loading'; // 'live' | 'demo' | 'offline'

// ── Chart Registry (keyed by canvas ID) ───────────────────────
// Replaces the brittle chartInstances array: each chart is stored
// by its canvas ID so multiple renders never leak stale instances.
var chartInstances  = []; // kept for destroyCharts() compat in tracking view
var chartRegistry   = {};

function getOrCreateChart(canvasId, config, tag) {
  if (chartRegistry[canvasId]) {
    try { chartRegistry[canvasId].destroy(); } catch (e) {}
    delete chartRegistry[canvasId];
  }
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  var chart = new Chart(canvas, config);
  if (tag) chart._sfTag = tag;
  chartRegistry[canvasId] = chart;
  chartInstances.push(chart); // also track in array for destroyCharts()
  return chart;
}

function destroyChartsByTag(tag) {
  Object.keys(chartRegistry).forEach(function (id) {
    var c = chartRegistry[id];
    if (!tag || c._sfTag === tag) {
      try { c.destroy(); } catch (e) {}
      delete chartRegistry[id];
    }
  });
  chartInstances = chartInstances.filter(function (c) {
    return !tag || c._sfTag !== tag;
  });
}

function destroyAllCharts() {
  Object.keys(chartRegistry).forEach(function (id) {
    try { chartRegistry[id].destroy(); } catch (e) {}
  });
  chartRegistry = {};
  chartInstances = [];
}

// ── In-memory TTL Cache (no localStorage / sessionStorage / indexedDB) ────
// Stores fetch responses in a plain object keyed by URL. Entries expire
// after CACHE_TTL_MS milliseconds. Avoids redundant network calls on
// rapid re-renders and view switches within the same session.
var _apiCache = {};
var CACHE_TTL_MS = 60 * 1000; // 60 seconds

function cachePut(key, data) {
  _apiCache[key] = { data: data, ts: Date.now() };
}

function cacheGet(key) {
  var entry = _apiCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    delete _apiCache[key];
    return null;
  }
  return entry.data;
}

function cacheBust(key) {
  // Invalidate a specific key (e.g. after a manual refresh)
  if (key) { delete _apiCache[key]; }
  else     { _apiCache = {}; }
}

// ── API ───────────────────────────────────────────────────────
async function apiFetch(path, opts) {
  // Bypass cache for non-GET requests or when opts.noCache is set
  var noCache = (opts && opts.noCache) || (opts && opts.method && opts.method !== 'GET');
  if (!noCache) {
    var cached = cacheGet(path);
    if (cached) return cached;
  }
  var res = await fetch(path, opts);
  if (!res.ok) throw new Error('API error: ' + res.status);
  var data = await res.json();
  if (!noCache) cachePut(path, data);
  return data;
}

function showToast(message, type) {
  // Use or create an aria-live container so screen readers announce toasts
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    container.style.cssText = 'position:fixed;bottom:0;right:0;z-index:1001;pointer-events:none;';
    document.body.appendChild(container);
  }
  var existing = container.querySelector('.toast');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  el.setAttribute('role', 'alert');
  el.style.pointerEvents = 'auto';
  container.appendChild(el);
  setTimeout(function () {
    if (!el.parentNode) return;
    el.classList.add('exiting');
    setTimeout(function () { if (el.parentNode) el.remove(); }, 250);
  }, 3250);
}

// ── Data Status Badge ───────────────────────────────────────────
function updateDataStatus(status, label) {
  dataSource = status;
  var badge = document.getElementById('dataStatusBadge');
  if (!badge) return;

  if (status === 'demo') {
    badge.style.display = 'none';
    badge.textContent = '';
  } else {
    badge.style.display = '';
    badge.className = 'data-status ' + status;
    badge.textContent = label || status;
  }

  var footer = document.getElementById('cacheStatusFooter');
  if (footer) {
    var _fiLoc = window.i18n ? window.i18n.getLocale() : 'es-MX';
    var ts = new Date().toLocaleTimeString(_fiLoc, { hour: '2-digit', minute: '2-digit' });
    var _fi = window.i18n;
  var _fPrefix = _fi ? _fi.t('status.demo-prefix') : 'Datos:';
  var _fDate   = (status === 'demo') ? (_fi ? _fi.t('status.demo-date') : 'Abril 2026') : (label || status);
  footer.textContent = _fPrefix + ' ' + _fDate + ' · ' + ts;
  }
}

// ── Days on Market Calculation ───────────────────────────────────
function computeDaysOnMarket(listings) {
  var now = new Date();
  listings.forEach(function (l) {
    if (l.first_seen_at && (!l.days_on_market || l.days_on_market === 0)) {
      try {
        var first = new Date(l.first_seen_at);
        var diffMs = now - first;
        l.days_on_market = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      } catch (e) { /* keep existing value */ }
    }
  });
  return listings;
}

// ── Load Data ─────────────────────────────────────────────────
async function loadData() {
  updateDataStatus('demo', window.i18n ? window.i18n.t('status.loading') : 'Cargando…');

  // 1. Try API first
  try {
    var [feedRes, agentsRes] = await Promise.all([
      apiFetch('/api/feed'),
      apiFetch('/api/agents'),
    ]);
    applyFeedData(feedRes, agentsRes.items || []);
    updateDataStatus('live', window.i18n ? window.i18n.t('status.live') : 'En vivo');
    init();
    return;
  } catch (err) {
    // API not available, continue to local fallback
  }

  // 2. Try local data files (canonical schema only — see CANONICAL_SCHEMA.md)
  var fallbackPaths = [
    './data.json',             // frontend/data.json — canonical, always in sync
    '../data/listings.live.json', // backend canonical source
  ];
  for (var i = 0; i < fallbackPaths.length; i++) {
    try {
      var fallbackRes = await fetch(fallbackPaths[i]);
      if (!fallbackRes.ok) continue;
      var fallbackFeed = await fallbackRes.json();
      if (!fallbackFeed.listings || fallbackFeed.listings.length === 0) continue;
      var fallbackAgents = buildAgentsFromListings(fallbackFeed.listings || []);
      applyFeedData(fallbackFeed, fallbackAgents);
      updateDataStatus('demo', 'Demo');
      showToast(window.i18n ? window.i18n.t('status.toast-demo') : 'Modo demo — datos estáticos de Abril 2026', 'warning');
      init();
      return;
    } catch (e) { /* try next */ }
  }

  // 3. All failed
  updateDataStatus('offline', window.i18n ? window.i18n.t('status.offline') : 'Sin datos');
  console.error('All data sources failed');
  var grid = document.getElementById('listingsGrid');
  var _ni = window.i18n;
  if (grid) grid.innerHTML =
    '<div class="empty-state-card">' +
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
    '<h3>' + (_ni ? _ni.t('status.no-data') : 'Sin conexión a datos') + '</h3>' +
    '<p>' + (_ni ? _ni.t('status.no-data-hint') : 'Verifica que el servidor esté activo (python server.py) o que data.json esté en la raíz del proyecto.') + '</p>' +
    '</div>';
}

function applyFeedData(feedRes, agentItems) {
  listingsData  = computeDaysOnMarket(feedRes.listings || []);
  buildingsData = feedRes.buildings   || {};
  towerSummary  = feedRes.tower_summary || {};
  marketSummary = feedRes.market_summary || {};
  eventsData    = (feedRes.events     || []).slice(0, 20);
  agentsData    = agentItems          || [];

  // Update overview subtitle
  var sub = document.getElementById('overviewSubtitle');
  if (sub) {
    var neg = (marketSummary.negotiate_count || 0);
    var _loc = window.i18n ? window.i18n.getLocale() : 'es-MX';
    var _si = window.i18n;
    sub.textContent = listingsData.length + ' ' + (_si ? _si.t('overview.sub.active') : 'activos') +
      ' · ' + Object.keys(buildingsData).length + ' ' + (_si ? _si.t('overview.sub.towers') : 'torres') +
      ' · ' + neg + ' ' + (_si ? _si.t('overview.sub.negotiable') : 'para negociar');
  }
}

function buildAgentsFromListings(listings) {
  var map = {};
  (listings || []).forEach(function (l) {
    var key = (l.agent_name || l.agent_company || 'sin-agente').toLowerCase();
    if (!map[key]) {
      map[key] = {
        name: l.agent_name || (window.i18n ? window.i18n.t('agents.unidentified') : 'Agente no identificado'),
        slug: key,
        credibility_score: Math.round(((l.intel || {}).scores || {}).confidence_score || 50),
        interactions: 1,
        contradictions: 0,
        listing_count: 0,
        synthetic: true, // scores are estimated from listing data, not verified
      };
    }
    map[key].listing_count += 1;
    map[key].credibility_score = Math.round((map[key].credibility_score + ((((l.intel || {}).scores || {}).confidence_score || 50))) / 2);
  });
  return Object.values(map).sort(function (a, b) {
    return (b.credibility_score || 0) - (a.credibility_score || 0);
  });
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  renderPulseBar();
  renderKPIs();
  renderBuildings();
  renderEvents();
  renderOverview();
  renderMarketChart(activeMarketChart);
  setupSearch();
  setupFilters();
  setupNavigation();
  setupSortSelect();
  setupKeyboardShortcuts();
  updatePulseTime();
  // Check for active alerts to show nav dot
  updateTrackingAlertDot();
}

// ── Keyboard Shortcuts ──────────────────────────────────────────
function setupKeyboardShortcuts() {
  // Guard against multiple wiring if init() is called again
  if (document._sfKbWired) return;
  document._sfKbWired = true;

  document.addEventListener('keydown', function (e) {
    // Cmd+K or Ctrl+K — focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      var input = document.getElementById('searchInput');
      if (input) { input.focus(); input.select(); }
    }
    // Escape from detail view — go back to overview
    if (e.key === 'Escape' && currentView === 'detail') {
      showView('overview');
    }
  });
}

// ── Market Pulse Bar ──────────────────────────────────────────
function renderPulseBar() {
  var ms = marketSummary;
  var _i18n = window.i18n;
  var _listLabel = _i18n ? (' ' + _i18n.t('pulse.listings').replace('— ', '')) : ' listados';
  var _negLabel  = _i18n ? (' ' + _i18n.t('pulse.negotiable').replace('— ', '')) : ' para negociar';
  setText('pulseListings', (ms.total_listings || listingsData.length) + _listLabel);
  setText('pulseMedianPsm', (_i18n ? _i18n.getCurrency() : 'MXN') + '/m²: ' + fmtMoney(ms.median_price_per_sqm || 0));
  setText('pulseNegotiate', (ms.negotiate_count || 0) + _negLabel);
  updatePulseTime();

  var btn = document.getElementById('pulseRefreshBtn');
  if (btn) {
    btn.addEventListener('click', async function () {
      btn.style.opacity = '0.5';
      try {
        await apiFetch('/api/refresh', { noCache: true });
        cacheBust(); // Invalidate all cached API responses after a data refresh
        await loadData();
        showToast('Datos actualizados', 'success');
      } catch (e) {
        showToast('Sin servidor — datos locales', 'warning');
      } finally {
        btn.style.opacity = '';
      }
    });
  }
}

function updatePulseTime() {
  var el = document.getElementById('pulseTime');
  if (!el) return;
  var now = new Date();
  var _ptLoc = window.i18n ? window.i18n.getLocale() : 'es-MX';
  el.textContent = now.toLocaleTimeString(_ptLoc, { hour: '2-digit', minute: '2-digit' });
}

setInterval(updatePulseTime, 60000);

// ── Navigation ────────────────────────────────────────────────
function setupNavigation() {
  document.getElementById('backBtn').addEventListener('click', function () { showView('overview'); });
  document.getElementById('logoBtn').addEventListener('click', function () { showView('overview'); });

  document.querySelectorAll('[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.getAttribute('data-view');
      if (currentView === view) {
        showView('overview');
        return;
      }
      showView(view);
      if (view === 'compare')   { renderCompareView(); }
      if (view === 'agents')    { renderAgentsView(); }
      if (view === 'operator')  { renderOperatorView(); }
      if (view === 'dashboard') { renderDashboardView(); }
      if (view === 'map')       { renderMapView(); }
      if (view === 'tracking')  { renderTrackingView(); }
    });
  });

  document.getElementById('refreshBtn').addEventListener('click', async function () {
    var btn = document.getElementById('refreshBtn');
    btn.style.opacity = '0.4';
    try {
      showToast('Actualizando…');
      await apiFetch('/api/refresh');
      await loadData();
      showToast('Datos actualizados', 'success');
    } catch (e) {
      showToast('Error al actualizar', 'error');
    } finally {
      btn.style.opacity = '';
    }
  });

  // Market chart tabs
  document.getElementById('marketChartTabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.panel-tab');
    if (!tab) return;
    document.querySelectorAll('.panel-tab').forEach(function (t) { t.classList.remove('active'); });
    tab.classList.add('active');
    activeMarketChart = tab.getAttribute('data-chart');
    renderMarketChart(activeMarketChart);
  });

  // Operator filter buttons
  document.getElementById('opFilterBar').addEventListener('click', function (e) {
    var btn = e.target.closest('.op-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.op-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeOpFilter = btn.getAttribute('data-op-filter');
    renderOperatorCards();
  });
}

function showView(view) {
  destroyCharts();
  currentView = view;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  var viewEl = document.getElementById(view + 'View');
  if (viewEl) viewEl.classList.add('active');

  // Map section needs its own active class for CSS targeting
  var mapSection = document.getElementById('section-map');
  if (mapSection) {
    mapSection.classList.toggle('active', view === 'map');
  }

  var backBtn = document.getElementById('backBtn');
  backBtn.style.display = view === 'overview' ? 'none' : 'flex';

  // Update nav active states
  document.querySelectorAll('[data-view]').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    btn.setAttribute('aria-current', btn.getAttribute('data-view') === view ? 'page' : 'false');
  });
}

// ── Sort ──────────────────────────────────────────────────────
function setupSortSelect() {
  var sel = document.getElementById('sortSelect');
  if (!sel) return;
  sel.addEventListener('change', function () {
    sortMode = sel.value;
    renderOverview();
  });
}

// ── Search (150ms debounce + ArrowUp/Down/Enter keyboard navigation) ─────────
function setupSearch() {
  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var debounceTimer = null;
  var activeIdx = -1; // index of the keyboard-highlighted result item

  function getItems() {
    return Array.from(results.querySelectorAll('.search-result-item'));
  }

  function setActive(idx) {
    var items = getItems();
    items.forEach(function (el) {
      el.removeAttribute('aria-selected');
      el.classList.remove('search-result-active');
    });
    activeIdx = Math.max(-1, Math.min(idx, items.length - 1));
    if (activeIdx >= 0) {
      items[activeIdx].setAttribute('aria-selected', 'true');
      items[activeIdx].classList.add('search-result-active');
      items[activeIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function runSearch() {
    var q = input.value.toLowerCase().trim();
    activeIdx = -1;
    if (q.length < 1) { results.classList.remove('active'); results.setAttribute('aria-expanded', 'false'); return; }

    var matches = listingsData.filter(function (l) {
      return l.title.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.building || '').toLowerCase().includes(q) ||
        String(l.price).includes(q) ||
        (l.agent_name || '').toLowerCase().includes(q);
    });

    if (matches.length === 0) { results.classList.remove('active'); results.setAttribute('aria-expanded', 'false'); return; }

    results.innerHTML = matches.slice(0, 8).map(function (l) {
      var buildingColor = 'var(--building-' + (l.building || 'peninsula') + ')';
      return '<div class="search-result-item" data-id="' + l.id + '" role="option" tabindex="-1">' +
        '<span class="search-result-id">' + l.id + '</span>' +
        '<span class="search-result-name">' + escapeHtml(l.title) + '</span>' +
        '<span class="search-result-price" style="color:' + buildingColor + '">' + fmtMoney(l.price) + '</span>' +
        '</div>';
    }).join('') +
    '<div class="search-shortcut-hint"><kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> cerrar</div>';

    results.classList.add('active');
    results.setAttribute('aria-expanded', 'true');

    results.querySelectorAll('.search-result-item').forEach(function (item) {
      item.addEventListener('click', function () { openResult(item); });
    });
  }

  function openResult(item) {
    var lid = item && item.getAttribute('data-id');
    var listing = lid && listingsData.find(function (l) { return l.id === lid; });
    if (listing) { currentListing = listing; showView('detail'); renderDetailView(listing); }
    results.classList.remove('active');
    results.setAttribute('aria-expanded', 'false');
    input.value = '';
    activeIdx = -1;
  }

  // Debounced input handler (150ms)
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 150);
  });

  // Keyboard navigation
  input.addEventListener('keydown', function (e) {
    var items = getItems();
    if (e.key === 'Escape') {
      results.classList.remove('active');
      results.setAttribute('aria-expanded', 'false');
      input.blur();
      activeIdx = -1;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!results.classList.contains('active') && input.value.trim().length > 0) runSearch();
      setActive(activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var curItems = getItems();
      if (activeIdx >= 0 && curItems[activeIdx]) {
        openResult(curItems[activeIdx]);
      } else if (curItems.length === 1) {
        openResult(curItems[0]);
      }
    }
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!document.getElementById('searchWrapper').contains(e.target)) {
      results.classList.remove('active');
      results.setAttribute('aria-expanded', 'false');
      activeIdx = -1;
    }
  });
}

// ── Filters ───────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      renderOverview();
    });
  });
}

function filterListings() {
  var f = activeFilter;
  if (f === 'all') return listingsData;
  if (f === 'peninsula' || f === 'torre300' || f === 'paradox') {
    return listingsData.filter(function (l) { return l.building === f; });
  }
  if (f === 'negotiate') {
    return listingsData.filter(function (l) {
      return l.intel && l.intel.status && l.intel.status.key === 'negotiate';
    });
  }
  if (f === '1bed') return listingsData.filter(function (l) { return l.beds === 1; });
  if (f === '2bed') return listingsData.filter(function (l) { return l.beds === 2; });
  if (f === '3bed') return listingsData.filter(function (l) { return l.beds >= 3; });
  return listingsData;
}

function sortListings(arr) {
  return arr.slice().sort(function (a, b) {
    var sa = getScore(a, sortMode);
    var sb = getScore(b, sortMode);
    if (sortMode === 'price_asc') return sa - sb;
    return sb - sa;
  });
}

function getScore(l, mode) {
  if (mode === 'price_asc' || mode === 'price_desc') return l.price || 0;
  if (mode === 'dom') return l.days_on_market || 0;
  var scores = (l.intel || {}).scores || {};
  if (mode === 'leverage_score') return scores.leverage_score || 0;
  return scores.composite_score || scores.value_score || 0;
}

// ── KPI Cards ─────────────────────────────────────────────────
function renderKPIs() {
  var strip = document.getElementById('kpiStrip');
  var ms = marketSummary;
  var ms_price = ms.median_price || 0;
  var ms_psm   = ms.median_price_per_sqm || 0;

  var _ki = window.i18n;
  var kpis = [
    { label: _ki ? _ki.t('kpi.visible-listings')  : 'Listados visibles', value: ms.total_listings || listingsData.length, sub: listingsData.length + ' ' + (_ki ? _ki.t('kpi.visible-listings-sub') : 'universo total'), modifier: '' },
    { label: _ki ? _ki.t('kpi.median-price')       : 'Renta mediana', value: fmtMoney(ms_price), sub: (_ki ? _ki.t('kpi.median-price-sub') + ' ' + _ki.getCurrency() : 'Renta mensual MXN'), modifier: 'mono' },
    { label: _ki ? _ki.t('kpi.median-psm')         : 'Renta mediana/m²', value: fmtMoney(ms_psm) + '/m²', sub: (_ki ? _ki.t('kpi.median-psm-sub') : 'Peer & tower adjusted'), modifier: 'mono' },
    { label: _ki ? _ki.t('kpi.negotiable')          : 'Negociables', value: ms.negotiate_count || 0, sub: (_ki ? _ki.t('kpi.negotiable-sub') : 'Unidades con ventaja'), modifier: 'success' },
    { label: _ki ? _ki.t('kpi.fast-move')           : 'Mov. rápido', value: ms.fast_move_count || 0, sub: (_ki ? _ki.t('kpi.fast-move-sub') : 'Velocidad operativa'), modifier: '' },
    { label: _ki ? _ki.t('kpi.verify-first')        : 'Verificar primero', value: ms.verify_first_count || 0, sub: (_ki ? _ki.t('kpi.verify-first-sub') : 'Confirmar disponibilidad'), modifier: ms.verify_first_count > 0 ? 'warning' : '' },
  ];

  strip.innerHTML = kpis.map(function (k) {
    var cls = 'kpi-card';
    if (k.modifier === 'warning') cls += ' warning';
    if (k.modifier === 'success') cls += ' success';
    return '<div class="' + cls + '" role="article">' +
      '<div class="kpi-label">' + k.label + '</div>' +
      '<div class="kpi-value' + (k.modifier === 'mono' ? ' ' : '') + '">' + k.value + '</div>' +
      '<div class="kpi-sub">' + (k.sub || '') + '</div>' +
      '</div>';
  }).join('');
}

// ── Building image map ──────────────────────────────────────
// Real listing photos downloaded from active Inmuebles24 listings
// Peninsula: exterior from listing 149328197 (park path view of building)
// Torre 300: exterior from listing 147592541 (distinctive round tower + sculpture)
// Paradox:   view from listing 149384032 (Parque Mexicana aerial from unit)
var BUILDING_IMAGES = {
  peninsula: 'img/peninsula-listing-3.jpg',
  torre300:  'img/torre300-listing-3.jpg',
  paradox:   'img/paradox-listing-1.jpg',
};

var LISTING_IMAGES = {
  peninsula: ['img/peninsula-listing-1.jpg','img/peninsula-listing-2.jpg','img/peninsula-listing-3.jpg'],
  torre300:  ['img/torre300-listing-1.jpg','img/torre300-listing-2.jpg','img/torre300-listing-3.jpg'],
  paradox:   ['img/paradox-listing-1.jpg','img/paradox-listing-2.jpg']
};

// ── Image manifest — classified per-listing images ────────────
// Exterior: building façade, entrance, aerial, park views
// Interior: unit rooms, kitchen, living area, bathrooms, closets
// Source domain extracted from listing.source URL for attribution
var IMAGE_MANIFEST = {
  sf_001: {
    exterior: ['img/peninsula-listing-1.jpg','img/peninsula-listing-3.jpg'],
    interior: ['img/interior-living.jpg','img/interior.jpg'],
    cover:    'img/peninsula-listing-1.jpg'
  },
  sf_002: {
    exterior: ['img/peninsula-listing-2.jpg','img/peninsula-listing-3.jpg'],
    interior: ['img/interior.jpg','img/interior-luxury.jpg'],
    cover:    'img/peninsula-listing-2.jpg'
  },
  sf_003: {
    exterior: ['img/peninsula-listing-1.jpg'],
    interior: ['img/interior-living.jpg'],
    cover:    'img/peninsula-listing-1.jpg'
  },
  sf_004: {
    exterior: ['img/peninsula-listing-3.jpg'],
    interior: ['img/interior.jpg'],
    cover:    'img/peninsula-listing-3.jpg'
  },
  sf_005: {
    exterior: ['img/torre300-listing-1.jpg','img/torre300-listing-3.jpg'],
    interior: ['img/interior-living.jpg','img/interior.jpg'],
    cover:    'img/torre300-listing-1.jpg'
  },
  sf_006: {
    exterior: ['img/torre300-listing-2.jpg','img/torre300-listing-3.jpg'],
    interior: ['img/interior-luxury.jpg','img/interior.jpg'],
    cover:    'img/torre300-listing-2.jpg'
  },
  sf_007: {
    exterior: ['img/torre300-listing-1.jpg'],
    interior: ['img/interior.jpg'],
    cover:    'img/torre300-listing-1.jpg'
  },
  sf_008: {
    exterior: ['img/torre300-listing-2.jpg','img/torre300-listing-3.jpg'],
    interior: ['img/interior-living.jpg'],
    cover:    'img/torre300-listing-2.jpg'
  },
  sf_009: {
    exterior: ['img/paradox-listing-1.jpg','img/paradox-listing-2.jpg'],
    interior: ['img/interior.jpg','img/interior-living.jpg'],
    cover:    'img/paradox-listing-1.jpg'
  },
  sf_010: {
    exterior: ['img/paradox-listing-1.jpg'],
    interior: ['img/interior-luxury.jpg','img/interior.jpg'],
    cover:    'img/paradox-listing-1.jpg'
  },
  sf_011: {
    exterior: ['img/paradox-listing-2.jpg'],
    interior: ['img/interior-living.jpg'],
    cover:    'img/paradox-listing-2.jpg'
  },
  sf_012: {
    exterior: ['img/peninsula-listing-2.jpg','img/peninsula-listing-3.jpg'],
    interior: ['img/interior-luxury.jpg','img/interior.jpg','img/interior-living.jpg'],
    cover:    'img/peninsula-listing-2.jpg'
  },
  sf_013: {
    exterior: ['img/torre300-listing-1.jpg','img/torre300-listing-2.jpg'],
    interior: ['img/interior.jpg'],
    cover:    'img/torre300-listing-1.jpg'
  },
  sf_014: {
    exterior: ['img/paradox-listing-1.jpg','img/paradox-listing-2.jpg'],
    interior: ['img/interior-luxury.jpg','img/interior-living.jpg'],
    cover:    'img/paradox-listing-1.jpg'
  }
};

function getSourceDomain(url) {
  if (!url) return '';
  try {
    var host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('inmuebles24')) return 'Inmuebles24';
    if (host.includes('metroscubicos')) return 'MetrosCúbicos';
    if (host.includes('vivanuncios')) return 'Vivanuncios';
    if (host.includes('easybroker')) return 'EasyBroker';
    if (host.includes('propiedades')) return 'Propiedades.com';
    if (host.includes('engelvoelkers')) return 'E&V';
    if (host.includes('christies')) return 'Christie\'s RE';
    return host.split('.')[0];
  } catch (e) { return ''; }
}

function getListingImages(listing) {
  var manifest = IMAGE_MANIFEST[listing.id] || null;
  var building = listing.building || 'peninsula';
  var fallbackImgs = LISTING_IMAGES[building] || [];
  if (manifest) return manifest;
  // fallback: classify first image as exterior, rest as interior
  if (fallbackImgs.length === 0) return { exterior: [], interior: [], cover: '' };
  return {
    exterior: [fallbackImgs[0]],
    interior: fallbackImgs.slice(1),
    cover: fallbackImgs[0]
  };
}

// ── Lightbox ─────────────────────────────────────────────────
var _lightboxOpen = false;
function openLightbox(images, startIdx) {
  var idx = startIdx || 0;
  var existing = document.getElementById('sfLightbox');
  if (existing) existing.remove();

  var lb = document.createElement('div');
  lb.id = 'sfLightbox';
  lb.className = 'sf-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Galería de imágenes');

  function render() {
    var img = images[idx];
    lb.innerHTML =
      '<div class="sf-lb-backdrop"></div>' +
      '<div class="sf-lb-frame">' +
        '<button class="sf-lb-close" aria-label="Cerrar galería">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
        '<button class="sf-lb-nav sf-lb-prev" aria-label="Anterior" ' + (idx === 0 ? 'disabled' : '') + '>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
        '</button>' +
        '<img class="sf-lb-img" src="' + img + '" alt="Foto de propiedad ' + (idx + 1) + ' de ' + images.length + '">' +
        '<button class="sf-lb-nav sf-lb-next" aria-label="Siguiente" ' + (idx === images.length - 1 ? 'disabled' : '') + '>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
        '</button>' +
        '<div class="sf-lb-counter">' + (idx + 1) + ' / ' + images.length + '</div>' +
      '</div>';
    lb.querySelector('.sf-lb-close').addEventListener('click', closeLightbox);
    lb.querySelector('.sf-lb-backdrop').addEventListener('click', closeLightbox);
    var prev = lb.querySelector('.sf-lb-prev');
    var next = lb.querySelector('.sf-lb-next');
    if (prev) prev.addEventListener('click', function() { if (idx > 0) { idx--; render(); } });
    if (next) next.addEventListener('click', function() { if (idx < images.length - 1) { idx++; render(); } });
  }

  function closeLightbox() {
    _lightboxOpen = false;
    lb.classList.remove('sf-lb-visible');
    setTimeout(function() { if (lb.parentNode) lb.remove(); }, 200);
    document.removeEventListener('keydown', lbKeyHandler);
  }

  function lbKeyHandler(e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && idx > 0) { idx--; render(); }
    if (e.key === 'ArrowRight' && idx < images.length - 1) { idx++; render(); }
  }

  render();
  document.body.appendChild(lb);
  requestAnimationFrame(function() { lb.classList.add('sf-lb-visible'); });
  _lightboxOpen = true;
  document.addEventListener('keydown', lbKeyHandler);
}

// ── Building Cards ────────────────────────────────────────────
function renderBuildings() {
  var strip = document.getElementById('buildingsStrip');
  var html = '';

  Object.keys(buildingsData).forEach(function (key) {
    var b = buildingsData[key];
    var ts = towerSummary[key] || {};
    var best = ts.best_value_id ? listingsData.find(function (l) { return l.id === ts.best_value_id; }) : null;
    var imgSrc = BUILDING_IMAGES[key] || '';

    var buildingImgs = LISTING_IMAGES[key] || [];
    var imgStripHtml = buildingImgs.length > 1
      ? '<div class="bc-img-strip">' +
        buildingImgs.map(function(src, i) {
          return '<button class="bc-strip-thumb" data-bc-building="' + key + '" data-bc-idx="' + i + '" type="button" onclick="event.stopPropagation();" title="Ver foto ' + (i+1) + '" aria-label="Ver foto ' + (i+1) + ' de ' + escapeHtml(b.name) + '">' +
            '<img src="' + src + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display=\'none\'">' +
            '</button>';
        }).join('') +
        '<span class="bc-strip-count">' + buildingImgs.length + ' fotos</span>' +
        '</div>'
      : '';

    html += '<div class="building-card" data-building="' + key + '" role="button" tabindex="0">' +
      (imgSrc
        ? '<div class="building-card-img-wrap">' +
          '<img class="building-card-img" src="' + imgSrc + '" alt="' + escapeHtml(b.name) + '" loading="lazy" decoding="async" onerror="this.parentNode.style.display=\'none\'">' +
          '<span class="building-card-img-badge">' + escapeHtml(b.short || b.name) + '</span>' +
          '</div>'
        : '') +
      '<div class="building-card-body">' +
      '<div class="building-card-name">' + escapeHtml(b.name) + '</div>' +
      '<div class="building-card-zone">' + escapeHtml(b.zone || b.address || '') + '</div>' +
      '<div class="building-card-stats">' +
        buildingStat(ts.count || 0, window.i18n ? window.i18n.t('building.stat.listings') : 'Listados') +
        buildingStat(fmtMoney(ts.median_price || 0), window.i18n ? window.i18n.t('building.stat.median-price') : 'Med. Precio') +
        buildingStat(fmtMoney(ts.median_price_per_sqm || 0), window.i18n ? window.i18n.psmLabel() : '$/m²') +
      '</div>' +
      (best
        ? '<div class="building-best-value">' +
          '<span class="building-best-label">' + (window.i18n ? (window.i18n.getLocale() === 'en-US' ? 'Top value: ' : 'Mejor valor: ') : 'Mejor valor: ') + escapeHtml(best.title || best.id) + '</span>' +
          '<span class="building-best-price">' + fmtMoney(best.price) + '</span>' +
          '</div>'
        : '') +
      imgStripHtml +
      '</div></div>';
  });

  strip.innerHTML = html;

  strip.querySelectorAll('.building-card').forEach(function (card) {
    var activate = function () {
      var key = card.getAttribute('data-building');
      document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      var target = document.querySelector('.filter-chip[data-filter="' + key + '"]');
      if (target) target.classList.add('active');
      activeFilter = key;
      renderOverview();
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });

  // Wire building image strip thumbnail clicks
  strip.querySelectorAll('.bc-strip-thumb').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var building = btn.getAttribute('data-bc-building');
      var idx = parseInt(btn.getAttribute('data-bc-idx'), 10) || 0;
      var imgs = LISTING_IMAGES[building] || [];
      if (imgs.length > 0) openLightbox(imgs, idx);
    });
  });
}

function buildingStat(value, label) {
  return '<div class="building-stat">' +
    '<div class="building-stat-value">' + value + '</div>' +
    '<div class="building-stat-label">' + label + '</div>' +
    '</div>';
}

// ── Events Feed ───────────────────────────────────────────────
function renderEvents() {
  var el = document.getElementById('eventsList');
  var badge = document.getElementById('eventsCountBadge');
  if (badge) badge.textContent = eventsData.length;

  if (!eventsData.length) {
    el.innerHTML = '<p style="color:var(--color-text-faint);font-size:var(--text-xs);">Sin eventos recientes</p>';
    return;
  }

  el.innerHTML = eventsData.slice(0, 12).map(function (ev) {
    var typeClass = (ev.type || '').replace(/\s+/g, '_');
    return '<div class="event-row ' + escapeHtml(typeClass) + '">' +
      '<span class="event-time">' + escapeHtml(formatTime(ev.ts)) + '</span>' +
      '<span class="event-message">' + escapeHtml(ev.message || ev.label || '') + '</span>' +
      '</div>';
  }).join('');
}

// ── Market Distribution Chart ─────────────────────────────────
function renderMarketChart(chartType) {
  if (!listingsData.length) return;

  var canvas = document.getElementById('marketDistChart');
  if (!canvas) return;

  var style = getComputedStyle(document.documentElement);
  var textColor    = style.getPropertyValue('--color-text').trim();
  var mutedColor   = style.getPropertyValue('--color-text-muted').trim();
  var dividerColor = style.getPropertyValue('--color-divider').trim();
  var chart1       = style.getPropertyValue('--chart-1').trim();
  var chart2       = style.getPropertyValue('--chart-2').trim();
  var chart3       = style.getPropertyValue('--chart-3').trim();

  var bColors = {
    peninsula: style.getPropertyValue('--building-peninsula').trim(),
    torre300:  style.getPropertyValue('--building-torre300').trim(),
    paradox:   style.getPropertyValue('--building-paradox').trim(),
  };

  var labels, data, backgroundColor, config;

  if (chartType === 'price_distribution') {
    labels = listingsData.map(function (l) { return l.id; });
    data   = listingsData.map(function (l) { return l.price_per_sqm || 0; });
    backgroundColor = listingsData.map(function (l) { return (bColors[l.building] || chart1) + 'cc'; });
    config = {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColor, borderColor: backgroundColor.map(function(c){return c.slice(0,7);}), borderWidth: 1, borderRadius: 3 }] },
      options: barOpts(window.i18n ? window.i18n.t('market.tab.psm') : '$/m²', mutedColor, dividerColor, function(v){ return fmtMoney(v); }, true)
    };
  } else if (chartType === 'dom_distribution') {
    labels = listingsData.map(function (l) { return l.id; });
    data   = listingsData.map(function (l) { return l.days_on_market || 0; });
    backgroundColor = listingsData.map(function (l) { return (bColors[l.building] || chart2) + 'cc'; });
    config = {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColor, borderColor: backgroundColor.map(function(c){return c.slice(0,7);}), borderWidth: 1, borderRadius: 3 }] },
      options: barOpts(window.i18n ? window.i18n.t('market.tab.dom') : 'Días en Mercado', mutedColor, dividerColor, function(v){ return v + 'd'; }, true)
    };
  } else {
    // score distribution
    labels = listingsData.map(function (l) { return l.id; });
    data   = listingsData.map(function (l) { return ((l.intel || {}).scores || {}).composite_score || ((l.intel || {}).scores || {}).value_score || 0; });
    backgroundColor = listingsData.map(function (l) { return (bColors[l.building] || chart3) + 'cc'; });
    config = {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColor, borderColor: backgroundColor.map(function(c){return c.slice(0,7);}), borderWidth: 1, borderRadius: 3 }] },
      options: barOpts('Score de Valor', mutedColor, dividerColor, function(v){ return v; }, true)
    };
  }

  getOrCreateChart('marketDistChart', config, 'market');
}

function barOpts(label, mutedColor, dividerColor, tickFmt, rotateLabels) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
        bodyColor:  getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
        borderColor: dividerColor, borderWidth: 1, padding: 10,
        titleFont: { family: 'Inter', weight: '600' },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: { label: function(ctx) { return tickFmt(ctx.parsed.y); } }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: mutedColor,
          font: { family: 'JetBrains Mono', size: 10 },
          maxRotation: rotateLabels ? 45 : 0
        },
        border: { color: dividerColor }
      },
      y: {
        grid: { color: dividerColor + '50' },
        ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 }, callback: tickFmt },
        border: { display: false }
      }
    },
    animation: { duration: 500, easing: 'easeOutQuart' }
  };
}

// ── Overview / Listings Grid ──────────────────────────────────
function renderOverview() {
  var grid     = document.getElementById('listingsGrid');
  var countEl  = document.getElementById('listingsCount');
  var filtered = sortListings(filterListings());

  var _oi = window.i18n;
  if (countEl) countEl.textContent = filtered.length + ' / ' + listingsData.length;

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state-card"><h3>' + (_oi ? (_oi.getLocale() === 'en-US' ? 'No results' : 'Sin resultados') : 'Sin resultados') + '</h3><p>' + (_oi ? (_oi.getLocale() === 'en-US' ? 'Try a different filter or refresh the data.' : 'Prueba con otro filtro o actualiza los datos.') : 'Prueba con otro filtro o actualiza los datos.') + '</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(function (l) {
    var intel   = l.intel || {};
    var scores  = intel.scores || {};
    var status  = intel.status || {};
    var bName   = buildingsData[l.building] ? (buildingsData[l.building].short || buildingsData[l.building].name) : l.building;
    var leverage = scores.leverage_score || 0;
    var leverageCls = leverage >= 65 ? 'high' : leverage >= 35 ? 'mid' : 'low';

    var _cardi = window.i18n;
    var cardAriaLabel = escapeHtml(l.title) + ', ' + escapeHtml(bName) + ', ' + fmtMoney(l.price) + ', ' + (l.days_on_market || 0) + ' ' + (_cardi ? _cardi.t('card.days-market') : 'días en mercado');
    var listingImgSet = LISTING_IMAGES[l.building] || [];
    var listingIndexMap = {
      sf_001: 0, sf_002: 1, sf_003: 2, sf_004: 0, sf_005: 0, sf_006: 1, sf_007: 2, sf_008: 0,
      sf_009: 0, sf_010: 1, sf_011: 0, sf_012: 1, sf_013: 2, sf_014: 1
    };
    var listingImg = Array.isArray(listingImgSet)
      ? listingImgSet[Math.min((listingIndexMap[l.id] != null ? listingIndexMap[l.id] : 0), Math.max(0, listingImgSet.length - 1))]
      : listingImgSet;
    return '<div class="listing-card" data-id="' + l.id + '" data-building="' + l.building + '" role="button" tabindex="0" aria-label="' + cardAriaLabel + '">' +
      (listingImg
        ? '<div class="listing-card-media">' +
            '<img class="listing-card-img" src="' + listingImg + '" alt="' + escapeHtml(bName) + '" loading="lazy" decoding="async" onerror="this.parentNode.style.display=\'none\'">' +
            '<div class="listing-card-media-overlay"></div>' +
            '<div class="card-top card-top-media">' +
              '<span class="card-id">' + l.id + '</span>' +
              '<div class="card-badges">' +
                '<span class="card-building-badge" data-building="' + l.building + '">' + escapeHtml(bName) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>'
        : '<div class="card-top">' +
            '<span class="card-id">' + l.id + '</span>' +
            '<div class="card-badges">' +
              '<span class="card-building-badge" data-building="' + l.building + '">' + escapeHtml(bName) + '</span>' +
            '</div>' +
          '</div>') +
      '<div class="card-body">' +
      '<div class="card-title">' + escapeHtml(l.title) + '</div>' +
      '<div class="card-price-row">' +
        '<span class="card-price">' + fmtMoney(l.price) + '</span>' +
        '<span class="card-price-unit">' + (window.i18n ? window.i18n.currencyUnitLabel() : 'MXN/mes') + '</span>' +
        '<span class="card-sqm-price">' + fmtMoney(l.price_per_sqm || 0) + '/m²</span>' +
        (function() {
          var psm = l.price_per_sqm || 0;
          var peerMedian = ((((l.intel || {}).peer_group || {}).median_price_per_sqm) || ((((l.intel || {}).building_context || {}).median_price_per_sqm)) || (marketSummary.median_price_per_sqm) || 0);
          if (!peerMedian || !psm) return '';
          var deltaPct = Math.round(((psm - peerMedian) / peerMedian) * 100);
          var dCls = deltaPct <= -2 ? 'delta-below' : deltaPct >= 5 ? 'delta-above' : 'delta-neutral';
          var sign = deltaPct >= 0 ? '+' : '';
          return '<span class="card-psm-delta ' + dCls + '">' + sign + deltaPct + '% peer</span>';
        }()) +
      '</div>' +
      '<div class="card-features">' +
        feat(_cardi ? (_cardi.getLocale() === 'en-US' ? 'Beds' : 'Rec') : 'Rec', l.beds + (_cardi ? ' ' + _cardi.t('card.beds') : ' rec')) +
        feat(_cardi ? (_cardi.getLocale() === 'en-US' ? 'Baths' : 'Baños') : 'Baños', l.baths + (_cardi ? (_cardi.getLocale() === 'en-US' ? ' ba' : ' baños') : ' baños')) +
        feat(_cardi ? (_cardi.getLocale() === 'en-US' ? 'Area' : 'Área') : 'Área', l.sqm + ' m²') +
        feat(_cardi ? (_cardi.getLocale() === 'en-US' ? 'Pkg' : 'Estac.') : 'Estac.', l.parking + (_cardi ? (_cardi.getLocale() === 'en-US' ? ' pkg' : ' est') : ' est')) +
        (l.furnished ? feat(_cardi ? (_cardi.getLocale() === 'en-US' ? 'Furn.' : 'Mob.') : 'Mob.', _cardi ? _cardi.t('operator.card.furnished') : 'Amueblado') : '') +
        feat('DOM', (l.days_on_market || 0) + 'd') +
      '</div>' +
      '<div class="card-scores">' +
        scoreBarRow(_cardi ? _cardi.t('detail.score.value') : 'Valor', scores.value_score || scores.composite_score, false) +
        scoreBarRow(_cardi ? _cardi.t('detail.score.confidence') : 'Confianza', scores.confidence_score, false) +
        scoreBarRow(_cardi ? _cardi.t('detail.score.availability') : 'Disponib.', Math.round((1 - (scores.ghost_probability || 0)) * 100), false) +
      '</div>' +
      '<div class="card-leverage-wrap">' +
        '<div class="leverage-meter-label-row">' +
          '<span class="leverage-meter-label">Leverage</span>' +
          '<span class="leverage-meter-score" style="color:' + leverageColor(leverage) + '">' + Math.round(leverage) + '</span>' +
        '</div>' +
        '<div class="leverage-track"><div class="leverage-fill ' + leverageCls + '" style="width:' + Math.min(100, leverage) + '%"></div></div>' +
      '</div>' +
      '<div class="card-actions">' +
        (status.key
          ? '<span class="card-status ' + escapeHtml(status.key) + '">' + escapeHtml(status.label || status.key) + '</span>'
          : '<span class="card-status card-status-neutral">' + (_cardi ? _cardi.t('card.status.available') : 'Disponible') + '</span>') +
        (function() {
          var imgs = getListingImages(l);
          var total = imgs.exterior.length + imgs.interior.length;
          var domain = getSourceDomain(l.source);
          var photoBadge = total > 0
            ? '<button class="card-photo-btn" data-photo-id="' + l.id + '" type="button" onclick="event.stopPropagation();" title="' + total + ' ' + (_cardi ? _cardi.t('card.photos') : 'fotos') + '">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
              '<span>' + total + '</span>' +
              '</button>'
            : '';
          var sourceLink = l.source
            ? '<a class="card-link-btn" href="' + l.source + '" target="_blank" rel="noopener noreferrer" title="' + (_cardi ? _cardi.t('detail.source.open') : 'Abrir listado en') + ' ' + escapeHtml(domain || (_cardi ? _cardi.t('card.open-source') : 'fuente')) + '" onclick="event.stopPropagation()">' +
              (domain ? domain : (_cardi ? _cardi.t('card.open-source') : 'Fuente')) +
              '</a>'
            : '<button class="card-open-btn" type="button">' + (_cardi ? _cardi.t('card.open-analysis') : 'Abrir análisis') + '</button>';
          return photoBadge + sourceLink;
        }()) +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  grid.querySelectorAll('.listing-card').forEach(function (card) {
    function openCard() {
      var lid = card.getAttribute('data-id');
      var listing = listingsData.find(function (l) { return l.id === lid; });
      if (listing) { currentListing = listing; showView('detail'); renderDetailView(listing); }
    }
    card.addEventListener('click', openCard);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(); }
    });
    // Photo button opens lightbox with all images
    var photoBtn = card.querySelector('.card-photo-btn');
    if (photoBtn) {
      photoBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var lid = card.getAttribute('data-id');
        var listing = listingsData.find(function (l) { return l.id === lid; });
        if (!listing) return;
        var imgs = getListingImages(listing);
        var all = imgs.exterior.concat(imgs.interior);
        if (all.length > 0) openLightbox(all, 0);
      });
    }
  });
}

function feat(label, text) {
  return '<span class="card-feature"><span class="card-feature-key">' + label + '</span><span class="card-feature-text">' + text + '</span></span>';
}

function scoreBarTier(value, inverse) {
  // Returns a human-readable tier label for screen readers
  if (inverse) {
    return value > 50 ? 'alto' : value > 25 ? 'medio' : 'bajo';
  }
  return value >= 70 ? 'alto' : value >= 40 ? 'medio' : 'bajo';
}

function scoreBarRow(label, value, inverse) {
  if (value === undefined || value === null) return '';
  var pct   = Math.min(100, Math.max(0, value));
  var color = scoreColor(value, inverse);
  var tier  = scoreBarTier(value, inverse);
  var ariaLabel = label + ': ' + Math.round(value) + ' de 100, nivel ' + tier;
  return '<div class="card-score-row">' +
    '<span class="card-score-name">' + label + '</span>' +
    '<div class="card-score-bar-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="' + ariaLabel + '"><div class="card-score-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
    '<span class="card-score-value" style="color:' + color + '" aria-hidden="true">' + Math.round(value) + '</span>' +
    '</div>';
}

function scoreColor(value, inverse) {
  if (inverse) {
    return value > 50 ? 'var(--color-error)' : value > 25 ? 'var(--color-warning)' : 'var(--color-success)';
  }
  return value >= 70 ? 'var(--color-success)' : value >= 40 ? 'var(--color-warning)' : 'var(--color-error)';
}

function leverageColor(v) {
  return v >= 65 ? 'var(--color-success)' : v >= 35 ? 'var(--color-warning)' : 'var(--color-error)';
}

// ── Detail View ───────────────────────────────────────────────
function renderDetailView(listing) {
  destroyCharts();

  var intel       = listing.intel || {};
  var scores      = intel.scores  || {};
  var pricing     = intel.pricing || {};
  var status      = intel.status  || {};
  var battleCard  = intel.battle_card || [];
  var comparableIds = intel.comparable_ids || [];
  var script      = intel.script || {};
  var counterparty = intel.counterparty_playbook || {};

  // ── Renter Intel Header ─────────────────────────────────────
  var leverageScore = scores.leverage_score || 0;
  var renterHeader  = document.getElementById('renterIntelHeader');
  var renterDesc    = document.getElementById('renterIntelDesc');
  var renterBadge   = document.getElementById('renterBadge');
  if (renterHeader) {
    renterHeader.style.display = 'flex';
    var bName = buildingsData[listing.building] ? buildingsData[listing.building].name : listing.building;
    var _levI = window.i18n;
  var descText = leverageScore >= 65
      ? (_levI ? _levI.t('detail.leverage.high') : 'Alto leverage') + ' (' + Math.round(leverageScore) + '/100) — ' + bName + ' ' + (listing.days_on_market || 0) + ' ' + (_levI ? _levI.t('detail.leverage.dom') : 'días en mercado') + ' ' + (_levI ? _levI.t('detail.leverage.high-suffix') : '— posición de negociación favorable.')
      : leverageScore >= 35
        ? (_levI ? _levI.t('detail.leverage.moderate-desc') : 'Leverage moderado') + ' (' + Math.round(leverageScore) + '/100) ' + (_levI ? _levI.t('detail.leverage.mod-suffix') : '— oportunidad de negociación posible. Revisa comparables y días en mercado.')
        : (_levI ? _levI.t('detail.leverage.low-desc') : 'Leverage bajo') + ' (' + Math.round(leverageScore) + '/100) ' + (_levI ? _levI.t('detail.leverage.low-suffix') : '— posición desafiante. Considera comparables más competitivos.');
    if (renterDesc) renterDesc.textContent = descText;
    if (renterBadge) {
      var _rbi = window.i18n;
    renterBadge.textContent = leverageScore >= 65 ? (_rbi ? _rbi.t('detail.leverage.strong').toUpperCase() : 'FUERTE') : leverageScore >= 35 ? (_rbi ? _rbi.t('detail.leverage.moderate').toUpperCase() : 'MODERADO') : (_rbi ? _rbi.t('detail.leverage.weak').toUpperCase() : 'DÉBIL');
      renterBadge.style.background = leverageScore >= 65
        ? 'color-mix(in srgb, var(--color-success) 18%, transparent)'
        : leverageScore >= 35
          ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)'
          : 'color-mix(in srgb, var(--color-error) 15%, transparent)';
      renterBadge.style.color = leverageScore >= 65 ? 'var(--color-success)' : leverageScore >= 35 ? 'var(--color-warning)' : 'var(--color-error)';
      renterBadge.style.borderColor = leverageScore >= 65
        ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
        : leverageScore >= 35
          ? 'color-mix(in srgb, var(--color-warning) 28%, transparent)'
          : 'color-mix(in srgb, var(--color-error) 28%, transparent)';
    }
  }

  // ── Header ─────────────────────────────────────────────────
  var header    = document.getElementById('detailHeader');
  var buildingName = buildingsData[listing.building] ? buildingsData[listing.building].name : listing.building;
  var _di = window.i18n;

  header.innerHTML = '<div class="detail-company-info">' +
    '<p class="detail-eyebrow">' + (_di ? _di.t('detail.eyebrow') : 'Unidad seleccionada') + '</p>' +
    '<h1>' + escapeHtml(listing.title) + '</h1>' +
    '<div class="detail-meta">' +
      metaItem('ID',                                                   listing.id) +
      metaItem(_di ? _di.t('detail.meta.building') : 'Edificio',       buildingName) +
      metaItem(_di ? _di.t('detail.meta.price')    : 'Renta',          fmtMoney(listing.price)) +
      metaItem(_di ? _di.t('detail.meta.sqm')      : 'm²',            listing.sqm) +
      metaItem(_di ? _di.t('detail.meta.psm')      : 'Renta/m²',      fmtMoney(listing.price_per_sqm || 0)) +
      metaItem(_di ? _di.t('detail.meta.beds')     : 'Recámaras',      listing.beds) +
      metaItem(_di ? _di.t('detail.meta.dom')      : 'Días en mercado', listing.days_on_market) +
      (status.key ? metaItem('Status', status.label || status.key) : '') +
    '</div></div>';

  // ── Score Gauges ────────────────────────────────────────────
  var gauges   = document.getElementById('detailScores');
  var scoreList = [
    { label: _di ? _di.t('detail.score.composite')   : 'Composite', value: scores.composite_score, inverse: false },
    { label: _di ? _di.t('detail.score.value')        : 'Valor',     value: scores.value_score,     inverse: false },
    { label: _di ? _di.t('detail.score.confidence')   : 'Confianza', value: scores.confidence_score, inverse: false },
    { label: _di ? _di.t('detail.score.availability') : 'Disponib.', value: Math.round((1 - (scores.ghost_probability || 0)) * 100), inverse: false },
    { label: _di ? _di.t('detail.score.leverage')     : 'Leverage',  value: scores.leverage_score,  inverse: false },
    { label: _di ? _di.t('detail.score.action')       : 'Acción',    value: scores.action_score,    inverse: false },
  ];

  gauges.innerHTML = scoreList.map(function (s) {
    if (s.value === undefined || s.value === null) return '';
    var color = scoreColor(s.value, s.inverse);
    var pct   = Math.min(100, Math.max(0, s.value));
    var tier  = scoreBarTier(s.value, s.inverse);
    var gaugeLabel = s.label + ': ' + Math.round(s.value) + ' ' + (_di ? _di.t('score.of') : 'de 100, nivel') + ' ' + tier;
    return '<div class="score-gauge" aria-label="' + gaugeLabel + '">' +
      '<div class="score-gauge-value" style="color:' + color + '" aria-hidden="true">' + Math.round(s.value) + '</div>' +
      '<div class="score-gauge-bar-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="' + gaugeLabel + '"><div class="score-gauge-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<div class="score-gauge-label" aria-hidden="true">' + s.label + '</div>' +
      '</div>';
  }).join('');

  // ── Negotiation Band ────────────────────────────────────────
  var bandEl = document.getElementById('negotiationBand');
  if (pricing.opening_anchor || pricing.target_close || pricing.walk_away || pricing.fair_low) {
    var fairLow   = pricing.fair_low    || 0;
    var opening   = pricing.opening_anchor || 0;
    var target    = pricing.target_close   || 0;
    var walkAway  = pricing.walk_away     || 0;
    var listed    = listing.price         || 0;

    // Calculate positions as percentages
    var minVal = Math.min(fairLow, opening, target, walkAway, listed) * 0.95;
    var maxVal = Math.max(fairLow, opening, target, walkAway, listed) * 1.05;
    var range  = maxVal - minVal || 1;
    var pctOf  = function (v) { return ((v - minVal) / range * 100).toFixed(1) + '%'; };

    // Screen-reader / text fallback: summarises the negotiation band as a
    // plain sentence that assistive technologies read before the visual track.
    var srSummary = (_di ? _di.t('detail.band.title') : 'Banda operativa de negociación') + ': ' + (_di ? _di.t('detail.band.listed') : 'Listado') + ' ' + fmtMoney(listed) +
      '. ' + (_di ? _di.t('detail.band.fairlow') : 'Fair Low') + ' ' + fmtMoney(fairLow) +
      ', ' + (_di ? _di.t('detail.band.opening-anchor') : 'Opening anchor') + ' ' + fmtMoney(opening) +
      ', ' + (_di ? _di.t('detail.band.target-close') : 'Target close') + ' ' + fmtMoney(target) +
      ', ' + (_di ? _di.t('detail.band.walkaway') : 'Walk away') + ' ' + fmtMoney(walkAway) + '.';

    bandEl.innerHTML = '<div class="negotiation-band">' +
      '<h3>' + (_di ? _di.t('detail.band.title') : 'Banda operativa de negociación') + '</h3>' +
      '<p class="sr-only">' + srSummary + '</p>' +
      '<div class="band-visual" aria-hidden="true">' +
        '<div class="band-track"></div>' +
        (fairLow && target
          ? '<div class="band-zone-fair" style="left:' + pctOf(fairLow) + ';width:' + ((target - fairLow) / range * 100).toFixed(1) + '%;"></div>'
          : '') +
        priceMarker(listed,   pctOf(listed),   'marker-list',   _di ? _di.t('detail.band.listed')  : 'Listado') +
        priceMarker(target,   pctOf(target),   'marker-target', _di ? _di.t('detail.band.target')  : 'Target') +
        priceMarker(opening,  pctOf(opening),  'marker-open',   _di ? _di.t('detail.band.opening') : 'Opening') +
        priceMarker(walkAway, pctOf(walkAway), 'marker-walk',   _di ? _di.t('detail.band.walkaway') : 'Walk away') +
      '</div>' +
      '<div class="band-anchors">' +
        bandAnchor(fmtMoney(fairLow),  _di ? _di.t('detail.band.fairlow') : 'Fair low') +
        bandAnchor(fmtMoney(opening),  _di ? _di.t('detail.band.opening-anchor') : 'Opening anchor') +
        bandAnchor(fmtMoney(target),   _di ? _di.t('detail.band.target-close') : 'Target close') +
        bandAnchor(fmtMoney(walkAway), _di ? _di.t('detail.band.walkaway-note') : 'Walk away — no cruces') +
      '</div></div>';
  } else {
    bandEl.innerHTML = '';
  }

  // ── Leverage Panel ──────────────────────────────────────────
  var levPanel = document.getElementById('leveragePanel');
  var levSub   = document.getElementById('leveragePanelSubtitle');
  var levGrid  = document.getElementById('leverageVisualsGrid');
  var levPoints = document.getElementById('leveragePointsSection');

  if (levPanel && (scores.leverage_score || scores.composite_score)) {
    levPanel.style.display = 'block';
    if (levSub) levSub.textContent = (_di ? _di.t('detail.leverage.signals') : 'Señales de poder') + ': ' + listing.id + ' · ' + (listing.days_on_market || 0) + ' ' + (_di ? _di.t('detail.leverage.dom') : 'días en mercado');

    if (levGrid) {
      var domSignal  = (listing.days_on_market || 0) > 45 ? 'high' : (listing.days_on_market || 0) > 21 ? 'mid' : 'low';
      var domColor   = domSignal === 'high' ? 'var(--color-success)' : domSignal === 'mid' ? 'var(--color-warning)' : 'var(--color-error)';
      var ghostProb  = scores.ghost_probability || 0; // 0-1 fraction
      var ghostColor = ghostProb < 0.25 ? 'var(--color-success)' : ghostProb < 0.50 ? 'var(--color-warning)' : 'var(--color-error)';

      levGrid.innerHTML =
        leverageVisualCard(_di ? _di.t('detail.leverage.dom-label') : 'Días en mercado', (listing.days_on_market || 0) + 'd', _di ? _di.t('detail.leverage.time-pressure') : 'Presión de tiempo', domColor) +
        leverageVisualCard(_di ? _di.t('detail.leverage.availability') : 'Disponibilidad', Math.round((1 - ghostProb) * 100) + '%', _di ? _di.t('detail.leverage.availability-sub') : 'Probabilidad de disponibilidad real', ghostColor) +
        leverageVisualCard(_di ? _di.t('detail.leverage.psm-label') : 'Renta/m² vs mediana', fmtMoney(listing.price_per_sqm || 0), _di ? _di.t('detail.leverage.psm-sub') : 'Posición de precio', 'var(--color-text)') +
        leverageVisualCard(_di ? _di.t('detail.leverage.score-label') : 'Score Leverage', Math.round(leverageScore), _di ? _di.t('detail.leverage.score-sub') : 'Índice 0–100', leverageColor(leverageScore));
    }

    // Leverage points derived from intel
    if (levPoints) {
      var points = buildLeveragePoints(listing, scores, pricing);
      if (points.length) {
        levPoints.innerHTML =
          '<div class="leverage-points-label">' + (_di ? _di.t('detail.leverage.advantage-pts') : 'Puntos de ventaja') + '</div>' +
          points.map(function (p) {
            return '<div class="leverage-point-item ' + p.cls + '">' +
              '<span class="leverage-point-strength">' + p.strength + '</span>' +
              '<span class="leverage-point-text">' + escapeHtml(p.text) + '</span>' +
              '</div>';
          }).join('');
      } else {
        levPoints.innerHTML = '';
      }
    }
  } else {
    if (levPanel) levPanel.style.display = 'none';
  }

  // ── Intel Grid ──────────────────────────────────────────────
  var intelGrid = document.getElementById('intelGrid');
  var sections  = [];

  if (intel.primary_angle) {
    sections.push(intelCardHtml('Ángulo Principal', '<p>' + escapeHtml(intel.primary_angle) + '</p>'));
  }

  if (typeof script === 'string' && script.length > 0) {
    sections.push(intelCardHtml('Talk track — Script de Negociación',
      '<p style="line-height:1.7;white-space:pre-line;">' + escapeHtml(script) + '</p>'
    ));
  } else if (script && (script.opening || script.body)) {
    sections.push(intelCardHtml('Talk track — Script de Negociación',
      (script.opening ? '<p style="font-weight:700;margin-bottom:var(--space-2);">' + escapeHtml(script.opening) + '</p>' : '') +
      (script.body    ? '<p style="line-height:1.7;">' + escapeHtml(script.body) + '</p>' : '')
    ));
  }

  if (battleCard.length > 0) {
    var bcHtml = '<ul class="battle-card-list">' +
      battleCard.map(function (t) {
        if (typeof t === 'string') {
          var colonIdx = t.indexOf(':');
          if (colonIdx > 0) {
            var lbl = t.substring(0, colonIdx).trim();
            var val = t.substring(colonIdx + 1).trim();
            return '<li class="battle-card-item">' +
              '<span class="tactic-name">' + escapeHtml(lbl) + '</span>' +
              '<span class="tactic-counter">' + escapeHtml(val) + '</span>' +
              '</li>';
          }
          return '<li class="battle-card-item"><span class="tactic-name">' + escapeHtml(t) + '</span></li>';
        }
        return '<li class="battle-card-item">' +
          '<span class="tactic-name">' + escapeHtml(t.name || t.tactic || '') + '</span>' +
          '<span class="tactic-counter">' + escapeHtml(t.counter || t.response || '') + '</span>' +
          '</li>';
      }).join('') + '</ul>';
    sections.push(intelCardHtml('Battle Card — Anclas de Negociación', bcHtml));
  }

  if (counterparty.primary_tactic || (counterparty.tactics && counterparty.tactics.length > 0)) {
    var cpHtml = '';
    if (counterparty.primary_tactic) {
      var pt = counterparty.primary_tactic;
      var probCls = (pt.probability || 0) > 50 ? 'high' : (pt.probability || 0) > 25 ? 'med' : 'low';
      cpHtml += '<div class="playbook-primary">' +
        '<div class="playbook-primary-header">' +
          '<span class="playbook-tactic-badge primary">Táctica principal</span>' +
          '<span class="playbook-probability ' + probCls + '">' + (pt.probability || 0) + '% probable</span>' +
        '</div>' +
        '<h4>' + escapeHtml(pt.name || '') + '</h4>' +
        '<p class="playbook-desc">' + escapeHtml(pt.description || '') + '</p>' +
        (pt.tell ? '<div class="playbook-field"><strong>Indicador:</strong> ' + escapeHtml(pt.tell) + '</div>' : '') +
        (pt.rebuttal_script ? '<div class="playbook-field"><strong>Respuesta:</strong> ' + escapeHtml(pt.rebuttal_script) + '</div>' : '') +
        (pt.say_instead ? '<div class="playbook-field say-instead"><strong>Decir en su lugar:</strong> ' + escapeHtml(pt.say_instead) + '</div>' : '') +
        (pt.do_not_say ? '<div class="playbook-field do-not-say"><strong>No decir:</strong> ' + escapeHtml(pt.do_not_say) + '</div>' : '') +
        '</div>';
    }
    if (counterparty.market_context_note) {
      cpHtml += '<div class="playbook-context"><strong>Contexto de mercado:</strong> ' + escapeHtml(counterparty.market_context_note) + '</div>';
    }
    if (counterparty.counter_script) {
      cpHtml += '<div class="playbook-counter-script"><strong>Counter script:</strong> ' + escapeHtml(counterparty.counter_script) + '</div>';
    }
    var otherTactics = (counterparty.tactics || []).filter(function (t) {
      return !counterparty.primary_tactic || t.id !== counterparty.primary_tactic.id;
    });
    if (otherTactics.length > 0) {
      cpHtml += '<details class="playbook-more"><summary>Más tácticas (' + otherTactics.length + ')</summary>' +
        '<div class="playbook-tactics-list">' +
        otherTactics.map(function (t) {
          var pCls = (t.probability || 0) > 50 ? 'high' : (t.probability || 0) > 25 ? 'med' : 'low';
          return '<div class="playbook-tactic">' +
            '<div class="playbook-tactic-header">' +
              '<span class="playbook-tactic-name">' + escapeHtml(t.name || '') + '</span>' +
              '<span class="playbook-probability ' + pCls + '">' + (t.probability || 0) + '%</span>' +
            '</div>' +
            '<p class="playbook-desc">' + escapeHtml(t.description || '') + '</p>' +
            (t.tell ? '<div class="playbook-field"><strong>Indicador:</strong> ' + escapeHtml(t.tell) + '</div>' : '') +
            (t.say_instead ? '<div class="playbook-field say-instead"><strong>Decir:</strong> ' + escapeHtml(t.say_instead) + '</div>' : '') +
            '</div>';
        }).join('') +
        '</div></details>';
    }
    sections.push(intelCardHtml('Playbook operativo — Contraparte', cpHtml));
  } else if (counterparty.broker_profile || counterparty.predicted_moves) {
    var cpSimple = '';
    if (counterparty.broker_profile) cpSimple += '<p style="margin-bottom:var(--space-2);"><strong>Perfil:</strong> ' + escapeHtml(counterparty.broker_profile) + '</p>';
    if (counterparty.predicted_moves) cpSimple += '<p><strong>Movimientos probables:</strong> ' + escapeHtml(counterparty.predicted_moves) + '</p>';
    sections.push(intelCardHtml('Playbook operativo — Contraparte', cpSimple));
  }

  if (comparableIds.length > 0) {
    var compHtml = comparableIds.map(function (cid) {
      var comp = listingsData.find(function (l) { return l.id === cid; });
      if (!comp) return '';
      var delta = listing.price - comp.price;
      var deltaStr = delta > 0 ? '+$' + fmtNum(delta) : '-$' + fmtNum(Math.abs(delta));
      return '<div class="comparable-row">' +
        '<span>' + escapeHtml(comp.title) + '</span>' +
        '<span style="font-family:var(--font-mono);font-weight:700;">$' + fmtNum(comp.price) + '</span>' +
        '<span style="font-size:var(--text-xs);color:' + (delta > 0 ? 'var(--color-error)' : 'var(--color-success)') + ';font-family:var(--font-mono);">' + deltaStr + '</span>' +
        '</div>';
    }).join('');
    sections.push(intelCardHtml(window.i18n ? window.i18n.t('detail.intel.comparables') : 'Comparable units', compHtml));
  }

  if (listing.history && listing.history.length > 1) {
    // Compute trend summary for the header
    var hist = listing.history;
    var firstPrice = hist[0].price;
    var lastPrice  = hist[hist.length - 1].price;
    var peakPrice  = Math.max.apply(null, hist.map(function(h){return h.price;}));
    var peakDrop   = peakPrice > lastPrice ? Math.round(((peakPrice - lastPrice) / peakPrice) * 100) : 0;
    var totalChange = lastPrice - firstPrice;
    var changePct  = firstPrice > 0 ? Math.round(((totalChange) / firstPrice) * 100) : 0;
    var trendDir   = totalChange < 0 ? '&#9660;' : totalChange > 0 ? '&#9650;' : '→';
    var trendColor = totalChange < 0 ? 'var(--color-success)' : totalChange > 0 ? 'var(--color-error)' : 'var(--color-text-muted)';
    var trendLabel = (totalChange < 0 ? '−' : totalChange > 0 ? '+' : '') + Math.abs(changePct) + '%';

    var histHeader =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<h3 style="margin:0;">Historial de Precio</h3>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          (peakDrop > 0
            ? '<span style="font-size:10px;color:var(--color-text-faint);font-family:var(--font-mono);">↓' + peakDrop + '% desde pico</span>'
            : '') +
          '<span style="font-size:11px;font-weight:700;color:' + trendColor + ';font-family:var(--font-mono);">' +
            trendDir + ' ' + trendLabel +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:10px;">' +
        '<div style="text-align:center;">' +
          '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:var(--color-text-faint);font-weight:600;">Inicial</div>' +
          '<div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--color-text-muted);">' + fmtMoney(firstPrice) + '</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:var(--color-text-faint);font-weight:600;">Actual</div>' +
          '<div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--color-text);">' + fmtMoney(lastPrice) + '</div>' +
        '</div>' +
        (peakDrop > 0
          ? '<div style="text-align:center;">' +
            '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.07em;color:var(--color-text-faint);font-weight:600;">Máx.</div>' +
            '<div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--color-error);">' + fmtMoney(peakPrice) + '</div>' +
          '</div>'
          : '') +
      '</div>';

    sections.push(
      '<div class="intel-card">' +
        histHeader +
        '<div class="chart-container" style="min-height:130px;"><canvas id="priceHistoryChart"></canvas></div>' +
      '</div>'
    );
  }

  if (intel.flags && intel.flags.length > 0) {
    var flagsHtml = intel.flags.map(function (f) {
      var text = typeof f === 'string' ? f : f.label || f.flag || JSON.stringify(f);
      return '<span style="display:inline-block;font-size:var(--text-xs);padding:3px 8px;background:var(--color-surface-alt);border-radius:var(--radius-full);margin:2px;border:1px solid var(--color-border);">' + escapeHtml(text) + '</span>';
    }).join('');
    sections.push(intelCardHtml('Required proof — Verificación requerida', flagsHtml));
  }

  intelGrid.innerHTML = sections.join('');

  // Price history chart
  if (listing.history && listing.history.length > 1) {
    renderPriceHistoryChart(listing.history);
  }

  // Image gallery panel
  renderImageGalleryPanel(listing);

  // Inquiry form
  renderInquiryForm(listing);
}

// ── Image Gallery Panel ─────────────────────────────────────
function renderImageGalleryPanel(listing) {
  var el = document.getElementById('detailImageGallery');
  if (!el) return;

  var imgs = getListingImages(listing);
  var allImgs = imgs.exterior.concat(imgs.interior);
  if (allImgs.length === 0) { el.style.display = 'none'; return; }

  el.style.display = 'block';

  var domain  = getSourceDomain(listing.source);
  var building = buildingsData[listing.building] ? buildingsData[listing.building].name : listing.building;
  var extCount = imgs.exterior.length;
  var intCount = imgs.interior.length;
  var totalCount = allImgs.length;

  // Build tab HTML
  var _gi = window.i18n;
  var tabs =
    '<div class="ig-tabs">' +
    '<button class="ig-tab active" data-ig-tab="all">' + (_gi ? _gi.t('detail.gallery.all') : 'Todas') + ' <span class="ig-count">' + totalCount + '</span></button>' +
    (extCount > 0
      ? '<button class="ig-tab" data-ig-tab="exterior">' + (_gi ? _gi.t('detail.gallery.exterior') : 'Exterior') + ' <span class="ig-count">' + extCount + '</span></button>'
      : '') +
    (intCount > 0
      ? '<button class="ig-tab" data-ig-tab="interior">' + (_gi ? _gi.t('detail.gallery.interior') : 'Interior') + ' <span class="ig-count">' + intCount + '</span></button>'
      : '') +
    '</div>';

  // Source attribution
  var sourceAttr = domain
    ? '<div class="ig-source-row">' +
      '<span class="ig-source-label">' + (_gi ? _gi.t('detail.gallery.source') : 'Fuente') + '</span>' +
      '<span class="ig-source-domain">' + escapeHtml(domain) + '</span>' +
      (listing.source
        ? '<a class="ig-source-link" href="' + listing.source + '" target="_blank" rel="noopener noreferrer" title="' + (_gi ? _gi.t('detail.source.open') : 'Abrir listado en') + ' ' + escapeHtml(domain) + '">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
          (_gi ? _gi.t('detail.gallery.open') : 'Abrir listado') + '</a>'
        : '') +
      '</div>'
    : (listing.source
      ? '<div class="ig-source-row"><a class="ig-source-link" href="' + listing.source + '" target="_blank" rel="noopener noreferrer">' + (_gi ? _gi.t('detail.gallery.open-original') : 'Abrir listado original') + '</a></div>'
      : '');

  // Build grid
  function buildGrid(images) {
    return '<div class="ig-grid">' +
      images.map(function(src, i) {
        return '<button class="ig-thumb" data-img-idx="' + i + '" aria-label="' + (_gi ? _gi.t('detail.gallery.expand') : 'Ampliar foto') + ' ' + (i+1) + '">' +
          '<img src="' + src + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display=\'none\'">' +
          '</button>';
      }).join('') +
      '</div>';
  }

  el.innerHTML =
    '<div class="ig-panel">' +
      '<div class="ig-header">' +
        '<div class="ig-title">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
          (_gi ? _gi.t('detail.gallery.title') : 'Imágenes de la propiedad') +
        '</div>' +
        sourceAttr +
      '</div>' +
      tabs +
      '<div class="ig-body" id="igBody">' + buildGrid(allImgs) + '</div>' +
    '</div>';

  // Tab switching
  el.querySelectorAll('.ig-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      el.querySelectorAll('.ig-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var which = tab.getAttribute('data-ig-tab');
      var images = which === 'exterior' ? imgs.exterior : which === 'interior' ? imgs.interior : allImgs;
      var body = el.querySelector('#igBody');
      if (body) body.innerHTML = buildGrid(images);
      // Re-wire thumb clicks
      wireThumbClicks(images);
    });
  });

  function wireThumbClicks(images) {
    el.querySelectorAll('.ig-thumb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-img-idx'), 10) || 0;
        openLightbox(images, idx);
      });
    });
  }

  wireThumbClicks(allImgs);
}

// ── Leverage points builder ───────────────────────────────────
function buildLeveragePoints(listing, scores, pricing) {
  var points = [];
  var dom = listing.days_on_market || 0;
  var _xilp = window.i18n;
  if (dom > 45) points.push({ cls: 'lp-strong',   strength: (_xilp ? _xilp.t('leverage.strength.strong') : 'Fuerte'),   text: dom + (_xilp ? ' ' + _xilp.t('leverage.point.dom-high') : ' días en mercado — el vendedor siente la presión del tiempo.') });
  else if (dom > 21) points.push({ cls: 'lp-moderate', strength: (_xilp ? _xilp.t('leverage.strength.moderate') : 'Moderado'), text: dom + (_xilp ? ' ' + _xilp.t('leverage.point.dom-mid') : ' días en mercado — presión de tiempo creciente.') });

  var ghost = (scores.ghost_probability || 0) * 100; // convert 0-1 to 0-100
  if (ghost > 60) points.push({ cls: 'lp-strong',   strength: (_xilp ? _xilp.t('leverage.strength.strong') : 'Fuerte'),   text: (_xilp ? _xilp.t('leverage.point.vacancy-high') : 'Riesgo de vacancia') + ' ' + Math.round(ghost) + (_xilp ? '% — ' + _xilp.t('leverage.point.vacancy-high-note') : '% — altas chances de que la unidad ya no esté disponible realmente.') });
  else if (ghost > 30) points.push({ cls: 'lp-moderate', strength: (_xilp ? _xilp.t('leverage.strength.moderate') : 'Moderado'), text: (_xilp ? _xilp.t('leverage.point.vacancy-mid') : 'Riesgo de vacancia') + ' ' + Math.round(ghost) + (_xilp ? '% — ' + _xilp.t('leverage.point.vacancy-mid-note') : '% — verifica disponibilidad antes de negociar.') });

  if (pricing.fair_low && listing.price > pricing.fair_low * 1.05) {
    points.push({ cls: 'lp-strong', strength: (_xilp ? _xilp.t('leverage.strength.strong') : 'Fuerte'), text: (_xilp ? _xilp.t('leverage.point.above-fair') : 'Precio') + ' ' + fmtMoney(listing.price) + (_xilp ? ' ' + _xilp.t('leverage.point.above-fair-note') : ' por encima del rango justo') + ' (' + fmtMoney(pricing.fair_low) + '). ' + (_xilp ? _xilp.t('leverage.point.negotiation-confirmed') : 'Espacio de negociación confirmado.') });
  }

  if (scores.value_score !== undefined && scores.value_score < 40) {
    points.push({ cls: 'lp-context', strength: (_xilp ? _xilp.t('leverage.strength.context') : 'Contexto'), text: (_xilp ? _xilp.t('leverage.point.low-value-score') : 'Score de valor bajo') + ' (' + Math.round(scores.value_score) + '/100) ' + (_xilp ? _xilp.t('leverage.point.low-value-note') : 'comparado con el mercado. Argumento de reducción de precio disponible.') });
  }

  return points;
}

function leverageVisualCard(title, value, sublabel, color) {
  return '<div class="drawer-visual-card">' +
    '<div class="drawer-visual-card-title">' + title + '</div>' +
    '<div class="drawer-visual-metric" style="color:' + color + '">' + value + '</div>' +
    '<div class="drawer-visual-sublabel">' + sublabel + '</div>' +
    '</div>';
}

function priceMarker(price, left, cls, label) {
  if (!price) return '';
  return '<div class="band-price-marker" style="left:' + left + '">' +
    '<div class="band-marker-line ' + cls + '"></div>' +
    '<div class="band-marker-label">' + label + '</div>' +
    '</div>';
}

// ── Price History Chart ────────────────────────────────────────
function renderPriceHistoryChart(history) {
  var canvas = document.getElementById('priceHistoryChart');
  if (!canvas) return;
  var style      = getComputedStyle(document.documentElement);
  var chartColor = style.getPropertyValue('--chart-1').trim() || '#1847c8';
  var textColor  = style.getPropertyValue('--color-text').trim();
  var mutedColor = style.getPropertyValue('--color-text-muted').trim();
  var divColor   = style.getPropertyValue('--color-border').trim();
  var surfColor  = style.getPropertyValue('--color-surface').trim();
  var successColor = style.getPropertyValue('--color-success').trim() || '#0a6630';
  var warningColor = style.getPropertyValue('--color-warning').trim() || '#924000';

  // Abbreviated Spanish date labels: "2026-03-14" -> "14 Mar"
  var MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var labels = history.map(function (h) {
    var parts = (h.date || '').split('-');
    if (parts.length === 3) {
      var m = parseInt(parts[1], 10) - 1;
      return parts[2] + ' ' + (MONTHS_ES[m] || parts[1]);
    }
    return h.date;
  });

  var prices = history.map(function(h){ return h.price; });
  var minP = Math.min.apply(null, prices);
  var maxP = Math.max.apply(null, prices);
  var pad  = (maxP - minP) * 0.18 || maxP * 0.05;

  // Color points: downward moves shown in success color, upward in warning
  var pointColors = prices.map(function(p, i) {
    if (i === 0) return chartColor;
    return p <= prices[i-1] ? successColor : warningColor;
  });

  getOrCreateChart('priceHistoryChart', {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Precio',
        data: prices,
        borderColor: chartColor,
        backgroundColor: chartColor + '12',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: prices.length <= 6 ? 5 : 3,
        pointHoverRadius: 8,
        pointBackgroundColor: pointColors,
        pointBorderColor: surfColor,
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surfColor,
          titleColor: textColor, bodyColor: textColor,
          borderColor: divColor, borderWidth: 1, padding: 10,
          titleFont: { weight: '600', size: 11 },
          callbacks: {
            label: function (ctx) {
              var p = ctx.parsed.y;
              var i = ctx.dataIndex;
              var diff = i > 0 ? p - prices[i-1] : null;
              var diffStr = diff !== null && diff !== 0
                ? ' (' + (diff < 0 ? '−' + fmtMoney(Math.abs(diff)) : '+' + fmtMoney(diff)) + ')'
                : '';
              return fmtMoney(p) + diffStr;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: mutedColor, font: { size: 10 }, maxRotation: 0 },
          border: { color: divColor }
        },
        y: {
          grid: { color: (divColor || '#8285a0') + '44', drawTicks: false },
          ticks: {
            color: mutedColor, font: { size: 10 },
            callback: function (v) { return fmtMoney(v); },
            maxTicksLimit: 4
          },
          border: { display: false },
          beginAtZero: false,
          suggestedMin: minP - pad,
          suggestedMax: maxP + pad
        }
      },
      animation: { duration: 600, easing: 'easeOutQuart' }
    }
  }, 'detail');
}
// ── Inquiry Form ──────────────────────────────────────────────
function renderInquiryForm(listing) {
  var section = document.getElementById('inquirySection');
  var _xii = window.i18n;
  section.innerHTML = '<div class="inquiry-form">' +
    '<h3>' + (_xii ? _xii.t('inquiry.title') : 'Log Agent Contact') + '</h3>' +
    '<div class="form-grid">' +
      formGroup('contact_name', (_xii ? _xii.t('inquiry.contact-name') : 'Contact name'), 'text') +
      formGroup('company', (_xii ? _xii.t('inquiry.company') : 'Company / Broker'), 'text') +
      formSelect('channel', (_xii ? _xii.t('inquiry.channel') : 'Channel'), [
        { v: 'whatsapp', l: 'WhatsApp' }, { v: 'phone', l: (_xii ? _xii.t('inquiry.channel.phone') : 'Teléfono') },
        { v: 'email', l: 'Email' }, { v: 'portal', l: 'Portal' },
      ]) +
      formSelect('claimed_status', (_xii ? _xii.t('inquiry.status') : 'Reported status'), [
        { v: 'available', l: (_xii ? _xii.t('inquiry.status.available') : 'Available') },
        { v: 'unavailable', l: (_xii ? _xii.t('inquiry.status.unavailable') : 'Unavailable') },
        { v: 'no_response', l: (_xii ? _xii.t('inquiry.status.no-response') : 'No response') },
        { v: 'changed_offer', l: (_xii ? _xii.t('inquiry.status.changed-offer') : 'Changed offer') },
      ]) +
      formGroup('response_hours', (_xii ? _xii.t('inquiry.response-hours') : 'Response time (hrs)'), 'number') +
      formGroup('price_quoted', (_xii ? _xii.t('inquiry.price-quoted') : 'Quoted asking rent'), 'number') +
    '</div>' +
    '<div style="display:flex;gap:var(--space-4);margin-top:var(--space-3);flex-wrap:wrap;">' +
      formCheckbox('provided_unit_number', (_xii ? _xii.t('inquiry.provided-unit') : 'Provided unit number')) +
      formCheckbox('provided_video', (_xii ? _xii.t('inquiry.provided-video') : 'Provided video')) +
      formCheckbox('provided_cost_breakdown', (_xii ? _xii.t('inquiry.provided-breakdown') : 'Provided cost breakdown')) +
    '</div>' +
    '<div class="form-grid" style="margin-top:var(--space-3);">' +
      '<div class="form-group" style="grid-column:1/-1;"><label for="inq_notes">' + (_xii ? _xii.t('inquiry.notes') : 'Notes') + '</label><textarea id="inq_notes" rows="2" placeholder="' + (_xii ? _xii.t('inquiry.notes-placeholder') : 'Observations…') + '"></textarea></div>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button class="btn-primary" id="submitInquiry">' + (_xii ? _xii.t('inquiry.submit') : 'Log contact') + '</button>' +
      '<button class="btn-secondary" id="clearInquiry">' + (_xii ? _xii.t('inquiry.clear') : 'Clear') + '</button>' +
    '</div></div>';

  document.getElementById('submitInquiry').addEventListener('click', async function () {
    var data = {
      listing_id: listing.id,
      contact_name:    valEl('inq_contact_name'),
      company:         valEl('inq_company'),
      channel:         valEl('inq_channel'),
      claimed_status:  valEl('inq_claimed_status'),
      response_hours:  parseFloat(valEl('inq_response_hours')) || null,
      price_quoted:    parseFloat(valEl('inq_price_quoted')) || null,
      provided_unit_number:    checkEl('inq_provided_unit_number'),
      provided_video:          checkEl('inq_provided_video'),
      provided_cost_breakdown: checkEl('inq_provided_cost_breakdown'),
      notes: valEl('inq_notes'),
    };
    try {
      var res  = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      var json = await res.json();
      if (json.ok) {
        showToast('Contacto registrado', 'success');
        ['contact_name','company','response_hours','price_quoted','notes'].forEach(function (f) {
          var el = document.getElementById('inq_' + f);
          if (el) el.value = '';
        });
      } else {
        showToast('Error: ' + (json.error || 'desconocido'), 'error');
      }
    } catch (e) { showToast('Error de red', 'error'); }
  });

  document.getElementById('clearInquiry').addEventListener('click', function () {
    section.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = el.tagName === 'SELECT' ? el.options[0].value : '';
    });
  });
}

function formGroup(id, label, type) {
  return '<div class="form-group"><label for="inq_' + id + '">' + label + '</label><input id="inq_' + id + '" type="' + type + '"></div>';
}
function formSelect(id, label, options) {
  return '<div class="form-group"><label for="inq_' + id + '">' + label + '</label><select id="inq_' + id + '">' +
    options.map(function (o) { return '<option value="' + o.v + '">' + o.l + '</option>'; }).join('') +
    '</select></div>';
}
function formCheckbox(id, label) {
  return '<div class="form-checkbox"><input type="checkbox" id="inq_' + id + '"><label for="inq_' + id + '">' + label + '</label></div>';
}
function valEl(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function checkEl(id) {
  var el = document.getElementById(id);
  return el ? el.checked : false;
}

// ── Operator View ─────────────────────────────────────────────
function renderOperatorView() {
  var ms = marketSummary;

  // Summary chips
  var strip = document.getElementById('opSummaryStrip');
  if (strip) {
    var neg  = ms.negotiate_count  || listingsData.filter(function(l){return (((l.intel||{}).status||{}).key)==='negotiate';}).length;
    var fast = ms.fast_move_count  || listingsData.filter(function(l){return (((l.intel||{}).status||{}).key)==='fast_move';}).length;
    var ver  = ms.verify_first_count || listingsData.filter(function(l){return (((l.intel||{}).status||{}).key)==='verify';}).length;
    var mon  = listingsData.filter(function(l){return (((l.intel||{}).status||{}).key)==='monitor';}).length;

    var _xio = window.i18n;
    strip.innerHTML =
      opChip(neg,  (_xio ? _xio.t('operator.chip.negotiate') : 'Negotiate'),        'op-chip-strong') +
      opChip(fast, (_xio ? _xio.t('operator.chip.fast') : 'Fast move'),     'op-chip-urgent') +
      opChip(ver,  (_xio ? _xio.t('operator.chip.verify') : 'Verify'),       'op-chip-caution') +
      opChip(mon,  (_xio ? _xio.t('operator.chip.monitor') : 'Monitor'),      'op-chip-neutral');
  }

  // BV callout — best value listing (canonical source of truth)
  var bvCallout = document.getElementById('opBvCallout');
  var canonicalBestId = getCanonicalBestId();
  var bestListing = canonicalBestId
    ? listingsData.find(function (l) { return l.id === canonicalBestId; })
    : null;
  if (bestListing && bvCallout) {
    bvCallout.style.display = 'flex';
    setText('opBvId',    bestListing.id || '');
    setText('opBvPrice', fmtMoney(bestListing.price || 0));
  }

  renderOperatorCards();
}

function opChip(count, label, cls) {
  return '<div class="op-summary-chip ' + cls + '"><span class="chip-count">' + count + '</span>' + label + '</div>';
}

function renderOperatorCards() {
  var container = document.getElementById('operatorCards');
  if (!container) return;

  // Sort all listings by action_score or composite_score
  var sorted = listingsData.slice().sort(function (a, b) {
    var sa = ((a.intel || {}).scores || {}).action_score || ((a.intel || {}).scores || {}).composite_score || 0;
    var sb = ((b.intel || {}).scores || {}).action_score || ((b.intel || {}).scores || {}).composite_score || 0;
    return sb - sa;
  });

  // Filter by activeOpFilter
  var filtered = sorted.filter(function (l) {
    if (activeOpFilter === 'all') return true;
    return (((l.intel || {}).status || {}).key) === activeOpFilter;
  });

  var _xioc = window.i18n;
  if (!filtered.length) {
    container.innerHTML = '<div class="op-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg><p>' + (_xioc ? _xioc.t('operator.empty') : 'No actions for this filter.') + '</p></div>';
    return;
  }

  // Group by action priority
  var groups = {};
  var ORDER = ['negotiate', 'fast_move', 'verify', 'monitor', 'avoid', ''];

  filtered.forEach(function (l) {
    var key = (((l.intel || {}).status || {}).key) || '';
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  });

  var html = '';

  ORDER.forEach(function (key) {
    if (!groups[key] || !groups[key].length) return;
    var _xiog = window.i18n;
    var groupLabel = {
      negotiate: (_xiog ? _xiog.t('operator.group.negotiate') : 'Negotiate now'),
      fast_move: (_xiog ? _xiog.t('operator.group.fast_move') : 'Fast move'),
      verify:    (_xiog ? _xiog.t('operator.group.verify') : 'Verify first'),
      monitor:   (_xiog ? _xiog.t('operator.group.monitor') : 'Monitor'),
      avoid:     (_xiog ? _xiog.t('operator.group.avoid') : 'Avoid'),
      '':        (_xiog ? _xiog.t('operator.group.uncategorized') : 'Uncategorized'),
    }[key] || key;

    var colorClass = {
      negotiate: 'color-strong',
      fast_move: 'color-urgent',
      verify:    'color-caution',
      monitor:   'color-neutral',
      avoid:     'color-neutral',
      '':        'color-neutral',
    }[key] || 'color-neutral';

    html += '<div class="op-group">';
    html += '<div class="op-group-label ' + colorClass + '">' + groupLabel +
      '<span class="op-group-count">' + groups[key].length + ' ' + (_xiog ? _xiog.t('operator.group.listings') : 'listings') + '</span></div>';

    groups[key].forEach(function (l, idx) {
      html += renderOpCard(l, colorClass, idx);
    });

    html += '</div>';
  });

  container.innerHTML = html;

  // Click / keyboard to detail
  container.querySelectorAll('.op-card').forEach(function (card) {
    card.setAttribute('tabindex', '0');
    function activate() {
      var lid = card.getAttribute('data-id');
      var listing = listingsData.find(function (l) { return l.id === lid; });
      if (listing) { currentListing = listing; showView('detail'); renderDetailView(listing); }
    }
    card.addEventListener('click', activate);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

function renderOpCard(l, colorCls, idx) {
  var scores  = (l.intel || {}).scores  || {};
  var status  = (l.intel || {}).status  || {};
  var actionScore = Math.round(scores.action_score || scores.composite_score || 0);
  var leverage    = Math.round(scores.leverage_score || 0);
  var actionLabel = status.label || status.key || 'Monitor';
  var bName = buildingsData[l.building] ? (buildingsData[l.building].short || buildingsData[l.building].name) : l.building;
  var _xir = window.i18n;
  var tierLabel = actionScore >= 70 ? (_xir ? _xir.t('score.tier.high') : 'High') : actionScore >= 45 ? (_xir ? _xir.t('score.tier.mid') : 'Mid') : (_xir ? _xir.t('score.tier.low') : 'Low');

  return '<div class="op-card ' + colorCls + '" data-id="' + l.id + '">' +
    '<div class="op-rank ' + colorCls + '">' + (idx + 1) + '</div>' +
    '<div class="op-card-body">' +
      '<div class="op-card-title">' + escapeHtml(l.title) + '</div>' +
      '<div class="op-card-reason">' + escapeHtml(bName) + ' · ' + (l.beds || '?') + ' ' + (_xir ? _xir.t('operator.card.beds') : 'bd') + ' · ' + (l.days_on_market || 0) + (_xir ? _xir.t('operator.card.dom') : 'd on market') + ' · $' + fmtNum(l.price_per_sqm || 0) + '/m²</div>' +
      '<div class="op-card-signals">' +
        (scores.leverage_score !== undefined ? '<span class="op-signal-pill">' + (_xir ? _xir.t('operator.card.leverage') : 'Leverage') + ' ' + leverage + '</span>' : '') +
        (scores.ghost_probability !== undefined && scores.ghost_probability > 0.40
          ? '<span class="op-signal-pill" style="background:var(--color-warning-bg);color:var(--color-warning);border-color:var(--color-warning-border);">' + (_xir ? _xir.t('operator.card.vacancy') : 'Vacancy') + ' ' + Math.round(scores.ghost_probability * 100) + '%</span>'
          : '') +
        (l.furnished ? '<span class="op-signal-pill">' + (_xir ? _xir.t('operator.card.furnished') : 'Furnished') + '</span>' : '') +
      '</div>' +
      '<div class="op-score-bar-wrap">' +
        '<div class="op-score-bar-track" title="Score: ' + actionScore + '/100 — ' + tierLabel + '"><div class="op-score-bar-fill" style="width:' + Math.min(100, actionScore) + '%;background:' + scoreColor(actionScore, false) + '"></div></div>' +
        '<span class="op-score-label">' + actionScore + '/100</span>' +
      '</div>' +
    '</div>' +
    '<div class="op-card-meta">' +
      '<div class="op-price" title="' + (_xir ? _xir.t('card.asking-rent') : 'Asking rent') + '">' + fmtMoney(l.price) + '</div>' +
      (((l.intel || {}).pricing || {}).target_close
        ? '<div class="op-target-close">' + (_xir ? _xir.t('operator.card.target') : 'Target') + ' ' + fmtMoney(((l.intel || {}).pricing || {}).target_close) + '</div>'
        : '') +
      '<div class="op-action-badge ' + colorCls + '">' + escapeHtml(actionLabel) + '</div>' +
    '</div>' +
  '</div>';
}

// ── Compare View ──────────────────────────────────────────────
function renderCompareView() {
  var sidebar = document.getElementById('compareSidebar');
  var crossSection = document.getElementById('crossTowerSection');

  var _xicmp = window.i18n;
  var categories = [
    { id: 'price_per_sqm',     label: (_xicmp ? _xicmp.t('compare.metric.price_per_sqm') : 'Rent psm'),         metric: 'price_per_sqm' },
    { id: 'price',             label: (_xicmp ? _xicmp.t('compare.metric.price') : 'Monthly rent'),              metric: 'price' },
    { id: 'composite_score',   label: (_xicmp ? _xicmp.t('compare.metric.composite_score') : 'Composite score'), metric: 'composite_score' },
    { id: 'value_score',       label: (_xicmp ? _xicmp.t('compare.metric.value_score') : 'Value score'),         metric: 'value_score' },
    { id: 'ghost_probability', label: (_xicmp ? _xicmp.t('compare.metric.ghost_probability') : 'Availability'),  metric: 'ghost_probability' },
    { id: 'leverage_score',    label: (_xicmp ? _xicmp.t('compare.metric.leverage_score') : 'Leverage score'),   metric: 'leverage_score' },
    { id: 'days_on_market',    label: (_xicmp ? _xicmp.t('compare.metric.days_on_market') : 'Days on market'),   metric: 'days_on_market' },
  ];

  sidebar.innerHTML = categories.map(function (c) {
    return '<button class="compare-category" data-group="' + c.id + '">' +
      escapeHtml(c.label) +
      '<span class="compare-category-count">' + listingsData.length + '</span></button>';
  }).join('');

  sidebar.querySelectorAll('.compare-category').forEach(function (btn) {
    btn.addEventListener('click', function () {
      sidebar.querySelectorAll('.compare-category').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var groupId = btn.getAttribute('data-group');
      var group   = categories.find(function (c) { return c.id === groupId; });
      if (group) {
        activeComparison = group;
        renderComparisonChart(group);

        // Show cross-tower section
        if (crossSection) {
          crossSection.style.display = 'block';
          renderCrossTower(group);
        }
      }
    });
  });
}

function renderCrossTower(group) {
  var grid = document.getElementById('crossTowerGrid');
  if (!grid) return;

  var towers = Object.keys(buildingsData);
  grid.innerHTML = towers.map(function (key) {
    var bListings = listingsData.filter(function (l) { return l.building === key; });
    var vals = bListings.map(function (l) { return getCompValue(l, group); }).filter(function (v) { return v > 0; });
    var median = vals.length ? vals.sort(function (a, b) { return a - b; })[Math.floor(vals.length / 2)] : 0;
    var bName = buildingsData[key] ? (buildingsData[key].short || buildingsData[key].name) : key;
    var style = getComputedStyle(document.documentElement);
    var bColor = style.getPropertyValue('--building-' + key).trim();
    return '<div class="ct-stat" style="border-top:2px solid ' + bColor + '">' +
      '<div class="ct-stat-val">' + fmtCompValue(median, group) + '</div>' +
      '<div class="ct-stat-label">' + escapeHtml(group.label) + '</div>' +
      '<div class="ct-stat-building">' + escapeHtml(bName) + '</div>' +
      '</div>';
  }).join('');
}

function renderComparisonChart(group) {
  destroyCharts();
  var main   = document.getElementById('compareMain');
  var style  = getComputedStyle(document.documentElement);
  var textColor  = style.getPropertyValue('--color-text').trim();
  var mutedColor = style.getPropertyValue('--color-text-muted').trim();
  var divColor   = style.getPropertyValue('--color-divider').trim();
  var surfColor  = style.getPropertyValue('--color-surface').trim();

  var buildingColors = {
    peninsula: style.getPropertyValue('--building-peninsula').trim(),
    torre300:  style.getPropertyValue('--building-torre300').trim(),
    paradox:   style.getPropertyValue('--building-paradox').trim(),
  };

  // Sort by value for better readability
  var sorted = listingsData.slice().sort(function (a, b) {
    return getCompValue(b, group) - getCompValue(a, group);
  });

  var labels = sorted.map(function (l) { return l.id + ' (' + (l.beds || '?') + 'R)'; });
  var data   = sorted.map(function (l) { return getCompValue(l, group); });
  var colors = sorted.map(function (l) { return (buildingColors[l.building] || '#6e728a') + 'cc'; });

  var _xicch = window.i18n;
  main.innerHTML =
    '<div class="compare-chart-title">' + escapeHtml(group.label) + '</div>' +
    '<div class="compare-chart-subtitle">' + (_xicch ? _xicch.t('compare.subtitle.all') : 'Operational benchmark · All listings by tower') + ' · ' + sorted.length + ' ' + (_xicch ? _xicch.t('compare.subtitle.units') : 'units') + '</div>' +
    '<div class="compare-chart-wrapper"><canvas id="compareChart"></canvas></div>';

  getOrCreateChart('compareChart', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: group.label,
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(function (c) { return c.slice(0, 7); }),
        borderWidth: 1.5,
        borderRadius: 3,
        barPercentage: 0.75,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surfColor,
          titleColor: textColor, bodyColor: textColor,
          borderColor: divColor, borderWidth: 1, padding: 12,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: function (ctx) { return fmtCompValue(ctx.parsed.x, group); }
          }
        }
      },
      scales: {
        x: { grid: { color: divColor + '40' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 }, callback: function (v) { return fmtCompValue(v, group); } }, border: { display: false } },
        y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, border: { color: divColor } },
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
    }
  }, 'compare');
}

function getCompValue(l, group) {
  if (group.metric === 'price_per_sqm')   return l.price_per_sqm || 0;
  if (group.metric === 'price')           return l.price || 0;
  if (group.metric === 'days_on_market')  return l.days_on_market || 0;
  if (l.intel && l.intel.scores) return l.intel.scores[group.metric] || 0;
  return 0;
}

function fmtCompValue(v, group) {
  if (group.metric === 'price_per_sqm' || group.metric === 'price') return fmtMoney(v);
  if (group.metric === 'days_on_market') return v + 'd';
  return Math.round(v);
}

// ── Agents / Scorecards View ──────────────────────────────────
function renderAgentsView() {
  var grid = document.getElementById('scorecardsGrid');
  var wrap = document.getElementById('agentsTableWrap');

  var _xia = window.i18n;
  if (!agentsData.length) {
    if (grid) grid.innerHTML = '';
    if (wrap) wrap.innerHTML = '<p style="padding:var(--space-6);color:var(--color-text-faint);">' + (_xia ? _xia.t('agents.empty') : 'No agent data yet. Log contacts to build the directory.') + '</p>';
    return;
  }

  // Broker scorecards (tracking.css style)
  if (grid) {
    grid.innerHTML = agentsData.map(function (a) {
      var score  = Math.round(a.credibility_score || 0);
      var riskCls = score >= 70 ? 'risk-low' : score >= 40 ? 'risk-medium' : 'risk-high';
      var riskLabel = score >= 70 ? (_xia ? _xia.t('agents.score.reliable') : 'Reliable') : score >= 40 ? (_xia ? _xia.t('agents.score.moderate') : 'Moderate') : (_xia ? _xia.t('agents.score.risk') : 'High risk');
      var syntheticBadge = a.synthetic
        ? '<span class="agent-source-badge estimado" title="' + (_xia ? _xia.t('agents.badge.estimated-title') : 'Score estimated from listing data, not verified') + '">' + (_xia ? _xia.t('agents.badge.estimated') : 'Estimated') + '</span>'
        : '';
      return '<div class="scorecard-card ' + riskCls + '">' +
        '<div class="scorecard-header">' +
          '<div class="scorecard-name">' + escapeHtml(a.name || a.slug || '') + syntheticBadge + '</div>' +
          '<div class="scorecard-risk-label">' + riskLabel + '</div>' +
        '</div>' +
        '<div class="scorecard-score-row">' +
          '<div class="scorecard-score-val">' + score + '</div>' +
          '<div class="scorecard-score-bar-wrap">' +
            '<div class="scorecard-score-bar-label">' + (_xia ? _xia.t('agents.stat.credibility') : 'Credibility / 100') + '</div>' +
            '<div class="scorecard-score-bar" title="' + (_xia ? _xia.t('agents.stat.credibility') : 'Credibility') + ': ' + score + '/100 — ' + riskLabel + '"><div class="scorecard-score-fill" style="width:' + score + '%"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="scorecard-stats">' +
          scorecardStat((_xia ? _xia.t('agents.stat.interactions') : 'Interactions'), a.interactions || 0) +
          scorecardStat((_xia ? _xia.t('agents.stat.contradictions') : 'Contradictions'), a.contradictions || 0) +
          scorecardStat((_xia ? _xia.t('agents.stat.listings') : 'Listings'), a.listing_count || 0) +
          scorecardStat((_xia ? _xia.t('agents.stat.trust') : 'Trust'), score + '/100') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // Fallback table
  if (wrap) {
    var html = '<table class="agents-table">' +
      '<thead><tr>' +
        '<th>' + (_xia ? _xia.t('agents.table.agent') : 'Agent') + '</th>' +
        '<th>' + (_xia ? _xia.t('agents.table.credibility') : 'Credibility') + '</th>' +
        '<th>' + (_xia ? _xia.t('agents.table.interactions') : 'Interactions') + '</th>' +
        '<th>' + (_xia ? _xia.t('agents.table.contradictions') : 'Contradictions') + '</th>' +
        '<th>' + (_xia ? _xia.t('agents.table.listings') : 'Listings') + '</th>' +
        '<th>' + (_xia ? _xia.t('agents.table.source') : 'Source') + '</th>' +
      '</tr></thead>' +
      '<tbody>';
    agentsData.forEach(function (a) {
      var credColor = a.credibility_score >= 70 ? 'var(--color-success)' : a.credibility_score >= 40 ? 'var(--color-warning)' : 'var(--color-error)';
      var fuenteBadge = a.synthetic
        ? '<span class="agent-source-badge estimado">' + (_xia ? _xia.t('agents.badge.estimated') : 'Estimated') + '</span>'
        : '<span class="agent-source-badge verificado">' + (_xia ? _xia.t('agents.badge.verified') : 'Verified') + '</span>';
      html += '<tr>' +
        '<td><strong>' + escapeHtml(a.name || a.slug || '') + '</strong></td>' +
        '<td><span class="credibility-badge" style="color:' + credColor + '">' + Math.round(a.credibility_score || 0) + '</span></td>' +
        '<td>' + (a.interactions || 0) + '</td>' +
        '<td>' + (a.contradictions || 0) + '</td>' +
        '<td>' + (a.listing_count || 0) + '</td>' +
        '<td>' + fuenteBadge + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }
}

function scorecardStat(label, value) {
  return '<div class="scorecard-stat-item">' +
    '<div class="scorecard-stat-label">' + label + '</div>' +
    '<div class="scorecard-stat-val">' + value + '</div>' +
    '</div>';
}

// ── Dashboard View ──────────────────────────────────────────────
// Merged from reference dashboard (MegaCap 50):
// - calcGrowth(), shouldBeginAtZero(), formatCompact() utilities
// - Chart card pattern with growth badges
// - Sector/building color coding in chart datasets
// - KPI cards with accent bars and delta badges
// - Multi-metric chart grid (score distribution, scatter, bar)

function calcGrowth(values) {
  if (!values || values.length < 2) return null;
  var first = values[0];
  var last  = values[values.length - 1];
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function shouldBeginAtZero(values) {
  if (!values || !values.length) return true;
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  if (max === 0) return true;
  return min / max > 0.3;
}

function formatCompact(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) {
    var kVal = val / 1000;
    return (kVal >= 10 ? kVal.toFixed(0) : kVal.toFixed(1)) + 'K';
  }
  if (val >= 100) return val.toFixed(0);
  if (val >= 1)   return val.toFixed(1);
  return val.toFixed(2);
}

function growthBadgeHtml(values) {
  var g = calcGrowth(values);
  if (g === null) return '';
  var cls = g >= 0 ? 'positive' : 'negative';
  return '<span class="dash-chart-growth ' + cls + '">' +
    (g >= 0 ? '▲ +' : '▼ ') + g.toFixed(1) + '%</span>';
}

function renderDashboardView() {
  // Guard: need data
  if (!listingsData.length) return;

  var style = getComputedStyle(document.documentElement);
  var chart1 = style.getPropertyValue('--chart-1').trim();
  var chart2 = style.getPropertyValue('--chart-2').trim();
  var chart3 = style.getPropertyValue('--chart-3').trim();
  var chart4 = style.getPropertyValue('--chart-4').trim();
  var chart5 = style.getPropertyValue('--chart-5').trim();
  var textColor  = style.getPropertyValue('--color-text').trim();
  var mutedColor = style.getPropertyValue('--color-text-muted').trim();
  var divColor   = style.getPropertyValue('--color-divider').trim();
  var surfColor  = style.getPropertyValue('--color-surface').trim();
  var bColors = {
    peninsula: style.getPropertyValue('--building-peninsula').trim(),
    torre300:  style.getPropertyValue('--building-torre300').trim(),
    paradox:   style.getPropertyValue('--building-paradox').trim(),
  };

  var ms = marketSummary;

  // ── Dashboard KPI row ─────────────────────────────────────────
  var kpiRow = document.getElementById('dashKpiRow');
  if (kpiRow) {
    var avgPsm = listingsData.length
      ? Math.round(listingsData.reduce(function (s, l) { return s + (l.price_per_sqm || 0); }, 0) / listingsData.length)
      : 0;
    var avgLev = listingsData.length
      ? Math.round(listingsData.reduce(function (s, l) { return s + (((l.intel || {}).scores || {}).leverage_score || 0); }, 0) / listingsData.length)
      : 0;
    var avgDom = listingsData.length
      ? Math.round(listingsData.reduce(function (s, l) { return s + (l.days_on_market || 0); }, 0) / listingsData.length)
      : 0;
    var ghostHigh = listingsData.filter(function (l) { return (((l.intel || {}).scores || {}).ghost_probability || 0) > 0.50; }).length;
    var negCount  = ms.negotiate_count || listingsData.filter(function (l) { return (((l.intel || {}).status || {}).key) === 'negotiate'; }).length;
    var towers    = Object.keys(buildingsData).length;

    var _xidash = window.i18n;
    var kpis = [
      { label: (_xidash ? _xidash.t('dashboard.kpi.total-listings') : 'Active listings'), value: listingsData.length, cls: '', accent: chart1 },
      { label: (_xidash ? _xidash.t('kpi.median-price') : 'Median asking rent'), value: fmtMoney(ms.median_price || 0), cls: '', accent: chart2 },
      { label: (_xidash ? _xidash.t('kpi.avg-psm') : 'Avg. rent psm'), value: fmtMoney(avgPsm), cls: '', accent: chart3 },
      { label: (_xidash ? _xidash.t('dashboard.kpi.negotiable') : 'Negotiable'), value: negCount, cls: negCount > 0 ? 'success' : '', accent: style.getPropertyValue('--color-success').trim() },
      { label: (_xidash ? _xidash.t('kpi.avg-leverage') : 'Avg. leverage'), value: avgLev, cls: avgLev >= 55 ? 'success' : avgLev >= 35 ? 'warning' : '', accent: chart4 },
      { label: (_xidash ? _xidash.t('kpi.avg-dom') : 'Avg. DOM'), value: avgDom + 'd', cls: '', accent: chart5 },
      { label: (_xidash ? _xidash.t('kpi.high-vacancy') : 'High vacancy risk'), value: ghostHigh, cls: ghostHigh > 0 ? 'warning' : '', accent: style.getPropertyValue('--color-warning').trim() },
      { label: (_xidash ? _xidash.t('dashboard.kpi.towers') : 'Towers'), value: towers, cls: '', accent: chart1 },
    ];

    kpiRow.innerHTML = kpis.map(function (k) {
      var accentStyle = '--dash-accent:' + k.accent + ';';
      return '<div class="dash-kpi-card accent-always" style="' + accentStyle + '">' +
        '<div class="dash-kpi-label">' + k.label + '</div>' +
        '<div class="dash-kpi-value' + (k.cls ? ' ' + k.cls : '') + '">' + k.value + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Building metrics cards ────────────────────────────────────
  var bMetrics = document.getElementById('dashBuildingMetrics');
  if (bMetrics) {
    bMetrics.innerHTML = Object.keys(buildingsData).map(function (key) {
      var b = buildingsData[key];
      var ts = towerSummary[key] || {};
      var bListings = listingsData.filter(function (l) { return l.building === key; });
      var avgScore = bListings.length
        ? Math.round(bListings.reduce(function (s, l) { return s + (((l.intel || {}).scores || {}).composite_score || 0); }, 0) / bListings.length)
        : 0;
      var avgLeverage = bListings.length
        ? Math.round(bListings.reduce(function (s, l) { return s + (((l.intel || {}).scores || {}).leverage_score || 0); }, 0) / bListings.length)
        : 0;
      var color = bColors[key] || chart1;
      return '<div class="dash-building-card" style="--dash-building-color:' + color + '">' +
        '<div class="dash-building-name">' + escapeHtml(b.name || key) + '</div>' +
        '<div class="dash-building-stats">' +
          dashBStat((_xidash ? _xidash.t('dashboard.building.listings') : 'Listings'), ts.count || bListings.length) +
          dashBStat((_xidash ? _xidash.t('dashboard.building.median') : 'Median asking rent'), fmtMoney(ts.median_price || 0)) +
          dashBStat((_xidash ? _xidash.t('kpi.avg-psm') : 'Avg. rent psm'), fmtMoney(ts.median_price_per_sqm || 0)) +
          dashBStat((_xidash ? _xidash.t('compare.metric.composite_score') : 'Composite score'), avgScore + '/100') +
          dashBStat((_xidash ? _xidash.t('kpi.avg-leverage') : 'Avg. leverage'), avgLeverage + '/100') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Score Charts ─────────────────────────────────────────────
  // Destroy only dashboard-tagged charts via registry
  destroyChartsByTag('dashboard');

  var commonTooltip = {
    backgroundColor: surfColor,
    titleColor: textColor,
    bodyColor: textColor,
    borderColor: divColor,
    borderWidth: 1,
    padding: 10,
    titleFont: { family: 'Inter', weight: '600' },
    bodyFont: { family: 'JetBrains Mono', size: 11 },
  };

  // 1. Composite Score bar chart (all listings, colored by building)
  if (document.getElementById('dashCompositeChart')) {
    var sortedByScore = listingsData.slice().sort(function (a, b) {
      return (((b.intel || {}).scores || {}).composite_score || 0) -
             (((a.intel || {}).scores || {}).composite_score || 0);
    });
    var compositeValues = sortedByScore.map(function (l) {
      return ((l.intel || {}).scores || {}).composite_score || 0;
    });
    getOrCreateChart('dashCompositeChart', {
      type: 'bar',
      data: {
        labels: sortedByScore.map(function (l) { return l.id; }),
        datasets: [{
          data: compositeValues,
          backgroundColor: sortedByScore.map(function (l) {
            return (bColors[l.building] || chart1) + 'cc';
          }),
          borderColor: sortedByScore.map(function (l) {
            return bColors[l.building] || chart1;
          }),
          borderWidth: 1.5,
          borderRadius: 3,
          barPercentage: 0.75,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: Object.assign({}, commonTooltip, {
          callbacks: { label: function (ctx) { return 'Score: ' + ctx.parsed.y; } }
        }) },
        scales: {
          x: { grid: { display: false }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 45 }, border: { color: divColor } },
          y: { grid: { color: divColor + '50' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 } }, border: { display: false }, min: 0, max: 100 }
        },
        animation: { duration: 700, easing: 'easeOutQuart' }
      }
    }, 'dashboard');
  }

  // 2. Leverage vs. DOM scatter chart
  if (document.getElementById('dashLeverageChart')) {
    var scatterDatasets = Object.keys(bColors).map(function (key, i) {
      var color = bColors[key] || chart1;
      var bName = buildingsData[key] ? (buildingsData[key].short || buildingsData[key].name) : key;
      return {
        label: bName,
        data: listingsData.filter(function (l) { return l.building === key; }).map(function (l) {
          return {
            x: l.days_on_market || 0,
            y: ((l.intel || {}).scores || {}).leverage_score || 0,
          };
        }),
        backgroundColor: color + 'bb',
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 6,
        pointHoverRadius: 9,
      };
    });

    getOrCreateChart('dashLeverageChart', {
      type: 'scatter',
      data: { datasets: scatterDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, padding: 12, usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 } }
          },
          tooltip: Object.assign({}, commonTooltip, {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': DOM=' + ctx.parsed.x + 'd, Leverage=' + ctx.parsed.y;
              }
            }
          })
        },
        scales: {
          x: { title: { display: true, text: (_xidash ? _xidash.t('detail.meta.dom') : 'Days on Market'), color: mutedColor, font: { family: 'Inter', size: 10 } }, grid: { color: divColor + '40' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 } }, border: { color: divColor } },
          y: { title: { display: true, text: (_xidash ? _xidash.t('score.leverage') : 'Leverage score'), color: mutedColor, font: { family: 'Inter', size: 10 } }, grid: { color: divColor + '40' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 } }, border: { display: false }, min: 0, max: 100 }
        },
        animation: { duration: 700, easing: 'easeOutQuart' }
      }
    }, 'dashboard');
  }

  // 3. Price per sqm distribution by building (grouped bars)
  if (document.getElementById('dashPsmChart')) {
    var towerKeys = Object.keys(buildingsData);
    var psmDatasets = towerKeys.map(function (key) {
      var color = bColors[key] || chart1;
      var bName = buildingsData[key] ? (buildingsData[key].short || buildingsData[key].name) : key;
      var bListings = listingsData.filter(function (l) { return l.building === key; });
      return {
        label: bName,
        data: bListings.map(function (l) { return l.price_per_sqm || 0; }),
        backgroundColor: color + 'bb',
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 3,
        barPercentage: 0.7,
      };
    });

    // Use max length for labels
    var maxCount = towerKeys.reduce(function (m, k) {
      return Math.max(m, listingsData.filter(function (l) { return l.building === k; }).length);
    }, 0);
    var psmLabels = Array.from({ length: maxCount }, function (_, i) { return 'L' + (i + 1); });

    getOrCreateChart('dashPsmChart', {
      type: 'bar',
      data: { labels: psmLabels, datasets: psmDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, padding: 12, usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 } }
          },
          tooltip: Object.assign({}, commonTooltip, {
            callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y) + '/m²'; } }
          })
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 } }, border: { color: divColor } },
          y: { grid: { color: divColor + '50' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 }, callback: function (v) { return '$' + formatCompact(v); } }, border: { display: false }, beginAtZero: true }
        },
        animation: { duration: 700, easing: 'easeOutQuart' }
      }
    }, 'dashboard');
  }

  // 4. Ghost probability horizontal bar
  if (document.getElementById('dashGhostChart')) {
    var ghostSorted = listingsData.slice().sort(function (a, b) {
      return (((b.intel || {}).scores || {}).ghost_probability || 0) -
             (((a.intel || {}).scores || {}).ghost_probability || 0);
    }).slice(0, 20); // Top 20 highest risk

    var ghostValues = ghostSorted.map(function (l) {
      return ((l.intel || {}).scores || {}).ghost_probability || 0;
    });
    var ghostColors = ghostSorted.map(function (l) {
      var g = ((l.intel || {}).scores || {}).ghost_probability || 0;
      return g > 60 ? style.getPropertyValue('--color-error').trim() + 'cc'
           : g > 35 ? style.getPropertyValue('--color-warning').trim() + 'cc'
           : (bColors[l.building] || chart1) + 'cc';
    });

    getOrCreateChart('dashGhostChart', {
      type: 'bar',
      data: {
        labels: ghostSorted.map(function (l) { return l.id; }),
        datasets: [{
          data: ghostValues,
          backgroundColor: ghostColors,
          borderColor: ghostColors.map(function (c) { return c.slice(0, 7); }),
          borderWidth: 1.5,
          borderRadius: 3,
          barPercentage: 0.7,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: Object.assign({}, commonTooltip, {
          callbacks: { label: function (ctx) { return 'Vacancia: ' + ctx.parsed.x.toFixed(1) + '%'; } }
        }) },
        scales: {
          x: { grid: { color: divColor + '40' }, ticks: { color: mutedColor, font: { family: 'JetBrains Mono', size: 10 }, callback: function (v) { return v + '%'; } }, border: { display: false }, min: 0, max: 100 },
          y: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, border: { color: divColor } }
        },
        animation: { duration: 700, easing: 'easeOutQuart' }
      }
    }, 'dashboard');
  }

  // Update subtitle
  var _xids2 = window.i18n;
  setText('dashboardSubtitle', listingsData.length + ' ' + (_xids2 ? _xids2.t('dashboard.kpi.total-listings') : 'listings') + ' · ' + Object.keys(buildingsData).length + ' ' + (_xids2 ? _xids2.t('dashboard.buildings') : 'buildings') + ' · ' + (_xids2 ? _xids2.t('dashboard.updated') : 'Updated now'));
}

function dashBStat(label, value) {
  return '<div class="dash-bstat">' +
    '<span class="dash-bstat-label">' + label + '</span>' +
    '<span class="dash-bstat-value">' + value + '</span>' +
    '</div>';
}

// ── Utility functions ─────────────────────────────────────────

function metaItem(label, value) {
  return '<div class="detail-meta-item">' +
    '<span class="detail-meta-label">' + label + '</span>' +
    '<span class="detail-meta-value">' + escapeHtml(String(value)) + '</span></div>';
}

function bandAnchor(value, label) {
  return '<div class="band-anchor">' +
    '<div class="band-anchor-value">' + value + '</div>' +
    '<div class="band-anchor-label">' + label + '</div></div>';
}

function intelCardHtml(title, content) {
  return '<div class="intel-card"><h3>' + escapeHtml(title) + '</h3><div class="intel-card-content">' + content + '</div></div>';
}

function destroyCharts() {
  // Delegate to destroyAllCharts which handles both the registry and the instance array
  destroyAllCharts();
}

function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  // Delegate to i18n formatter so numbers use the active locale style
  if (window.i18n) return window.i18n.formatNum(n);
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Shorthand: format a MXN base amount as full currency string in active locale
function fmtMoney(mxnAmount) {
  if (window.i18n) return window.i18n.formatMoney(mxnAmount);
  return '$' + fmtNum(mxnAmount);
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    var d = new Date(ts);
    var _ftLoc = window.i18n ? window.i18n.getLocale() : 'es-MX';
    return d.toLocaleDateString(_ftLoc, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(_ftLoc, { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return String(ts).substring(0, 16); }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Start ─────────────────────────────────────────────────────
loadData();

// ── Map View ──────────────────────────────────────────────────
var mapInstance = null;
var mapMarkers = [];
var mapPopupInstance = null;
var activeMapFilter = 'all';

// Known tower coordinates in Santa Fe, CDMX
var TOWER_COORDS = {
  peninsula: { lng: -99.2602, lat: 19.3617, label: 'Península' },
  torre300:  { lng: -99.2581, lat: 19.3631, label: 'Torre 300' },
  paradox:   { lng: -99.2558, lat: 19.3598, label: 'Paradox'   },
};

// Reliable inline MapLibre styles using public raster tiles
var MAP_STYLES = {
  dark: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-brightness-max': 0.42, 'raster-saturation': -0.7, 'raster-contrast': 0.15 } }
    ]
  },
  streets: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' }
    ]
  },
  satellite: {
    version: 8,
    sources: {
      osmhot: {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png','https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, HOT'
      }
    },
    layers: [
      { id: 'osmhot', type: 'raster', source: 'osmhot', paint: { 'raster-saturation': -0.15, 'raster-contrast': 0.08 } }
    ]
  }
};

var activeMapLayer = 'streets';

function getMapStyle(layer) {
  return MAP_STYLES[layer] || MAP_STYLES.streets;
}

function renderMapView() {
  // Set up legend toggle
  var legend = document.getElementById('mapLegend');
  var legendToggle = document.getElementById('mapLegendToggle');
  if (legendToggle && !legendToggle._sfBound) {
    legendToggle._sfBound = true;
    legendToggle.addEventListener('click', function () {
      legend.classList.toggle('expanded');
      legendToggle.setAttribute('aria-expanded', legend.classList.contains('expanded') ? 'true' : 'false');
    });
    legendToggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); legendToggle.click(); }
    });
  }

  // Map layer toggle
  document.querySelectorAll('[data-layer]').forEach(function (btn) {
    if (btn._sfLayerBound) return;
    btn._sfLayerBound = true;
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-layer]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeMapLayer = btn.getAttribute('data-layer');
      if (mapInstance) {
        mapInstance.setStyle(getMapStyle(activeMapLayer));
        mapInstance.once('styledata', function () { addMapMarkers(); });
      }
    });
  });

  // Map building filter
  document.querySelectorAll('[data-map-filter]').forEach(function (btn) {
    if (btn._sfMapFilterBound) return;
    btn._sfMapFilterBound = true;
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-map-filter]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeMapFilter = btn.getAttribute('data-map-filter');
      updateMapMarkerVisibility();
      updateMapListingCount();
    });
  });

  // Fit/center button
  var fitBtn = document.getElementById('mapFitBtn');
  if (fitBtn && !fitBtn._sfFitBound) {
    fitBtn._sfFitBound = true;
    fitBtn.addEventListener('click', function () {
      if (mapInstance) {
        mapInstance.flyTo({ center: [-99.2581, 19.3620], zoom: 14.5, duration: 900 });
      }
    });
  }

  updateMapListingCount();

  // Initialize map if not yet done
  if (!mapInstance) {
    initMap();
  } else {
    setTimeout(function () { mapInstance.resize(); }, 50);
  }
}

function updateMapListingCount() {
  var el = document.getElementById('mapListingCount');
  if (!el) return;
  var count = activeMapFilter === 'all'
    ? listingsData.length
    : listingsData.filter(function (l) { return l.building === activeMapFilter; }).length;
  var _ximaps = window.i18n;
  el.textContent = count + ' ' + (_ximaps ? _ximaps.t('map.listings-count') : 'listings');
}

var _mapInitRetries = 0;
var _mapResizeTimer = null;

function initMap() {
  if (typeof maplibregl === 'undefined') {
    _mapInitRetries++;
    var canvas = document.getElementById('mapCanvas');
    if (_mapInitRetries === 1 && canvas) {
      var _ximap = window.i18n;
      canvas.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:var(--text-sm);"><span>' + (_ximap ? _ximap.t('map.loading') : 'Loading map…') + '</span></div>';
    }
    if (_mapInitRetries < 12) {
      setTimeout(function () { if (currentView === 'map') initMap(); }, 1500);
    } else {
      renderStaticMapFallback();
    }
    return;
  }
  _mapInitRetries = 0;

  // Ensure container has dimensions before init to prevent blank canvas
  var canvas = document.getElementById('mapCanvas');
  if (canvas) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      requestAnimationFrame(function () {
        if (currentView === 'map') initMap();
      });
      return;
    }
  }

  try {
    mapInstance = new maplibregl.Map({
      container: 'mapCanvas',
      style: getMapStyle(activeMapLayer),
      center: [-99.2581, 19.3620],
      zoom: 14.5,
      attributionControl: false,
      fadeDuration: 200,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    mapInstance.on('load', function () {
      addMapMarkers();
      // Force resize after load to fill container correctly
      setTimeout(function () { if (mapInstance) mapInstance.resize(); }, 50);
    });

    // Suppress tile errors without showing black canvas
    mapInstance.on('error', function (e) {
      if (e && e.error && e.error.status === 0) return; // network offline
      console.warn('MapLibre tile error:', e && e.error && e.error.message);
    });

    // Guard against style-switch leaving map blank
    mapInstance.on('styledata', function () {
      if (_mapResizeTimer) clearTimeout(_mapResizeTimer);
      _mapResizeTimer = setTimeout(function () {
        if (mapInstance) mapInstance.resize();
      }, 80);
    });

  } catch (err) {
    console.error('Map init failed:', err);
    renderStaticMapFallback();
  }
}

function renderStaticMapFallback() {
  // Clean schematic fallback when MapLibre cannot initialize
  var canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;background:var(--color-surface-alt);">' +
    '<svg width="300" height="180" viewBox="0 0 300 180" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<line x1="0" y1="90" x2="300" y2="90" stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="4,4"/>' +
    '<line x1="150" y1="0" x2="150" y2="180" stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="4,4"/>' +
    '<text x="290" y="16" font-size="8" fill="var(--color-text-faint)" text-anchor="middle" font-weight="600">N ↑</text>' +
    '<circle cx="150" cy="88" r="7" fill="var(--building-torre300, #c47800)" opacity="0.85"/>' +
    '<text x="150" y="110" font-size="9" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">Torre 300</text>' +
    '<circle cx="82" cy="100" r="7" fill="var(--building-peninsula, #0095a8)" opacity="0.85"/>' +
    '<text x="82" y="122" font-size="9" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">Península</text>' +
    '<circle cx="220" cy="108" r="7" fill="var(--building-paradox, #6a18c8)" opacity="0.85"/>' +
    '<text x="220" y="130" font-size="9" fill="var(--color-text-muted)" text-anchor="middle" font-weight="600">Paradox</text>' +
    '<line x1="82" y1="100" x2="150" y2="88" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3"/>' +
    '<line x1="150" y1="88" x2="220" y2="108" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3"/>' +
    '</svg>' +
    '<div style="font-size:11px;color:var(--color-text-faint);text-align:center;line-height:1.7;">' +
    'Santa Fe, CDMX · Vista esquemática<br>' +
    '<span style="font-size:9px;">Mapa interactivo requiere conexión activa</span>' +
    '</div>' +
    '</div>';
}

function buildingColorVar(key) {
  var style = getComputedStyle(document.documentElement);
  var c = style.getPropertyValue('--building-' + key).trim();
  return c || '#6e728a';
}

function addMapMarkers() {
  // Remove old markers
  mapMarkers.forEach(function (m) { m.remove(); });
  mapMarkers = [];
  if (mapPopupInstance) { mapPopupInstance.remove(); mapPopupInstance = null; }

  // Add tower markers first
  Object.keys(TOWER_COORDS).forEach(function (key) {
    var tc = TOWER_COORDS[key];
    var color = buildingColorVar(key);

    var el = document.createElement('div');
    el.className = 'map-tower-marker';
    el.setAttribute('data-building', key);
    el.innerHTML =
      '<div class="tower-pin" style="background:' + color + ';"></div>' +
      '<span class="tower-label">' + escapeHtml(tc.label) + '</span>';

    var bData = buildingsData[key] || {};
    var ts = towerSummary[key] || {};

    (function(k, bD, tS, tcRef, colorRef) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (mapPopupInstance) { mapPopupInstance.remove(); }
        // Tower decision context
        var tListings = listingsData.filter(function(l){ return l.building === k; });
        var tDomValues = tListings.map(function(l){ return l.days_on_market || 0; });
        var tMedianDom = tDomValues.length
          ? Math.round(tDomValues.reduce(function(a,b){return a+b;},0) / tDomValues.length)
          : 0;
        var mktPsm = marketSummary.median_price_per_sqm || 0;
        var tPsm = tS.median_price_per_sqm || 0;
        var tDeltaPct = (mktPsm > 0 && tPsm > 0)
          ? Math.round(((tPsm - mktPsm) / mktPsm) * 100)
          : null;
        var tDeltaStr = tDeltaPct !== null
          ? (tDeltaPct >= 0 ? '+' : '') + tDeltaPct + '% Santa Fe'
          : '';
        var tDeltaCls = tDeltaPct === null ? '' : tDeltaPct <= -3 ? 'map-delta-below' : tDeltaPct >= 5 ? 'map-delta-above' : 'map-delta-neutral';

        var _xipu = window.i18n;
        var popupHtml =
          '<div class="map-tower-popup">' +
            '<div class="map-tower-popup-name">' + escapeHtml(bD.name || tcRef.label) + '</div>' +
            '<div class="map-tower-popup-address">' + escapeHtml(bD.address || '') + '</div>' +
            '<div class="map-tower-popup-stats">' +
              '<div class="map-tower-popup-stat">' +
                '<div class="map-tower-popup-stat-val">' + (tS.count || 0) + '</div>' +
                '<div class="map-tower-popup-stat-label">' + (_xipu ? _xipu.t('map.popup.listings') : 'Listings') + '</div>' +
              '</div>' +
              '<div class="map-tower-popup-stat">' +
                '<div class="map-tower-popup-stat-val">' + fmtMoney(tPsm) + '</div>' +
                '<div class="map-tower-popup-stat-label">' + (_xipu ? _xipu.t('map.popup.psm') : 'Rent psm') + '</div>' +
              '</div>' +
              '<div class="map-tower-popup-stat">' +
                '<div class="map-tower-popup-stat-val">' + tMedianDom + 'd</div>' +
                '<div class="map-tower-popup-stat-label">' + (_xipu ? _xipu.t('map.popup.dom') : 'Median DOM') + '</div>' +
              '</div>' +
            '</div>' +
            (tDeltaStr ? '<div class="map-tower-delta ' + tDeltaCls + '">' + tDeltaStr + ' ' + (_xipu ? _xipu.t('map.popup.psm-delta') : 'vs. mkt psm') + '</div>' : '') +
          '<button class="map-popup-action" data-building-filter="' + k + '">' + (_xipu ? _xipu.t('map.popup.view-listings') : 'View tower listings') + '</button>' +
          '</div>';

        mapPopupInstance = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat([tcRef.lng, tcRef.lat])
          .setHTML(popupHtml)
          .addTo(mapInstance);

        var actionBtn = mapPopupInstance.getElement().querySelector('.map-popup-action');
        if (actionBtn) {
          actionBtn.addEventListener('click', function () {
            showView('overview');
            document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
            var chip = document.querySelector('.filter-chip[data-filter="' + k + '"]');
            if (chip) chip.classList.add('active');
            activeFilter = k;
            renderOverview();
          });
        }
      });
    })(key, bData, ts, tc, color);

    var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([tc.lng, tc.lat])
      .addTo(mapInstance);

    marker._sfBuilding = key;
    mapMarkers.push(marker);
  });

  // Add listing bubbles
  var listingsByBuilding = {};
  listingsData.forEach(function (l) {
    if (!listingsByBuilding[l.building]) listingsByBuilding[l.building] = [];
    listingsByBuilding[l.building].push(l);
  });

  listingsData.forEach(function (listing) {
    var key = listing.building;
    var tc = TOWER_COORDS[key];
    if (!tc) return;

    var siblings = listingsByBuilding[key] || [];
    var idx = siblings.indexOf(listing);
    var total = siblings.length;
    var angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
    // Use two concentric rings to reduce marker overlap
    var ring = Math.floor(idx / Math.max(1, Math.ceil(total / 2)));
    var radius = 0.0009 + ring * 0.0005;
    var lng = tc.lng + Math.cos(angle) * radius;
    var lat = tc.lat + Math.sin(angle) * radius * 0.7;

    var scores = (listing.intel || {}).scores || {};
    var conf = scores.confidence_score || 50;
    var confClass = conf >= 70 ? 'conf-high' : conf >= 45 ? 'conf-mid' : 'conf-low';

    var status = (listing.intel || {}).status || {};
    var isFastMove = status.key === 'fast_move';
    var isVerify   = status.key === 'verify_first';
    var statusClass = isFastMove ? ' status-fast-move' : isVerify ? ' status-verify' : '';

    // Show short monthly price in MXN (e.g. $62k for 62,000 MXN/mo)
    var priceLabel = '$' + Math.round((listing.price || 0) / 1000) + 'k';

    var el = document.createElement('div');
    el.className = 'map-listing-marker';
    el.setAttribute('data-building', key);
    el.setAttribute('data-id', listing.id);
    el.innerHTML = '<div class="listing-bubble ' + confClass + statusClass + '"><span class="listing-bubble-price">' + escapeHtml(priceLabel) + '</span></div>';

    (function(lst, lngV, latV, cfClass, fM, vr) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        mapMarkers.forEach(function (m) {
          if (m._sfListingId) {
            var b = m.getElement().querySelector('.listing-bubble');
            if (b) b.classList.remove('selected');
          }
        });
        el.querySelector('.listing-bubble').classList.add('selected');

        if (mapPopupInstance) { mapPopupInstance.remove(); }

        var sc = (lst.intel || {}).scores || {};
        var cf = sc.confidence_score || 50;
        var _xicf = window.i18n;
        var cfLbl = cf >= 70 ? (_xicf ? _xicf.t('score.tier.high') : 'High') : cf >= 45 ? (_xicf ? _xicf.t('score.tier.mid') : 'Mid') : (_xicf ? _xicf.t('score.tier.low') : 'Low');
        var stKey = ((lst.intel || {}).status || {}).key || '';

        // Compute decision metrics for popup
        var peerPsm = (((lst.intel || {}).peer_group || {}).median_price_per_sqm)
          || (((lst.intel || {}).building_context || {}).median_price_per_sqm)
          || (marketSummary.median_price_per_sqm) || 0;
        var lstPsm = lst.price_per_sqm || 0;
        var deltaPct = peerPsm > 0 ? Math.round(((lstPsm - peerPsm) / peerPsm) * 100) : null;
        var deltaStr = deltaPct !== null
          ? (deltaPct >= 0 ? '+' : '') + deltaPct + '% vs mediana'
          : null;
        var deltaCls = deltaPct !== null
          ? (deltaPct <= -3 ? 'map-delta-below' : deltaPct >= 5 ? 'map-delta-above' : 'map-delta-neutral')
          : '';
        var dom = lst.days_on_market || 0;
        var leverage = Math.round(sc.leverage_score || 0);
        var conf = Math.round(sc.confidence_score || cf);

        var popupHtml =
          '<div class="map-popup">' +
            '<div class="map-popup-header">' +
              '<span class="map-popup-building-tag">' + escapeHtml((buildingsData[lst.building] || {}).short || lst.building) + '</span>' +
              (fM ? '<span class="map-popup-status-tag status-fast">Mover rápido</span>' : '') +
              (vr ? '<span class="map-popup-status-tag status-verify">Verificar</span>' : '') +
            '</div>' +
            '<div class="map-popup-title">' + escapeHtml(lst.title || lst.id) + '</div>' +
            '<div class="map-popup-price-row">' +
              '<span class="map-popup-price">' + fmtMoney(lst.price) + '</span>' +
              '<span class="map-popup-psm">' + fmtMoney(lstPsm) + '/m²</span>' +
              (deltaStr ? '<span class="map-popup-delta ' + deltaCls + '">' + deltaStr + '</span>' : '') +
            '</div>' +
            '<div class="map-popup-metrics">' +
              '<div class="map-metric"><div class="map-metric-val">' + dom + 'd</div><div class="map-metric-lbl">DOM</div></div>' +
              '<div class="map-metric"><div class="map-metric-val">' + leverage + '</div><div class="map-metric-lbl">Leverage</div></div>' +
              '<div class="map-metric"><div class="map-metric-val ' + cfClass + '">' + conf + '%</div><div class="map-metric-lbl">Confianza</div></div>' +
              '<div class="map-metric"><div class="map-metric-val">' + (lst.beds || '—') + 'R</div><div class="map-metric-lbl">Rec.</div></div>' +
            '</div>' +
          '<button class="map-popup-action" data-listing-id="' + lst.id + '">Ver análisis completo</button>' +
          '</div>';

        mapPopupInstance = new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat([lngV, latV])
          .setHTML(popupHtml)
          .addTo(mapInstance);

        var actionBtn = mapPopupInstance.getElement().querySelector('.map-popup-action');
        if (actionBtn) {
          actionBtn.addEventListener('click', function () {
            currentListing = lst;
            showView('detail');
            renderDetailView(lst);
          });
        }
      });
    })(listing, lng, lat, confClass, isFastMove, isVerify);

    var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(mapInstance);

    marker._sfBuilding = key;
    marker._sfListingId = listing.id;
    mapMarkers.push(marker);
  });

  updateMapMarkerVisibility();
}

function updateMapMarkerVisibility() {
  mapMarkers.forEach(function (m) {
    var el = m.getElement();
    var key = el.getAttribute('data-building');
    var visible = activeMapFilter === 'all' || key === activeMapFilter;
    el.style.display = visible ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
//  TRACKING & COLLECTION VIEW
//  Endpoints: /api/alerts, /api/watch-state, /api/event-log,
//             /api/snapshots, /api/collect
// ══════════════════════════════════════════════════════════════

var trackingActiveTab   = 'alerts';
var trackingAlertFilter = 'all';
var trackingEventFilter = 'all';
var trackingEventOffset = 0;
var TRACKING_PAGE_SIZE  = 30;

// ── Main entry for tracking view ───────────────────────────────
async function renderTrackingView() {
  await loadTrackingAlerts();
  setupTrackingTabs();
  setupAlertFilters();
  setupEventFilters();
  setupCollectButton();
  updateTrackingAlertDot();

  var btn = document.getElementById('run-collect-btn');
  var tsEl = document.getElementById('verifyLastRunTs');
  var backendReady = false;
  try {
    var probe = await apiFetch('/api/alerts', { noCache: true });
    backendReady = !!probe && typeof probe === 'object';
  } catch (e) {
    backendReady = false;
  }

  if (btn && !backendReady) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.setAttribute('title', 'Disponible cuando el servidor local esté activo');
    if (tsEl && (!tsEl.textContent || tsEl.textContent === '—')) tsEl.textContent = 'Sin servidor local';
  } else if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    btn.removeAttribute('title');
  }
}

// ── Alert dot in nav ───────────────────────────────────────────
async function updateTrackingAlertDot() {
  try {
    var res = await apiFetch('/api/alerts');
    var dot = document.getElementById('trackingAlertDot');
    if (dot) {
      dot.style.display = (res.critical_count > 0 || res.high_count > 0) ? 'block' : 'none';
    }
  } catch (e) { /* silent */ }
}

// ── Load alerts tab ────────────────────────────────────────────
async function loadTrackingAlerts() {
  var kpiRow = document.getElementById('trackingKpiRow');
  var sub    = document.getElementById('trackingSubtitle');

  try {
    var res = await apiFetch('/api/alerts');

    // KPI cards
    var _xit = window.i18n;
    if (kpiRow) {
      kpiRow.innerHTML = [
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.changes') : 'Changes detected'), res.total_events || 0, 'neutral'),
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.critical') : 'Critical'), res.critical_count || 0, res.critical_count > 0 ? 'critical' : 'ok'),
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.high') : 'High alert'), res.high_count || 0, res.high_count > 0 ? 'high' : 'ok'),
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.off-market') : 'Off market'), res.off_market_count || 0, res.off_market_count > 0 ? 'critical' : 'ok'),
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.no-source') : 'No source'), res.source_missing_count || 0, res.source_missing_count > 0 ? 'high' : 'ok'),
        trackingKpiCard((_xit ? _xit.t('tracking.kpi.blocked') : 'Access blocked'), res.blocked_count || 0, 'neutral'),
      ].join('');
    }

    if (sub) {
      var locale = _xit ? _xit.getLocale() : 'es-MX';
      sub.textContent = (res.total_events || 0) + ' ' + (_xit ? _xit.t('tracking.sub.changes') : 'changes') + ' · ' +
        (res.critical_count || 0) + ' ' + (_xit ? _xit.t('tracking.sub.critical') : 'critical') + ' · ' +
        (res.off_market_count || 0) + ' ' + (_xit ? _xit.t('tracking.sub.off-market') : 'off market') + ' — ' +
        new Date().toLocaleDateString(locale, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    }

    // Render alerts feed
    renderAlertsFeed(res.active_alerts || []);

    // Update last-run timestamp context
    var tsEl = document.getElementById('verifyLastRunTs');
    if (tsEl) {
      var latestAlert = (res.active_alerts || [])[0];
      if (latestAlert && latestAlert.ts) {
        tsEl.textContent = formatTrackingTs(latestAlert.ts);
      } else if (res.total_events > 0) {
        tsEl.textContent = 'Datos disponibles';
      } else {
        tsEl.textContent = 'Sin datos — ejecutar primera verificación';
      }
    }

  } catch (e) {
    var _xite = window.i18n;
    if (kpiRow) {
      kpiRow.innerHTML = [
        trackingKpiCard((_xite ? _xite.t('tracking.kpi.backend') : 'Backend'), (_xite ? _xite.t('status.no-connection') : 'Offline'), 'neutral'),
        trackingKpiCard((_xite ? _xite.t('tracking.kpi.critical') : 'Alerts'), '—', 'neutral'),
        trackingKpiCard((_xite ? _xite.t('tracking.sub.changes') : 'Changes'), '—', 'neutral'),
        trackingKpiCard((_xite ? _xite.t('tracking.kpi.status') : 'Status'), (_xite ? _xite.t('tracking.kpi.local-only') : 'Local only'), 'neutral')
      ].join('');
    }
    if (sub) sub.textContent = (_xite ? _xite.t('tracking.sub.connect-server') : 'Connect the server to view source verification status');
    renderAlertsFeed([]);
  }
}

function trackingKpiCard(label, value, cls) {
  return '<div class="tracking-kpi-card ' + ((cls === 'neutral' && (String(value).includes('Sin') || String(value).includes('Local'))) ? 'is-neutral-state' : '') + '">' +
    '<div class="tracking-kpi-label">' + escapeHtml(String(label)) + '</div>' +
    '<div class="tracking-kpi-val ' + (cls || '') + '">' + escapeHtml(String(value)) + '</div>' +
    '</div>';
}

function renderAlertsFeed(alerts) {
  var feed = document.getElementById('alertsFeed');
  if (!feed) return;

  var filtered = alerts;
  if (trackingAlertFilter !== 'all') {
    filtered = alerts.filter(function (a) { return a.severity === trackingAlertFilter; });
  }

  var _xitaf = window.i18n;
  if (!filtered.length) {
    feed.innerHTML = '<div class="tracking-empty">' +
      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' +
      '<p>' + (trackingAlertFilter !== 'all' ? (_xitaf ? _xitaf.t('tracking.empty.no-type-alerts') : 'No alerts of this type') : (_xitaf ? _xitaf.t('tracking.empty.no-alerts') : 'No active alerts')) + '</p>' +
      '<div class="tracking-empty-hint">' + (_xitaf ? _xitaf.t('tracking.empty.run-verify') : 'Run a verification to detect source changes') + '</div>' +
      '</div>';
    return;
  }

  feed.innerHTML = filtered.map(function (a) {
    var sev = a.severity || 'low';
    var icon = alertIcon(a.event_type || '');
    var ts   = formatTrackingTs(a.ts || '');
    var lid  = a.listing_id || '';
    var listing = listingsData.find(function (l) { return l.id === lid; });
    var title = listing ? escapeHtml(listing.title || lid) : escapeHtml(lid);

    return '<div class="alert-item sev-' + sev + '" data-testid="alert-item-' + sev + '">' +
      '<span class="alert-icon" aria-hidden="true">' + icon + '</span>' +
      '<div class="alert-body">' +
        '<div class="alert-label">' + formatEventType(a.event_type || '') + '</div>' +
        '<div class="alert-listing" style="font-size:var(--text-xs);color:var(--color-text-muted);margin:2px 0;">' + title + '</div>' +
        (a.note ? '<div class="alert-note" style="font-size:var(--text-xs);color:var(--color-text-faint);line-height:1.4;">' + escapeHtml(a.note) + '</div>' : '') +
        (a.event_type === 'access_blocked' ? '<div class="alert-block-note">' + (window.i18n ? window.i18n.t('tracking.blocked-note') : 'Portal blocked access — not a market exit signal') + '</div>' : '') +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;">' +
        '<div style="font-size:10px;color:var(--color-text-faint);white-space:nowrap;">' + ts + '</div>' +
        '<span class="alert-rule-sev ' + sev + '" style="margin-top:4px;">' + sev + '</span>' +
      '</div>' +
      '</div>';
  }).join('');
}

// ── Load watch state ───────────────────────────────────────────
async function loadTrackingWatchState() {
  var tableWrap = document.getElementById('watchStateTable');
  var countEl   = document.getElementById('watchStateCount');
  if (!tableWrap) return;

  var _xiws = window.i18n;
  tableWrap.innerHTML = '<div class="tracking-empty"><p>' + (_xiws ? _xiws.t('status.loading') : 'Loading…') + '</p></div>';

  try {
    var res = await apiFetch('/api/watch-state');
    var items = res.items || {};
    var entries = Object.entries(items);

    if (countEl) countEl.textContent = entries.length + ' ' + (_xiws ? _xiws.t('tracking.watchlist-count') : 'listings in watchlist');

    if (!entries.length) {
      tableWrap.innerHTML = '<div class="tracking-empty">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' +
        '<p>' + (_xiws ? _xiws.t('tracking.empty.no-watchstate') : 'No watchlist entries') + '</p>' +
        '<div class="tracking-empty-hint">' + (_xiws ? _xiws.t('tracking.empty.run-verify-init') : 'Run a verification to initialize tracking state') + '</div>' +
        '</div>';
      return;
    }

    var html = '<table class="watch-state-table" data-testid="watch-state-table">' +
      '<thead><tr>' +
        '<th>ID</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.unit') : 'Unit') + '</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.source-status') : 'Source status') + '</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.last-read') : 'Last read') + '</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.reads') : 'Reads') + '</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.confidence') : 'Confidence') + '</th>' +
        '<th>' + (_xiws ? _xiws.t('tracking.table.tracking') : 'Tracking') + '</th>' +
      '</tr></thead>' +
      '<tbody>';

    entries.forEach(function (kv) {
      var lid = kv[0];
      var ws  = kv[1];
      var listing = listingsData.find(function (l) { return l.id === lid; });
      var title = listing ? (listing.title || lid) : lid;
      var status = ws.last_check_status || 'unknown';
      var lastCheck = formatTrackingTs(ws.last_checked_at || '');
      var checks = ws.check_count || 0;
      var conf   = ws.avg_confidence != null ? Math.round(ws.avg_confidence) + '%' : '—';
      var watching = ws.watching !== false;
      var confCls = ws.avg_confidence >= 70 ? 'conf-high' : ws.avg_confidence >= 40 ? 'conf-medium' : 'conf-low';

      html += '<tr data-testid="ws-row-' + lid + '">' +
        '<td style="font-family:var(--font-mono);font-size:10px;color:var(--color-text-muted);">' + escapeHtml(lid) + '</td>' +
        '<td style="max-width:180px;" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</td>' +
        '<td><span class="ws-status-badge ' + status + '">' + status.replace(/_/g,' ') + '</span></td>' +
        '<td style="color:var(--color-text-faint);font-size:10px;white-space:nowrap;">' + lastCheck + '</td>' +
        '<td style="font-variant-numeric:tabular-nums;color:var(--color-text-muted);">' + checks + '</td>' +
        '<td><span class="ws-conf-val ' + confCls + '">' + conf + '</span></td>' +
        '<td>' +
          '<button class="ws-watch-toggle ' + (watching ? 'watching' : '') + '" ' +
            'data-ws-lid="' + lid + '" data-ws-watching="' + watching + '" ' +
            'title="' + (watching ? (_xiws ? _xiws.t('tracking.watch.pause') : 'Pause tracking') : (_xiws ? _xiws.t('tracking.watch.activate') : 'Activate tracking')) + '">' +
            (watching ? '● ' + (_xiws ? _xiws.t('tracking.watch.active') : 'Active') : '○ ' + (_xiws ? _xiws.t('tracking.watch.paused') : 'Paused')) +
          '</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    tableWrap.innerHTML = html;

    // Wire watch toggles
    tableWrap.querySelectorAll('.ws-watch-toggle').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var lid = btn.getAttribute('data-ws-lid');
        var currently = btn.getAttribute('data-ws-watching') === 'true';
        btn.disabled = true;
        try {
          var resp = await fetch('/api/watch-state?toggle=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_id: lid, watching: !currently })
          });
          var data = await resp.json();
          var _xiwtg = window.i18n;
          if (data.ok) {
            showToast((data.watching ? (_xiwtg ? _xiwtg.t('tracking.watch.toast-watching') : 'Watching') : (_xiwtg ? _xiwtg.t('tracking.watch.toast-paused') : 'Paused')) + ': ' + lid, 'success');
            loadTrackingWatchState();
          } else {
            showToast(data.error || 'Error', 'error');
          }
        } catch (e) {
          showToast('Error de red', 'error');
        }
        btn.disabled = false;
      });
    });

  } catch (e) {
    tableWrap.innerHTML = '<div class="tracking-empty">' +
      '<p>' + (_xiws ? _xiws.t('tracking.empty.load-failed') : 'Could not load watchlist') + '</p>' +
      '<div class="tracking-empty-hint">' + (_xiws ? _xiws.t('tracking.empty.ensure-server') : 'Make sure the server is running') + '</div>' +
      '</div>';
  }
}

// ── Load event log ─────────────────────────────────────────────
async function loadTrackingEventLog() {
  var listEl = document.getElementById('eventLogList');
  if (!listEl) return;

  var _xiel = window.i18n;
  listEl.innerHTML = '<div class="tracking-empty"><p>' + (_xiel ? _xiel.t('status.loading') : 'Loading…') + '</p></div>';

  try {
    var url = '/api/event-log?limit=' + TRACKING_PAGE_SIZE + '&offset=' + trackingEventOffset;
    if (trackingEventFilter !== 'all') url += '&event_type=' + encodeURIComponent(trackingEventFilter);
    var res = await apiFetch(url);
    var items = res.items || [];
    var total = res.total || 0;

    if (!items.length) {
      listEl.innerHTML = '<div class="tracking-empty">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<p>' + (_xiel ? _xiel.t('tracking.empty.no-events') : 'No events logged') + '</p>' +
        '<div class="tracking-empty-hint">' + (_xiel ? _xiel.t('tracking.empty.events-hint') : 'Changes are recorded after each source verification') + '</div>' +
        '</div>';
      return;
    }

    var html = items.map(function (evt) {
      var sev = evt.severity || 'low';
      var ts  = formatTrackingTs(evt.ts || '');
      var lid = evt.listing_id || '';
      var listing = listingsData.find(function (l) { return l.id === lid; });
      var title = listing ? escapeHtml(listing.title || lid) : escapeHtml(lid);

      return '<div class="event-log-item sev-' + sev + '" data-testid="evt-' + evt.id + '">' +
        '<span class="event-log-icon">' + alertIcon(evt.event_type || '') + '</span>' +
        '<div class="event-log-body">' +
          '<div class="event-log-type">' + formatEventType(evt.event_type || '') + '</div>' +
          '<div class="event-log-listing">' + title + '</div>' +
          (evt.note ? '<div class="event-log-note">' + escapeHtml(evt.note) + '</div>' : '') +
        '</div>' +
        '<div class="event-log-meta">' +
          '<div class="event-log-ts">' + ts + '</div>' +
          '<span class="event-sev-badge sev-' + sev + '">' + sev + '</span>' +
        '</div>' +
        '</div>';
    }).join('');

    // Pagination
    var pageStart = trackingEventOffset + 1;
    var pageEnd   = Math.min(trackingEventOffset + items.length, total);
    html += '<div class="tracking-pagination">' +
      '<span class="tracking-page-info">' + pageStart + '–' + pageEnd + ' ' + (_xiel ? _xiel.t('tracking.page.of') : 'of') + ' ' + total + ' ' + (_xiel ? _xiel.t('tracking.page.events') : 'events') + '</span>' +
      '<div class="tracking-page-btns">' +
        '<button class="tracking-page-btn" id="evtPrevBtn" ' + (trackingEventOffset === 0 ? 'disabled' : '') + '>← ' + (_xiel ? _xiel.t('tracking.page.prev') : 'Previous') + '</button>' +
        '<button class="tracking-page-btn" id="evtNextBtn" ' + (pageEnd >= total ? 'disabled' : '') + '>' + (_xiel ? _xiel.t('tracking.page.next') : 'Next') + ' →</button>' +
      '</div>' +
      '</div>';

    listEl.innerHTML = html;

    var prevBtn = document.getElementById('evtPrevBtn');
    var nextBtn = document.getElementById('evtNextBtn');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      trackingEventOffset = Math.max(0, trackingEventOffset - TRACKING_PAGE_SIZE);
      loadTrackingEventLog();
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      trackingEventOffset += TRACKING_PAGE_SIZE;
      loadTrackingEventLog();
    });

  } catch (e) {
    listEl.innerHTML = '<div class="tracking-empty"><p>Sin datos de eventos</p></div>';
  }
}

// ── Load snapshots ─────────────────────────────────────────────
async function loadTrackingSnapshots() {
  var listEl = document.getElementById('snapshotsList');
  if (!listEl) return;

  var _xisnap = window.i18n;
  listEl.innerHTML = '<div class="tracking-empty"><p>' + (_xisnap ? _xisnap.t('status.loading') : 'Loading…') + '</p></div>';

  try {
    var res = await apiFetch('/api/snapshots?limit=50');
    var items = res.items || [];

    if (!items.length) {
      listEl.innerHTML = '<div class="tracking-empty">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' +
        '<p>' + (_xisnap ? _xisnap.t('tracking.empty.no-snapshots') : 'No source snapshots') + '</p>' +
        '<div class="tracking-empty-hint">' + (_xisnap ? _xisnap.t('tracking.empty.snapshots-hint') : 'Snapshots are created after each source verification') + '</div>' +
        '</div>';
      return;
    }

    listEl.innerHTML = items.map(function (snap) {
      var lid = snap.listing_id || '';
      var listing = listingsData.find(function (l) { return l.id === lid; });
      var title = listing ? escapeHtml(listing.title || lid) : escapeHtml(lid);
      var status = snap.status || 'unknown';
      var ts = formatTrackingTs(snap.collected_at || snap.ts || '');
      var url = snap.url || snap.source_url || '';
      var statusCls = status === 'active' ? 'ok' : status === 'off_market' ? 'critical' : status === 'not_found' ? 'high' : 'neutral';

      return '<div class="snapshot-item" data-testid="snap-' + lid + '">' +
        '<div>' +
          '<div class="snapshot-listing">' + title + '</div>' +
          '<div class="snapshot-url" title="' + escapeHtml(url) + '">' + escapeHtml(url) + '</div>' +
        '</div>' +
        '<div class="snapshot-meta">' +
          '<div class="snapshot-status tracking-kpi-val ' + statusCls + '" style="font-size:var(--text-xs);">' + status.replace(/_/g,' ') + '</div>' +
          '<div class="snapshot-ts">' + ts + '</div>' +
        '</div>' +
        '</div>';
    }).join('');

  } catch (e) {
    listEl.innerHTML = '<div class="tracking-empty"><p>Sin datos de snapshots</p></div>';
  }
}

// ── Collect button ─────────────────────────────────────────────
function setupCollectButton() {
  var btn = document.getElementById('run-collect-btn');
  if (!btn || btn._collectWired) return;
  btn._collectWired = true;

  btn.addEventListener('click', async function () {
    if (btn.disabled) {
      showToast('Activa el servidor local para verificar fuentes', 'warning');
      return;
    }
    btn.classList.add('running');
    var origText = btn.innerHTML;
    var _xicol = window.i18n;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> ' + (_xicol ? _xicol.t('tracking.verify.running') : 'Verifying…');

    // Show a running bar
    var existingBar = document.querySelector('.collect-result-bar');
    if (existingBar) existingBar.remove();
    var bar = document.createElement('div');
    bar.className = 'collect-result-bar';
    bar.textContent = (_xicol ? _xicol.t('tracking.verify.in-progress') : 'Verification in progress — checking sources, may take 20–60 s');
    var panel = document.querySelector('.tracking-panel[style*="none"]');
    var activePanel = document.querySelector('.tracking-panel:not([style*="none"])');
    if (activePanel) activePanel.insertBefore(bar, activePanel.firstChild);

    try {
      var res = await fetch('/api/collect', { method: 'POST' });
      var data = await res.json();
      bar.remove();

      if (data.ok) {
        var col = data.collection || {};
        var msg = document.createElement('div');
        msg.className = 'collect-result-bar';
        msg.innerHTML = '✓ ' + (_xicol ? _xicol.t('tracking.verify.completed') : 'Verification complete') + ' — ' +
          (col.checked || 0) + ' ' + (_xicol ? _xicol.t('tracking.verify.sources-checked') : 'sources checked') + ' · ' +
          (col.events_created || 0) + ' ' + (_xicol ? _xicol.t('tracking.verify.changes-detected') : 'changes detected') + ' · ' +
          (col.off_market_detected || 0) + ' ' + (_xicol ? _xicol.t('tracking.verify.off-market') : 'off market');
        if (activePanel) activePanel.insertBefore(msg, activePanel.firstChild);
        setTimeout(function () { msg.style.opacity='0'; setTimeout(function(){msg.remove();},400); }, 7000);

        // Update last-run timestamp
        var tsEl = document.getElementById('verifyLastRunTs');
        if (tsEl) {
          var _vrLoc = window.i18n ? window.i18n.getLocale() : 'es-MX';
          tsEl.textContent = new Date().toLocaleString(_vrLoc, {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          });
        }
        // Reload all panels to show fresh data
        await loadTrackingAlerts();
        if (trackingActiveTab === 'watchstate') loadTrackingWatchState();
        if (trackingActiveTab === 'eventlog')   loadTrackingEventLog();
        if (trackingActiveTab === 'snapshots')  loadTrackingSnapshots();
        updateTrackingAlertDot();
        showToast('Verificación completada', 'success');
      } else {
        bar.className = 'collect-result-bar error';
        bar.textContent = 'Error: ' + (data.error || (_xicol ? _xicol.t('tracking.verify.failed') : 'Collection failed'));
        if (activePanel) activePanel.insertBefore(bar, activePanel.firstChild);
        showToast('Error en verificación', 'error');
      }
    } catch (e) {
      bar.remove();
      var errBar = document.createElement('div');
      errBar.className = 'collect-result-bar error';
      errBar.textContent = (_xicol ? _xicol.t('status.no-server') : 'No server connection');
      if (activePanel) activePanel.insertBefore(errBar, activePanel.firstChild);
      showToast('Sin conexión al servidor', 'error');
    }

    btn.classList.remove('running');
    btn.innerHTML = origText;
  });
}

// ── Tab switching ──────────────────────────────────────────────
function setupTrackingTabs() {
  var tabsEl = document.getElementById('trackingTabs');
  if (!tabsEl || tabsEl._wired) return;
  tabsEl._wired = true;

  tabsEl.addEventListener('click', function (e) {
    var tab = e.target.closest('.tracking-tab');
    if (!tab) return;
    var name = tab.getAttribute('data-tracking-tab');
    if (!name) return;

    tabsEl.querySelectorAll('.tracking-tab').forEach(function (t) {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });

    // Show/hide panels
    document.querySelectorAll('.tracking-panel').forEach(function (p) {
      p.style.display = p.id === 'trackingPanel-' + name ? '' : 'none';
    });

    trackingActiveTab = name;

    // Lazy-load tab data
    if (name === 'watchstate') loadTrackingWatchState();
    if (name === 'eventlog')   { trackingEventOffset = 0; loadTrackingEventLog(); }
    if (name === 'snapshots')  loadTrackingSnapshots();
  });
}

// ── Alert filter ───────────────────────────────────────────────
function setupAlertFilters() {
  var row = document.getElementById('alertFilterRow');
  if (!row || row._wired) return;
  row._wired = true;

  row.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-alert-filter]');
    if (!chip) return;
    row.querySelectorAll('[data-alert-filter]').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    trackingAlertFilter = chip.getAttribute('data-alert-filter');
    loadTrackingAlerts();
  });
}

// ── Event log filter ───────────────────────────────────────────
function setupEventFilters() {
  var row = document.getElementById('eventLogFilterRow');
  if (!row || row._wired) return;
  row._wired = true;

  row.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-event-filter]');
    if (!chip) return;
    row.querySelectorAll('[data-event-filter]').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    trackingEventFilter = chip.getAttribute('data-event-filter');
    trackingEventOffset = 0;
    loadTrackingEventLog();
  });
}

// ── Helpers ────────────────────────────────────────────────────
function alertIcon(eventType) {
  var icons = {
    off_market:                  'OM',
    source_missing:              'NF',
    price_drop:                  'PD',
    price_increase:              'PI',
    access_blocked:              'BL',
    verification_blocked:        'BV',
    access_error:                'ER',
    relisting_suspected:         'RL',
    content_changed:             'CH',
    title_changed:               'TT',
    claimed_unavailable_active:  'CA',
    duplicate_suspected:         'DP',
  };
  return icons[eventType] || 'EV';
}

function formatEventType(eventType) {
  var _xiev = window.i18n;
  var key = 'event.' + eventType;
  if (_xiev && _xiev.t(key) !== key) return _xiev.t(key);
  // Fallback labels (used when i18n not ready or key not found)
  var labels = {
    off_market:                  'Off Market',
    source_missing:              'Source Missing (404)',
    price_drop:                  'Rent Drop',
    price_increase:              'Rent Increase',
    access_blocked:              'Access Blocked',
    verification_blocked:        'Verification Blocked',
    access_error:                'Access Error',
    relisting_suspected:         'Suspected Relisting',
    content_changed:             'Content Changed',
    title_changed:               'Title Changed',
    claimed_unavailable_active:  'Agent Claims Unavailable (Active)',
    duplicate_suspected:         'Suspected Duplicate',
  };
  return labels[eventType] || eventType.replace(/_/g, ' ');
}

function formatTrackingTs(ts) {
  if (!ts) return '—';
  try {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    var loc = window.i18n ? window.i18n.getLocale() : 'es-MX';
    return d.toLocaleDateString(loc, { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString(loc, { hour:'2-digit', minute:'2-digit' });
  } catch (e) {
    return ts;
  }
}

// ── Inject CSS for spin animation ──────────────────────────────
(function injectTrackingAnimations() {
  var style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();
;

// ════════════════════════════════════════════════════════════
//  BLUEPRINT MERGE — April 2026
//  Features adopted from blueprint: guided mode dialog,
//  animated ticker footer, decision engine banner text,
//  advanced filter panel, operating context strip.
// ════════════════════════════════════════════════════════════

// ── Guided Mode Dialog ─────────────────────────────────────
// Blueprint: 4-step onboarding dialog triggered by "?" button
// in header-actions. Keeps live app's full navigation intact.
(function setupGuidedMode() {
  var btn   = document.getElementById('guidedModeBtn');
  var dialog = document.getElementById('guidedDialog');
  var closeBtn = document.getElementById('guidedCloseBtn');
  var guideCta = document.getElementById('decisionEngineGuideBtn');

  if (!btn || !dialog) return;

  function openDialog() {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  btn.addEventListener('click', openDialog);
  if (guideCta) guideCta.addEventListener('click', openDialog);

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    });
  }

  // Close on backdrop click
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    }
  });
})();

// ── Animated Ticker Footer ─────────────────────────────────
// Blueprint: bottom-ticker with animated scrolling (marquee).
// Replaces static footer text with a live market data feed.
function renderAnimatedTicker() {
  var track = document.getElementById('tickerScrollTrack');
  if (!track) return;

  var listings = listingsData || [];
  if (!listings.length) {
    track.innerHTML = '';
    return;
  }

  // Build ticker items from live listings (top 10 by opportunity score)
  var items = listings
    .slice()
    .sort(function (a, b) {
      var sa = ((a.intel || {}).scores || {}).composite_score || 0;
      var sb = ((b.intel || {}).scores || {}).composite_score || 0;
      return sb - sa;
    })
    .slice(0, 12)
    .map(function (l) {
      var psm = l.price_per_sqm || 0;
      var ms = marketSummary || {};
      var medianPsm = ms.median_price_per_sqm || psm;
      var deltaPct = medianPsm ? Math.round(((psm - medianPsm) / medianPsm) * 100) : 0;
      var dotClass = deltaPct <= -2 ? 'good' : deltaPct >= 5 ? 'bad' : 'warn';
      var sign = deltaPct >= 0 ? '+' : '';
      var building = (l.building || '').replace('torre300', 'Torre 300').replace('peninsula', 'Península').replace('paradox', 'Paradox');
      var price = fmtMoney(l.price || 0);
      var psmStr = fmtMoney(psm) + '/m²';
      var lvg = Math.round(((l.intel || {}).scores || {}).leverage_score || 0);
      var conf = Math.round(((l.intel || {}).scores || {}).confidence_score || 0);
      var ghost = Math.round((((l.intel || {}).scores || {}).ghost_probability || 0) * 100);
      var targetClose = ((l.intel || {}).pricing || {}).target_close || 0;
      return (
        '<span class="ticker-item-bp">' +
          '<span class="ticker-dot ' + dotClass + '"></span>' +
          '<span>' + escapeHtml(building + ': ' + (l.title || l.id)) + '</span>' +
          '<span class="ticker-val">' + price + '</span>' +
          (targetClose ? '<span>target ' + fmtMoney(targetClose) + '</span>' : '<span>' + psmStr + '</span>') +
          '<span>' + sign + deltaPct + '% peer</span>' +
          (lvg > 0 ? '<span style="opacity:0.7;font-weight:600;">leverage ' + lvg + '</span>' : '') +
          (conf > 0 ? '<span style="opacity:0.6;">' + (window.i18n ? window.i18n.t('score.confidence') : 'conf') + ' ' + conf + '</span>' : '') +
          (ghost > 0 ? '<span style="opacity:0.55;">' + (window.i18n ? window.i18n.t('ticker.vacancy') : 'vacancy') + ' ' + ghost + '%</span>' : '') +
        '</span>'
      );
    });

  // Duplicate for seamless loop
  var html = items.join('') + items.join('');
  track.innerHTML = html;

  // Adjust animation duration based on content width
  // Allow CSS to handle timing via the ticker-scroll keyframe
}

// ── Sort Label helper (absorbed from utils.ts concept) ──────────────
function sortLabel(mode) {
  var _xi = window.i18n;
  var map = {
    composite_score: _xi ? _xi.t('sort.label.opportunity') : 'by opportunity',
    leverage_score:  _xi ? _xi.t('sort.label.leverage') : 'by leverage',
    price_asc:       _xi ? _xi.t('sort.label.price-asc') : 'asking rent ascending',
    price_desc:      _xi ? _xi.t('sort.label.price-desc') : 'asking rent descending',
    dom:             _xi ? _xi.t('sort.label.dom') : 'by days on market',
  };
  return map[mode] || mode;
}

// ── Canonical best listing ────────────────────────────────────
// Single source of truth used by all summary surfaces:
//   1. market_summary.top_targets[0]  (authoritative, backend-computed)
//   2. highest composite_score listing (fallback)
function getCanonicalBestId() {
  var ms = marketSummary || {};
  if (ms.top_targets && ms.top_targets.length) return ms.top_targets[0];
  var bestId = null, bestScore = -Infinity;
  listingsData.forEach(function (l) {
    var s = ((l.intel || {}).scores || {}).composite_score || 0;
    if (s > bestScore) { bestScore = s; bestId = l.id; }
  });
  return bestId;
}

// ── Decision Engine Banner Update ─────────────────────────
// Blueprint: "operating view" context summary.
// Populates the banner and operating context strip after data loads.
function updateDecisionEngineBanner() {
  var ms = marketSummary || {};
  var total = listingsData.length;
  // Use authoritative market summary count (same source as KPI cards)
  var negotiable = ms.negotiate_count || 0;
  // Fallback: count from listings if market_summary lacks the field
  if (!negotiable && listingsData.length) {
    negotiable = listingsData.filter(function (l) {
      return ((l.intel || {}).negotiation || {}).recommended_offer_band;
    }).length;
  }

  // Use canonical best ID (single source of truth)
  var bestId = getCanonicalBestId();

  var summary = document.getElementById('decisionEngineSummary');
  var _xidec = window.i18n;
  if (summary) {
    summary.textContent =
      total + ' ' + (_xidec ? _xidec.t('overview.sub.active') : 'active') + ' · ' +
      (ms.median_price_per_sqm ? fmtMoney(ms.median_price_per_sqm) + (_xidec ? ' ' + _xidec.t('kpi.psm-median') : '/m² median') + ' · ' : '') +
      negotiable + ' ' + (_xidec ? _xidec.t('overview.sub.negotiation-opps') : 'with negotiation opportunity') + ' · ' + (_xidec ? _xidec.t('sort.sorted') : 'Sorted') + ' ' + sortLabel(sortMode) +
      (bestId ? ' · ' + (_xidec ? _xidec.t('kpi.top-opportunity') : 'Top opportunity') + ': ' + bestId : '');
  }

  // Operating context strip
  var median = ms.median_price || 0;
  var medPsm = ms.median_price_per_sqm || 0;
  setText('ctxUniverse', total + ' ' + (_xidec ? _xidec.t('dashboard.kpi.total-listings') : 'listings'));
  setText('ctxMedian', median ? fmtMoney(median) : '—');
  setText('ctxPsm', medPsm ? fmtMoney(medPsm) + '/m²' : '—');
  setText('ctxNegotiate', negotiable + ' ' + (_xidec ? _xidec.t('overview.sub.units') : 'units'));

  // Best deal — use canonical source (same as banner above)
  setText('ctxBestDeal', bestId || '—');
}

// ── Advanced Filter Panel (blueprint collapse) ─────────────
// Blueprint: <details> progressive disclosure for advanced filters.
// Wired to existing filter chip logic — updates sortMode and
// re-renders the overview without breaking chip state.
(function setupAdvancedFilters() {
  // We wait for data to be loaded before wiring (called from patchInitHook below)
  window._advFiltersSetup = function () {
    var towerSel   = document.getElementById('advTowerFilter');
    var bedsSel    = document.getElementById('advBedsFilter');
    var sortSel    = document.getElementById('advSortFilter');
    var priceInput = document.getElementById('advMinPriceFilter');
    var sqmInput   = document.getElementById('advMinSqmFilter');
    var negChk     = document.getElementById('advNegotiableOnly');
    var applyBtn   = document.getElementById('advFilterApplyBtn');
    var resetBtn   = document.getElementById('advFilterResetBtn');
    var details    = document.getElementById('advFilterDetails');

    if (!applyBtn) return;

    function applyAdv() {
      // Sync advanced filters to existing filter chip system
      if (towerSel && towerSel.value !== 'all') {
        // Trigger the matching filter chip
        var chips = document.querySelectorAll('.filter-chip[data-filter]');
        chips.forEach(function (c) { c.classList.remove('active'); });
        var matchChip = document.querySelector('.filter-chip[data-filter="' + towerSel.value + '"]');
        if (matchChip) {
          matchChip.classList.add('active');
          activeFilter = towerSel.value;
        }
      }

      // Sync beds
      if (bedsSel && bedsSel.value !== 'all') {
        var bedMap = { '1': '1bed', '2': '2bed', '3': '3bed' };
        var bedChip = document.querySelector('.filter-chip[data-filter="' + (bedMap[bedsSel.value] || bedsSel.value) + '"]');
        if (bedChip) {
          document.querySelectorAll('.filter-chip[data-filter]').forEach(function (c) { c.classList.remove('active'); });
          bedChip.classList.add('active');
          activeFilter = bedMap[bedsSel.value] || bedsSel.value;
        }
      }

      // Sync negotiable
      if (negChk && negChk.checked) {
        var negChip = document.querySelector('.filter-chip[data-filter="negotiate"]');
        if (negChip) {
          document.querySelectorAll('.filter-chip[data-filter]').forEach(function (c) { c.classList.remove('active'); });
          negChip.classList.add('active');
          activeFilter = 'negotiate';
        }
      }

      // Sync sort
      if (sortSel && sortSel.value) {
        sortMode = sortSel.value;
        var sortSelectEl = document.getElementById('sortSelect');
        if (sortSelectEl) sortSelectEl.value = sortMode;
      }

      // Store min price & sqm for renderOverview to pick up
      window._advMinPrice = priceInput ? (parseInt(priceInput.value, 10) || 0) : 0;
      window._advMinSqm   = sqmInput   ? (parseInt(sqmInput.value, 10) || 0) : 0;

      renderOverview();

      // Collapse the details after applying
      if (details) details.removeAttribute('open');

      showToast(window.i18n ? window.i18n.t('adv.applied-toast') : 'Advanced filters applied', 'success');
    }

    function resetAdv() {
      if (towerSel)   towerSel.value = 'all';
      if (bedsSel)    bedsSel.value  = 'all';
      if (sortSel)    sortSel.value  = 'composite_score';
      if (priceInput) priceInput.value = '';
      if (sqmInput)   sqmInput.value   = '';
      if (negChk)     negChk.checked   = false;
      window._advMinPrice = 0;
      window._advMinSqm   = 0;
      sortMode = 'composite_score';
      activeFilter = 'all';

      document.querySelectorAll('.filter-chip[data-filter]').forEach(function (c) {
        c.classList.toggle('active', c.getAttribute('data-filter') === 'all');
      });

      var sortSelectEl = document.getElementById('sortSelect');
      if (sortSelectEl) sortSelectEl.value = 'composite_score';

      renderOverview();
      showToast(window.i18n ? window.i18n.t('adv.reset-toast') : 'Filters reset', 'success');
    }

    applyBtn.addEventListener('click', applyAdv);
    if (resetBtn) resetBtn.addEventListener('click', resetAdv);
  };
})();

// ── Hook into init() to wire blueprint additions ───────────
// We patch the existing init() call chain by appending to the
// DOMContentLoaded-equivalent post-init sequence.
// Safe: only runs after listingsData is available.
var _origInit = typeof init === 'function' ? init : null;
if (_origInit) {
  // Override init to also call blueprint additions after all renders
  window.init = function bpInit() {
    _origInit.apply(this, arguments);
    // Blueprint additions (safe — data already loaded by loadData())
    setTimeout(function () {
      renderAnimatedTicker();
      updateDecisionEngineBanner();
      if (typeof window._advFiltersSetup === 'function') window._advFiltersSetup();
    }, 0);
  };
}

// Also wire up if data loads after this script (re-trigger on
// any subsequent loadData() calls by patching applyFeedData)
var _origApplyFeedData = typeof applyFeedData === 'function' ? applyFeedData : null;
if (_origApplyFeedData) {
  window.applyFeedData = function bpApplyFeedData(feedRes, agentItems) {
    _origApplyFeedData.call(this, feedRes, agentItems);
  };
}

// ── Export Snapshot Button (blueprint merge) ────────────────────
// Client-side JSON export of the current filtered listings view.
// Adapted from blueprint ExportSnapshotButton.tsx — no backend
// required; uses in-memory listingsData directly.
(function setupExportSnapshot() {
  var btn = document.getElementById('exportSnapshotBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    if (!listingsData || !listingsData.length) {
      showToast('Sin datos para exportar', 'warning');
      return;
    }

    btn.disabled = true;
    var _xiexp = window.i18n;
    btn.textContent = (_xiexp ? _xiexp.t('export.exporting') : 'Exporting…');

    try {
      var snapshot = {
        exported_at: new Date().toISOString(),
        source: 'Santa Fe CI Platform',
        active_filter: activeFilter || 'all',
        sort_mode: sortMode || 'composite_score',
        total_listings: listingsData.length,
        market_summary: marketSummary || {},
        listings: listingsData.map(function (l) {
          var scores = (l.intel || {}).scores || {};
          var pricing = (l.intel || {}).pricing || {};
          return {
            id: l.id,
            title: l.title,
            building: l.building,
            price: l.price,
            price_per_sqm: l.price_per_sqm,
            sqm: l.sqm,
            beds: l.beds,
            days_on_market: l.days_on_market,
            furnished: l.furnished,
            composite_score: scores.composite_score,
            leverage_score: scores.leverage_score,
            opening_anchor: pricing.opening_anchor,
            target_close: pricing.target_close,
            walk_away: pricing.walk_away,
            fair_low: pricing.fair_low,
            status: (l.intel || {}).status || {},
          };
        }),
      };

      var json = JSON.stringify(snapshot, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'santafe-snapshot-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Snapshot exportado', 'success');
    } catch (err) {
      showToast('Error al exportar', 'warning');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export';
    }
  });
})();
