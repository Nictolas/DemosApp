'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per migrare dati storici da Neon a Axiom
const { Pool } = require('pg');
const path = require('path');

// Carica .env dalla root del progetto PRIMA di qualsiasi altra cosa
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Verifica che DATABASE_URL sia presente
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non configurato nel file .env');
  console.error('💡 Assicurati che il file .env esista nella root del progetto');
  process.exit(1);
}

// Axiom SDK
let axiom;
try {
  const axiomModule = require('@axiomhq/axiom-node');
  
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    // Usa Client se disponibile, altrimenti usa direttamente il modulo
    if (axiomModule.Client) {
      axiom = new axiomModule.Client({
        token: process.env.AXIOM_API_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        region: process.env.AXIOM_REGION || 'eu'
      });
    } else {
      // Fallback: usa direttamente il modulo (metodo deprecato)
      axiom = axiomModule;
      axiom.token = process.env.AXIOM_API_TOKEN;
      axiom.orgId = process.env.AXIOM_ORG_ID;
      axiom.region = process.env.AXIOM_REGION || 'eu';
    }
  }
} catch (error) {
  console.error('❌ Axiom SDK non installato:', error.message);
  process.exit(1);
}

// Configurazione database
let pool;
try {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl || dbUrl.includes('username:password') || dbUrl.includes('your-')) {
    console.error('❌ DATABASE_URL non configurato correttamente nel file .env');
    console.error('💡 Il valore attuale sembra essere un placeholder');
    console.error('💡 Aggiorna DATABASE_URL nel file .env con la connection string reale di Neon');
    process.exit(1);
  }
  
  pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} catch (error) {
  console.error('❌ Errore configurazione database:', error.message);
  process.exit(1);
}

// Configurazione migrazione
const MIGRATION_CONFIG = {
  batchSize: 1000, // Record per batch
  delayBetweenBatches: 1000, // Pausa tra batch (ms) per evitare rate limiting
  maxRecords: null // null = tutti, oppure numero massimo
};

/**
 * Converte timestamp BIGINT in ISO string
 */
function convertTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  // Se è già un timestamp in millisecondi
  if (timestamp > 1000000000000) {
    return new Date(timestamp).toISOString();
  }
  // Se è in secondi, converti
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Decodifica livello log (E → ERROR, W → WARN, etc.)
 */
function decodeLogLevel(code) {
  const mapping = {
    'E': 'ERROR',
    'W': 'WARN',
    'I': 'INFO',
    'D': 'DEBUG',
    'T': 'TRACE'
  };
  return mapping[code] || code;
}

/**
 * Anonimizza dati se richiesto (GDPR)
 */
