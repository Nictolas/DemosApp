'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per migrare dati da Neon a Axiom - Eseguibile localmente
// Non richiede accesso a Render Shell - si connette direttamente a Neon e Axiom
// Uso: node scripts/migrate-local.js [dry-run|migrate] [--tables=centralized_logs,audit_logs]

const { Pool } = require('pg');
const path = require('path');

// Carica .env dalla root del progetto
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Permetti di passare DATABASE_URL come variabile d'ambiente o come argomento
const dbUrlArg = process.argv.find(arg => arg.startsWith('--database-url='));
if (dbUrlArg) {
  process.env.DATABASE_URL = dbUrlArg.split('=')[1];
}

// Verifica configurazione
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('username:password') || process.env.DATABASE_URL.includes('your-')) {
  console.error('❌ DATABASE_URL non configurato correttamente nel file .env');
  console.error('💡 Ottieni il DATABASE_URL da Neon Console:');
  console.error('   1. Vai su https://console.neon.tech');
  console.error('   2. Seleziona il tuo progetto');
  console.error('   3. Vai su "Connection Details"');
  console.error('   4. Copia la connection string');
  console.error('   5. Aggiungila al file .env come: DATABASE_URL=postgresql://...');
  console.error('\n💡 Oppure passa DATABASE_URL come variabile d\'ambiente:');
  console.error('   $env:DATABASE_URL="postgresql://..." ; node scripts/migrate-local.js dry-run');
  process.exit(1);
}

// Inizializza Axiom Client
let axiom;
try {
  const axiomModule = require('@axiomhq/axiom-node');
  if (axiomModule.Client) {
    const axiomConfig = {
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID
    };
    // Forza regione EU se configurata
    if (process.env.AXIOM_REGION) {
      // Axiom SDK usa 'eu' per Europa, ma potrebbe essere necessario 'cloud.eu-central-1.aws'
      // Prova prima con 'eu', se non funziona useremo il formato completo
      axiomConfig.region = process.env.AXIOM_REGION === 'eu' ? 'eu' : process.env.AXIOM_REGION;
    } else {
      // Default: EU
      axiomConfig.region = 'eu';
    }
    console.log(`🌍 Configurazione Axiom - Regione: ${axiomConfig.region}`);
    axiom = new axiomModule.Client(axiomConfig);
  } else {
    throw new Error('Axiom SDK non supporta Client');
  }
} catch (error) {
  console.error('❌ Errore inizializzazione Axiom:', error.message);
  process.exit(1);
}

// Inizializza database pool
let pool;
try {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('username:password') || dbUrl.includes('your-')) {
    console.error('❌ DATABASE_URL non configurato correttamente');
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
  batchSize: 1000,
  delayBetweenBatches: 1000,
  maxRecords: null
};

// Funzioni di conversione (copiate da migrate-neon-to-axiom.js)
function convertTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  
  try {
    // Se è già una stringa ISO, usala direttamente
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Se è un numero (millisecondi o secondi)
    if (typeof timestamp === 'number') {
      // Se è in millisecondi (> 1e12 è circa 2001)
      if (timestamp > 1000000000000) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } else {
        // Se è in secondi
        const date = new Date(timestamp * 1000);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Se è un oggetto Date
    if (timestamp instanceof Date) {
      if (!isNaN(timestamp.getTime())) {
        return timestamp.toISOString();
      }
    }
    
    // Fallback: usa la data corrente
    return new Date().toISOString();
  } catch (error) {
    // In caso di errore, usa la data corrente
    return new Date().toISOString();
  }
}

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

