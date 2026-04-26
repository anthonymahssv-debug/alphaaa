// ══════════════════════════════════════════════════════════════
//  Santa Fe CI — i18n.js
//  Locale & currency toggle: English/Spanish + USD/MXN
//  Vanilla JS, in-memory state (no localStorage/sessionStorage).
// ══════════════════════════════════════════════════════════════

'use strict';

// ── Locale Config ─────────────────────────────────────────────
var LOCALE_CONFIG = {
  'es-MX': {
    languageLabel: 'Español',
    currencyLabel: 'MXN',
    currency: 'MXN',
    flag: 'MX',
    // Exchange: MXN is the base — no conversion needed
    rateFromMXN: 1
  },
  'en-US': {
    languageLabel: 'English',
    currencyLabel: 'USD',
    currency: 'USD',
    flag: 'US',
    // Approximate exchange rate: 1 USD ≈ 17.5 MXN (fixed reference rate for display)
    rateFromMXN: 1 / 17.5
  }
};

// ── Active State (in-memory only — no blocked storage APIs) ───
var _activeLocale = 'es-MX';

// ── Persistence: try URL hash param, then fall back to default ─
(function initLocale() {
  // Attempt to read from URL param ?locale=en-US for persistence
  try {
    var params = new URLSearchParams(window.location.search);
    var urlLocale = params.get('locale');
    if (urlLocale && LOCALE_CONFIG[urlLocale]) {
      _activeLocale = urlLocale;
    }
  } catch (e) {}
})();

// ── Public API ─────────────────────────────────────────────────

/** Get the current locale string */
function getLocale() { return _activeLocale; }

/** Get the current currency code */
function getCurrency() { return LOCALE_CONFIG[_activeLocale].currency; }

/** Get config for the active locale */
function getLocaleConfig() { return LOCALE_CONFIG[_activeLocale]; }

/** Switch locale + trigger full app re-render */
function setLocale(locale) {
  if (!LOCALE_CONFIG[locale]) return;
  _activeLocale = locale;

  // Persist in URL (no localStorage/sessionStorage/cookies needed)
  try {
    var url = new URL(window.location.href);
    if (locale === 'es-MX') {
      url.searchParams.delete('locale'); // default: no param needed
    } else {
      url.searchParams.set('locale', locale);
    }
    window.history.replaceState({}, '', url.toString());
  } catch (e) {}

  applyLocaleToDOM();
  refreshMoneyDisplay();
}

// ── Money Formatting ───────────────────────────────────────────

/**
 * Convert a MXN base amount to the active currency.
 * All prices in the app are stored in MXN, so this handles display.
 */
function convertFromMXN(mxnAmount) {
  if (!mxnAmount || isNaN(mxnAmount)) return 0;
  return Number(mxnAmount) * LOCALE_CONFIG[_activeLocale].rateFromMXN;
}

/**
 * Format a MXN base amount using Intl, in the active locale + currency.
 * Returns a formatted string like "$62,000" (MXN) or "$3,543" (USD).
 */
