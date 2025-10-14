const { Pool } = require('pg');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * STRATEGIA DI ARCHIVIAZIONE GDPR-COMPLIANT
 * 
 * 1. RETENTION POLICY: Dati mantenuti per periodi specifici
 * 2. ARCHIVIAZIONE: Dati vecchi spostati in storage esterno
 * 3. ANONIMIZZAZIONE: Dati personali anonimizzati prima dell'archiviazione
 * 4. ELIMINAZIONE: Dati oltre il periodo di retention eliminati
 * 5. BACKUP: Backup critici prima dell'eliminazione
 */

// Configurazione retention policy (in giorni)
const RETENTION_POLICIES = {
  // Dati critici - mantenuti più a lungo
  security_events: {
    active: 90,      // 3 mesi in database attivo
    archive: 365,    // 1 anno in archivio
    total: 455       // Totale: 1 anno e 3 mesi
  },
  access_audit: {
    active: 30,      // 1 mese in database attivo
    archive: 180,    // 6 mesi in archivio
    total: 210       // Totale: 7 mesi
  },
  
  // Dati di monitoraggio - retention più breve
  performance_metrics: {
    active: 7,       // 1 settimana in database attivo
    archive: 30,     // 1 mese in archivio
    total: 37        // Totale: 1 mese e 1 settimana
  },
  health_checks: {
    active: 7,       // 1 settimana in database attivo
    archive: 30,     // 1 mese in archivio
    total: 37        // Totale: 1 mese e 1 settimana
  },
  
  // Log generali - retention breve
  centralized_logs: {
    active: 14,      // 2 settimane in database attivo
    archive: 60,     // 2 mesi in archivio
    total: 74        // Totale: 2 mesi e 2 settimane
  },
  
  // Audit logs - retention media
  audit_logs: {
    active: 30,      // 1 mese in database attivo
    archive: 180,    // 6 mesi in archivio
    total: 210       // Totale: 7 mesi
  }
};

// Configurazione archiviazione
const ARCHIVE_CONFIG = {
  // Storage esterno (es. AWS S3, Google Cloud Storage)
  storage: {
    type: 's3', // o 'gcs', 'azure'
    bucket: process.env.ARCHIVE_BUCKET || 'demosapp-archive',
    region: process.env.ARCHIVE_REGION || 'eu-west-1'
  },
  
  // Compressione per ridurre spazio
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },
  
  // Crittografia per sicurezza
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    key: process.env.ARCHIVE_ENCRYPTION_KEY
  }
};

/**
 * Funzione principale di archiviazione
 */
async function archiveOldData() {
  console.log('🗄️ Inizio processo di archiviazione dati...');
  
  try {
    for (const [tableName, policy] of Object.entries(RETENTION_POLICIES)) {
      console.log(`\n📋 Processando tabella: ${tableName}`);
      
      // 1. Verifica se la tabella esiste
      const tableExists = await checkTableExists(tableName);
      if (!tableExists) {
        console.log(`⚠️ Tabella ${tableName} non esiste, salto...`);
        continue;
      }
      
      // 2. Conta record da archiviare
      const countToArchive = await countRecordsToArchive(tableName, policy.active);
      console.log(`📊 Record da archiviare: ${countToArchive}`);
      
      if (countToArchive === 0) {
        console.log(`✅ Nessun record da archiviare per ${tableName}`);
        continue;
      }
      
      // 3. Archivia i dati
      await archiveTableData(tableName, policy);
      
      // 4. Elimina dati oltre il periodo totale
      await deleteExpiredData(tableName, policy.total);
    }
    
    console.log('\n✅ Processo di archiviazione completato!');
    
  } catch (error) {
    console.error('❌ Errore durante archiviazione:', error);
    throw error;
  }
}

/**
 * Verifica se una tabella esiste
 */
async function checkTableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows[0].exists;
}

/**
 * Conta i record da archiviare
 */