// Funzione per inviare dati ad Axiom usando API HTTP diretta
async function sendToAxiomHTTP(dataset, events) {
  const axios = require('axios');
  
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  const edgeDomain = process.env.AXIOM_EDGE_DOMAIN 
    || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
  const url = `https://${edgeDomain}/v1/ingest/${dataset}`;
  
  try {
    const response = await axios.post(url, events, {
      headers: {
        'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorMsg = error.response.data?.message || JSON.stringify(error.response.data);
      throw new Error(`Axiom API error: ${error.response.status} - ${errorMsg}`);
    }
    throw error;
  }
}

function anonymizeData(data, anonymize = false, anonymizeUserId = false) {
  if (!anonymize) return data;
  
  const anonymized = { ...data };
  
  if (anonymized.ip_address) {
    if (typeof anonymized.ip_address === 'string') {
      const parts = anonymized.ip_address.split('.');
      if (parts.length === 4) {
        anonymized.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }
  }
  
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
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

function convertAuditLogToAxiom(row) {
  const logEntry = {
    _time: convertTimestamp(row.timestamp || row.created_at),
    level: 'INFO',
    message: row.action || row.message || '',
    log_type: 'audit',
    action: row.action || null,
    user_id: row.user_id || null,
    user_email: row.user_email || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    endpoint: row.endpoint || null,
    request_id: row.request_id || null,
    resource_type: row.resource || null,
    resource_id: row.resource_id || null,
    details: row.details || null
  };
  
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
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

// Funzione per migrare centralized_logs
async function migrateCentralizedLogs() {
  console.log('📊 Migrazione centralized_logs da Neon a Axiom...\n');
  
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  // Conta record totali
  const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
  const totalRecords = parseInt(countResult.rows[0].count);
  
  console.log(`📈 Record totali da migrare: ${totalRecords.toLocaleString()}\n`);
  
  if (totalRecords === 0) {
    console.log('✅ Nessun record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  const limit = Math.min(MIGRATION_CONFIG.batchSize, maxRecords);
  
  let migrated = 0;
  let batches = 0;
  let offset = 0;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(limit, maxRecords - migrated);
    
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
    
    // Invia ad Axiom usando API HTTP diretta (per evitare problemi di regione)
    await sendToAxiomHTTP(dataset, axiomLogs);
    
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
}

// Funzione per migrare audit_logs
async function migrateAuditLogs() {
  console.log('📊 Migrazione audit_logs da Neon a Axiom...\n');
  
  const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
  
  // Verifica quale tabella usare
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs_compressed'
    )
  `);
  
  const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
  
  // Conta record totali
  const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const totalRecords = parseInt(countResult.rows[0].count);
  
  console.log(`📈 Record totali da migrare: ${totalRecords.toLocaleString()} (tabella: ${tableName})\n`);
  
  if (totalRecords === 0) {
    console.log('✅ Nessun record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  const limit = Math.min(MIGRATION_CONFIG.batchSize, maxRecords);
  
  let migrated = 0;
  let batches = 0;
  let offset = 0;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(limit, maxRecords - migrated);
    
    const query = `
      SELECT * FROM ${tableName}
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [currentBatchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    // Converti in formato Axiom
    const axiomLogs = result.rows.map(row => convertAuditLogToAxiom(row));
    
    // Invia ad Axiom usando API HTTP diretta (per evitare problemi di regione)
    await sendToAxiomHTTP(dataset, axiomLogs);
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    // Pausa tra batch
    if (migrated < maxRecords) {
      await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Migrazione ${tableName} completata: ${migrated.toLocaleString()} record in ${batches} batch`);
  
  return { migrated, batches };
}

// Funzione principale
async function migrateNeonToAxiom(options = {}) {
  const { tables = ['centralized_logs', 'audit_logs'], dryRun = false } = options;
  
  console.log('🚀 Avvio migrazione dati da Neon a Axiom...\n');
  console.log(`📋 Dataset di destinazione:`);
  console.log(`   - centralized_logs → ${process.env.AXIOM_DATASET || 'centralized_logs'}`);
  console.log(`   - audit_logs → ${process.env.AXIOM_REALTIME_DATASET || 'real-time'}\n`);
  
  if (dryRun) {
    console.log('🧪 MODALITÀ DRY RUN - Nessun dato verrà inviato\n');
    
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

// Esegui migrazione
async function runMigration() {
  try {
    const command = process.argv[2] || 'dry-run';
    const options = {};
    
    switch (command) {
      case 'migrate':
        options.dryRun = false;
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
        console.log('Uso: node scripts/migrate-local.js [migrate|dry-run] [opzioni]');
        console.log('  migrate          - Migra dati da Neon a Axiom');
        console.log('  dry-run          - Simula migrazione senza inviare dati');
        console.log('\nOpzioni:');
        console.log('  --tables=...           - Lista tabelle da migrare (separate da virgola)');
        console.log('  --database-url=...     - Connection string Neon (opzionale, altrimenti usa .env)');
        console.log('\nTabelle disponibili:');
        console.log('  - centralized_logs');
        console.log('  - audit_logs');
        console.log('\nEsempi:');
        console.log('  node scripts/migrate-local.js dry-run');
        console.log('  node scripts/migrate-local.js migrate');
        console.log('  node scripts/migrate-local.js migrate --database-url="postgresql://..."');
    }
    
  } catch (error) {
    console.error('💥 Errore:', error);
    process.exit(1);
  }
}

runMigration();