function formatMoney(mxnAmount) {
  if (mxnAmount === null || mxnAmount === undefined) return '—';
  var converted = convertFromMXN(Number(mxnAmount));
  var locale = _activeLocale;
  var currency = LOCALE_CONFIG[locale].currency;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(converted);
  } catch (e) {
    // Fallback: plain formatted number
    return (currency === 'MXN' ? '$' : 'USD ') +
      Number(converted).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

/**
 * Format a MXN base number (plain, no currency symbol) in locale style.
 * Used for $/m² labels where the symbol is added separately.
 */
function formatNum(mxnAmount) {
  if (mxnAmount === null || mxnAmount === undefined) return '0';
  var converted = convertFromMXN(Number(mxnAmount));
  return Number(converted).toLocaleString(_activeLocale, { maximumFractionDigits: 0 });
}

/**
 * Compact formatted money with symbol: "$62k" style for map popups.
 * Always uses the active locale/currency.
 */
function formatMoneyCompact(mxnAmount) {
  if (!mxnAmount) return '—';
  var converted = convertFromMXN(Number(mxnAmount));
  var currency = getCurrency();
  var sym = currency === 'MXN' ? '$' : 'USD ';
  if (converted >= 1000) {
    return sym + (converted / 1000).toLocaleString(_activeLocale, { maximumFractionDigits: 1 }) + 'k';
  }
  return sym + Number(converted).toLocaleString(_activeLocale, { maximumFractionDigits: 0 });
}

/** Currency unit label string: "MXN/mes" or "USD/mo" */
function currencyUnitLabel() {
  return getCurrency() === 'MXN' ? 'MXN/mes' : 'USD/mo';
}

/** $/m² label with active currency */
function psmLabel() {
  return getCurrency() + '/m²';
}

// ── Translations ───────────────────────────────────────────────

var TRANSLATIONS = {
  'es-MX': {
    // Nav
    'nav.overview':    'Vista',
    'nav.operator':    'Operador',
    'nav.compare':     'Comparar',
    'nav.agents':      'Agentes',
    'nav.dashboard':   'Dashboard',
    'nav.map':         'Mapa',
    'nav.tracking':    'Fuentes',

    // Header
    'header.ask':      'Preguntar',
    'header.logo-tagline': 'Market Intelligence',

    // Pulse bar
    'pulse.listings':    '— listados',
    'pulse.negotiable':  '— negociables',
    'pulse.loading':     'Cargando',

    // Hero
    'hero.eyebrow':    'Motor de Decisión Inmobiliaria',
    'hero.sub':        'Santa Fe · CDMX · Arrendamiento de alto valor · Península · Torre 300 · Paradox',
    'hero.badge':      'Santa Fe CI · Abril 2026',
    'hero.stat.listings':  'Listados',
    'hero.stat.median':    'Renta mediana',
    'hero.stat.negotiable':'Negociables',

    // Overview
    'overview.title':  'Decisión de Arrendamiento · Santa Fe',
    'overview.loading':'Cargando listados…',
    'filter.all':      'Todos',
    'filter.negotiate':'Negociar',
    'filter.1bed':     '1 Rec',
    'filter.2bed':     '2 Rec',
    'filter.3bed':     '3+ Rec',

    // Decision banner
    'decision.eyebrow':    'Motor de decisión',
    'decision.guide-btn':  'Guía rápida',

    // Advanced filters
    'adv.title':           'Filtros avanzados',
    'adv.tower-label':     'Torre',
    'adv.tower-all':       'Todas las torres',
    'adv.beds-label':      'Recámaras',
    'adv.beds-all':        'Todas',
    'adv.beds-1':          '1 recámara',
    'adv.beds-2':          '2 recámaras',
    'adv.beds-3':          '3+ recámaras',
    'adv.sort-label':      'Ordenar por',
    'adv.sort-opportunity':'Mejor oportunidad (score composite)',
    'adv.sort-leverage':   'Leverage de negociación',
    'adv.sort-price-asc':  'Precio ↑',
    'adv.sort-price-desc': 'Precio ↓',
    'adv.sort-dom':        'Mayor antigüedad en mercado (DOM)',
    'adv.minprice-label':  'Renta mín.',
    'adv.minsqm-label':    'M² mínimo',
    'adv.negotiable-only': 'Solo negociables',
    'adv.apply':           'Aplicar filtros',
    'adv.reset':           'Restablecer',

    // Context strip
    'ctx.universe':    'Inventario activo',
    'ctx.median':      'Renta mediana',
    'ctx.negotiate':   'Negociables',
    'ctx.best-deal':   'Mejor oportunidad',

    // Market charts
    'market.title':    'Distribución de Mercado',
    'market.tab.psm':  'Renta/m²',
    'market.tab.dom':  'Días en Mercado',
    'market.tab.score':'Score de Valor',

    // Market chart tab buttons (used in data-i18n on panel-tabs)
    'market.tab.psm.btn':   'Renta/m²',
    'market.tab.dom.btn':   'Días en Mercado',
    'market.tab.score.btn': 'Score Valor',

    // Events
    'events.title':    'Actividad reciente de mercado',

    // Listings section
    'listings.title':  'Listados activos',
    'listings.sort':   'Ordenar:',
    'sort.opportunity':'Mejor oportunidad',
    'sort.leverage':   'Leverage',
    'sort.price-asc':  'Renta ascendente',
    'sort.price-desc': 'Renta descendente',
    'sort.dom':        'Mayor antigüedad en mercado',

    // Card labels
    'card.status.available':   'Disponible',
    'card.open-source':        'Fuente',
    'card.open-analysis':      'Abrir análisis',
    'card.open-listing':       'Ver listado',
    'card.photos':             'fotos',
    'card.days-market':        'días en mercado',
    'card.beds':               'rec',
    'card.sqm':                'm²',

    // Overview subtitle template
    'overview.sub.active':      'activos',
    'overview.sub.towers':      'torres',
    'overview.sub.negotiable':  'para negociar',

    // Operator view
    'operator.title':  'Workbench de Negociación',
    'operator.sub':    'Ordenado por score de acción · Banda de oferta y argumentos incluidos',
    'operator.filter.all':       'Todos',
    'operator.filter.negotiate': 'Negociar',
    'operator.filter.fast':      'Movimiento rápido',
    'operator.filter.verify':    'Verificar',
    'operator.filter.monitor':   'Monitorear',
    'operator.group.negotiate':  'Negociar ahora',
    'operator.group.fast_move':  'Movimiento rápido',
    'operator.group.verify':     'Verificar primero',
    'operator.group.monitor':    'Monitorear',
    'operator.group.avoid':      'Evitar',
    'operator.group.uncategorized': 'Sin categoría',
    'operator.group.listings':   'listados',
    'operator.chip.negotiate':   'Negociar',
    'operator.chip.fast':        'Mov. rápido',
    'operator.chip.verify':      'Verificar',
    'operator.chip.monitor':     'Monitorear',
    'operator.card.beds':        'rec',
    'operator.card.dom':         'd en mercado',
    'operator.card.leverage':    'Potencial',
    'operator.card.vacancy':     'Vacancia',
    'operator.card.furnished':   'Amueblado',
    'operator.card.target':      'Target',
    'operator.empty':            'No hay acciones para este filtro.',

    // Compare view
    'compare.title':   'Benchmark por Torre',
    'compare.sub':     'Renta/m² · Días en mercado · Leverage · Score composite por edificio',
    'compare.metric.price_per_sqm':     'Renta por m²',
    'compare.metric.price':             'Renta mensual',
    'compare.metric.composite_score':   'Score Composite',
    'compare.metric.value_score':       'Score de Valor',
    'compare.metric.ghost_probability': 'Disponibilidad real',
    'compare.metric.leverage_score':    'Score de Leverage',
    'compare.metric.days_on_market':    'Días en Mercado',
    'compare.subtitle.all':             'Benchmark operativo · Todos los listados por edificio',
    'compare.subtitle.units':           'unidades',
    'compare.cross-tower':              'Comparativa entre torres',
    'compare.benchmark-label':          'Benchmark operativo',
    'compare.benchmark-hint':           'Benchmark por torre: $/m², días en mercado y score composite. Selecciona una métrica para comenzar.',

    // Agents view
    'agents.title':    'Inteligencia de Agentes',
    'agents.sub':      'Credibilidad, historial y propiedades activas de cada broker en el mercado',
    'agents.scores-hint':     'Scores estimados desde datos de listados · Registra contactos para verificar credibilidad',
    'agents.active-listings': 'Propiedades activas por agente',
    'agents.empty':           'Sin datos de agentes aún. Registra contactos para generar el directorio.',
    'agents.score.reliable':  'Confiable',
    'agents.score.moderate':  'Moderado',
    'agents.score.risk':      'Riesgo alto',
    'agents.stat.credibility':'Credibilidad / 100',
    'agents.stat.interactions':'Interacciones',
    'agents.stat.contradictions':'Contradicciones',
    'agents.stat.listings':   'Listados',
    'agents.stat.trust':      'Confianza',
    'agents.badge.estimated': 'Estimado',
    'agents.badge.verified':  'Verificado',
    'agents.table.agent':     'Agente',
    'agents.table.credibility':'Credibilidad',
    'agents.table.interactions':'Interacciones',
    'agents.table.contradictions':'Contradicciones',
    'agents.table.listings':  'Listados',
    'agents.table.source':    'Fuente',
    'agents.unidentified':    'Agente no identificado',

    // Dashboard view
    'dashboard.title': 'Dashboard de Mercado',
    'dashboard.sub':   'Métricas clave · tendencias · distribución por torre',
    'dashboard.kpi.total-listings':  'Listados totales',
    'dashboard.kpi.negotiable':      'Negociables',
    'dashboard.kpi.towers':          'Torres',
    'dashboard.kpi.units':           'unidades',
    'dashboard.kpi.advantage':       'Unidades con ventaja',
    'dashboard.kpi.op-speed':        'Velocidad operativa',
    'dashboard.kpi.confirm':         'Confirmar disponibilidad',
    'dashboard.kpi.visible':         'Listados visibles',
    'dashboard.kpi.universe':        'universo total',
    'dashboard.kpi.fast-move':       'Mov. rápido',
    'dashboard.kpi.verify-first':    'Verificar primero',
    'dashboard.building.listings':   'Listados',
    'dashboard.building.median':     'Renta mediana',
    'dashboard.chart.cross-tower':   'Comparativa entre Península, Torre 300 y Paradox',
    'dashboard.chart.scores-prices': 'Distribución de Scores y Precios',
    'dashboard.chart.leverage-dom':  'Leverage vs. Días en Mercado',
    'dashboard.chart.psm-dist':      'Renta por m² — Distribución',
    'dashboard.updated':             'Actualizado ahora',
    'dashboard.buildings':           'edificios',

    // Tracking view
    'tracking.title':  'Verificación de Fuentes',
    'tracking.sub':    'Estado de las fuentes monitoreadas — qué se revisó, qué cambió, qué requiere atención',
    'tracking.verify': 'Verificar ahora',
    'tracking.tab.alerts':    'Alertas activas',
    'tracking.tab.watchstate':'Listados en vigilancia',
    'tracking.tab.eventlog':  'Registro de cambios',
    'tracking.tab.snapshots': 'Capturas de fuente',
    'tracking.filter.all':    'Todas',
    'tracking.filter.critical':'Críticas',
    'tracking.filter.high':   'Altas',
    'tracking.filter.medium': 'Medias',
    'tracking.filter.low':    'Bajas',
    'tracking.event.all':     'Todos',
    'tracking.event.off_market':    'Fuera mercado',
    'tracking.event.price_drop':    'Baja precio',
    'tracking.event.source_missing':'Sin fuente',
    'tracking.event.access_blocked':'Bloqueado',
    'tracking.section.watchlist':   'Listados en seguimiento',
    'tracking.section.snapshots':   'Capturas de fuente',
    'tracking.kpi.changes':         'Cambios detectados',
    'tracking.kpi.critical':        'Crítico',
    'tracking.kpi.high-alert':      'Alerta alta',
    'tracking.kpi.off-market':      'Fuera de mercado',
    'tracking.kpi.no-source':       'Sin fuente',
    'tracking.kpi.blocked':         'Acceso bloqueado',
    'tracking.kpi.backend':         'Backend',
    'tracking.kpi.alerts':          'Alertas',
    'tracking.kpi.status':          'Estado',
    'tracking.no-connection':       'Sin conexión',
    'tracking.local-only':          'Local only',
    'tracking.no-alerts-filter':    'Sin alertas de este tipo',
    'tracking.no-alerts':           'No hay alertas activas',
    'tracking.run-hint':            'Ejecuta una verificación para detectar cambios en fuentes',
    'tracking.blocked-note':        'Portal bloqueó el acceso — no es señal de baja de mercado',
    'tracking.watchlist.count':     'listados en vigilancia',
    'tracking.empty.no-backend':    'Sin conexión al servidor',
    'tracking.empty.no-data':       'Sin datos',
    'tracking.empty.loading':       'Cargando…',
    'tracking.no-snapshots':        'Sin datos de snapshots',
    'tracking.no-events':           'Sin datos de eventos',
    'tracking.verifying':           'Verificando…',
    'tracking.verify-running':      'Verificación en curso — revisando fuentes, puede tomar 20–60 s',
    'tracking.verify-error-prefix': 'Error: ',
    'tracking.verify-failed':       'Colección falló',
    'tracking.verified-ok':         '✓ Verificación completada — ',
    'tracking.fuera-mercado':       'fuera de mercado',
    'tracking.ts.no-server':        'Sin servidor local',
    'tracking.ts.data-available':   'Datos disponibles',
    'tracking.ts.run-first':        'Sin datos — ejecutar primera verificación',
    'tracking.connect-server':      'Conecta el servidor para ver el estado de verificación de fuentes',
    'tracking.map.all':             'Todos',
    'tracking.map.listing-count':   '— listados',
    'tracking.map.legend-towers':   'Torres',

    // Map view
    'map.all':              'Todos',
    'map.listing-count':    '— listados',
    'map.legend-towers':    'Torres',
    'map.listing-bubble-label': 'listados',
    'map.popup.listings':   'Listados',
    'map.popup.view-tower': 'Ver listados de esta torre',
    'map.loading':          'Cargando mapa…',

    // Detail view
    'detail.eyebrow':         'Unidad seleccionada',
    'detail.meta.building':   'Edificio',
    'detail.meta.price':      'Renta',
    'detail.meta.sqm':        'm²',
    'detail.meta.psm':        'Renta/m²',
    'detail.meta.beds':       'Recámaras',
    'detail.meta.dom':        'Días en mercado',
    'detail.score.composite': 'Composite',
    'detail.score.value':     'Valor',
    'detail.score.confidence':'Confianza',
    'detail.score.availability':'Disponib.',
    'detail.score.leverage':  'Leverage',
    'detail.score.action':    'Acción',
    'detail.leverage.signals':'Señales de poder',
    'detail.leverage.dom':    'días en mercado',
    'detail.leverage.dom-label':    'Días en mercado',
    'detail.leverage.availability': 'Disponibilidad',
    'detail.leverage.availability-sub': 'Probabilidad de disponibilidad real',
    'detail.leverage.psm-label':    'Renta/m² vs mediana',
    'detail.leverage.psm-sub':      'Posición de precio',
    'detail.leverage.score-label':  'Score Leverage',
    'detail.leverage.score-sub':    'Índice 0–100',
    'detail.leverage.time-pressure':'Presión de tiempo',
    'detail.leverage.advantage-pts':'Puntos de ventaja',
    'detail.leverage.strong':       'Fuerte',
    'detail.leverage.moderate':     'Moderado',
    'detail.leverage.weak':         'Débil',
    'detail.band.title':      'Banda operativa de negociación',
    'detail.band.listed':     'Listado',
    'detail.band.target':     'Target',
    'detail.band.opening':    'Opening',
    'detail.band.walkaway':   'Walk Away',
    'detail.band.fairlow':    'Fair Low',
    'detail.band.opening-anchor':  'Opening anchor',
    'detail.band.target-close':    'Target close',
    'detail.band.walkaway-note':   'Walk away — no cruces',
    'detail.intel.angle':     'Ángulo principal',
    'detail.intel.script':    'Talk track — Script de negociación',
    'detail.intel.battlecard':'Battle card — Anclas de negociación',
    'detail.intel.playbook':  'Playbook operativo — Contraparte',
    'detail.intel.comparables':'Comparables',
    'detail.intel.price-history': 'Historial de precio',
    'detail.intel.flags':     'Verificación requerida',
    'detail.playbook.primary-tactic': 'Táctica principal',
    'detail.playbook.probable':       '% probable',
    'detail.playbook.tell':           'Indicador',
    'detail.playbook.rebuttal':       'Respuesta',
    'detail.playbook.say-instead':    'Decir en su lugar',
    'detail.playbook.dont-say':       'No decir',
    'detail.playbook.market-context': 'Contexto de mercado',
    'detail.playbook.counter-script': 'Counter script',
    'detail.playbook.more-tactics':   'Más tácticas',
    'detail.playbook.broker-profile': 'Perfil',
    'detail.playbook.predicted-moves':'Movimientos probables',
    'detail.history.initial':   'Inicial',
    'detail.history.current':   'Actual',
    'detail.history.peak':      'Máx.',
    'detail.history.peak-drop': '% desde pico',
    'detail.gallery.title':     'Imágenes de la propiedad',
    'detail.gallery.all':       'Todas',
    'detail.gallery.exterior':  'Exterior',
    'detail.gallery.interior':  'Interior',
    'detail.gallery.source':    'Fuente',
    'detail.gallery.open':      'Abrir listado',
    'detail.gallery.open-original': 'Abrir listado original',
    'detail.gallery.expand':    'Ampliar foto',
    'detail.inquiry.title':     'Registrar Contacto con Agente',
    'detail.inquiry.price-quoted': 'Precio cotizado',
    'detail.leverage.high':     'Alto leverage',
    'detail.leverage.moderate-desc': 'Leverage moderado',
    'detail.leverage.low-desc': 'Leverage bajo',
    'detail.leverage.high-suffix': '— posición de negociación favorable.',
    'detail.leverage.mod-suffix': '— oportunidad de negociación posible. Revisa comparables y días en mercado.',
    'detail.leverage.low-suffix': '— posición desafiante. Considera comparables más competitivos.',
    'detail.source.open':       'Abrir listado en',
    'detail.source.open-original': 'Abrir listado original',

    // KPI strip
    'kpi.median-price':    'Renta mediana',
    'kpi.median-price-sub':'Renta mensual',
    'kpi.median-psm':      'Renta mediana/m²',
    'kpi.median-psm-sub':  'Ajustado por torre y peers',
    'kpi.visible-listings':       'Listados visibles',
    'kpi.visible-listings-sub':   'universo total',
    'kpi.negotiable':             'Negociables',
    'kpi.negotiable-sub':         'Unidades con ventaja',
    'kpi.fast-move':              'Mov. rápido',
    'kpi.fast-move-sub':          'Velocidad operativa',
    'kpi.verify-first':           'Verificar primero',
    'kpi.verify-first-sub':       'Confirmar disponibilidad',

    // Building cards
    'building.stat.listings':     'Listados',
    'building.stat.median-price': 'Med. Precio',

    // Data status / footer
    'status.loading':       'Cargando…',
    'status.live':          'En vivo',
    'status.demo-prefix':   'Datos:',
    'status.demo-date':     'Abril 2026',
    'status.offline':       'Sin datos',
    'status.no-data':       'Sin conexión a datos',
    'status.no-data-hint':  'Verifica que el servidor esté activo (python server.py) o que data.json esté en la raíz del proyecto.',
    'status.toast-demo':    'Modo demo — datos estáticos de Abril 2026',
    'status.theme-dark':    'Cambiar a modo claro',
    'status.theme-light':   'Cambiar a modo oscuro',

    // Sorting
    'sort.mode.price_asc':  'precio ascendente',
    'sort.mode.price_desc': 'precio descendente',
    'sort.mode.composite_score': 'score composite',
    'sort.mode.dom':        'días en mercado',
    'sort.mode.leverage_score': 'leverage',

    // Score tiers
    'score.tier.high':      'alto',
    'score.tier.mid':       'medio',
    'score.tier.low':       'bajo',
    'score.of':             'de 100, nivel',

    // Event types
    'event.off_market':                 'Fuera de Mercado',
    'event.new_listing':                'Nuevo Listado',
    'event.price_drop':                 'Baja de Precio',
    'event.price_increase':             'Alza de Precio',
    'event.relisting':                  'Relistado',
    'event.relisting_suspected':        'Posible Relistado',
    'event.source_missing':             'Sin Fuente',
    'event.access_blocked':             'Acceso Bloqueado',
    'event.claimed_unavailable_active': 'Agente dice No Disponible (activo)',
    'event.verification_blocked':       'Verificación Bloqueada',
    'event.access_error':               'Error de Acceso',
    'event.content_changed':            'Contenido Modificado',
    'event.title_changed':              'Título Modificado',
    'event.duplicate_suspected':        'Duplicado Sospechado',

    // Currency label in context
    'currency.monthly':    '/mes',
    'currency.psm':        '/m²',

    // Export
    'export.exporting':    'Exportando…',
    'export.label':        'Export',

    // Leverage point builder keys
    'leverage.strength.strong':   'Fuerte',
    'leverage.strength.moderate': 'Moderado',
    'leverage.strength.context':  'Contexto',
    'leverage.point.dom-high':    'días en mercado — el vendedor siente la presión del tiempo.',
    'leverage.point.dom-mid':     'días en mercado — presión de tiempo creciente.',
    'leverage.point.vacancy-high':'Riesgo de vacancia',
    'leverage.point.vacancy-high-note': 'altas chances de que la unidad ya no esté disponible realmente.',
    'leverage.point.vacancy-mid': 'Riesgo de vacancia',
    'leverage.point.vacancy-mid-note':  'verifica disponibilidad antes de negociar.',
    'leverage.point.above-fair':  'Precio',
    'leverage.point.above-fair-note':   'por encima del rango justo',
    'leverage.point.negotiation-confirmed': 'Espacio de negociación confirmado.',
    'leverage.point.low-value-score': 'Score de valor bajo',
    'leverage.point.low-value-note':  'comparado con el mercado. Argumento de reducción de precio disponible.',

    // Inquiry form keys
    'inquiry.title':           'Registrar Contacto con Agente',
    'inquiry.contact-name':    'Nombre del contacto',
    'inquiry.company':         'Empresa / Broker',
    'inquiry.channel':         'Canal',
    'inquiry.channel.phone':   'Teléfono',
    'inquiry.status':          'Status reportado',
    'inquiry.status.available':'Disponible',
    'inquiry.status.unavailable':'No disponible',
    'inquiry.status.no-response':'Sin respuesta',
    'inquiry.status.changed-offer':'Cambio de oferta',
    'inquiry.response-hours':  'Tiempo respuesta (hrs)',
    'inquiry.price-quoted':    'Precio cotizado',
    'inquiry.provided-unit':   'Proporcionó número de unidad',
    'inquiry.provided-video':  'Proporcionó video',
    'inquiry.provided-breakdown': 'Proporcionó desglose',
    'inquiry.notes':           'Notas',
    'inquiry.notes-placeholder': 'Observaciones…',
    'inquiry.submit':          'Registrar contacto',
    'inquiry.clear':           'Limpiar',

    // Additional KPI / dashboard keys
    'kpi.avg-psm':          '$/m² promedio',
    'kpi.avg-leverage':     'Leverage promedio',
    'kpi.avg-dom':          'DOM promedio',
    'kpi.high-vacancy':     'Alta Vacancia',
    'kpi.top-opportunity':  'Mejor oportunidad',
    'kpi.psm-median':       '/m² mediano',

    // Map popup extra keys
    'map.popup.psm':         '/m² mediana',
    'map.popup.dom':         'DOM mediano',
    'map.popup.psm-delta':   'en $/m²',
    'map.popup.view-listings': 'Ver listados de esta torre',
    'map.listings-count':    'listados',

    // Score labels
    'score.leverage':     'Leverage Score',
    'score.confidence':   'confianza',
    'card.asking-rent':   'Precio listado',
    'ticker.vacancy':     'vacancia',

    // Tracking detailed keys
    'tracking.kpi.high':     'Alerta alta',
    'tracking.kpi.local-only': 'Local only',
    'tracking.sub.changes':  'cambios',
    'tracking.sub.critical': 'críticos',
    'tracking.sub.off-market':'fuera de mercado',
    'tracking.sub.connect-server': 'Conecta el servidor para ver el estado de verificación de fuentes',
    'tracking.watchlist-count': 'listados en vigilancia',
    'tracking.empty.no-type-alerts': 'Sin alertas de este tipo',
    'tracking.empty.no-alerts':      'No hay alertas activas',
    'tracking.empty.run-verify':     'Ejecuta una verificación para detectar cambios en fuentes',
    'tracking.empty.no-watchstate':  'Sin estado de vigilancia',
    'tracking.empty.run-verify-init':'Ejecuta una verificación para inicializar el estado de seguimiento',
    'tracking.empty.load-failed':    'No se pudo cargar el watch state',
    'tracking.empty.ensure-server':  'Asegúrate de que el servidor esté activo',
    'tracking.empty.no-events':      'Sin eventos registrados',
    'tracking.empty.events-hint':    'Los cambios se registran tras cada verificación de fuentes',
    'tracking.empty.no-snapshots':   'Sin snapshots de fuente',
    'tracking.empty.snapshots-hint': 'Las capturas se crean tras cada verificación de fuentes',
    'tracking.table.unit':           'Unidad',
    'tracking.table.source-status':  'Estado fuente',
    'tracking.table.last-read':      'Última lectura',
    'tracking.table.reads':          'Lecturas',
    'tracking.table.confidence':     'Confianza',
    'tracking.table.tracking':       'Seguimiento',
    'tracking.watch.pause':          'Pausar vigilancia',
    'tracking.watch.activate':       'Activar vigilancia',
    'tracking.watch.active':         'Activo',
    'tracking.watch.paused':         'Pausado',
    'tracking.watch.toast-watching': 'Vigilando',
    'tracking.watch.toast-paused':   'Pausado',
    'tracking.page.of':              'de',
    'tracking.page.events':          'eventos',
    'tracking.page.prev':            'Anterior',
    'tracking.page.next':            'Siguiente',
    'tracking.verify.running':       'Verificando…',
    'tracking.verify.in-progress':   'Verificación en curso — revisando fuentes, puede tomar 20–60 s',
    'tracking.verify.completed':     'Verificación completada',
    'tracking.verify.sources-checked': 'fuentes revisadas',
    'tracking.verify.changes-detected':'cambios detectados',
    'tracking.verify.off-market':    'fuera de mercado',
    'tracking.verify.failed':        'Colección falló',
    'status.no-connection':          'Sin conexión',
    'status.no-server':              'Sin conexión al servidor',

    // Sort labels for banner
    'sort.label.opportunity': 'por oportunidad',
    'sort.label.leverage':    'por leverage',
    'sort.label.price-asc':   'precio ascendente',
    'sort.label.price-desc':  'precio descendente',
    'sort.label.dom':         'mayor antigüedad',
    'sort.sorted':            'Orden',
    'overview.sub.negotiation-opps': 'con oportunidad de negociación',
    'overview.sub.units':     'unidades',

    // Advanced filter toasts
    'adv.applied-toast': 'Filtros avanzados aplicados',
    'adv.reset-toast':   'Filtros restablecidos',

    // Agents badge title
    'agents.badge.estimated-title': 'Puntuación estimada a partir de listados, no verificada',
    'agents.market-intel-label':    'INTELIGENCIA DE MERCADO',
    'agents.scorecards-title':      'Scorecards de Brokers',
    'agents.scorecards-sub':        'Ordenado por credibilidad · Score 0–100',
    'overview.eyebrow':             'Motor de Decisión Inmobiliaria',
    'decision.banner.desc':         'Unidades con oportunidad verificada, ordenadas por score de acción. Banda de oferta y argumentos de cierre listos.',
    'compare.hint':                 'Benchmark por torre: $/m², días en mercado y score composite. Selecciona una métrica para comenzar.',
    'sort.option.opportunity':      'Oportunidad (score composite)',
    'sort.option.dom':              'Mayor antigüedad (DOM)',
    'guided.step.click-listing':    'Haz clic en cualquier listado para ver el score composite, banda de negociación, historial de precio y el perfil de confianza del agente.',
    'decision.action-label':        'Lista de acción',
    'events.recent':                 'Eventos recientes',
    'adv.sort-price-asc-label':      'Precio ↑',
    'adv.sort-price-desc-label':     'Precio ↓',
    'adv.tower-all-option':          'Todas las torres',
  },

  'en-US': {
    // Nav
    'nav.overview':    'Overview',
    'nav.operator':    'Operator',
    'nav.compare':     'Compare',
    'nav.agents':      'Agents',
    'nav.dashboard':   'Dashboard',
    'nav.map':         'Map',
    'nav.tracking':    'Sources',

    // Header
    'header.ask':      'Ask',
    'header.logo-tagline': 'Market Intelligence',

    // Pulse bar
    'pulse.listings':    '— listings',
    'pulse.negotiable':  '— negotiable',
    'pulse.loading':     'Loading',

    // Hero
    'hero.eyebrow':    'Leasing Intelligence Platform',
    'hero.sub':        'Santa Fe · CDMX · Premium Leasing · Península · Torre 300 · Paradox',
    'hero.badge':      'Santa Fe CI · April 2026',
    'hero.stat.listings':  'Active Listings',
    'hero.stat.median':    'Asking Rent',
    'hero.stat.negotiable':'Negotiable',

    // Overview
    'overview.title':  'Leasing Decision · Santa Fe',
    'overview.loading':'Loading listings…',
    'filter.all':      'All',
    'filter.negotiate':'Negotiate',
    'filter.1bed':     '1 Bed',
    'filter.2bed':     '2 Bed',
    'filter.3bed':     '3+ Beds',

    // Decision banner
    'decision.eyebrow':    'Decision engine',
    'decision.guide-btn':  'Quick guide',

    // Advanced filters
    'adv.title':           'Advanced filters',
    'adv.tower-label':     'Tower',
    'adv.tower-all':       'All towers',
    'adv.beds-label':      'Bedrooms',
    'adv.beds-all':        'All',
    'adv.beds-1':          '1 bedroom',
    'adv.beds-2':          '2 bedrooms',
    'adv.beds-3':          '3+ bedrooms',
    'adv.sort-label':      'Sort by',
    'adv.sort-opportunity':'Best opportunity (composite score)',
    'adv.sort-leverage':   'Negotiation leverage',
    'adv.sort-price-asc':  'Asking rent ↑',
    'adv.sort-price-desc': 'Asking rent ↓',
    'adv.sort-dom':        'Days on market (most)',
    'adv.minprice-label':  'Min. asking rent',
    'adv.minsqm-label':    'Min. m²',
    'adv.negotiable-only': 'Negotiable only',
    'adv.apply':           'Apply filters',
    'adv.reset':           'Reset',

    // Context strip
    'ctx.universe':    'Active inventory',
    'ctx.median':      'Median asking rent',
    'ctx.negotiate':   'Negotiable',
    'ctx.best-deal':   'Top opportunity',

    // Market charts
    'market.title':    'Market Pulse',
    'market.tab.psm':  'Rent psm',
    'market.tab.dom':  'Days on Market',
    'market.tab.score':'Value Score',

    // Market chart tab buttons
    'market.tab.psm.btn':   'Rent psm',
    'market.tab.dom.btn':   'Days on Market',
    'market.tab.score.btn': 'Value Score',

    // Events
    'events.title':    'Market activity',

    // Listings section
    'listings.title':  'Active listings',
    'listings.sort':   'Sort:',
    'sort.opportunity':'Top opportunity',
    'sort.leverage':   'Leverage',
    'sort.price-asc':  'Asking rent ascending',
    'sort.price-desc': 'Asking rent descending',
    'sort.dom':        'Days on market (most)',

    // Card labels
    'card.status.available':   'Available',
    'card.open-source':        'Source',
    'card.open-analysis':      'Open analysis',
    'card.open-listing':       'View listing',
    'card.photos':             'photos',
    'card.days-market':        'days on market',
    'card.beds':               'bd',
    'card.sqm':                'm²',

    // Overview subtitle template
    'overview.sub.active':      'active',
    'overview.sub.towers':      'towers',
    'overview.sub.negotiable':  'negotiable',

    // Operator view
    'operator.title':  'Negotiation Workbench',
    'operator.sub':    'Ranked by action score · Negotiation band and close arguments included',
    'operator.filter.all':       'All',
    'operator.filter.negotiate': 'Negotiate',
    'operator.filter.fast':      'Fast move',
    'operator.filter.verify':    'Verify',
    'operator.filter.monitor':   'Monitor',
    'operator.group.negotiate':  'Negotiate now',
    'operator.group.fast_move':  'Fast move',
    'operator.group.verify':     'Verify first',
    'operator.group.monitor':    'Monitor',
    'operator.group.avoid':      'Avoid',
    'operator.group.uncategorized': 'Uncategorized',
    'operator.group.listings':   'listings',
    'operator.chip.negotiate':   'Negotiate',
    'operator.chip.fast':        'Fast move',
    'operator.chip.verify':      'Verify',
    'operator.chip.monitor':     'Monitor',
    'operator.card.beds':        'bd',
    'operator.card.dom':         'd on market',
    'operator.card.leverage':    'Leverage',
    'operator.card.vacancy':     'Vacancy',
    'operator.card.furnished':   'Furnished',
    'operator.card.target':      'Target',
    'operator.empty':            'No actions match this filter.',

    // Compare view
    'compare.title':   'Tower Benchmark',
    'compare.sub':     'Rent psm · Days on market · Leverage · Composite score by building',
    'compare.metric.price_per_sqm':     'Rent per m²',
    'compare.metric.price':             'Asking rent',
    'compare.metric.composite_score':   'Composite score',
    'compare.metric.value_score':       'Value score',
    'compare.metric.ghost_probability': 'Real availability',
    'compare.metric.leverage_score':    'Leverage score',
    'compare.metric.days_on_market':    'Days on market',
    'compare.subtitle.all':             'Operational benchmark · All active listings by building',
    'compare.subtitle.units':           'units',
    'compare.cross-tower':              'Cross-tower comparison',
    'compare.benchmark-label':          'Comparable towers',
    'compare.benchmark-hint':           'Benchmark by tower: rent psm, days on market, composite score. Select a metric to begin.',

    // Agents view
    'agents.title':    'Agent Intelligence',
    'agents.sub':      'Credibility ratings, track record, and active inventory for each broker in the market',
    'agents.scores-hint':     'Scores estimated from listing data · Log contacts to verify credibility',
    'agents.active-listings': 'Active listings by agent',
    'agents.empty':           'No agent data yet. Log contacts to build the agent directory.',
    'agents.score.reliable':  'Reliable',
    'agents.score.moderate':  'Moderate',
    'agents.score.risk':      'High risk',
    'agents.stat.credibility':'Credibility / 100',
    'agents.stat.interactions':'Interactions',
    'agents.stat.contradictions':'Contradictions',
    'agents.stat.listings':   'Listings',
    'agents.stat.trust':      'Trust score',
    'agents.badge.estimated': 'Estimated',
    'agents.badge.verified':  'Verified',
    'agents.table.agent':     'Agent',
    'agents.table.credibility':'Credibility',
    'agents.table.interactions':'Interactions',
    'agents.table.contradictions':'Contradictions',
    'agents.table.listings':  'Listings',
    'agents.table.source':    'Source',
    'agents.unidentified':    'Unidentified agent',

    // Dashboard view
    'dashboard.title': 'Market Dashboard',
    'dashboard.sub':   'Key metrics · trends · distribution by tower',
    'dashboard.kpi.total-listings':  'Total listings',
    'dashboard.kpi.negotiable':      'Negotiable',
    'dashboard.kpi.towers':          'Towers',
    'dashboard.kpi.units':           'units',
    'dashboard.kpi.advantage':       'Units with leverage',
    'dashboard.kpi.op-speed':        'Operational velocity',
    'dashboard.kpi.confirm':         'Confirm availability',
    'dashboard.kpi.visible':         'Visible listings',
    'dashboard.kpi.universe':        'total inventory',
    'dashboard.kpi.fast-move':       'Fast move',
    'dashboard.kpi.verify-first':    'Verify first',
    'dashboard.building.listings':   'Listings',
    'dashboard.building.median':     'Median asking rent',
    'dashboard.chart.cross-tower':   'Cross-tower: Península vs Torre 300 vs Paradox',
    'dashboard.chart.scores-prices': 'Score & Rent Distribution',
    'dashboard.chart.leverage-dom':  'Leverage vs. Days on Market',
    'dashboard.chart.psm-dist':      'Rent psm — Distribution',
    'dashboard.updated':             'Updated now',
    'dashboard.buildings':           'buildings',

    // Tracking view
    'tracking.title':  'Source Verification',
    'tracking.sub':    'Status of monitored sources — what was reviewed, what changed, what needs attention',
    'tracking.verify': 'Verify now',
    'tracking.tab.alerts':    'Active alerts',
    'tracking.tab.watchstate':'Watchlist',
    'tracking.tab.eventlog':  'Change log',
    'tracking.tab.snapshots': 'Source snapshots',
    'tracking.filter.all':    'All',
    'tracking.filter.critical':'Critical',
    'tracking.filter.high':   'High',
    'tracking.filter.medium': 'Medium',
    'tracking.filter.low':    'Low',
    'tracking.event.all':     'All',
    'tracking.event.off_market':    'Off market',
    'tracking.event.price_drop':    'Price drop',
    'tracking.event.source_missing':'No source',
    'tracking.event.access_blocked':'Blocked',
    'tracking.section.watchlist':   'Listings on watchlist',
    'tracking.section.snapshots':   'Source snapshots',
    'tracking.kpi.changes':         'Changes detected',
    'tracking.kpi.critical':        'Critical',
    'tracking.kpi.high-alert':      'High alert',
    'tracking.kpi.off-market':      'Off market',
    'tracking.kpi.no-source':       'No source',
    'tracking.kpi.blocked':         'Access blocked',
    'tracking.kpi.backend':         'Backend',
    'tracking.kpi.alerts':          'Alerts',
    'tracking.kpi.status':          'Status',
    'tracking.no-connection':       'Disconnected',
    'tracking.local-only':          'Local only',
    'tracking.no-alerts-filter':    'No alerts of this type',
    'tracking.no-alerts':           'No active alerts',
    'tracking.run-hint':            'Run a verification pass to detect source changes',
    'tracking.blocked-note':        'Portal blocked access — not a market exit signal',
    'tracking.watchlist.count':     'listings on watchlist',
    'tracking.empty.no-backend':    'No server connection',
    'tracking.empty.no-data':       'No data',
    'tracking.empty.loading':       'Loading…',
    'tracking.no-snapshots':        'No snapshot data',
    'tracking.no-events':           'No event data',
    'tracking.verifying':           'Verifying…',
    'tracking.verify-running':      'Verification in progress — checking sources, may take 20–60 s',
    'tracking.verify-error-prefix': 'Error: ',
    'tracking.verify-failed':       'Collection failed',
    'tracking.verified-ok':         '✓ Verification complete — ',
    'tracking.fuera-mercado':        'off market',
    'tracking.ts.no-server':        'No local server',
    'tracking.ts.data-available':   'Data available',
    'tracking.ts.run-first':        'No data — run first verification',
    'tracking.connect-server':      'Connect the server to view source verification status',
    'tracking.map.all':             'All',
    'tracking.map.listing-count':   '— listings',
    'tracking.map.legend-towers':   'Towers',

    // Map view
    'map.all':              'All',
    'map.listing-count':    '— listings',
    'map.legend-towers':    'Towers',
    'map.listing-bubble-label': 'listings',
    'map.popup.listings':   'Listings',
    'map.popup.view-tower': 'View listings for this tower',
    'map.loading':          'Loading map…',

    // Detail view
    'detail.eyebrow':         'Selected unit',
    'detail.meta.building':   'Building',
    'detail.meta.price':      'Asking rent',
    'detail.meta.sqm':        'm²',
    'detail.meta.psm':        'Rent psm',
    'detail.meta.beds':       'Beds',
    'detail.meta.dom':        'Days on market',
    'detail.score.composite': 'Composite',
    'detail.score.value':     'Value',
    'detail.score.confidence':'Confidence',
    'detail.score.availability':'Availability',
    'detail.score.leverage':  'Leverage',
    'detail.score.action':    'Action',
    'detail.leverage.signals':'Power signals',
    'detail.leverage.dom':    'days on market',
    'detail.leverage.dom-label':    'Days on market',
    'detail.leverage.availability': 'Availability',
    'detail.leverage.availability-sub': 'Real availability probability',
    'detail.leverage.psm-label':    'Rent psm vs. median',
    'detail.leverage.psm-sub':      'Pricing position',
    'detail.leverage.score-label':  'Leverage score',
    'detail.leverage.score-sub':    'Index 0–100',
    'detail.leverage.time-pressure':'Time pressure',
    'detail.leverage.advantage-pts':'Leverage points',
    'detail.leverage.strong':       'Strong',
    'detail.leverage.moderate':     'Moderate',
    'detail.leverage.weak':         'Weak',
    'detail.band.title':      'Negotiation band',
    'detail.band.listed':     'Listed',
    'detail.band.target':     'Target',
    'detail.band.opening':    'Opening',
    'detail.band.walkaway':   'Walk away',
    'detail.band.fairlow':    'Fair low',
    'detail.band.opening-anchor':  'Opening anchor',
    'detail.band.target-close':    'Target close',
    'detail.band.walkaway-note':   'Walk away — do not cross',
    'detail.intel.angle':     'Primary angle',
    'detail.intel.script':    'Talk track — Negotiation script',
    'detail.intel.battlecard':'Battle card — Negotiation anchors',
    'detail.intel.playbook':  'Counterparty playbook',
    'detail.intel.comparables':'Comparable units',
    'detail.intel.price-history': 'Price history',
    'detail.intel.flags':     'Source verification required',
    'detail.playbook.primary-tactic': 'Primary tactic',
    'detail.playbook.probable':       '% likely',
    'detail.playbook.tell':           'Tell',
    'detail.playbook.rebuttal':       'Rebuttal',
    'detail.playbook.say-instead':    'Say instead',
    'detail.playbook.dont-say':       'Do not say',
    'detail.playbook.market-context': 'Market context',
    'detail.playbook.counter-script': 'Counter script',
    'detail.playbook.more-tactics':   'More tactics',
    'detail.playbook.broker-profile': 'Profile',
    'detail.playbook.predicted-moves':'Predicted moves',
    'detail.history.initial':   'Initial',
    'detail.history.current':   'Current',
    'detail.history.peak':      'Peak',
    'detail.history.peak-drop': '% from peak',
    'detail.gallery.title':     'Property photos',
    'detail.gallery.all':       'All',
    'detail.gallery.exterior':  'Exterior',
    'detail.gallery.interior':  'Interior',
    'detail.gallery.source':    'Source',
    'detail.gallery.open':      'View listing',
    'detail.gallery.open-original': 'View original listing',
    'detail.gallery.expand':    'Expand photo',
    'detail.inquiry.title':     'Log Agent Contact',
    'detail.inquiry.price-quoted': 'Quoted rent',
    'detail.leverage.high':     'Strong leverage',
    'detail.leverage.moderate-desc': 'Moderate leverage',
    'detail.leverage.low-desc': 'Weak leverage',
    'detail.leverage.high-suffix': '— favorable negotiating position.',
    'detail.leverage.mod-suffix': '— negotiation possible. Review comparables and days on market.',
    'detail.leverage.low-suffix': '— challenging position. Consider more competitive comparable units.',
    'detail.source.open':       'View listing on',
    'detail.source.open-original': 'View original listing',

    // KPI strip
    'kpi.median-price':    'Median asking rent',
    'kpi.median-price-sub':'Monthly rent',
    'kpi.median-psm':      'Median rent psm',
    'kpi.median-psm-sub':  'Peer & tower adjusted',
    'kpi.visible-listings':       'Visible listings',
    'kpi.visible-listings-sub':   'total inventory',
    'kpi.negotiable':             'Negotiable',
    'kpi.negotiable-sub':         'Units with leverage',
    'kpi.fast-move':              'Fast move',
    'kpi.fast-move-sub':          'Operational velocity',
    'kpi.verify-first':           'Verify first',
    'kpi.verify-first-sub':       'Confirm availability',

    // Building cards
    'building.stat.listings':     'Listings',
    'building.stat.median-price': 'Median rent',

    // Data status / footer
    'status.loading':       'Loading…',
    'status.live':          'Live',
    'status.demo-prefix':   'Data:',
    'status.demo-date':     'April 2026',
    'status.offline':       'No data',
    'status.no-data':       'No data connection',
    'status.no-data-hint':  'Verify the server is running (python server.py) or that data.json is in the project root.',
    'status.toast-demo':    'Demo mode — static data from April 2026',
    'status.theme-dark':    'Switch to light mode',
    'status.theme-light':   'Switch to dark mode',

    // Sorting
    'sort.mode.price_asc':  'asking rent ascending',
    'sort.mode.price_desc': 'asking rent descending',
    'sort.mode.composite_score': 'composite score',
    'sort.mode.dom':        'days on market',
    'sort.mode.leverage_score': 'leverage',

    // Score tiers
    'score.tier.high':      'high',
    'score.tier.mid':       'mid',
    'score.tier.low':       'low',
    'score.of':             'of 100, tier',

    // Event types
    'event.off_market':                 'Off Market',
    'event.new_listing':                'New Listing',
    'event.price_drop':                 'Rent Drop',
    'event.price_increase':             'Rent Increase',
    'event.relisting':                  'Relisting',
    'event.relisting_suspected':        'Suspected Relisting',
    'event.source_missing':             'Source Missing',
    'event.access_blocked':             'Access Blocked',
    'event.claimed_unavailable_active': 'Agent Claims Unavailable (Active)',
    'event.verification_blocked':       'Verification Blocked',
    'event.access_error':               'Access Error',
    'event.content_changed':            'Content Changed',
    'event.title_changed':              'Title Changed',
    'event.duplicate_suspected':        'Suspected Duplicate',

    // Currency label in context
    'currency.monthly':    '/mo',
    'currency.psm':        '/m²',

    // Export
    'export.exporting':    'Exporting…',
    'export.label':        'Export',

    // Leverage point builder keys
    'leverage.strength.strong':   'Strong',
    'leverage.strength.moderate': 'Moderate',
    'leverage.strength.context':  'Context',
    'leverage.point.dom-high':    'days on market — seller is feeling time pressure.',
    'leverage.point.dom-mid':     'days on market — growing time pressure.',
    'leverage.point.vacancy-high':'Vacancy risk',
    'leverage.point.vacancy-high-note': 'high probability unit is no longer genuinely available.',
    'leverage.point.vacancy-mid': 'Vacancy risk',
    'leverage.point.vacancy-mid-note':  'verify availability before entering negotiation.',
    'leverage.point.above-fair':  'Asking rent',
    'leverage.point.above-fair-note':   'above fair range',
    'leverage.point.negotiation-confirmed': 'Confirmed negotiation headroom.',
    'leverage.point.low-value-score': 'Low value score',
    'leverage.point.low-value-note':  'versus market. Price-reduction argument available.',

    // Inquiry form keys
    'inquiry.title':           'Log Agent Contact',
    'inquiry.contact-name':    'Contact name',
    'inquiry.company':         'Company / Broker',
    'inquiry.channel':         'Channel',
    'inquiry.channel.phone':   'Phone',
    'inquiry.status':          'Reported status',
    'inquiry.status.available':'Available',
    'inquiry.status.unavailable':'Unavailable',
    'inquiry.status.no-response':'No response',
    'inquiry.status.changed-offer':'Changed offer',
    'inquiry.response-hours':  'Response time (hrs)',
    'inquiry.price-quoted':    'Quoted asking rent',
    'inquiry.provided-unit':   'Provided unit number',
    'inquiry.provided-video':  'Provided video',
    'inquiry.provided-breakdown': 'Provided cost breakdown',
    'inquiry.notes':           'Notes',
    'inquiry.notes-placeholder': 'Observations…',
    'inquiry.submit':          'Log contact',
    'inquiry.clear':           'Clear',

    // Additional KPI / dashboard keys
    'kpi.avg-psm':          'Avg. rent psm',
    'kpi.avg-leverage':     'Avg. leverage',
    'kpi.avg-dom':          'Avg. DOM',
    'kpi.high-vacancy':     'High vacancy risk',
    'kpi.top-opportunity':  'Top opportunity',
    'kpi.psm-median':       'psm median',

    // Map popup extra keys
    'map.popup.psm':         'Median rent psm',
    'map.popup.dom':         'Median DOM',
    'map.popup.psm-delta':   'vs. mkt psm',
    'map.popup.view-listings': 'View tower listings',
    'map.listings-count':    'listings',

    // Score labels
    'score.leverage':     'Leverage score',
    'score.confidence':   'conf.',
    'card.asking-rent':   'Asking rent',
    'ticker.vacancy':     'vacancy',

    // Tracking detailed keys
    'tracking.kpi.high':     'High alert',
    'tracking.kpi.local-only': 'Local only',
    'tracking.sub.changes':  'changes',
    'tracking.sub.critical': 'critical',
    'tracking.sub.off-market':'off market',
    'tracking.sub.connect-server': 'Connect the server to view source verification status',
    'tracking.watchlist-count': 'listings in watchlist',
    'tracking.empty.no-type-alerts': 'No alerts of this type',
    'tracking.empty.no-alerts':      'No active alerts',
    'tracking.empty.run-verify':     'Run a verification to detect source changes',
    'tracking.empty.no-watchstate':  'No watchlist entries',
    'tracking.empty.run-verify-init':'Run a verification to initialize tracking state',
    'tracking.empty.load-failed':    'Could not load watchlist state',
    'tracking.empty.ensure-server':  'Make sure the server is running',
    'tracking.empty.no-events':      'No events logged',
    'tracking.empty.events-hint':    'Changes are recorded after each source verification',
    'tracking.empty.no-snapshots':   'No source snapshots',
    'tracking.empty.snapshots-hint': 'Snapshots are created after each source verification',
    'tracking.table.unit':           'Unit',
    'tracking.table.source-status':  'Source status',
    'tracking.table.last-read':      'Last read',
    'tracking.table.reads':          'Reads',
    'tracking.table.confidence':     'Confidence',
    'tracking.table.tracking':       'Tracking',
    'tracking.watch.pause':          'Pause tracking',
    'tracking.watch.activate':       'Activate tracking',
    'tracking.watch.active':         'Active',
    'tracking.watch.paused':         'Paused',
    'tracking.watch.toast-watching': 'Watching',
    'tracking.watch.toast-paused':   'Paused',
    'tracking.page.of':              'of',
    'tracking.page.events':          'events',
    'tracking.page.prev':            'Previous',
    'tracking.page.next':            'Next',
    'tracking.verify.running':       'Verifying…',
    'tracking.verify.in-progress':   'Verification in progress — checking sources, may take 20–60 s',
    'tracking.verify.completed':     'Verification complete',
    'tracking.verify.sources-checked': 'sources checked',
    'tracking.verify.changes-detected':'changes detected',
    'tracking.verify.off-market':    'off market',
    'tracking.verify.failed':        'Collection failed',
    'status.no-connection':          'Offline',
    'status.no-server':              'No server connection',

    // Sort labels for banner
    'sort.label.opportunity': 'by opportunity',
    'sort.label.leverage':    'by leverage',
    'sort.label.price-asc':   'asking rent ascending',
    'sort.label.price-desc':  'asking rent descending',
    'sort.label.dom':         'by days on market',
    'sort.sorted':            'Sorted',
    'overview.sub.negotiation-opps': 'with negotiation opportunity',
    'overview.sub.units':     'units',

    // Advanced filter toasts
    'adv.applied-toast': 'Advanced filters applied',
    'adv.reset-toast':   'Filters reset',

    // Agents badge title
    'agents.badge.estimated-title': 'Score estimated from listing data, not verified',
    'agents.market-intel-label':    'MARKET INTELLIGENCE',
    'agents.scorecards-title':      'Broker Scorecards',
    'agents.scorecards-sub':        'Ranked by credibility · Score 0–100',
    'overview.eyebrow':             'Leasing Intelligence Platform',
    'decision.banner.desc':         'Verified opportunities ranked by action score. Negotiation band and close arguments ready.',
    'compare.hint':                 'Comparable towers: rent psm, days on market, composite score. Select a metric to begin.',
    'sort.option.opportunity':      'Top opportunity (composite score)',
    'sort.option.dom':              'Days on market (most)',
    'guided.step.click-listing':    'Click any listing to view the composite score, negotiation band, price history, and agent credibility profile.',
    'decision.action-label':        'Action list',
    'events.recent':                 'Recent events',
    'adv.sort-price-asc-label':      'Asking rent ↑',
    'adv.sort-price-desc-label':     'Asking rent ↓',
    'adv.tower-all-option':          'All towers',
  }
};

/** Get a translated string for the current locale */
function t(key) {
  var dict = TRANSLATIONS[_activeLocale] || TRANSLATIONS['es-MX'];
  return dict[key] !== undefined ? dict[key] : (TRANSLATIONS['es-MX'][key] || key);
}

// ── DOM Translation ────────────────────────────────────────────

/**
 * Apply all `data-i18n` attributes to DOM elements.
 * Elements with data-i18n="key" get their textContent replaced.
 * Elements with data-i18n-placeholder="key" get their placeholder attribute replaced.
 * Elements with data-i18n-aria="key" get their aria-label replaced.
 */
function applyLocaleToDOM() {
  // Update html lang attribute
  document.documentElement.lang = _activeLocale === 'en-US' ? 'en' : 'es';

  // Text content
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var key = el.getAttribute('data-i18n');
    var val = t(key);
    if (val) el.textContent = val;
  }

  // Placeholders
  var phEls = document.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < phEls.length; j++) {
    var key2 = phEls[j].getAttribute('data-i18n-placeholder');
    var val2 = t(key2);
    if (val2) phEls[j].placeholder = val2;
  }

  // Aria labels
  var ariaEls = document.querySelectorAll('[data-i18n-aria]');
  for (var k = 0; k < ariaEls.length; k++) {
    var key3 = ariaEls[k].getAttribute('data-i18n-aria');
    var val3 = t(key3);
    if (val3) ariaEls[k].setAttribute('aria-label', val3);
  }

  // Update toggle button state
  updateToggleState();
}

