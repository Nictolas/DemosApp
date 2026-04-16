/**
 * Metriche in-memory per fase 1: frequenza e durata per endpoint (pattern route).
 * Si resetta al riavvio del processo. Opzionale: reset manuale via API admin.
 */

const startedAt = Date.now();

function isEnabled() {
  return process.env.REQUEST_METRICS_ENABLED !== 'false';
}

/** Normalizza path senza route Express (404 o middleware) per non esplodere le chiavi. */
function normalizeUnknownPath(path) {
  let p = String(path || '').split('?')[0];
  p = p.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':uuid'
  );
  p = p.replace(/\/\d+(?=\/|$)/g, '/:id');
  return p || '/';
}

/**
 * Etichetta stabile per aggregare: pattern route Express se disponibile, altrimenti path normalizzato.
 */
function getRouteLabel(req) {
  if (req.route && typeof req.route.path === 'string') {
    const base = req.baseUrl || '';
    const rp = req.route.path;
    const pathPart = rp === '/' ? '' : rp;
    return (base + pathPart) || '/';
  }
  const raw = (req.originalUrl || req.url || '').split('?')[0];
  return normalizeUnknownPath(raw);
}

const MAX_KEYS = Math.max(50, parseInt(process.env.REQUEST_METRICS_MAX_KEYS || '800', 10));

const stats = new Map();

function makeKey(method, routeLabel) {
  return `${method} ${routeLabel}`;
}

function record(req, res, durationMs) {
  if (!isEnabled()) return;

  const method = req.method || 'GET';
  const routeLabel = getRouteLabel(req);
  const key = makeKey(method, routeLabel);
  const status = res.statusCode || 0;
  const d = Math.max(0, Math.round(durationMs));

  let row = stats.get(key);
  if (!row) {
    if (stats.size >= MAX_KEYS) {
      return;
    }
    row = {
      method,
      route: routeLabel,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      minMs: Number.POSITIVE_INFINITY,
      errors: 0
    };
    stats.set(key, row);
  }

  row.count += 1;
  row.totalMs += d;
  if (d > row.maxMs) row.maxMs = d;
  if (d < row.minMs) row.minMs = d;
  if (status >= 400) row.errors += 1;
}

function reset() {
  stats.clear();
}

function getSnapshot() {
  const rows = Array.from(stats.values()).map((r) => ({
    method: r.method,
    route: r.route,
    count: r.count,
    totalMs: r.totalMs,
    avgMs: r.count ? Math.round((r.totalMs / r.count) * 100) / 100 : 0,
    maxMs: r.maxMs,
    minMs: r.minMs === Number.POSITIVE_INFINITY ? 0 : r.minMs,
    errors: r.errors
  }));

  rows.sort((a, b) => b.count - a.count);

  const totalRequests = rows.reduce((s, r) => s + r.count, 0);

  const slowest = [...rows]
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, 20);

  return {
    enabled: isEnabled(),
    since: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    totalRequests,
    endpointsTracked: rows.length,
    maxKeys: MAX_KEYS,
    byCount: rows,
    slowestByMaxMs: slowest
  };
}

module.exports = {
  record,
  reset,
  getSnapshot,
  getRouteLabel,
  isEnabled
};