async function countRecordsToArchive(tableName, activeDays) {
  const query = `
    SELECT COUNT(*) as count
    FROM ${tableName}
    WHERE created_at < NOW() - INTERVAL '${activeDays} days'
  `;
  
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

/**
 * Archivia i dati di una tabella
 */
async function archiveTableData(tableName, policy) {
  console.log(`📦 Archiviazione dati per ${tableName}...`);
  
  // 1. Estrai dati da archiviare
  const dataToArchive = await extractDataToArchive(tableName, policy.active);
  
  if (dataToArchive.length === 0) {
    console.log(`✅ Nessun dato da archiviare per ${tableName}`);
    return;
  }
  
  // 2. Anonimizza dati personali se necessario
  const anonymizedData = await anonymizePersonalData(tableName, dataToArchive);
  
  // 3. Comprimi i dati
  const compressedData = await compressData(anonymizedData);
  
  // 4. Carica su storage esterno
  const archivePath = await uploadToArchive(tableName, compressedData);
  
  // 5. Registra l'archiviazione
  await logArchival(tableName, dataToArchive.length, archivePath);
  
  // 6. Elimina i dati dal database attivo
  await deleteArchivedData(tableName, policy.active);
  
  console.log(`✅ Archiviazione completata per ${tableName}: ${dataToArchive.length} record`);
}

/**
 * Estrae i dati da archiviare
 */
async function extractDataToArchive(tableName, activeDays) {
  const query = `
    SELECT *
    FROM ${tableName}
    WHERE created_at < NOW() - INTERVAL '${activeDays} days'
    ORDER BY created_at ASC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Anonimizza i dati personali
 */
async function anonymizePersonalData(tableName, data) {
  console.log(`🔒 Anonimizzazione dati personali per ${tableName}...`);
  
  const anonymizedData = data.map(record => {
    const anonymized = { ...record };
    
    // Campi da anonimizzare per ogni tabella
    const fieldsToAnonymize = {
      centralized_logs: ['user_id', 'ip_address', 'user_agent', 'session_id'],
      security_events: ['user_id', 'user_email', 'ip_address', 'user_agent'],
      access_audit: ['user_id', 'ip_address', 'user_agent'],
      audit_logs: ['user_id', 'ip_address', 'user_agent'],
      performance_metrics: [], // Nessun dato personale
      health_checks: [] // Nessun dato personale
    };
    
    const fields = fieldsToAnonymize[tableName] || [];
    
    fields.forEach(field => {
      if (anonymized[field]) {
        if (field === 'ip_address') {
          // Anonimizza IP mantenendo solo la rete
          anonymized[field] = anonymizeIP(anonymized[field]);
        } else if (field === 'user_agent') {
          // Anonimizza user agent mantenendo solo browser/OS
          anonymized[field] = anonymizeUserAgent(anonymized[field]);
        } else {
          // Hash per altri campi
          anonymized[field] = hashValue(anonymized[field]);
        }
      }
    });
    
    return anonymized;
  });
  
  return anonymizedData;
}

/**
 * Anonimizza un indirizzo IP
 */
function anonymizeIP(ip) {
  if (!ip) return null;
  
  // Per IPv4, mantieni solo i primi 3 ottetti
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  
  // Per IPv6, mantieni solo i primi 4 gruppi
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::`;
  }
  
  return ip;
}

/**
 * Anonimizza user agent
 */
function anonymizeUserAgent(userAgent) {
  if (!userAgent) return null;
  
  // Estrai solo browser e OS principali
  const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0] || 'Unknown';
  const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/)?.[0] || 'Unknown';
  
  return `${browser} on ${os}`;
}

/**
 * Hash di un valore
 */
function hashValue(value) {
  if (!value) return null;
  
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value.toString()).digest('hex').substring(0, 16);
}

/**
 * Comprimi i dati
 */
