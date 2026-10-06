// Compatibility adapter for legacy routes.
// Keep a single database pool and inherit the verified TLS configuration from database.js.
const { getPool } = require('./database');

const pool = getPool();

module.exports = { pool };