function anonymizeData(data, anonymize = false, anonymizeUserId = false) {
  if (!anonymize) return data;
  
  const anonymized = { ...data };
  
  // Anonimizza IP (solo rete)
  if (anonymized.ip_address) {
    if (typeof anonymized.ip_address === 'string') {
      const parts = anonymized.ip_address.split('.');
      if (parts.length === 4) {
        anonymized.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }
  }
  
  // Hash user_id se richiesto
  if (anonymized.user_id && anonymizeUserId) {
    const crypto = require('crypto');
    anonymized.user_id = crypto
      .createHash('sha256')
      .update(anonymized.user_id + (process.env.EXPORT_HASH_SALT || 'axiom-salt'))
      .digest('hex')
      .substring(0, 16);
  }
  
  return anonymized;
}

/**
 * Converte record centralized_logs in formato Axiom
 */
function convertCentralizedLogToAxiom(row) {
  const logEntry = {
    _time: convertTimestamp(row.timestamp || row.created_at),
    level: decodeLogLevel(row.level),
    message: row.message || '',
    log_type: 'application',
    pid: row.pid || null,
    hostname: row.hostname || null,
    user_id: row.user_id || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    endpoint: row.endpoint || null,
    request_id: row.request_id || null,
    session_id: row.session_id || null
  };
  
  // Aggiungi meta_data se presente
  if (row.meta_data) {
    try {
      const meta = typeof row.meta_data === 'string' 
        ? JSON.parse(row.meta_data) 
        : row.meta_data;
      Object.assign(logEntry, meta);
    } catch (e) {
      // Ignora errori parsing
    }
  }
  
  // Anonimizza se richiesto
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

/**
 * Converte record audit_logs in formato Axiom
 */
function convertAuditLogToAxiom(row) {
  const logEntry = {
    _time: convertTimestamp(row.timestamp || row.created_at),
    log_type: 'audit',
    type: 'audit',
    user_id: row.user_id || null,
    action: row.action || null,
    resource: row.resource || null,
    resource_id: row.resource_id || null,
    success: row.success !== undefined ? row.success : true,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    error_message: row.error_message || null
  };
  
  // Aggiungi details se presente
  if (row.details) {
    try {
      const details = typeof row.details === 'string' 
        ? JSON.parse(row.details) 
        : row.details;
      Object.assign(logEntry, details);
    } catch (e) {
      logEntry.details = row.details;
    }
  }
  
  // Anonimizza se richiesto
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

/**
 * Migra centralized_logs da Neon a Axiom
 */
async function migrateCentralizedLogs() {
  console.log('📊 Migrazione centralized_logs da Neon a Axiom...\n');
  
  try {
    // Conta record totali
    const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    const totalRecords = parseInt(countResult.rows[0].count);
    
    console.log(`📈 Record totali da migrare: ${totalRecords.toLocaleString()}\n`);
    
    if (totalRecords === 0) {
      console.log('✅ Nessun record da migrare');
      return { migrated: 0, batches: 0 };
    }
    
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
    const limit = Math.min(MIGRATION_CONFIG.batchSize, maxRecords);
    
    let migrated = 0;
    let batches = 0;
    let offset = 0;
    
    while (migrated < maxRecords) {
      const currentBatchSize = Math.min(limit, maxRecords - migrated);
      
      // Query batch
      const query = `
        SELECT 
          id, timestamp, level, pid, hostname, message,
          user_id, ip_address, user_agent, endpoint,
          request_id, session_id, meta_data, created_at
        FROM centralized_logs
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
      `;
      
      const result = await pool.query(query, [currentBatchSize, offset]);
      
      if (result.rows.length === 0) break;
      
      // Converti in formato Axiom
      const axiomLogs = result.rows.map(row => convertCentralizedLogToAxiom(row));
      
      // Invia ad Axiom
      await axiom.ingestEvents(dataset, axiomLogs);
      
      migrated += result.rows.length;
      offset += result.rows.length;
      batches++;
      
      console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
      
      // Pausa tra batch
      if (migrated < maxRecords) {
        await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
      }
    }
    
    console.log(`\n✅ Migrazione centralized_logs completata: ${migrated.toLocaleString()} record in ${batches} batch`);
    
    return { migrated, batches };
    
  } catch (error) {
    console.error('❌ Errore migrazione centralized_logs:', error);
    throw error;
  }
}

/**
 * Migra audit_logs da Neon a Axiom
 */
async function migrateAuditLogs() {
  console.log('\n📊 Migrazione audit_logs da Neon a Axiom...\n');
  
  try {
    // Verifica quale tabella usare (potrebbe essere audit_logs_compressed)
    let tableName = 'audit_logs';
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs_compressed'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      // Usa la vista decompressa se disponibile
      const viewCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.views 
          WHERE table_schema = 'public' 
          AND table_name = 'audit_logs_decompressed'
        )
      `);
      
      if (viewCheck.rows[0].exists) {
        tableName = 'audit_logs_decompressed';
        console.log('   ℹ️ Usando vista audit_logs_decompressed\n');
      } else {
        tableName = 'audit_logs_compressed';
        console.log('   ⚠️ Tabella compressa trovata, potrebbe essere necessario decompressione\n');
      }
    }
    
    // Conta record totali
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    
    console.log(`📈 Record totali da migrare: ${totalRecords.toLocaleString()}\n`);
    
    if (totalRecords === 0) {
      console.log('✅ Nessun record da migrare');
      return { migrated: 0, batches: 0 };
    }
    
    const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
    const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
    const limit = Math.min(MIGRATION_CONFIG.batchSize, maxRecords);
    
    let migrated = 0;
    let batches = 0;
    let offset = 0;
    
    while (migrated < maxRecords) {
      const currentBatchSize = Math.min(limit, maxRecords - migrated);
      
      // Query batch
      let query;
      if (tableName === 'audit_logs_decompressed') {
        query = `
          SELECT 
            id, user_id, action, resource, resource_id, details,
            ip_address, user_agent, timestamp, success, error_message, created_at
          FROM audit_logs_decompressed
          ORDER BY created_at ASC
          LIMIT $1 OFFSET $2
        `;
      } else {
        query = `
          SELECT 
            id, user_id, action, resource, resource_id, details,
            ip_address, user_agent, timestamp, success, error_message, created_at
          FROM ${tableName}
          ORDER BY created_at ASC
          LIMIT $1 OFFSET $2
        `;
      }
      
      const result = await pool.query(query, [currentBatchSize, offset]);
      
      if (result.rows.length === 0) break;
      
      // Converti in formato Axiom
      const axiomLogs = result.rows.map(row => convertAuditLogToAxiom(row));
      
      // Invia ad Axiom
      await axiom.ingestEvents(dataset, axiomLogs);
      
      migrated += result.rows.length;
      offset += result.rows.length;
      batches++;
      
      console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
      
      // Pausa tra batch
      if (migrated < maxRecords) {
        await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
      }
    }
    
    console.log(`\n✅ Migrazione audit_logs completata: ${migrated.toLocaleString()} record in ${batches} batch`);
    
    return { migrated, batches };
    
  } catch (error) {
    console.error('❌ Errore migrazione audit_logs:', error);
    throw error;
  }
}

/**
 * Funzione principale
 */
async function migrateNeonToAxiom(options = {}) {
  const {
    tables = ['centralized_logs', 'audit_logs'],
    dryRun = false
  } = options;
  
  if (!axiom) {
    console.error('❌ Axiom non configurato. Verifica AXIOM_ENABLED, AXIOM_API_TOKEN e AXIOM_ORG_ID');
    process.exit(1);
  }
  
  console.log('🚀 Avvio migrazione dati da Neon a Axiom...\n');
  console.log(`📋 Dataset di destinazione:`);
  console.log(`   - centralized_logs → ${process.env.AXIOM_DATASET || 'centralized_logs'}`);
  console.log(`   - audit_logs → ${process.env.AXIOM_REALTIME_DATASET || 'real-time'}\n`);
  
  if (dryRun) {
    console.log('🧪 MODALITÀ DRY RUN - Nessun dato verrà inviato\n');
    
    // Solo conteggi
    for (const table of tables) {
      if (table === 'centralized_logs') {
        const count = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
        console.log(`📊 ${table}: ${parseInt(count.rows[0].count).toLocaleString()} record`);
      } else if (table === 'audit_logs') {
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'audit_logs_compressed'
          )
        `);
        const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
        const count = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`📊 ${table}: ${parseInt(count.rows[0].count).toLocaleString()} record`);
      }
    }
    
    return;
  }
  
  const results = {};
  
  try {
    if (tables.includes('centralized_logs')) {
      results.centralized_logs = await migrateCentralizedLogs();
    }
    
    if (tables.includes('audit_logs')) {
      results.audit_logs = await migrateAuditLogs();
    }
    
    console.log('\n🎉 Migrazione completata!');
    console.log('\n📊 Riepilogo:');
    Object.entries(results).forEach(([table, result]) => {
      console.log(`   - ${table}: ${result.migrated.toLocaleString()} record in ${result.batches} batch`);
    });
    
    console.log('\n💡 Verifica su Axiom:');
    console.log(`   - Dataset "${process.env.AXIOM_DATASET || 'centralized_logs'}": https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets/${process.env.AXIOM_DATASET || 'centralized_logs'}`);
    console.log(`   - Dataset "${process.env.AXIOM_REALTIME_DATASET || 'real-time'}": https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets/${process.env.AXIOM_REALTIME_DATASET || 'real-time'}`);
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Esegui migrazione
 */
async function runMigration() {
  try {
    const command = process.argv[2];
    const options = {};
    
    switch (command) {
      case 'migrate':
        options.dryRun = process.argv.includes('--dry-run');
        const tables = process.argv.includes('--tables') 
          ? process.argv[process.argv.indexOf('--tables') + 1].split(',')
          : ['centralized_logs', 'audit_logs'];
        options.tables = tables;
        await migrateNeonToAxiom(options);
        break;
        
      case 'dry-run':
        await migrateNeonToAxiom({ dryRun: true });
        break;
        
      default:
        console.log('Uso: node scripts/migrate-neon-to-axiom.js [migrate|dry-run] [--dry-run] [--tables=table1,table2]');
        console.log('  migrate          - Migra dati da Neon a Axiom');
        console.log('  dry-run          - Simula migrazione senza inviare dati');
        console.log('  --dry-run        - Modalità test (solo conteggi)');
        console.log('  --tables=...     - Lista tabelle da migrare (separate da virgola)');
        console.log('\nTabelle disponibili:');
        console.log('  - centralized_logs');
        console.log('  - audit_logs');
    }
    
  } catch (error) {
    console.error('💥 Errore:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runMigration();
}

module.exports = {
  migrateNeonToAxiom,
  migrateCentralizedLogs,
  migrateAuditLogs
};

