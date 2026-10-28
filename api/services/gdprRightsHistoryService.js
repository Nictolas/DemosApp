'use strict';

// A single, bounded and read-only source of GDPR rights request history for
// both legacy HTTP endpoints. Do not return private request_data,
// response_data or internal DPO identity to the user-facing history.
function integerParameter(raw, fallback, minimum, maximum) {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= minimum &&
    number <= maximum ? number : null;
}

function parseRightsHistoryQuery(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return null;
  const limit = integerParameter(query.limit, 50, 1, 50);
  const offset = integerParameter(query.offset, 0, 0, 100000);
  const status = query.status;
  if (limit === null || offset === null ||
      (status !== undefined && (typeof status !== 'string' ||
      !/^[a-z][a-z0-9_]{0,19}$/.test(status)))) return null;
  return Object.freeze({limit, offset, status});
}

async function readRightsHistory(pool, userId, {limit, offset, status}) {
  if (!pool || typeof pool.query !== 'function' ||
      (typeof userId !== 'string' && typeof userId !== 'number') ||
      !userId || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    throw Error('GDPR_RIGHTS_HISTORY_INVALID_INVOCATION');
  }
  const values = [userId];
  let filter = '';
  if (status !== undefined) {
    values.push(status);
    filter = ' AND status = $' + values.length;
  }
  values.push(limit + 1, offset);
  const pageLimit = '$' + (values.length - 1);
  const pageOffset = '$' + values.length;

  // The visibility preflight and page execute in ONE PostgreSQL statement,
  // eliminating role/pool changes and READ COMMITTED snapshot drift between
  // two standalone queries. A role subject to partial RLS must fail closed.
  const result = await pool.query(
    'WITH visibility AS MATERIALIZED (' +
    "SELECT NOT pg_catalog.row_security_active(" +
    "'public.user_rights_requests'::regclass) AS complete_visibility) " +
    'SELECT visibility.complete_visibility, history.id, ' +
    'history.request_type, history.status, history.created_at, ' +
    'history.processed_at FROM visibility LEFT JOIN LATERAL (' +
    'SELECT id, request_type, status, created_at, processed_at ' +
    'FROM public.user_rights_requests WHERE user_id = $1' + filter +
    ' ORDER BY created_at DESC NULLS LAST, id DESC ' +
    'LIMIT ' + pageLimit + ' OFFSET ' + pageOffset +
    ') AS history ON visibility.complete_visibility',
    values
  );
  if (result.rows?.[0]?.complete_visibility !== true) {
    throw Error('GDPR_RIGHTS_HISTORY_RLS_UNVERIFIABLE');
  }
  // LEFT JOIN emits one row with null id for a genuinely empty page.
  const rows = result.rows.filter(row => row.id != null).map(row => ({
    id: row.id,
    request_type: row.request_type,
    status: row.status,
    created_at: row.created_at,
    processed_at: row.processed_at
  }));
  const hasMore = rows.length > limit;
  return {
    data: rows.slice(0, limit),
    pagination: {
      limit, offset, has_more: hasMore,
      next_offset: hasMore ? offset + limit : null
    }
  };
}

module.exports = {parseRightsHistoryQuery, readRightsHistory};
