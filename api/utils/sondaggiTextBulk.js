'use strict';

/**
 * National survey aggregates using the current TEXT answer columns.
 * This is NOT a binary codec, migration or new API response.
 *
 * The published question list is supplied by the existing /api/sondaggi
 * route. Before interpolating any column into SQL, validate its identifier
 * and require an exact match in public.opinioni_risposte metadata.
 */
const { cellThresholdMet } = require('./politicalAggregatePrivacy');

const SAFE_COLUMN = /^[a-z][a-z0-9_]{0,62}$/;
const MAX_GROUPED_COLUMNS = 256;
const MAX_LEGACY_FALLBACK_COLUMNS = 128;

// Keep the SQL text for each grouped statement bounded as the catalog grows.
// A 300-question catalog takes two aggregates instead of >600 legacy reads.
async function queryGroupedChunks(pool, columns, builder, params = []) {
  const rows = [];
  for (let start = 0; start < columns.length; start += MAX_GROUPED_COLUMNS) {
    const batch = columns.slice(start, start + MAX_GROUPED_COLUMNS);
    const result = await pool.query(builder(batch), params);
    rows.push(...result.rows);
  }
  return rows;
}

// Multiple statements must observe one consent/answer snapshot. A pool.query()
// call may use a different connection and each READ COMMITTED statement can
// otherwise see a different set of consents. Use one read-only REPEATABLE READ
// transaction for catalogs that require multiple aggregate batches.
// A request that starts before a revocation may still finish on its earlier
// snapshot; a NEW request sees the committed revocation.
// Use one consistent snapshot for operations consisting of multiple SQL
// statements. In production the pg.Pool always implements connect().
async function withReadOnlySnapshot(pool, read, { requireConnection = false } = {}) {
  if (typeof pool.connect !== 'function') {
    // Strictly require it for multi-batch queries, where consistency is
    // essential even if a non-transactional adapter is supplied.
    if (requireConnection) {
      throw new TypeError('Survey read requires a transaction-capable pool');
    }
    // Legacy unit-test adapters expose only query(); actual pg pools always
    // have connect(). Never use this fallback for an actual connection pool.
    return read(pool);
  }
  const client = await pool.connect();
  let begun = false;
  let damaged = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    begun = true;
    const value = await read(client);
    await client.query('COMMIT');
    begun = false;
    return value;
  } catch (error) {
    if (begun) {
      try { await client.query('ROLLBACK'); }
      catch (_) { damaged = true; }
    } else {
      // A failed BEGIN or COMMIT may leave the connection unusable. Avoid
      // returning it to the pool for future requests.
      damaged = true;
    }
    throw error;
  } finally {
    client.release(damaged);
  }
}

async function withMultiBatchSnapshot(pool, ids, read) {
  if (ids.length <= MAX_GROUPED_COLUMNS) return read(pool);
  return withReadOnlySnapshot(pool, read, {requireConnection:true});
}

function enforceLegacyFallbackBudget(ids) {
  if (ids.length > MAX_LEGACY_FALLBACK_COLUMNS) {
    const error = new Error('Survey legacy fallback exceeds safe query budget');
    error.code = 'SONDAGGI_FALLBACK_LIMIT';
    throw error;
  }
}


// An unavailable/overloaded database must never trigger up to two extra
// queries per question. Only stable SQL feature / syntax incompatibilities
// can justify switching from grouped VALUES to the legacy implementation.
// PostgreSQL SQLSTATE: 0A000=feature_not_supported, 42601=syntax_error,
// 42883=undefined_function, 42703=undefined_column (metadata race).
const FALLBACK_SQLSTATES = new Set(['0A000', '42601', '42883', '42703']);
function eligibleForLegacyFallback(error) {
  return error != null && typeof error.code === 'string' &&
    FALLBACK_SQLSTATES.has(error.code);
}

const COLUMN_SQL = `
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'opinioni_risposte'
    AND column_name = ANY($1::text[])
`;

function safeOpinionIds(questions) {
  if (!Array.isArray(questions)) throw new TypeError('Expected question array');
  return [...new Set(questions.map(q => q?.id).filter(
    id => typeof id === 'string' && SAFE_COLUMN.test(id)
  ))];
}

