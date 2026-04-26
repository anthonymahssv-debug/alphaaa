(function () {
  'use strict';
  var alerts = [];
  var activeFilter = 'all';
  var els = {};

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>'"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }
  function rel(ts) {
    if (!ts) return '—';
    var d = new Date(ts); if (isNaN(d)) return '—';
    var mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 60) return 'Hace ' + mins + ' min';
    var hrs = Math.round(mins / 60); if (hrs < 48) return 'Hace ' + hrs + ' h';
    return d.toLocaleDateString('es-MX');
  }
  function normAlert(a) {
    return {
      id: a.id || (a.type || a.event_type || 'alert') + '_' + (a.listingId || a.listing_id || '') + '_' + (a.timestamp || a.ts || ''),
      type: a.type || a.event_type || 'watchlist_update',
      severity: a.severity || 'medium',
      title: a.title || a.label || a.message || 'Alerta operativa',
      detail: a.detail || a.note || a.message || 'Revisa esta señal antes de avanzar.',
      listingId: a.listingId || a.listing_id || a.id_listing || null,
      building: a.building || null,
      timestamp: a.timestamp || a.ts || a.updated_at || new Date().toISOString(),
      metricBefore: a.metricBefore == null ? a.metric_before : a.metricBefore,
      metricAfter: a.metricAfter == null ? a.metric_after : a.metricAfter,
      unread: a.unread !== false,
      urgent: !!a.urgent || a.severity === 'critical' || a.severity === 'high',
      actionLabel: a.actionLabel || (a.listingId || a.listing_id ? 'Abrir unidad' : 'Ver fuentes'),
      actionView: a.actionView || (a.listingId || a.listing_id ? 'detail' : 'tracking'),
      source: a.source || 'computed'
    };
  }
  async function api(path, opts) {
    var res = await fetch(path, opts || {});
    if (!res.ok) throw new Error(path + ' ' + res.status);
    return res.json();
  }
  async function loadAlerts() {
    try {
      var res = await api('/api/alerts');
      alerts = (res.alerts || res.items || res.active_alerts || []).map(normAlert).slice(0, 20);
    } catch (e) {
      alerts = [];
    }
    renderBell();
    renderPanel();
  }
  function filtered() {
    if (activeFilter === 'unread') return alerts.filter(function (a) { return a.unread; });
    if (activeFilter === 'urgent') return alerts.filter(function (a) { return a.urgent || a.severity === 'critical' || a.severity === 'high'; });
    return alerts;
  }
  function renderBell() {
    if (!els.badge) return;
    var unread = alerts.filter(function (a) { return a.unread; }).length;
    var urgent = alerts.some(function (a) { return a.unread && (a.urgent || a.severity === 'critical' || a.severity === 'high'); });
    els.badge.hidden = unread === 0;
    els.badge.textContent = unread > 99 ? '99+' : String(unread);
    els.badge.classList.toggle('urgent', urgent);
  }
  function renderPanel() {
    if (!els.list) return;
    var list = filtered();
    var unread = alerts.filter(function (a) { return a.unread; }).length;
    var urgent = alerts.filter(function (a) { return a.urgent || a.severity === 'critical' || a.severity === 'high'; }).length;
    els.summary.textContent = unread + ' no leídas · ' + urgent + ' urgentes';
    if (!list.length) {
      var msg = activeFilter === 'unread' ? 'Sin alertas no leídas' : activeFilter === 'urgent' ? 'Sin alertas urgentes' : 'Sin alertas activas';
      els.list.innerHTML = '<div class="alert-panel-empty">' + esc(msg) + '</div>';
      return;
    }
    els.list.innerHTML = list.map(function (a) {
      var delta = a.metricAfter != null ? '<span class="alert-metric-delta">Métrica: ' + esc(a.metricAfter) + '</span>' : '';
      return '<article class="alert-card ' + (a.unread ? 'unread ' : '') + (a.urgent ? 'urgent ' : '') + 'sev-' + esc(a.severity) + '" data-alert-id="' + esc(a.id) + '">' +
        '<div class="alert-card-top"><span class="alert-severity-badge ' + esc(a.severity) + '">' + esc(a.severity) + '</span><span class="alert-type-label">' + esc(a.type.replace(/_/g, ' ')) + '</span></div>' +
        '<h3>' + esc(a.title) + '</h3>' +
        '<p>' + esc(a.detail) + '</p>' +
        '<div class="alert-meta-line">' + (a.listingId ? '<span>' + esc(a.listingId) + '</span>' : '') + (a.building ? '<span>' + esc(a.building) + '</span>' : '') + '<span title="' + esc(a.timestamp) + '">' + rel(a.timestamp) + '</span>' + delta + '</div>' +
        '<button class="alert-card-cta" data-alert-action="' + esc(a.id) + '">' + esc(a.actionLabel) + '</button>' +
      '</article>';
    }).join('');
  }
  async function markRead(id) {
    var a = alerts.find(function (x) { return x.id === id; });
    if (a) a.unread = false;
    renderBell(); renderPanel();
    try { await api('/api/alerts/' + encodeURIComponent(id) + '/read', { method: 'POST' }); } catch (e) {}
  }
  async function markAll() {
    alerts.forEach(function (a) { a.unread = false; });
    renderBell(); renderPanel();
    try { await api('/api/alerts/read-all', { method: 'POST' }); } catch (e) {}
  }
  function navigate(a) {
    if (!a) return;
    if (a.actionView === 'detail' && a.listingId && window.listingsData) {
      var l = window.listingsData.find && window.listingsData.find(function (x) { return x.id === a.listingId; });
      if (l && window.renderDetailView && window.showView) { window.currentListing = l; window.showView('detail'); window.renderDetailView(l); closePanel(); return; }
    }
    var target = a.actionView || 'tracking';
    var btn = document.querySelector('[data-view="' + target + '"]');
    if (btn) btn.click();
    closePanel();
  }
  function openPanel() {
    els.panel.classList.add('open');
    els.panel.setAttribute('aria-hidden', 'false');
    els.backdrop.hidden = false;
    loadAlerts();
    setTimeout(function () { if (els.close) els.close.focus(); }, 0);
  }
  function closePanel() {
    els.panel.classList.remove('open');
    els.panel.setAttribute('aria-hidden', 'true');
    els.backdrop.hidden = true;
    if (els.bell) els.bell.focus();
  }
  function bind() {
    els.bell = $('alertBellBtn'); els.badge = $('alertUnreadBadge'); els.panel = $('alertPanel'); els.backdrop = $('alertPanelBackdrop'); els.close = $('alertPanelClose'); els.list = $('alertPanelList'); els.summary = $('alertPanelSummary'); els.markAll = $('markAllAlertsRead');
    if (!els.bell || !els.panel) return;
    els.bell.addEventListener('click', openPanel);
    els.close.addEventListener('click', closePanel);
    els.backdrop.addEventListener('click', closePanel);
    els.markAll.addEventListener('click', markAll);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.panel.classList.contains('open')) closePanel(); });
    document.querySelectorAll('[data-alert-panel-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-alert-panel-filter');
        document.querySelectorAll('[data-alert-panel-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        renderPanel();
      });
    });
    els.list.addEventListener('click', function (e) {
      var action = e.target.closest('[data-alert-action]');
      var card = e.target.closest('[data-alert-id]');
      var id = (action || card) && (action || card).getAttribute(action ? 'data-alert-action' : 'data-alert-id');
      if (!id) return;
      var a = alerts.find(function (x) { return x.id === id; });
      markRead(id);
      if (action) navigate(a);
    });
    loadAlerts();
    setInterval(loadAlerts, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
