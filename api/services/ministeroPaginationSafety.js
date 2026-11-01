'use strict';

// Strict, pure validation of the official multi-page feed before any writes
// or new civic notifications. Reject truncated, empty or inconsistent pages.
const MAX_OFFICIAL_PAGES = 100;

function parseCount(value, label) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('MINISTERO_PAGINATION_' + label + '_INVALID');
  return n;
}

function selectPageItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('MINISTERO_PAGINATION_BAD_RESPONSE');
  }
  // Never reinterpret malformed or missing content as one data record.
  for (const key of ['content', 'iniziative', 'data']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      if (!Array.isArray(payload[key])) throw new Error('MINISTERO_PAGINATION_BAD_ITEMS');
      return payload[key];
    }
  }
  throw new Error('MINISTERO_PAGINATION_MISSING_ITEMS');
}

function inspectMinisteroPage(payload, {
  currentPage,
  pageSize,
  priorItems,
  expectedTotal = null,
} = {}) {
  if (!Number.isSafeInteger(currentPage) || currentPage < 0 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 ||
      !Number.isSafeInteger(priorItems) || priorItems < 0) {
    throw new TypeError('MINISTERO_PAGINATION_BAD_CONTEXT');
  }
  const items = selectPageItems(payload);
  if (items.length > pageSize ||
      items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('MINISTERO_PAGINATION_INVALID_ITEMS');
  }

  const page = Array.isArray(payload) ? null
    : (payload.infoPaginazione || payload.pagination || payload.pagina || null);
  if (page != null && (typeof page !== 'object' || Array.isArray(page))) {
    throw new Error('MINISTERO_PAGINATION_INVALID_METADATA');
  }
  const total = parseCount(page?.totalElements ?? page?.total ?? page?.totale, 'TOTAL');
  const totalPages = parseCount(
    page?.totalPages ?? page?.total_page ?? page?.pagine_totali, 'PAGES'
  );
  if (total !== null && expectedTotal !== null && total !== expectedTotal) {
    throw new Error('MINISTERO_PAGINATION_TOTAL_CHANGED');
  }
  const authoritativeTotal = expectedTotal ?? total;
  if (totalPages != null && (totalPages === 0 || currentPage >= totalPages)) {
    throw new Error('MINISTERO_PAGINATION_PAGE_OUT_OF_RANGE');
  }
  if (items.length === 0 && priorItems === 0) {
    throw new Error('MINISTERO_PAGINATION_EMPTY_FEED');
  }
  const readItems = priorItems + items.length;
  if (authoritativeTotal != null && readItems > authoritativeTotal) {
    throw new Error('MINISTERO_PAGINATION_TOO_MANY_ITEMS');
  }
  const last = page?.last;
  if (last != null && typeof last !== 'boolean') {
    throw new Error('MINISTERO_PAGINATION_INVALID_LAST_FLAG');
  }

  let hasMore;
  if (totalPages != null) {
    hasMore = currentPage + 1 < totalPages;
    if (last === true && hasMore) throw new Error('MINISTERO_PAGINATION_EARLY_END');
    if (last === false && !hasMore) throw new Error('MINISTERO_PAGINATION_LAST_CONFLICT');
  } else if (last != null) {
    hasMore = !last;
  } else if (authoritativeTotal != null) {
    hasMore = readItems < authoritativeTotal;
  } else {
    hasMore = items.length === pageSize;
  }
  if (hasMore && items.length === 0) {
    throw new Error('MINISTERO_PAGINATION_EARLY_EMPTY_PAGE');
  }
  if (hasMore && currentPage + 1 >= MAX_OFFICIAL_PAGES) {
    throw new Error('MINISTERO_PAGINATION_LIMIT_REACHED');
  }
  if (!hasMore && authoritativeTotal != null && readItems !== authoritativeTotal) {
    throw new Error('MINISTERO_PAGINATION_TRUNCATED');
  }
  return { items, hasMore, expectedTotal: authoritativeTotal };
}

module.exports = { inspectMinisteroPage, MAX_OFFICIAL_PAGES };