function aggregateRow(row) {
  return {
    favorevole: Number.parseInt(row.favorevole, 10) || 0,
    contrario: Number.parseInt(row.contrario, 10) || 0,
    indeciso: Number.parseInt(row.indeciso, 10) || 0
  };
}

function asPublishedStats(rows) {
  const stats = {};
  for (const row of rows) {
    const aggregate = aggregateRow(row);
    if (cellThresholdMet(aggregate)) {
      stats[row.opinion_id] = aggregate;
    }
  }
  return stats;
}


// Opt-in staging experiment only. Default behaviour stays the measured
// lateral-per-person SQL; do not enable on DEMOS production without a
// staged comparison across both small and large account populations.
function directFilterEnabled() {
  const e = process.env;
  // A lone flag must not silently enable experimental query plans on
  // DEMOS production. Permit only the disposable CI or the specifically
  // isolated OP-37 Render staging service (with its setup-only gate off).
  return e.SONDAGGI_EXPERIMENTAL_DIRECT_FILTER === 'true' && (
    (e.GITHUB_ACTIONS === 'true' && e.SONDAGGI_TEXT_CI === 'isolated') ||
    (e.RENDER === 'true' && e.OP37_STAGING_HTTP_ONLY === 'yes' &&
     e.OP37_STAGING_SETUP_ONLY === 'no')
  );
}

// Pivot counts only AFTER computing each selected column's f/c/i totals.
// Unlike the existing query, this does not generate person × opinion rows.
// Opinion identifiers are validated and checked against DB metadata before
// this builder is called in an actual route.
function buildDirectFilterTextAggregateQuery(columns, options = {}) {
  if (!Array.isArray(columns) || columns.length === 0 ||
      columns.length > MAX_GROUPED_COLUMNS ||
      new Set(columns).size !== columns.length ||
      columns.some(id => typeof id !== 'string' || !SAFE_COLUMN.test(id))) {
    throw new TypeError('Expected distinct validated opinion column names');
  }
  const geo = options.scope ? territorialFilter(options.scope, options.params) : '';
  const names = columns.map((id,i) => ({id,f:'f'+i,c:'c'+i,u:'i'+i}));
  const counts = names.flatMap(({id,f,c,u}) => [
    'COUNT(*) FILTER (WHERE orr."'+id+'" = \'f\')::int AS '+f,
    'COUNT(*) FILTER (WHERE orr."'+id+'" = \'c\')::int AS '+c,
    'COUNT(*) FILTER (WHERE orr."'+id+'" = \'i\')::int AS '+u
  ]);
  const values = names.map(({id,f,c,u}) =>
    "('"+id+"', totals."+f+", totals."+c+", totals."+u+")");
  return [
    'SELECT v.opinion_id, v.favorevole, v.contrario, v.indeciso',
    'FROM (SELECT '+counts.join(',\n      '),
    'FROM opinioni_risposte orr',
    'JOIN users u ON u.id = orr.user_id',
    'LEFT JOIN user_consents uc ON uc.user_id = u.id',
    "WHERE u.account_type IN ('PERSON', 'P')",
    'AND COALESCE(uc.political_opinions_consent,',
    '             u.political_opinions_consent, false) IS TRUE',
    geo,
    ') totals CROSS JOIN LATERAL (VALUES',
    values.join(',\n      '),
    ') AS v(opinion_id, favorevole, contrario, indeciso)',
    'WHERE (v.favorevole + v.contrario + v.indeciso) > 0'
  ].filter(Boolean).join('\n');
}

function buildNationalTextAggregateQuery(columns) {
  if (!Array.isArray(columns) || columns.length === 0 ||
      columns.length > MAX_GROUPED_COLUMNS ||
      new Set(columns).size !== columns.length ||
      columns.some(id => typeof id !== 'string' || !SAFE_COLUMN.test(id))) {
    throw new TypeError('Expected unique validated opinion columns');
  }
  const values = columns.map(id => "('" + id + "', orr.\"" + id + "\")").join(',\n    ');
  return `
    SELECT v.opinion_id,
      COUNT(*) FILTER (WHERE v.answer = 'f')::int AS favorevole,
      COUNT(*) FILTER (WHERE v.answer = 'c')::int AS contrario,
      COUNT(*) FILTER (WHERE v.answer = 'i')::int AS indeciso
    FROM opinioni_risposte orr
    JOIN users u ON u.id = orr.user_id
    LEFT JOIN user_consents uc ON uc.user_id = u.id
    CROSS JOIN LATERAL (VALUES
      ${values}
    ) AS v(opinion_id, answer)
    WHERE v.answer IS NOT NULL
      AND u.account_type IN ('PERSON', 'P')
      AND COALESCE(uc.political_opinions_consent,
                   u.political_opinions_consent, false) IS TRUE
    GROUP BY v.opinion_id
  `;
}