/** Update the visual active state of the locale toggle buttons */
function updateToggleState() {
  var btns = document.querySelectorAll('.locale-btn');
  for (var i = 0; i < btns.length; i++) {
    var btn = btns[i];
    var btnLocale = btn.getAttribute('data-locale');
    if (btnLocale === _activeLocale) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  }
}

/**
 * Trigger a full money re-render. Calls back into app.js rendering
 * functions that are exposed as globals. This runs after locale switch.
 */
function refreshMoneyDisplay() {
  // Re-render whatever the current view is.
  // Function names come from app.js globals.
  try {
    if (typeof currentView === 'undefined') return;
    if (currentView === 'overview')  { if (typeof renderOverview === 'function') renderOverview(); }
    if (currentView === 'detail' && typeof currentListing !== 'undefined' && currentListing) {
      if (typeof renderDetailView === 'function') renderDetailView(currentListing);
    }
    if (currentView === 'compare' && typeof activeComparison !== 'undefined' && activeComparison) {
      if (typeof renderComparisonChart === 'function') renderComparisonChart(activeComparison);
    }
    if (currentView === 'operator')  { if (typeof renderOperatorView === 'function') renderOperatorView(); }
    if (currentView === 'dashboard') { if (typeof renderDashboardView === 'function') renderDashboardView(); }
    if (currentView === 'agents')    { if (typeof renderAgentsView === 'function') renderAgentsView(); }
    // Always refresh the pulse bar (visible in all views)
    if (typeof renderPulseBar === 'function') renderPulseBar();
  } catch (e) {
    console.warn('[i18n] refreshMoneyDisplay error:', e);
  }
}

