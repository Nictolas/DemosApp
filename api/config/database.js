// File: api/config/database.js
// Configurazione centralizzata del database per ottimizzare le performance
const { Pool } = require('pg');

// Configurazione ottimizzata per gestire molti utenti connessi
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  // Aumento significativo delle connessioni per supportare molti utenti
  max: 100,                    // Aumentato da 20 a 100 connessioni massime
  min: 10,                     // Mantieni sempre 10 connessioni attive
  idleTimeoutMillis: 60000,    // 1 minuto prima di chiudere connessioni idle
  connectionTimeoutMillis: 15000, // 15 secondi timeout per nuove connessioni
  query_timeout: 30000,        // 30 secondi timeout per query
  statement_timeout: 30000,    // 30 secondi timeout per statement
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Configurazioni per performance
  allowExitOnIdle: false,      // Non chiudere il pool quando idle
  application_name: 'demos-app-performance-optimized'
};

// Pool singleton per evitare connessioni duplicate
let poolInstance = null;

const getPool = () => {
  if (!poolInstance) {
    console.log('🔧 Inizializzazione pool database ottimizzato...');
    poolInstance = new Pool(poolConfig);
    
    // Event listeners per monitoraggio
    poolInstance.on('connect', (client) => {
      console.log('🔗 Nuova connessione database stabilita');
    });
    
    poolInstance.on('error', (err) => {
      console.error('❌ Errore pool database:', err);
    });
    
    poolInstance.on('remove', (client) => {
      console.log('🔌 Connessione database rimossa');
    });
  }
  return poolInstance;
};

// Funzione per ottenere statistiche del pool
const getPoolStats = () => {
  if (!poolInstance) return null;
  
  return {
    totalCount: poolInstance.totalCount,
    idleCount: poolInstance.idleCount,
    waitingCount: poolInstance.waitingCount,
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    utilizationPercent: Math.round((poolInstance.totalCount / poolConfig.max) * 100)
  };
};

// Funzione per testare la connessione
const testConnection = async () => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    
    return {
      success: true,
      timestamp: result.rows[0].current_time,
      version: result.rows[0].db_version,
      poolStats: getPoolStats()
    };
  } catch (error) {
    console.error('❌ Test connessione database fallito:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Funzione per chiudere il pool (per shutdown graceful)
const closePool = async () => {
  if (poolInstance) {
    console.log('🔌 Chiusura pool database...');
    await poolInstance.end();
    poolInstance = null;
  }
};

module.exports = {
  getPool,
  getPoolStats,
  testConnection,
  closePool,
  poolConfig
};