async function legacyNationalStatsFallback(pool, ids) {
  enforceLegacyFallbackBudget(ids);
  const stats = {};
  for (const id of ids) {
    try {
      const allowed = await pool.query(COLUMN_SQL, [[id]]);
      if (!allowed.rows.some(row => row.column_name === id)) continue;
      const quoted = '"' + id + '"';
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE orr.${quoted} = 'f') AS favorevole,
          COUNT(*) FILTER (WHERE orr.${quoted} = 'c') AS contrario,
          COUNT(*) FILTER (WHERE orr.${quoted} = 'i') AS indeciso
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${quoted} IS NOT NULL
          AND u.account_type IN ('PERSON', 'P')
          AND COALESCE(uc.political_opinions_consent,
                       u.political_opinions_consent, false) IS TRUE
      `);
      const aggregate = aggregateRow(result.rows[0] || {});
      if (cellThresholdMet(aggregate)) stats[id] = aggregate;
    } catch (error) {
      // A concurrent schema change can remove an individual column;
      // all other errors stop the loop instead of multiplying DB work.
      if (error?.code !== '42703') throw error;
      continue;
    }
  }
  return stats;
}

async function getNationalSurveyStats(pool, questions, logger = console) {
  const ids = safeOpinionIds(questions);
  if (ids.length === 0) return {};
  try {
    return await withMultiBatchSnapshot(pool, ids, async client => {
      const metadata = await client.query(COLUMN_SQL, [ids]);
      const existing = new Set(metadata.rows.map(row => row.column_name));
      const columns = ids.filter(id => existing.has(id));
      if (columns.length === 0) return {};
      const builder = directFilterEnabled() ?
        buildDirectFilterTextAggregateQuery : buildNationalTextAggregateQuery;
      const rows = await queryGroupedChunks(client, columns, builder);
      return asPublishedStats(rows.filter(row => existing.has(row.opinion_id)));
    });
  } catch (error) {
    // Never amplify outages: connection failures, statement timeouts,
    // permissions, pool exhaustion and unknown failures fail fast as 500.
    if (!eligibleForLegacyFallback(error)) throw error;
    enforceLegacyFallbackBudget(ids);
    logger.warn?.('National TEXT grouped SQL incompatible; using legacy per-opinion queries', error.code);
    return withReadOnlySnapshot(pool, client => legacyNationalStatsFallback(client, ids));
  }
}


// Every territorial scope is an exact, static SQL clause. Never interpolate
// geography or client-supplied column names directly into SQL.
const TERRITORIAL_FILTERS = Object.freeze({
  regione: ['u.regione_residenza = $1'],
  provincia: ['u.regione_residenza = $1', 'u.provincia_residenza = $2'],
  comune: [
    'u.regione_residenza = $1',
    'u.provincia_residenza = $2',
    'u.comune_residenza = $3'
  ]
});

function territorialFilter(scope, params) {
  if (!Object.hasOwn(TERRITORIAL_FILTERS, scope) ||
      !Array.isArray(params) ||
      params.length !== TERRITORIAL_FILTERS[scope].length ||
      params.some(value => typeof value !== 'string' || value.length === 0)) {
    throw new TypeError('Expected supported territorial scope and parameter values');
  }
  return TERRITORIAL_FILTERS[scope].map(fragment => 'AND '+fragment).join('\n      ');
}

function buildTerritorialTextAggregateQuery(columns, { scope, params } = {}) {
  const filter = territorialFilter(scope, params);
  if (!Array.isArray(columns) || columns.length === 0 ||
      columns.length > MAX_GROUPED_COLUMNS ||
      new Set(columns).size !== columns.length ||
      columns.some(id => typeof id !== 'string' || !SAFE_COLUMN.test(id))) {
    throw new TypeError('Expected distinct validated opinion column names');
  }
  const values = columns.map(id => "('" + id + "', orr.\"" + id + "\")")
    .join(',\n      ');
  return [
    'SELECT v.opinion_id,',
    "COUNT(*) FILTER (WHERE v.answer = 'f')::int AS favorevole,",
    "COUNT(*) FILTER (WHERE v.answer = 'c')::int AS contrario,",
    "COUNT(*) FILTER (WHERE v.answer = 'i')::int AS indeciso",
    'FROM opinioni_risposte orr',
    'JOIN users u ON u.id = orr.user_id',
    'LEFT JOIN user_consents uc ON uc.user_id = u.id',
    'CROSS JOIN LATERAL (VALUES',
    values,
    ') AS v(opinion_id, answer)',
    'WHERE v.answer IS NOT NULL',
    "AND u.account_type IN ('PERSON', 'P')",
    'AND COALESCE(uc.political_opinions_consent,',
    '             u.political_opinions_consent, false) IS TRUE',
    filter,
    'GROUP BY v.opinion_id'
  ].join('\n');
}

async function legacyTerritorialStatsFallback(pool, ids, scope, params) {
  const filter = territorialFilter(scope, params);
  enforceLegacyFallbackBudget(ids);
  const stats = {};
  for (const id of ids) {
    try {
      const allowed = await pool.query(COLUMN_SQL, [[id]]);
      if (!allowed.rows.some(row => row.column_name === id)) continue;
      const quoted = '"' + id + '"';
      const query = [
        'SELECT',
        "COUNT(*) FILTER (WHERE orr." + quoted + " = 'f') AS favorevole,",
        "COUNT(*) FILTER (WHERE orr." + quoted + " = 'c') AS contrario,",
        "COUNT(*) FILTER (WHERE orr." + quoted + " = 'i') AS indeciso",
        'FROM opinioni_risposte orr',
        'JOIN users u ON u.id = orr.user_id',
        'LEFT JOIN user_consents uc ON uc.user_id = u.id',
        'WHERE orr.' + quoted + ' IS NOT NULL',
        "AND u.account_type IN ('PERSON', 'P')",
        'AND COALESCE(uc.political_opinions_consent,',
        '             u.political_opinions_consent, false) IS TRUE',
        filter
      ].join('\n');
      const result = await pool.query(query, params);
      const aggregate = aggregateRow(result.rows[0] || {});
      if (cellThresholdMet(aggregate)) stats[id] = aggregate;
    } catch (error) {
      // A concurrent schema change can remove an individual column;
      // all other errors stop the loop instead of multiplying DB work.
      if (error?.code !== '42703') throw error;
      continue;
    }
  }
  return stats;
}

async function getTerritorialSurveyStats(pool, questions, { scope, params } = {}, logger = console) {
  territorialFilter(scope, params);
  const ids = safeOpinionIds(questions);
  if (ids.length === 0) return {};
  try {
    return await withMultiBatchSnapshot(pool, ids, async client => {
      const metadata = await client.query(COLUMN_SQL, [ids]);
      const existing = new Set(metadata.rows.map(row => row.column_name));
      const columns = ids.filter(id => existing.has(id));
      if (columns.length === 0) return {};
      const builder = directFilterEnabled() ?
        batch => buildDirectFilterTextAggregateQuery(batch, {scope,params}) :
        batch => buildTerritorialTextAggregateQuery(batch, {scope,params});
      const rows = await queryGroupedChunks(client, columns, builder, params);
      return asPublishedStats(rows.filter(row => existing.has(row.opinion_id)));
    });
  } catch (error) {
    if (!eligibleForLegacyFallback(error)) throw error;
    enforceLegacyFallbackBudget(ids);
    logger.warn?.('Territorial TEXT grouped SQL incompatible; using legacy per-opinion queries', error.code);
    return withReadOnlySnapshot(pool, client => legacyTerritorialStatsFallback(client, ids, scope, params));
  }
}
module.exports = {
  safeOpinionIds,
  eligibleForLegacyFallback,
  buildDirectFilterTextAggregateQuery,
  buildNationalTextAggregateQuery,
  getNationalSurveyStats,
  buildTerritorialTextAggregateQuery,
  getTerritorialSurveyStats
};