// ── Toggle Component HTML ──────────────────────────────────────
// Inline SVG flags for US and Mexico — clean, no external deps.

var FLAG_US = '<svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true" style="display:block;flex-shrink:0;border-radius:2px;overflow:hidden;">' +
  '<rect width="18" height="13" fill="#B22234"/>' +
  '<rect y="1" width="18" height="1" fill="#fff"/>' +
  '<rect y="3" width="18" height="1" fill="#fff"/>' +
  '<rect y="5" width="18" height="1" fill="#fff"/>' +
  '<rect y="7" width="18" height="1" fill="#fff"/>' +
  '<rect y="9" width="18" height="1" fill="#fff"/>' +
  '<rect y="11" width="18" height="1" fill="#fff"/>' +
  '<rect width="7" height="7" fill="#3C3B6E"/>' +
  '<circle cx="1.5" cy="1.3" r="0.5" fill="#fff"/>' +
  '<circle cx="3.5" cy="1.3" r="0.5" fill="#fff"/>' +
  '<circle cx="5.5" cy="1.3" r="0.5" fill="#fff"/>' +
  '<circle cx="2.5" cy="2.5" r="0.5" fill="#fff"/>' +
  '<circle cx="4.5" cy="2.5" r="0.5" fill="#fff"/>' +
  '<circle cx="1.5" cy="3.7" r="0.5" fill="#fff"/>' +
  '<circle cx="3.5" cy="3.7" r="0.5" fill="#fff"/>' +
  '<circle cx="5.5" cy="3.7" r="0.5" fill="#fff"/>' +
  '<circle cx="2.5" cy="4.9" r="0.5" fill="#fff"/>' +
  '<circle cx="4.5" cy="4.9" r="0.5" fill="#fff"/>' +
  '<circle cx="1.5" cy="6.1" r="0.5" fill="#fff"/>' +
  '<circle cx="3.5" cy="6.1" r="0.5" fill="#fff"/>' +
  '<circle cx="5.5" cy="6.1" r="0.5" fill="#fff"/>' +
  '</svg>';

