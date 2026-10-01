// File: api/config/db.js
// Compatibility facade for legacy imports. The canonical pool configuration lives
// in database.js, where remote connections use certificate verification.
const { getPool } = require('./database');

const pool = getPool();

// Some legacy routes import { pool }, while others import this module and call
// db.query(...). Export the Pool itself and keep .pool as a compatibility alias.
module.exports = pool;
module.exports.pool = pool;
