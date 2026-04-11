// File: api/config/database.js
// Configurazione centralizzata del database per ottimizzare le performance
const { Pool } = require('pg');

const poolMax = Math.max(1, parseInt(process.env.DATABASE_POOL_MAX || '100', 10));
// Neon: preferire DATABASE_URL con endpoint pooler (-pooler) e min basso per ridurre tempo di compute attivo.
const defaultPoolMin = process.env.NODE_ENV === 'production' ? '0' : '2';
const poolMin = Math.max(
  0,
  Math.min(parseInt(process.env.DATABASE_POOL_MIN || defaultPoolMin, 10), poolMax)
);

// Configurazione ottimizzata per gestire molti utenti connessi
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { 
        rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    // Override con DATABASE_POOL_MAX / DATABASE_POOL_MIN (su Neon: min basso = compute può sospendersi prima)
  max: poolMax,
  min: poolMin,
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
    // Verifica che DATABASE_URL sia disponibile
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL non definita! Il database non può essere inizializzato.');
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    console.log('🔧 Inizializzazione pool database ottimizzato...');
    try {
      poolInstance = new Pool(poolConfig);
      
      // Event listeners per monitoraggio e gestione errori
      poolInstance.on('connect', (client) => {
        console.log('🔗 Nuova connessione database stabilita');
        
        // Gestisci errori a livello di client
        client.on('error', (err) => {
          console.error('❌ Errore client database:', err);
          // Il pool gestirà automaticamente la rimozione del client difettoso
        });
      });
      
      poolInstance.on('error', (err, client) => {
        console.error('❌ Errore pool database:', err);
        console.error('   Codice errore:', err.code);
        console.error('   Messaggio:', err.message);
        
        // Se è un errore di connessione, il pool lo gestirà automaticamente
        // ma logghiamo per monitoraggio
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          console.error('⚠️ Connessione database persa, il pool tenterà di riconnettersi automaticamente');
        }
        
        // Se il client è specificato, rilascialo per evitare leak
        if (client) {
          try {
            client.release();
          } catch (releaseError) {
            console.error('❌ Errore nel rilasciare client difettoso:', releaseError);
          }
        }
      });
      
      poolInstance.on('remove', (client) => {
        console.log('🔌 Connessione database rimossa');
      });
    } catch (error) {
      console.error('❌ Errore nella creazione del pool database:', error);
      throw error;
    }
  }
  return poolInstance;
};

// Funzione per ottenere statistiche del pool
const getPoolStats = () => {
  if (!poolInstance) return null;
  
  const stats = {
    totalCount: poolInstance.totalCount || 0,
    idleCount: poolInstance.idleCount || 0,
    waitingCount: poolInstance.waitingCount || 0,
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    utilizationPercent: Math.round(((poolInstance.totalCount || 0) / poolConfig.max) * 100)
  };
  
  // Alert se il pool è saturo (oltre 90%)
  if (stats.utilizationPercent > 90) {
    console.warn(`⚠️ POOL DATABASE SATURO: ${stats.utilizationPercent}% utilizzato (${stats.totalCount}/${stats.maxConnections} connessioni)`);
    console.warn(`⚠️ Connessioni in attesa: ${stats.waitingCount}`);
  }
  
  return stats;
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
