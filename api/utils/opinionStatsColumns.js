'use strict';

// Every published opinion ID is validated when the immutable catalog loads,
// and the 94/94 answer-column parity is a required cutover gate.
// Therefore statistics need no extra information_schema SELECT per request.
// Still reject any non-published or malformed ID before interpolation into SQL.
const { isPublishedOpinionId } = require('../services/opinionCatalog');

async function resolvePublishedOpinionColumn(_pool, opinionId) {
  if (typeof opinionId !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(opinionId)) {
    return null;
  }
  return isPublishedOpinionId(opinionId) ? opinionId : null;
}

module.exports = { resolvePublishedOpinionColumn };
