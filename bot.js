'use strict';

(function SantaFeBot() {

  // ══════════════════════════════════════════════════════════════
  //  Santa Fe CI — Real Estate Intelligence Bot
  //  Single-file drop-in version
  //  - Fully client-side
  //  - API-aware frontend companion
  //  - Injects its own styles
  //  - Interactive avatar
  //  - Optional voice synthesis
  //  - Listing intelligence states
  // ══════════════════════════════════════════════════════════════

  var BOT_NAME   = 'Santa Fe Realty AI';
  var BOT_INTRO  = 'Hola. Soy tu asistente inmobiliario de Santa Fe. Puedo ayudarte a detectar oportunidades, comparar torres, revisar precios, negociar mejor y analizar la unidad abierta.';
  var BOT_AVATAR_IMAGE = window.sfBotAvatarImage || './img/sf-bot-avatar.jpg';

  var STARTER_PROMPTS = [
    '¿Cuál es la mejor oportunidad ahora?',
    'Muéstrame unidades negociables',
    '¿Qué torre está más cara por m²?',
    '¿Cómo está el mercado hoy?',
    '¿Qué unidades llevan más días?',
    'Analiza la unidad abierta'
  ];

  var panelOpen       = false;
  var messages        = [];
  var botVoiceEnabled = true;
  var botUtterance    = null;
  var botSpeaking     = false;
  var botThinking     = false;

  injectStyles();

  // ── Helpers ──────────────────────────────────────────────────
  function fmtN(n) {
    if (n == null || n === '') return '—';
    return Number(n).toLocaleString('es-MX');
  }

  function fmtMoney(n) {
    if (n == null || n === '') return '—';
    return '$' + fmtN(n) + ' MXN';
  }

  function fmtMoneyShort(n) {
    if (n == null || n === '') return '—';
    return '$' + fmtN(n);
  }

  function pct(n) {
    if (n == null || n === '') return '—';
    var v = parseFloat(n);
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }

  function escH(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function matchAny(q, terms) {
    return terms.some(function(t) { return q.includes(t); });
  }

  function avg(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce(function(sum, n) { return sum + (Number(n) || 0); }, 0) / arr.length;
  }

  function buildingName(key) {
    var names = {
      peninsula: 'Península Santa Fe',
      torre300: 'Torre 300',
      paradox: 'Paradox Santa Fe'
    };
    return names[key] || key || '—';
  }

  function statusLabel(key) {
    var labels = {
      negotiate: 'Negociar ahora',
      fast_move: 'Mover rápido',
      verify: 'Verificar primero',
      watch: 'Monitorear',
      avoid: 'Evitar'
    };
    return labels[key] || key || 'Sin etiqueta';
  }

  function statusTone(key) {
    var tones = {
      negotiate: 'warning',
      fast_move: 'accent',
      verify: 'warning',
      watch: 'neutral',
      avoid: 'danger'
    };
    return tones[key] || 'neutral';
  }

  function getListings()       { return window.listingsData || []; }
  function getMarketSummary()  { return window.marketSummary || {}; }
  function getTowerSummary()   { return window.towerSummary || {}; }
  function getCurrentListing() { return window.currentListing || null; }

  function listingScores(l)  { return ((l || {}).intel || {}).scores || {}; }
  function listingPricing(l) { return ((l || {}).intel || {}).pricing || {}; }
  function listingStatus(l)  { return ((l || {}).intel || {}).status || {}; }

  function topByComposite(listings) {
    return listings.slice().sort(function(a, b) {
      var sa = listingScores(a).composite_score || 0;
      var sb = listingScores(b).composite_score || 0;
      if (sb !== sa) return sb - sa;
      return (listingScores(b).leverage_score || 0) - (listingScores(a).leverage_score || 0);
    });
  }

  function botMetric(label, value, tone) {
    return '' +
      '<div class="sfre-metric' + (tone ? ' is-' + escH(tone) : '') + '">' +
        '<div class="sfre-metric-label">' + escH(String(label)) + '</div>' +
        '<div class="sfre-metric-value">' + escH(String(value)) + '</div>' +
      '</div>';
  }

  function badge(label, tone) {
    return '<span class="sfre-badge is-' + escH(tone || 'neutral') + '">' + escH(label) + '</span>';
  }

  function tableWrap(headers, rows) {
    return '' +
      '<div class="sfre-table-wrap">' +
        '<table class="sfre-table">' +
          '<thead><tr>' + headers.map(function(h) { return '<th>' + escH(h) + '</th>'; }).join('') + '</tr></thead>' +
          '<tbody>' + rows.join('') + '</tbody>' +
        '</table>' +
      '</div>';
  }

  function row(cols) {
    return '<tr>' + cols.map(function(c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
  }

  function heroCard(title, subtitle, chipHtml) {
    return '' +
      '<div class="sfre-hero">' +
        '<div class="sfre-hero-copy">' +
          '<div class="sfre-hero-kicker">' + (chipHtml || badge('Insight', 'accent')) + '</div>' +
          '<div class="sfre-hero-title">' + escH(title) + '</div>' +
          (subtitle ? '<div class="sfre-hero-sub">' + subtitle + '</div>' : '') +
        '</div>' +
        '<div class="sfre-hero-art">' + houseIcon() + '</div>' +
      '</div>';
  }

  function infoLine(label, value) {
    return '' +
      '<div class="sfre-line">' +
        '<span class="sfre-line-label">' + escH(label) + '</span>' +
        '<span class="sfre-line-value">' + escH(value) + '</span>' +
      '</div>';
  }

  function houseIcon() {
    return '' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 11.5 12 4l9 7.5"/>' +
        '<path d="M5 10.5V20h14v-9.5"/>' +
        '<path d="M10 20v-5h4v5"/>' +
      '</svg>';
  }

  function sparkIcon() {
    return '' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3l1.7 4.8L19 9.5l-4 3 1.4 4.7L12 14.4 7.6 17.2 9 12.5 5 9.5l5.3-1.7L12 3z"/>' +
      '</svg>';
  }

  function chartIcon() {
    return '' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 3v18h18"/>' +
        '<path d="m7 14 3-3 3 2 4-5"/>' +
      '</svg>';
  }

  function avatarMarkup() {
    if (BOT_AVATAR_IMAGE) {
      return '' +
        '<div class="sf-bot-avatar sf-bot-avatar--idle" aria-hidden="true">' +
          '<div class="sf-bot-avatar-photo" style="background-image:url(' + escH(BOT_AVATAR_IMAGE) + ')"></div>' +
          '<div class="sf-bot-avatar-ring"></div>' +
          '<div class="sf-bot-avatar-home">' + houseIcon() + '</div>' +
        '</div>';
    }

    return '' +
      '<div class="sf-bot-avatar sf-bot-avatar--idle" aria-hidden="true">' +
        '<div class="sf-bot-avatar-face">' +
          '<div class="sf-bot-avatar-hair"></div>' +
          '<div class="sf-bot-avatar-head"></div>' +
          '<div class="sf-bot-avatar-eyes">' +
            '<span class="sf-bot-avatar-eye"></span>' +
            '<span class="sf-bot-avatar-eye"></span>' +
          '</div>' +
          '<div class="sf-bot-avatar-mouth"></div>' +
          '<div class="sf-bot-avatar-home">' + houseIcon() + '</div>' +
        '</div>' +
      '</div>';
  }

  // ── Avatar state engine ──────────────────────────────────────
  function setAvatarState(state) {
    var avatar = document.querySelector('.sf-bot-avatar');
    if (!avatar) return;

    avatar.classList.remove(
      'sf-bot-avatar--idle',
      'sf-bot-avatar--active',
      'sf-bot-avatar--thinking',
      'sf-bot-avatar--speaking',
      'sf-bot-avatar--normal',
      'sf-bot-avatar--negotiating',
      'sf-bot-avatar--high-risk',
      'sf-bot-avatar--high-confidence'
    );

    avatar.classList.add('sf-bot-avatar--' + state);
  }

  function syncAvatarState() {
    if (botSpeaking) {
      setAvatarState('speaking');
      return;
    }
    if (botThinking) {
      setAvatarState('thinking');
      return;
    }
    if (panelOpen) {
      setAvatarState('active');
      return;
    }
    setAvatarState('idle');
  }

  function applyListingAvatarState(listing) {
    if (botSpeaking || botThinking) {
      syncAvatarState();
      return;
    }

    if (!listing || !listing.intel) {
      setAvatarState(panelOpen ? 'active' : 'idle');
      return;
    }

    var scores = listing.intel.scores || {};
    var status = (listing.intel.status || {}).key || '';

    if ((scores.ghost_probability || 0) > 40) {
      setAvatarState('high-risk');
      return;
    }

    if ((scores.confidence_score || 0) >= 70) {
      setAvatarState('high-confidence');
      return;
    }

    if (status === 'negotiate') {
      setAvatarState('negotiating');
      return;
    }

    setAvatarState('normal');
  }

  // ── Speech engine ────────────────────────────────────────────
  function stopBotSpeech() {
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (e) {}
    botSpeaking = false;
    syncAvatarState();
    applyListingAvatarState(getCurrentListing());
  }

  function getBotVoice() {
    if (!('speechSynthesis' in window)) return null;
    var voices = window.speechSynthesis.getVoices() || [];

    var preferred = voices.find(function(v) { return /es(-|_)?MX/i.test(v.lang); });
    if (preferred) return preferred;

    preferred = voices.find(function(v) { return /^es/i.test(v.lang); });
    if (preferred) return preferred;

    return voices[0] || null;
  }

  function stripHtmlForSpeech(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function speakBotResponse(html) {
    if (!botVoiceEnabled) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

    var text = stripHtmlForSpeech(html);
    if (!text) return;

    stopBotSpeech();

    var utterance = new SpeechSynthesisUtterance(text);
    var voice = getBotVoice();
    if (voice) utterance.voice = voice;

    utterance.lang  = voice && voice.lang ? voice.lang : 'es-MX';
    utterance.rate  = 1;
    utterance.pitch = 1;

    utterance.onstart = function() {
      botSpeaking = true;
      syncAvatarState();
    };

    utterance.onend = function() {
      botSpeaking = false;
      syncAvatarState();
      applyListingAvatarState(getCurrentListing());
    };

    utterance.onerror = function() {
      botSpeaking = false;
      syncAvatarState();
      applyListingAvatarState(getCurrentListing());
    };

    botUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoice() {
    botVoiceEnabled = !botVoiceEnabled;
    if (!botVoiceEnabled) stopBotSpeech();
    updateVoiceButton();
  }

  function updateVoiceButton() {
    var btn = document.getElementById('sfBotVoiceBtn');
    if (!btn) return;
    btn.textContent = botVoiceEnabled ? 'Voz: On' : 'Voz: Off';
    btn.setAttribute('aria-pressed', botVoiceEnabled ? 'true' : 'false');
    btn.classList.toggle('is-on', botVoiceEnabled);
  }

  // ── Answer engine ────────────────────────────────────────────
  function answer(rawQ) {
    var q = String(rawQ || '').toLowerCase().trim();
    var listings = getListings();
    var ms = getMarketSummary();
    var ts = getTowerSummary();
    var activeListing = getCurrentListing();

    if (!listings.length) {
      return heroCard('Datos cargando', 'Todavía no detecto listados listos para analizar. Intenta de nuevo en un momento.', badge('Sin datos', 'warning'));
    }

    if (activeListing && matchAny(q, ['esta unidad', 'este listado', 'unidad actual', 'unidad abierta', 'este depa', 'este apartamento', 'analiza la unidad abierta'])) {
      return answerCurrentListing(activeListing);
    }

    var idMatch = rawQ.match(/\bsf[_-]?(\d+)\b/i);
    if (idMatch) {
      var lid = 'sf_' + idMatch[1].padStart(3, '0');
      var found = listings.find(function(l) { return String(l.id).toLowerCase() === lid.toLowerCase(); });
      if (found) return answerCurrentListing(found);
      return heroCard('Unidad no encontrada', 'No encontré ' + lid + ' en los datos activos.', badge('Sin match', 'warning'));
    }

    if (matchAny(q, ['mejor oportunidad', 'mejor listado', 'mejor unidad', 'mejor opción', 'top oportunidad', 'recomienda', 'recomend'])) {
      return answerBestOpportunity(listings, ms, ts);
    }
    if (matchAny(q, ['negoci', 'negociables', 'para negociar', 'negotiate'])) {
      return answerNegotiable(listings, ms);
    }
    if (matchAny(q, ['mayor $/m²', 'más caro por m', 'mas caro por m', '$/m²', 'precio m2', 'precio por m', 'psm', 'm²'])) {
      return answerTowerPsm(ts);
    }
    if (matchAny(q, ['mediana', 'precio mediano', 'promedio', 'average', 'precio medio'])) {
      return answerMedian(ms, ts, listings);
    }
    if (matchAny(q, ['días', 'dias', 'dom', 'mercado', 'más antiguo', 'mas antiguo', 'cuánto tiempo', 'cuanto tiempo'])) {
      return answerDOM(listings);
    }
    if (matchAny(q, ['confianza', 'riesgo', 'ghost', 'composite', 'score', 'risk', 'confidence', 'calidad'])) {
      return answerConfidenceRisk(listings, ms);
    }
    if (matchAny(q, ['torre', 'tower', 'península', 'peninsula', 'paradox', 'torre 300', 'comparar torres', 'comparación'])) {
      return answerTowerComparison(ts);
    }
    if (matchAny(q, ['precio', 'price', 'costo', 'renta', 'rent', 'barato', 'caro'])) {
      return answerPriceRange(listings, ms);
    }
    if (matchAny(q, ['cuántos', 'cuantos', 'total', 'universo', 'listados', 'disponibles', 'activos'])) {
      return answerSupply(listings, ms);
    }
    if (matchAny(q, ['rápido', 'rapido', 'fast', 'urgente', 'mover rápido', 'fast move'])) {
      return answerFastMove(listings, ms);
    }
    if (activeListing) {
      return answerCurrentListing(activeListing);
    }

    return answerMarketSnapshot(listings, ms, ts);
  }

  // ── Answer builders ──────────────────────────────────────────
  function answerBestOpportunity(listings, ms, ts) {
    var sorted = topByComposite(listings);
    var best = sorted[0];
    if (!best) return answerMarketSnapshot(listings, ms, ts);

    var scores  = listingScores(best);
    var pricing = listingPricing(best);
    var status  = listingStatus(best);

    var html = '';
    html += heroCard(best.title || best.id || 'Mejor oportunidad', buildingName(best.building) + ' · ' + (best.id || '—'), badge(status.label || 'Oportunidad destacada', statusTone(status.key)));
    html += '<div class="sfre-grid">';
    html += botMetric('Renta mensual', fmtMoney(best.price), 'accent');
    html += botMetric('$/m²', fmtMoneyShort(best.price_per_sqm), 'neutral');
    html += botMetric('Composite', scores.composite_score || '—', 'success');
    html += botMetric('Leverage', scores.leverage_score || '—', 'neutral');
    if (pricing.opening_anchor) html += botMetric('Ancla inicial', fmtMoney(pricing.opening_anchor), 'warning');
    if (pricing.target_close) html += botMetric('Cierre objetivo', fmtMoney(pricing.target_close), 'success');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Lectura rápida</div>';
    html += infoLine('Torre', buildingName(best.building));
    html += infoLine('DOM', (best.days_on_market || 0) + ' días');
    html += infoLine('Amueblado', best.furnished ? 'Sí' : 'No');
    html += infoLine('Confianza', (scores.confidence_score || '—') + '/100');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Top 5 por score</div>';
    html += tableWrap(['ID', 'Torre', 'Score', '$/m²', 'Estado'], sorted.slice(0, 5).map(function(l) {
      var sc = listingScores(l);
      var st = listingStatus(l);
      return row([
        '<span class="sfre-mono">' + escH(l.id || '—') + '</span>',
        escH(buildingName(l.building)),
        '<span class="sfre-mono">' + escH(String(sc.composite_score || '—')) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(l.price_per_sqm)) + '</span>',
        badge(statusLabel(st.key), statusTone(st.key))
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerNegotiable(listings, ms) {
    var neg = listings.filter(function(l) { return listingStatus(l).key === 'negotiate'; });

    var html = '';
    html += heroCard(neg.length + ' unidades negociables', 'Estas opciones muestran mejor señal para abrir conversación de precio.', badge('Negociación', 'warning'));
    html += '<div class="sfre-grid">';
    html += botMetric('Detectadas', neg.length, 'success');
    html += botMetric('Total mercado', listings.length, 'neutral');
    html += botMetric('Participación', listings.length ? Math.round((neg.length / listings.length) * 100) + '%' : '0%', 'accent');
    html += botMetric('Mediana mercado', fmtMoney(ms.median_price), 'neutral');
    html += '</div>';

    if (!neg.length) {
      html += '<div class="sfre-card"><div class="sfre-empty">No veo unidades marcadas como negociables en los datos actuales.</div></div>';
      return html;
    }

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Lista prioritaria</div>';
    html += tableWrap(['ID', 'Torre', 'Precio', '$/m²', 'Ancla'], neg.slice(0, 8).map(function(l) {
      var p = listingPricing(l);
      return row([
        '<span class="sfre-mono">' + escH(l.id || '—') + '</span>',
        escH(buildingName(l.building)),
        '<span class="sfre-mono">' + escH(fmtMoneyShort(l.price)) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(l.price_per_sqm)) + '</span>',
        '<span class="sfre-mono">' + escH(p.opening_anchor ? fmtMoneyShort(p.opening_anchor) : '—') + '</span>'
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerTowerPsm(ts) {
    var towers = Object.keys(ts).map(function(k) {
      return {
        key: k,
        name: buildingName(k),
        psm: (ts[k] || {}).median_price_per_sqm || 0,
        count: (ts[k] || {}).count || 0,
        best: (ts[k] || {}).best_value_id || '—'
      };
    }).sort(function(a, b) { return b.psm - a.psm; });

    if (!towers.length) return heroCard('Sin torres', 'No hay resumen por torre disponible.', badge('Sin datos', 'warning'));

    var top = towers[0];
    var html = '';
    html += heroCard(top.name, 'Es la torre con el $/m² mediano más alto del universo actual.', badge('Mayor $/m²', 'accent'));
    html += '<div class="sfre-grid">';
    html += botMetric('$/m² mediano', fmtMoneyShort(top.psm), 'accent');
    html += botMetric('Listados', top.count, 'neutral');
    html += botMetric('Mejor valor', top.best, 'success');
    html += botMetric('Torres comparadas', towers.length, 'neutral');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Ranking por $/m²</div>';
    html += tableWrap(['Torre', '$/m² mediano', 'Listados', 'Mejor valor'], towers.map(function(t) {
      return row([
        escH(t.name),
        '<span class="sfre-mono">' + escH(fmtMoneyShort(t.psm)) + '</span>',
        '<span class="sfre-mono">' + escH(String(t.count)) + '</span>',
        '<span class="sfre-mono">' + escH(t.best) + '</span>'
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerMedian(ms, ts, listings) {
    var html = '';
    html += heroCard(fmtMoney(ms.median_price || 0), 'Precio mediano mensual del mercado cargado.', badge('Mercado', 'accent'));
    html += '<div class="sfre-grid">';
    html += botMetric('$/m² mediano', fmtMoneyShort(ms.median_price_per_sqm), 'accent');
    html += botMetric('Precio promedio', fmtMoney(ms.avg_price), 'neutral');
    html += botMetric('$/m² promedio', fmtMoneyShort(ms.avg_price_per_sqm), 'neutral');
    html += botMetric('Listados', ms.total_listings || listings.length, 'neutral');
    html += '</div>';

    var rows = Object.keys(ts).map(function(k) {
      var t = ts[k] || {};
      return row([
        escH(buildingName(k)),
        '<span class="sfre-mono">' + escH(fmtMoneyShort(t.median_price)) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(t.median_price_per_sqm)) + '</span>',
        '<span class="sfre-mono">' + escH(String(t.count || 0)) + '</span>'
      ]);
    });

    if (rows.length) {
      html += '<div class="sfre-card">';
      html += '<div class="sfre-card-title">Comparativo por torre</div>';
      html += tableWrap(['Torre', 'Med. precio', 'Med. $/m²', 'Listados'], rows);
      html += '</div>';
    }

    return html;
  }

  function answerDOM(listings) {
    var sorted = listings.slice().sort(function(a, b) { return (b.days_on_market || 0) - (a.days_on_market || 0); });
    var maxDom = sorted[0] ? (sorted[0].days_on_market || 0) : 0;
    var avgDom = listings.length ? Math.round(avg(listings.map(function(l) { return l.days_on_market || 0; }))) : 0;
    var over30 = listings.filter(function(l) { return (l.days_on_market || 0) > 30; }).length;
    var over60 = listings.filter(function(l) { return (l.days_on_market || 0) > 60; }).length;

    var html = '';
    html += heroCard(maxDom + ' días', 'Este es el mayor tiempo detectado en mercado entre los listados activos.', badge('DOM', 'warning'));
    html += '<div class="sfre-grid">';
    html += botMetric('Mayor DOM', maxDom + 'd', 'warning');
    html += botMetric('DOM promedio', avgDom + 'd', 'neutral');
    html += botMetric('Más de 30 días', over30, 'neutral');
    html += botMetric('Más de 60 días', over60, 'danger');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Unidades con mayor antigüedad</div>';
    html += tableWrap(['ID', 'Torre', 'DOM', 'Precio', 'Estado'], sorted.slice(0, 6).map(function(l) {
      var st = listingStatus(l);
      return row([
        '<span class="sfre-mono">' + escH(l.id || '—') + '</span>',
        escH(buildingName(l.building)),
        '<span class="sfre-mono">' + escH(String((l.days_on_market || 0) + 'd')) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(l.price)) + '</span>',
        badge(statusLabel(st.key), statusTone(st.key))
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerConfidenceRisk(listings, ms) {
    var scored = listings.map(function(l) {
      var s = listingScores(l);
      return {
        id: l.id,
        building: l.building,
        confidence: s.confidence_score || 0,
        composite: s.composite_score || 0,
        ghost: s.ghost_probability || 0,
        leverage: s.leverage_score || 0,
        status: listingStatus(l).key || ''
      };
    });

    var avgConf = Math.round(avg(scored.map(function(x) { return x.confidence; })));
    var avgComp = Math.round(avg(scored.map(function(x) { return x.composite; })));
    var highGhost = scored.filter(function(x) { return x.ghost > 40; }).length;
    var highConf = scored.filter(function(x) { return x.confidence >= 70; }).length;

    var html = '';
    html += heroCard('Confianza promedio ' + avgConf + '/100', 'Lectura general de calidad de datos, claridad de oportunidad y riesgo fantasma.', badge('Riesgo y confianza', 'accent'));
    html += '<div class="sfre-grid">';
    html += botMetric('Confianza prom.', avgConf + '/100', 'success');
    html += botMetric('Composite prom.', avgComp + '/100', 'accent');
    html += botMetric('Alta confianza', highConf, 'success');
    html += botMetric('Ghost risk alto', highGhost, 'danger');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Detalle por unidad</div>';
    html += tableWrap(['ID', 'Confianza', 'Composite', 'Ghost %', 'Estado'], scored.slice().sort(function(a, b) {
      return b.confidence - a.confidence;
    }).slice(0, 8).map(function(l) {
      return row([
        '<span class="sfre-mono">' + escH(l.id || '—') + '</span>',
        '<span class="sfre-mono">' + escH(String(l.confidence)) + '</span>',
        '<span class="sfre-mono">' + escH(String(l.composite)) + '</span>',
        '<span class="sfre-mono">' + escH(String(l.ghost) + '%') + '</span>',
        badge(statusLabel(l.status), statusTone(l.status))
      ]);
    }));
    html += '</div>';

    if (ms.high_risk && ms.high_risk.length) {
      html += '<div class="sfre-card is-warning">';
      html += '<div class="sfre-card-title">Unidades marcadas como alto riesgo</div>';
      html += '<div class="sfre-risk-list">' + escH(ms.high_risk.join(', ')) + '</div>';
      html += '</div>';
    }

    return html;
  }

  function answerTowerComparison(ts) {
    var keys = Object.keys(ts);
    if (!keys.length) return heroCard('Sin comparativo', 'No hay resumen por torre.', badge('Sin datos', 'warning'));

    var html = '';
    html += heroCard('Comparación de torres', 'Vista rápida de inventario, precio, eficiencia por m² y tiempo en mercado.', badge('Torres', 'accent'));
    html += '<div class="sfre-card">';
    html += tableWrap(['Torre', 'Listados', 'Med. precio', '$/m²', 'DOM med.', 'Mejor valor'], keys.map(function(k) {
      var t = ts[k] || {};
      return row([
        escH(buildingName(k)),
        '<span class="sfre-mono">' + escH(String(t.count || 0)) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(t.median_price)) + '</span>',
        '<span class="sfre-mono">' + escH(fmtMoneyShort(t.median_price_per_sqm)) + '</span>',
        '<span class="sfre-mono">' + escH(String((t.median_days_on_market || 0) + 'd')) + '</span>',
        '<span class="sfre-mono">' + escH(String(t.best_value_id || '—')) + '</span>'
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerPriceRange(listings, ms) {
    var prices = listings.map(function(l) { return l.price || 0; }).sort(function(a, b) { return a - b; });
    var minP = prices[0] || 0;
    var maxP = prices[prices.length - 1] || 0;
    var cheapest = listings.slice().sort(function(a, b) { return (a.price || 0) - (b.price || 0); })[0];
    var priciest = listings.slice().sort(function(a, b) { return (b.price || 0) - (a.price || 0); })[0];

    var html = '';
    html += heroCard(fmtMoney(minP) + ' — ' + fmtMoney(maxP), 'Este es el rango de renta mensual detectado en el universo activo.', badge('Precios', 'accent'));
    html += '<div class="sfre-grid">';
    if (cheapest) html += botMetric('Más barato', cheapest.id + ' · ' + fmtMoneyShort(cheapest.price), 'success');
    if (priciest) html += botMetric('Más caro', priciest.id + ' · ' + fmtMoneyShort(priciest.price), 'danger');
    html += botMetric('Mediana', fmtMoney(ms.median_price), 'accent');
    html += botMetric('Promedio', fmtMoney(ms.avg_price), 'neutral');
    html += '</div>';
    return html;
  }

  function answerSupply(listings, ms) {
    var byBuilding = {};
    listings.forEach(function(l) { byBuilding[l.building] = (byBuilding[l.building] || 0) + 1; });

    var html = '';
    html += heroCard(listings.length + ' listados activos', 'Inventario visible en el contexto actual.', badge('Oferta', 'accent'));
    html += '<div class="sfre-grid">';
    Object.keys(byBuilding).forEach(function(k) {
      html += botMetric(buildingName(k), byBuilding[k], 'neutral');
    });
    html += botMetric('Negociables', ms.negotiate_count || 0, 'success');
    html += botMetric('Mover rápido', ms.fast_move_count || 0, 'accent');
    html += botMetric('Verificar', ms.verify_first_count || 0, 'warning');
    html += '</div>';
    return html;
  }

  function answerFastMove(listings, ms) {
    var fm = listings.filter(function(l) { return listingStatus(l).key === 'fast_move'; });

    var html = '';
    html += heroCard(fm.length + ' unidades con urgencia', 'Estas opciones tienen señal de decisión rápida.', badge('Fast move', 'accent'));
    html += '<div class="sfre-grid">';
    html += botMetric('Fast move', fm.length, 'accent');
    html += botMetric('Mercado total', listings.length, 'neutral');
    html += botMetric('Negociables', ms.negotiate_count || 0, 'success');
    html += botMetric('Mediana', fmtMoney(ms.median_price), 'neutral');
    html += '</div>';

    if (!fm.length) {
      html += '<div class="sfre-card"><div class="sfre-empty">Ninguna unidad está marcada como mover rápido en este momento.</div></div>';
      return html;
    }

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Prioridad inmediata</div>';
    html += tableWrap(['ID', 'Torre', 'Precio', 'DOM'], fm.map(function(l) {
      return row([
        '<span class="sfre-mono">' + escH(l.id || '—') + '</span>',
        escH(buildingName(l.building)),
        '<span class="sfre-mono">' + escH(fmtMoneyShort(l.price)) + '</span>',
        '<span class="sfre-mono">' + escH(String((l.days_on_market || 0) + 'd')) + '</span>'
      ]);
    }));
    html += '</div>';
    return html;
  }

  function answerCurrentListing(l) {
    if (!l) return heroCard('Sin unidad abierta', 'No detecto un listing activo en pantalla.', badge('Sin contexto', 'warning'));

    var scores  = listingScores(l);
    var pricing = listingPricing(l);
    var status  = listingStatus(l);

    var html = '';
    html += heroCard(l.title || l.id || 'Unidad abierta', buildingName(l.building) + ' · ' + (l.id || '—'), badge(status.label || statusLabel(status.key), statusTone(status.key)));
    html += '<div class="sfre-grid">';
    html += botMetric('Precio', fmtMoney(l.price), 'accent');
    html += botMetric('$/m²', fmtMoneyShort(l.price_per_sqm), 'neutral');
    html += botMetric('m²', l.sqm || '—', 'neutral');
    html += botMetric('Recámaras', l.beds || '—', 'neutral');
    html += botMetric('DOM', (l.days_on_market || 0) + 'd', 'warning');
    html += botMetric('Amueblado', l.furnished ? 'Sí' : 'No', 'neutral');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Scores de inteligencia</div>';
    html += '<div class="sfre-grid">';
    html += botMetric('Composite', scores.composite_score || '—', 'accent');
    html += botMetric('Leverage', scores.leverage_score || '—', 'success');
    html += botMetric('Confianza', scores.confidence_score || '—', 'success');
    html += botMetric('Ghost %', scores.ghost_probability != null ? scores.ghost_probability + '%' : '—', 'danger');
    html += '</div>';
    html += '</div>';

    if (pricing.opening_anchor || pricing.target_close || pricing.fair_low || pricing.walk_away) {
      html += '<div class="sfre-card">';
      html += '<div class="sfre-card-title">Banda de negociación</div>';
      html += '<div class="sfre-grid">';
      html += botMetric('Ancla apertura', pricing.opening_anchor ? fmtMoney(pricing.opening_anchor) : '—', 'warning');
      html += botMetric('Cierre objetivo', pricing.target_close ? fmtMoney(pricing.target_close) : '—', 'success');
      html += botMetric('Fair low', pricing.fair_low ? fmtMoney(pricing.fair_low) : '—', 'neutral');
      html += botMetric('Walk away', pricing.walk_away ? fmtMoney(pricing.walk_away) : '—', 'danger');
      html += '</div>';
      html += '</div>';
    }

    if (pricing.delta_to_peer_psqm_pct != null) {
      var delta = parseFloat(pricing.delta_to_peer_psqm_pct);
      html += '<div class="sfre-card">';
      html += '<div class="sfre-card-title">Comparativo contra pares</div>';
      html += '<div class="sfre-delta ' + (delta < 0 ? 'is-good' : 'is-bad') + '">Δ vs. peer group: ' + escH(pct(delta)) + '</div>';
      html += '</div>';
    }

    return html;
  }

  function answerMarketSnapshot(listings, ms, ts) {
    var html = '';
    html += heroCard('Snapshot del mercado', 'Vista rápida del inventario actual en Santa Fe.', badge('Mercado activo', 'accent'));
    html += '<div class="sfre-grid">';
    html += botMetric('Total listados', ms.total_listings || listings.length, 'neutral');
    html += botMetric('Precio mediano', fmtMoney(ms.median_price), 'accent');
    html += botMetric('$/m² mediano', fmtMoneyShort(ms.median_price_per_sqm), 'neutral');
    html += botMetric('Negociables', ms.negotiate_count || 0, 'success');
    html += '</div>';

    html += '<div class="sfre-card">';
    html += '<div class="sfre-card-title">Qué me puedes preguntar</div>';
    html += '<div class="sfre-suggest-grid">';
    STARTER_PROMPTS.forEach(function(p) {
      html += '<button class="sfre-inline-chip" data-inline-q="' + escH(p) + '">' + escH(p) + '</button>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ── UI ───────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById('sfBotFab')) return;

    var fab = document.createElement('button');
    fab.id = 'sfBotFab';
    fab.className = 'sfre-fab';
    fab.setAttribute('aria-label', 'Abrir asistente inmobiliario');
    fab.setAttribute('title', 'Santa Fe Realty AI');
    fab.innerHTML = '' +
      '<span class="sfre-fab-icon">' + houseIcon() + '</span>' +
      '<span class="sfre-fab-copy">' +
        '<span class="sfre-fab-title">Preguntar</span>' +
        '<span class="sfre-fab-sub">real estate AI</span>' +
      '</span>';
    document.body.appendChild(fab);

    var panel = document.createElement('section');
    panel.id = 'sfBotPanel';
    panel.className = 'sfre-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Asistente inmobiliario');
    panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = '' +
      '<div class="sfre-shell">' +
        '<div class="sfre-header">' +
          '<div class="sfre-header-left">' +
            avatarMarkup() +
            '<div class="sfre-brand-copy">' +
              '<div class="sfre-brand-name">' + escH(BOT_NAME) + '</div>' +
              '<div class="sfre-brand-sub" id="sfBotHeaderSub">Inteligencia local · sin backend</div>' +
            '</div>' +
          '</div>' +
          '<div class="sfre-header-right">' +
            '<button class="sfre-voice-btn is-on" id="sfBotVoiceBtn" type="button" aria-label="Activar o desactivar voz" aria-pressed="true">Voz: On</button>' +
            '<button class="sfre-close-btn" id="sfBotCloseBtn" aria-label="Cerrar asistente">×</button>' +
          '</div>' +
        '</div>' +
        '<div class="sfre-market-strip" id="sfBotMarketStrip"></div>' +
        '<div class="sfre-messages" id="sfBotMessages" role="log" aria-live="polite"></div>' +
        '<div class="sfre-starters" id="sfBotStarters"></div>' +
        '<div class="sfre-input-row">' +
          '<input type="text" id="sfBotInput" class="sfre-input" maxlength="320" placeholder="Pregunta sobre mercado, torres, precios o una unidad" autocomplete="off" aria-label="Pregunta al asistente" />' +
          '<button id="sfBotSendBtn" class="sfre-send-btn" aria-label="Enviar pregunta">' + sparkIcon() + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    fab.addEventListener('click', togglePanel);
    document.getElementById('sfBotCloseBtn').addEventListener('click', closePanel);
    document.getElementById('sfBotVoiceBtn').addEventListener('click', toggleVoice);
    document.getElementById('sfBotSendBtn').addEventListener('click', function() { sendQuestion(); });

    var input = document.getElementById('sfBotInput');
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
      }
    });

    document.getElementById('sfBotMessages').addEventListener('click', function(e) {
      var chip = e.target.closest('[data-inline-q]');
      if (chip) sendQuestion(chip.getAttribute('data-inline-q'));
    });

    renderMarketStrip();
    renderStarters();
    pushMessage('bot', welcomeHtml(), BOT_INTRO);
    updateVoiceButton();
    syncAvatarState();
  }

  function welcomeHtml() {
    var ms = getMarketSummary();
    var listings = getListings();
    var total = ms.total_listings || listings.length || 0;

    var html = '';
    html += heroCard('Bienvenida', BOT_INTRO, badge('Asistente listo', 'success'));
    html += '<div class="sfre-grid">';
    html += botMetric('Listados', total, 'neutral');
    html += botMetric('Precio mediano', fmtMoney(ms.median_price), 'accent');
    html += botMetric('Negociables', ms.negotiate_count || 0, 'success');
    html += botMetric('Mover rápido', ms.fast_move_count || 0, 'accent');
    html += '</div>';
    return html;
  }

  function renderMarketStrip() {
    var el = document.getElementById('sfBotMarketStrip');
    if (!el) return;
    var ms = getMarketSummary();
    var listings = getListings();
    var total = ms.total_listings || listings.length || 0;

    el.innerHTML = '' +
      '<div class="sfre-strip-pill">Mercado: ' + escH(String(total)) + ' activos</div>' +
      '<div class="sfre-strip-pill">Mediana: ' + escH(fmtMoney(ms.median_price)) + '</div>' +
      '<div class="sfre-strip-pill">Negociables: ' + escH(String(ms.negotiate_count || 0)) + '</div>';
  }

  function renderStarters() {
    var el = document.getElementById('sfBotStarters');
    if (!el) return;

    if (messages.length > 1) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    el.innerHTML = STARTER_PROMPTS.map(function(p) {
      return '<button class="sfre-chip" data-q="' + escH(p) + '">' + escH(p) + '</button>';
    }).join('');

    el.querySelectorAll('.sfre-chip').forEach(function(btn) {
      btn.addEventListener('click', function() { sendQuestion(btn.getAttribute('data-q')); });
    });
  }

  function togglePanel() {
    if (panelOpen) closePanel(); else openPanel();
  }

  function openPanel() {
    var panel = document.getElementById('sfBotPanel');
    var fab = document.getElementById('sfBotFab');
    if (!panel || !fab) return;

    panelOpen = true;
    panel.classList.add('is-open');
    fab.classList.add('is-active');
    fab.setAttribute('aria-expanded', 'true');

    var cur = getCurrentListing();
    var sub = document.getElementById('sfBotHeaderSub');
    if (sub) {
      sub.textContent = cur ? ('Contexto activo: ' + (cur.title || cur.id || 'unidad')) : 'Inteligencia local · sin backend';
    }

    renderMarketStrip();
    syncAvatarState();
    applyListingAvatarState(getCurrentListing());

    setTimeout(function() {
      var input = document.getElementById('sfBotInput');
      if (input) input.focus();
    }, 70);
  }

  function closePanel() {
    var panel = document.getElementById('sfBotPanel');
    var fab = document.getElementById('sfBotFab');
    if (!panel || !fab) return;

    panelOpen = false;
    panel.classList.remove('is-open');
    fab.classList.remove('is-active');
    fab.setAttribute('aria-expanded', 'false');
    stopBotSpeech();
    syncAvatarState();
  }

  function pushMessage(role, html, rawText) {
    messages.push({ role: role, html: html, text: rawText });
    renderMessages();
  }

  function pushThinking(id) {
    var container = document.getElementById('sfBotMessages');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'sfre-message is-bot';
    el.id = id;
    el.innerHTML = '<div class="sfre-thinking"><span></span><span></span><span></span></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function removeThinking(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  }

  function renderMessages() {
    var container = document.getElementById('sfBotMessages');
    if (!container) return;

    container.innerHTML = messages.map(function(m) {
      return '<div class="sfre-message ' + (m.role === 'user' ? 'is-user' : 'is-bot') + '">' + m.html + '</div>';
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function sendQuestion(overrideQ) {
    var input = document.getElementById('sfBotInput');
    var q = String(overrideQ || (input ? input.value : '') || '').trim();
    if (!q) return;
    if (input && !overrideQ) input.value = '';

    pushMessage('user', '<div class="sfre-user-bubble">' + escH(q) + '</div>', q);

    var starters = document.getElementById('sfBotStarters');
    if (starters) starters.style.display = 'none';

    var thinkId = 'sfBotThink_' + Date.now();
    pushThinking(thinkId);

    botThinking = true;
    syncAvatarState();

    setTimeout(function() {
      removeThinking(thinkId);
      botThinking = false;
      syncAvatarState();

      var html = answer(q);
      pushMessage('bot', html, q);
      speakBotResponse(html);
      applyListingAvatarState(getCurrentListing());
    }, 180);
  }

  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === 'Escape' && panelOpen) {
      closePanel();
    }
  });

  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.onvoiceschanged = function() {}; } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }

  window.sfBotOpen = openPanel;

  // ── Styles ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sfBotStyles')) return;

    var css = '' +
      ':root{' +
        '--sfre-bg:#0d131a;' +
        '--sfre-surface:#121d27;' +
        '--sfre-surface-2:#1b2a38;' +
        '--sfre-card:#f8f5ef;' +
        '--sfre-border:rgba(255,255,255,.08);' +
        '--sfre-border-light:#eadfce;' +
        '--sfre-text:#f5f7fb;' +
        '--sfre-text-dark:#1c2630;' +
        '--sfre-muted:#8ca0b3;' +
        '--sfre-accent:#c69253;' +
        '--sfre-accent-2:#8e6236;' +
        '--sfre-success:#2b8a61;' +
        '--sfre-warning:#c2802d;' +
        '--sfre-danger:#b75454;' +
        '--sfre-radius-xl:28px;' +
        '--sfre-radius-lg:20px;' +
        '--sfre-radius-md:14px;' +
        '--sfre-radius-sm:12px;' +
        '--sfre-shadow:0 22px 60px rgba(0,0,0,.38);' +
        '--sfre-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        '--sfre-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' +
      '}' +

      '#sfBotFab.sfre-fab{' +
        'position:fixed;right:22px;bottom:22px;z-index:99998;border:0;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:999px;background:linear-gradient(135deg,#fff8ef,#f0dec6);color:#1b2430;box-shadow:var(--sfre-shadow);font-family:var(--sfre-font);transition:transform .22s ease,opacity .22s ease;' +
      '}' +
      '#sfBotFab.sfre-fab:hover{transform:translateY(-2px)}' +
      '#sfBotFab.sfre-fab.is-active{opacity:.94}' +
      '.sfre-fab-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--sfre-accent),#e8c38e);color:#fff;flex:none}' +
      '.sfre-fab-icon svg{width:20px;height:20px}' +
      '.sfre-fab-copy{display:flex;flex-direction:column;align-items:flex-start;line-height:1.05}' +
      '.sfre-fab-title{font-size:14px;font-weight:800}' +
      '.sfre-fab-sub{font-size:11px;color:#6b5b46}' +

      '#sfBotPanel.sfre-panel{' +
        'position:fixed;right:22px;bottom:88px;width:min(470px,calc(100vw - 24px));height:min(82vh,800px);z-index:99999;opacity:0;transform:translateY(12px) scale(.985);pointer-events:none;transition:all .22s ease;font-family:var(--sfre-font);' +
      '}' +
      '#sfBotPanel.sfre-panel.is-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}' +
      '.sfre-shell{' +
        'height:100%;display:flex;flex-direction:column;overflow:hidden;border-radius:32px;background:linear-gradient(180deg,#0e1720 0%,#172634 100%);box-shadow:var(--sfre-shadow);border:1px solid rgba(255,255,255,.08);' +
      '}' +

      '.sfre-header{' +
        'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 16px 12px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0));color:var(--sfre-text);' +
      '}' +
      '.sfre-header-left{display:flex;align-items:center;gap:12px;min-width:0}' +
      '.sfre-header-right{display:flex;align-items:center;gap:8px;flex:none}' +
      '.sfre-brand-copy{min-width:0}' +
      '.sfre-brand-name{font-size:15px;font-weight:800;letter-spacing:.01em}' +
      '.sfre-brand-sub{font-size:12px;color:var(--sfre-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}' +

      '.sfre-voice-btn,.sfre-close-btn{' +
        'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;height:38px;border-radius:12px;cursor:pointer;padding:0 12px;font-weight:700;transition:background .16s ease,border-color .16s ease,transform .16s ease;' +
      '}' +
      '.sfre-close-btn{width:38px;padding:0;font-size:24px;line-height:1}' +
      '.sfre-voice-btn:hover,.sfre-close-btn:hover{background:rgba(255,255,255,.10)}' +
      '.sfre-voice-btn:active,.sfre-close-btn:active{transform:scale(.98)}' +
      '.sfre-voice-btn.is-on{border-color:rgba(198,146,83,.35);color:#f7e6cd}' +

      '.sf-bot-avatar{' +
        'position:relative;width:72px;height:72px;border-radius:22px;overflow:hidden;flex:none;background:linear-gradient(180deg,#1f2d3b,#12202d);box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);transition:box-shadow .18s ease,border-color .18s ease,transform .18s ease,opacity .18s ease;' +
      '}' +
      '.sf-bot-avatar-face,.sf-bot-avatar-photo{position:absolute;inset:0}' +
      '.sf-bot-avatar-photo{background-size:cover;background-position:center center;filter:saturate(1.02) contrast(1.03)}' +
      '.sf-bot-avatar-ring{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}' +
      '.sf-bot-avatar-face{background:linear-gradient(180deg,#28384c 0%,#16202d 100%)}' +
      '.sf-bot-avatar-hair{position:absolute;left:9px;right:9px;top:6px;height:28px;border-radius:18px 18px 12px 12px;background:linear-gradient(180deg,#2a1f1a,#0f0b09)}' +
      '.sf-bot-avatar-head{position:absolute;left:14px;right:14px;top:13px;bottom:9px;border-radius:20px 20px 22px 22px;background:linear-gradient(180deg,#f0cdb0,#ddb08b)}' +
      '.sf-bot-avatar-eyes{position:absolute;top:29px;left:19px;right:19px;display:flex;justify-content:space-between;pointer-events:none}' +
      '.sf-bot-avatar-eye{width:8px;height:8px;border-radius:999px;background:#17202d;box-shadow:0 0 7px rgba(142,197,255,.65)}' +
      '.sf-bot-avatar-mouth{position:absolute;left:50%;bottom:14px;width:13px;height:3px;transform:translateX(-50%);border-radius:999px;background:#7a3d30;transform-origin:center center}' +
      '.sf-bot-avatar-home{position:absolute;right:5px;bottom:5px;width:18px;height:18px;border-radius:999px;display:grid;place-items:center;background:rgba(198,146,83,.92);color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.28)}' +
      '.sf-bot-avatar-home svg{width:11px;height:11px}' +

      '.sf-bot-avatar--idle{opacity:.92}' +
      '.sf-bot-avatar--active{box-shadow:0 0 12px rgba(59,130,246,.4)}' +
      '.sf-bot-avatar--normal{box-shadow:0 0 0 rgba(0,0,0,0)}' +
      '.sf-bot-avatar--negotiating{box-shadow:0 0 18px rgba(245,158,11,.55);border-color:rgba(245,158,11,.65)}' +
      '.sf-bot-avatar--high-risk{box-shadow:0 0 18px rgba(239,68,68,.60);border-color:rgba(239,68,68,.70)}' +
      '.sf-bot-avatar--high-confidence{box-shadow:0 0 18px rgba(34,197,94,.60);border-color:rgba(34,197,94,.70)}' +
      '.sf-bot-avatar--thinking .sf-bot-avatar-mouth{animation:sfBotThinkingMouth .95s ease-in-out infinite alternate}' +
      '.sf-bot-avatar--speaking .sf-bot-avatar-mouth{animation:sfBotSpeakingMouth .28s ease-in-out infinite alternate}' +
      '.sf-bot-avatar--speaking .sf-bot-avatar-eye{box-shadow:0 0 9px rgba(142,197,255,.82)}' +
      '.sf-bot-avatar--thinking .sf-bot-avatar-eye{animation:sfBotEyePulse 1.1s ease-in-out infinite alternate}' +
      '@keyframes sfBotThinkingMouth{from{transform:translateX(-50%) scaleX(1) scaleY(1)}to{transform:translateX(-50%) scaleX(1.12) scaleY(1.28)}}' +
      '@keyframes sfBotSpeakingMouth{from{transform:translateX(-50%) scaleX(1) scaleY(1)}to{transform:translateX(-50%) scaleX(1.08) scaleY(1.9)}}' +
      '@keyframes sfBotEyePulse{from{opacity:.86}to{opacity:1;transform:scale(1.08)}}' +

      '.sfre-market-strip{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px 0 16px}' +
      '.sfre-strip-pill{font-size:11px;color:#f5ead8;background:rgba(198,146,83,.16);border:1px solid rgba(198,146,83,.24);padding:8px 10px;border-radius:999px}' +

      '.sfre-messages{flex:1;overflow:auto;padding:14px 14px 6px 14px;display:flex;flex-direction:column;gap:12px}' +
      '.sfre-message{display:flex;max-width:100%}' +
      '.sfre-message.is-user{justify-content:flex-end}' +
      '.sfre-message.is-bot{justify-content:flex-start}' +
      '.sfre-user-bubble{max-width:85%;padding:12px 14px;border-radius:18px 18px 6px 18px;background:linear-gradient(135deg,var(--sfre-accent),#ddbb8b);color:#fff;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.18)}' +

      '.sfre-hero{display:flex;align-items:stretch;justify-content:space-between;gap:14px;padding:18px;border-radius:22px;background:linear-gradient(135deg,#fff8f0 0%,#f4ebdf 52%,#fdfcf9 100%);border:1px solid var(--sfre-border-light);color:var(--sfre-text-dark)}' +
      '.sfre-hero-kicker{font-size:11px;font-weight:700;color:#8a6a47;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}' +
      '.sfre-hero-title{font-size:22px;line-height:1.08;font-weight:800;color:#1b2632}' +
      '.sfre-hero-sub{margin-top:8px;font-size:13px;line-height:1.5;color:#566474}' +
      '.sfre-hero-art{width:68px;height:68px;border-radius:20px;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,#132131,#223548);color:#f3d6aa;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}' +
      '.sfre-hero-art svg{width:30px;height:30px}' +

      '.sfre-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}' +
      '.sfre-metric{padding:14px 14px 12px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--sfre-text)}' +
      '.sfre-metric.is-accent{background:rgba(198,146,83,.12);border-color:rgba(198,146,83,.25)}' +
      '.sfre-metric.is-success{background:rgba(45,140,99,.12);border-color:rgba(45,140,99,.22)}' +
      '.sfre-metric.is-warning{background:rgba(197,125,45,.12);border-color:rgba(197,125,45,.24)}' +
      '.sfre-metric.is-danger{background:rgba(184,85,85,.12);border-color:rgba(184,85,85,.22)}' +
      '.sfre-metric-label{font-size:11px;color:var(--sfre-muted);margin-bottom:7px;letter-spacing:.03em;text-transform:uppercase}' +
      '.sfre-metric-value{font-size:16px;font-weight:800;line-height:1.2;word-break:break-word}' +

      '.sfre-card{margin-top:12px;padding:14px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--sfre-text)}' +
      '.sfre-card.is-warning{background:rgba(197,125,45,.12);border-color:rgba(197,125,45,.2)}' +
      '.sfre-card-title{font-size:13px;font-weight:800;margin-bottom:12px;color:#f5f3ee}' +
      '.sfre-empty{font-size:13px;color:var(--sfre-muted)}' +
      '.sfre-risk-list{font-size:13px;line-height:1.55;color:#f7ede0}' +

      '.sfre-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}' +
      '.sfre-line:first-of-type{border-top:0;padding-top:0}' +
      '.sfre-line-label{font-size:12px;color:var(--sfre-muted)}' +
      '.sfre-line-value{font-size:13px;color:#fff;font-weight:700;text-align:right}' +

      '.sfre-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}' +
      '.sfre-badge.is-accent{background:#efe2cd;color:#8a5a2e}' +
      '.sfre-badge.is-success{background:#d9efe6;color:#236c4d}' +
      '.sfre-badge.is-warning{background:#f6e5d0;color:#9b6225}' +
      '.sfre-badge.is-danger{background:#f5dddd;color:#9e4545}' +
      '.sfre-badge.is-neutral{background:#eceff3;color:#5a6673}' +

      '.sfre-table-wrap{overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,.07)}' +
      '.sfre-table{width:100%;border-collapse:collapse;font-size:12px;background:rgba(8,14,20,.24)}' +
      '.sfre-table th{position:sticky;top:0;background:#1a2835;color:#d5dde7;text-align:left;padding:10px 11px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}' +
      '.sfre-table td{padding:11px;border-top:1px solid rgba(255,255,255,.06);color:#f6f8fb;vertical-align:middle}' +
      '.sfre-table tr:hover td{background:rgba(255,255,255,.025)}' +
      '.sfre-mono{font-family:var(--sfre-mono);font-variant-numeric:tabular-nums}' +

      '.sfre-starters{padding:0 14px 12px 14px;display:flex;gap:8px;flex-wrap:wrap}' +
      '.sfre-chip,.sfre-inline-chip{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#eff4fb;padding:10px 12px;border-radius:999px;font-size:12px;cursor:pointer;transition:all .18s ease}' +
      '.sfre-chip:hover,.sfre-inline-chip:hover{background:rgba(198,146,83,.14);border-color:rgba(198,146,83,.24);transform:translateY(-1px)}' +
      '.sfre-suggest-grid{display:flex;flex-wrap:wrap;gap:8px}' +

      '.sfre-input-row{display:flex;gap:10px;padding:14px;border-top:1px solid rgba(255,255,255,.08);background:rgba(9,15,20,.28)}' +
      '.sfre-input{flex:1;min-width:0;height:48px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;padding:0 16px;font-size:14px;outline:none}' +
      '.sfre-input::placeholder{color:#8ea1b5}' +
      '.sfre-input:focus{border-color:rgba(198,146,83,.45);box-shadow:0 0 0 4px rgba(198,146,83,.12)}' +
      '.sfre-send-btn{width:48px;height:48px;border:0;border-radius:16px;cursor:pointer;background:linear-gradient(135deg,var(--sfre-accent),#e1bd89);color:#fff;display:grid;place-items:center;flex:none}' +
      '.sfre-send-btn svg{width:18px;height:18px}' +

      '.sfre-thinking{display:flex;gap:6px;align-items:center;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.06);width:max-content}' +
      '.sfre-thinking span{width:8px;height:8px;border-radius:999px;background:#d8c19f;animation:sfrePulse 1.1s infinite ease-in-out}' +
      '.sfre-thinking span:nth-child(2){animation-delay:.15s}' +
      '.sfre-thinking span:nth-child(3){animation-delay:.3s}' +
      '@keyframes sfrePulse{0%,80%,100%{transform:scale(.65);opacity:.45}40%{transform:scale(1);opacity:1}}' +

      '.sfre-delta{font-size:14px;font-weight:800;font-family:var(--sfre-mono)}' +
      '.sfre-delta.is-good{color:#7ae0b2}' +
      '.sfre-delta.is-bad{color:#ffb3a8}' +

      '.sfre-messages::-webkit-scrollbar,.sfre-table-wrap::-webkit-scrollbar{width:10px;height:10px}' +
      '.sfre-messages::-webkit-scrollbar-thumb,.sfre-table-wrap::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px}' +

      '@media (max-width:640px){' +
        '#sfBotPanel.sfre-panel{right:10px;left:10px;bottom:84px;width:auto;height:min(79vh,760px)}' +
        '#sfBotFab.sfre-fab{right:14px;bottom:14px;padding:12px 14px}' +
        '.sfre-grid{grid-template-columns:1fr}' +
        '.sfre-brand-sub{max-width:140px}' +
        '.sfre-hero{padding:16px}' +
        '.sfre-hero-title{font-size:20px}' +
      '}' +

      '@media (prefers-reduced-motion:reduce){' +
        '#sfBotPanel.sfre-panel,#sfBotFab.sfre-fab,.sfre-chip,.sfre-inline-chip,.sf-bot-avatar{transition:none}' +
        '.sfre-thinking span,.sf-bot-avatar--thinking .sf-bot-avatar-mouth,.sf-bot-avatar--speaking .sf-bot-avatar-mouth,.sf-bot-avatar--thinking .sf-bot-avatar-eye{animation:none}' +
      '}';

    var style = document.createElement('style');
    style.id = 'sfBotStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }

})();