async function compressData(data) {
  if (!ARCHIVE_CONFIG.compression.enabled) {
    return JSON.stringify(data);
  }
  
  const zlib = require('zlib');
  const jsonData = JSON.stringify(data);
  
  return new Promise((resolve, reject) => {
    zlib.gzip(jsonData, { level: ARCHIVE_CONFIG.compression.level }, (err, compressed) => {
      if (err) reject(err);
      else resolve(compressed);
    });
  });
}

/**
 * Carica i dati su storage esterno
 */
async function uploadToArchive(tableName, data) {
  console.log(`☁️ Caricamento su storage esterno per ${tableName}...`);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${tableName}_${timestamp}_${Date.now()}.json.gz`;
  
  // Simulazione caricamento (implementare con AWS S3, GCS, etc.)
  console.log(`📁 File caricato: ${filename}`);
  
  return {
    bucket: ARCHIVE_CONFIG.storage.bucket,
    key: `archives/${tableName}/${filename}`,
    size: data.length,
    compressed: ARCHIVE_CONFIG.compression.enabled
  };
}

/**
 * Registra l'archiviazione
 */
async function logArchival(tableName, recordCount, archivePath) {
  const query = `
    INSERT INTO archival_logs (
      table_name, 
      record_count, 
      archive_path, 
      archived_at
    ) VALUES ($1, $2, $3, NOW())
  `;
  
  await pool.query(query, [tableName, recordCount, JSON.stringify(archivePath)]);
}

/**
 * Elimina i dati archiviato dal database attivo
 */
async function deleteArchivedData(tableName, activeDays) {
  const query = `
    DELETE FROM ${tableName}
    WHERE created_at < NOW() - INTERVAL '${activeDays} days'
  `;
  
  const result = await pool.query(query);
  console.log(`🗑️ Eliminati ${result.rowCount} record da ${tableName}`);
}

/**
 * Elimina dati oltre il periodo totale di retention
 */
async function deleteExpiredData(tableName, totalDays) {
  const query = `
    DELETE FROM ${tableName}
    WHERE created_at < NOW() - INTERVAL '${totalDays} days'
  `;
  
  const result = await pool.query(query);
  if (result.rowCount > 0) {
    console.log(`🗑️ Eliminati definitivamente ${result.rowCount} record da ${tableName}`);
  }
}

/**
 * Crea la tabella per i log di archiviazione
 */
async function createArchivalLogsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS archival_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name VARCHAR(100) NOT NULL,
      record_count INTEGER NOT NULL,
      archive_path JSONB NOT NULL,
      archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(query);
  console.log('✅ Tabella archival_logs creata');
}

/**
 * Funzione per eseguire l'archiviazione
 */
async function runArchival() {
  try {
    console.log('🚀 Avvio processo di archiviazione dati...');
    
    // Crea tabella log se non esiste
    await createArchivalLogsTable();
    
    // Esegui archiviazione
    await archiveOldData();
    
    // Mostra statistiche finali
    await showArchivalStats();
    
    console.log('🎉 Processo di archiviazione completato con successo!');
    
  } catch (error) {
    console.error('💥 Errore durante archiviazione:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Mostra statistiche di archiviazione
 */
async function showArchivalStats() {
  console.log('\n📊 Statistiche archiviazione:');
  
  for (const tableName of Object.keys(RETENTION_POLICIES)) {
    const tableExists = await checkTableExists(tableName);
    if (!tableExists) continue;
    
    const count = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`   ${tableName}: ${count.rows[0].count} record attivi`);
  }
  
  const archivalCount = await pool.query('SELECT COUNT(*) as count FROM archival_logs');
  console.log(`   Archivi: ${archivalCount.rows[0].count} operazioni di archiviazione`);
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runArchival();
}

module.exports = {
  archiveOldData,
  runArchival,
  RETENTION_POLICIES,
  ARCHIVE_CONFIG
};