var FLAG_MX = '<svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true" style="display:block;flex-shrink:0;border-radius:2px;overflow:hidden;">' +
  '<rect width="6" height="13" fill="#006847"/>' +
  '<rect x="6" width="6" height="13" fill="#fff"/>' +
  '<rect x="12" width="6" height="13" fill="#CE1126"/>' +
  '<ellipse cx="9" cy="6.5" rx="1.8" ry="2" fill="#8B6914" opacity="0.7"/>' +
  '</svg>';

/** Build the locale toggle HTML string */
function buildLocaleToggleHTML() {
  return '<div class="locale-toggle" aria-label="Change language and currency" role="group">' +
    '<button class="locale-btn' + (_activeLocale === 'en-US' ? ' active' : '') + '" ' +
      'data-locale="en-US" ' +
      'aria-pressed="' + (_activeLocale === 'en-US' ? 'true' : 'false') + '" ' +
      'aria-label="English, prices in US dollars" ' +
      'title="English · USD">' +
      FLAG_US +
      '<span class="locale-btn-label">EN</span>' +
    '</button>' +
    '<div class="locale-sep" aria-hidden="true"></div>' +
    '<button class="locale-btn' + (_activeLocale === 'es-MX' ? ' active' : '') + '" ' +
      'data-locale="es-MX" ' +
      'aria-pressed="' + (_activeLocale === 'es-MX' ? 'true' : 'false') + '" ' +
      'aria-label="Español, precios en pesos mexicanos" ' +
      'title="Español · MXN">' +
      FLAG_MX +
      '<span class="locale-btn-label">ES</span>' +
    '</button>' +
  '</div>';
}

