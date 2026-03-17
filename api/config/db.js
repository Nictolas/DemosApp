// File: api/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Usa DATABASE_URL se disponibile, altrimenti usa le variabili separate
const config = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
      ssl: {
        rejectUnauthorized: false
      }
    };

const pool = new Pool(config);

module.exports = { pool };
