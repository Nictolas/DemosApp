// Carica dotenv solo se disponibile (non necessario in produzione)
try {
  require('dotenv').config();
} catch (error) {
  // dotenv non disponibile, usa le variabili d'ambiente del sistema
  console.log('dotenv non disponibile, usando variabili d\'ambiente del sistema');
}

const { Pool } = require('pg');

// Configurazione database per produzione e sviluppo
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        // Produzione: usa DATABASE_URL (formato standard per Render, Vercel, etc.)
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { 
          rejectUnauthorized: true,
          ca: process.env.SSL_CERT_PATH ? require('fs').readFileSync(process.env.SSL_CERT_PATH) : undefined
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        // Sviluppo: usa credenziali specifiche
        user: process.env.DB_USER || 'xeadylil_Nicolas',
        password: process.env.DB_PASSWORD || 'N1Nj6tAu789',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'xeadylil_demos',
        ssl: process.env.DB_SSL === 'true' || false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

// Test connection
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

module.exports = pool;