/** Inject the locale toggle into the header-actions div */
function mountLocaleToggle() {
  var headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  // Prevent double-mount
  if (document.querySelector('.locale-toggle')) return;

  var wrapper = document.createElement('div');
  wrapper.innerHTML = buildLocaleToggleHTML();
  var toggle = wrapper.firstChild;

  // Insert as the first child (leftmost in header-actions)
  headerActions.insertBefore(toggle, headerActions.firstChild);

  // Wire click handlers
  var btns = toggle.querySelectorAll('.locale-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var locale = this.getAttribute('data-locale');
      if (locale !== _activeLocale) {
        setLocale(locale);
        showLocaleToast(locale);
      }
    });
  }
}

/** Show a brief toast on locale switch */
function showLocaleToast(locale) {
  var msg = locale === 'en-US'
    ? 'Switched to English · USD'
    : 'Cambiado a Español · MXN';
  if (typeof showToast === 'function') showToast(msg, 'info');
}

// ── Auto-init ──────────────────────────────────────────────────
// Mount after DOM is ready; app.js loads after this script.

document.addEventListener('DOMContentLoaded', function () {
  mountLocaleToggle();
  applyLocaleToDOM();
});

// Export globals for use in app.js
window.i18n = {
  getLocale:          getLocale,
  getCurrency:        getCurrency,
  getLocaleConfig:    getLocaleConfig,
  setLocale:          setLocale,
  t:                  t,
  formatMoney:        formatMoney,
  formatNum:          formatNum,
  formatMoneyCompact: formatMoneyCompact,
  convertFromMXN:     convertFromMXN,
  currencyUnitLabel:  currencyUnitLabel,
  psmLabel:           psmLabel,
  applyLocaleToDOM:   applyLocaleToDOM,
  mountLocaleToggle:  mountLocaleToggle
};
