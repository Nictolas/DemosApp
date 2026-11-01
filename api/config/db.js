'use strict';
// Compatibility for legacy routes. This MUST NOT create a second PostgreSQL
// pool or disable TLS certificate verification for Supabase connections.
// Production connection settings live in the canonical api/config/database.js.
require('dotenv').config();
const { getPool } = require('./database');

const pool = Object.freeze({
  query(...args) {
    return getPool().query(...args);
  },
  connect(...args) {
    return getPool().connect(...args);
  }
});

// Historical import styles use either { pool } or db.query(...) directly.
module.exports = {
  pool,
  query(...args) {
    return pool.query(...args);
  }
};
