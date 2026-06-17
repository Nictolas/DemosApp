/** @deprecated Usa centralizedLogsDb.js — mantenuto per compatibilità import legacy. */
const db = require('./centralizedLogsDb');

module.exports = {
  isCentralizedLogsTableAvailable: db.isCentralizedLogsTableAvailable,
  invalidateCentralizedLogsNeonCache: db.invalidateCentralizedLogsDbCache
};
