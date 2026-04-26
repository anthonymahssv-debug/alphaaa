(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function relMins(mins) {
    if (mins == null) return 'edad desconocida';
    if (mins < 60) return 'hace ' + Math.round(mins) + ' min';
    var h = Math.round(mins / 60);
    if (h < 48) return 'hace ' + h + ' h';
    return 'hace ' + Math.round(h / 24) + ' días';
  }
  async function updateHealth() {
    var el = $('pulseHealth');
    var badge = $('dataStatusBadge');
    try {
      var res = await fetch('/api/system/health');
      if (!res.ok) throw new Error(String(res.status));
      var h = await res.json();
      var data = h.data || {};
      var api = h.api || {};
      if (el) {
        var state = data.freshnessState || '—';
        el.textContent = 'API ' + (api.averageResponseTimeMs || 0) + 'ms · ' + state + ' · ' + relMins(data.dataAgeMinutes);
        el.className = 'pulse-time pulse-mono freshness-indicator ' + state;
      }
      if (badge) {
        var mode = data.dataSource === 'live' ? 'En vivo' : data.dataSource === 'offline' ? 'Sin conexión' : 'Demo API';
        badge.style.display = '';
        badge.textContent = mode;
        badge.className = 'data-status ' + (data.dataSource || 'demo');
      }
    } catch (e) {
      if (el) { el.textContent = 'API: no disponible'; el.className = 'pulse-time pulse-mono freshness-indicator offline'; }
      if (badge) { badge.style.display = ''; badge.textContent = 'Demo estático'; badge.className = 'data-status demo'; }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateHealth); else updateHealth();
  setInterval(updateHealth, 60000);
})();
