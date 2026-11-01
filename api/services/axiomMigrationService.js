// Servizio per migrare dati da Neon a Axiom
const { Pool } = require('pg');
const { assertLegacyAxiomMigrationUnavailable } = require('./legacyAxiomMigrationGate');
const path = require('path');
const axios = require('axios');

// Inizializza pool e axiom
let pool;
let axiom;

function initializeServices() {
  // Inizializza database pool se non esiste
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl || dbUrl.includes('username:password') || dbUrl.includes('your-')) {
      throw new Error('DATABASE_URL non configurato correttamente');
    }
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  
  // Inizializza Axiom client se non esiste
  if (!axiom && process.env.AXIOM_ENABLED === 'true') {
    try {
      const axiomModule = require('@axiomhq/axiom-node');
      
      if (process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
        const region = process.env.AXIOM_REGION || 'eu';
        console.log(`🌍 Configurazione Axiom - Regione: ${region}`);
        
        if (axiomModule.Client) {
          // Forza regione EU esplicitamente
          const clientConfig = {
            token: process.env.AXIOM_API_TOKEN,
            orgId: process.env.AXIOM_ORG_ID
          };
          
          // Se regione è EU, usa 'eu' esplicitamente
          if (region === 'eu' || region === 'EU') {
            clientConfig.region = 'eu';
          } else {
            clientConfig.region = region;
          }
          
          axiom = new axiomModule.Client(clientConfig);
          console.log(`✅ Axiom Client inizializzato con regione: ${clientConfig.region}`);
        } else {
          axiom = axiomModule;
          axiom.token = process.env.AXIOM_API_TOKEN;
          axiom.orgId = process.env.AXIOM_ORG_ID;
          axiom.region = region === 'eu' ? 'eu' : region;
        }
      }
    } catch (error) {
      console.error('❌ Axiom SDK non disponibile:', error.message);
    }
  }
  
  return { pool, axiom };
}

// Configurazione migrazione
const MIGRATION_CONFIG = {
  batchSize: 1000,
  delayBetweenBatches: 1000,
  maxRecords: null
};

/**
 * Converte timestamp BIGINT in ISO string (versione robusta)
 */
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

/**
 * Decodifica livello log
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

/**
 * Invia dati ad Axiom usando API HTTP diretta (rispetta la regione EU)
 */
async function sendToAxiomHTTP(dataset, events) {
  const axios = require('axios');
  
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  const edgeDomain = process.env.AXIOM_EDGE_DOMAIN 
    || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
  const url = `https://${edgeDomain}/v1/ingest/${dataset}`;
  
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  
  // Log per debug (senza esporre token completo)
  console.log(`📤 Invio a Axiom: ${url}`);
  console.log(`   Dataset: ${dataset}`);
  console.log(`   Eventi: ${events.length}`);
  console.log(`   Credenziale Axiom disponibile: ${Boolean(token)}`);
  console.log(`   Org ID: ${orgId || 'MISSING'}`);
  
  if (!token) {
    throw new Error('AXIOM_API_TOKEN non configurato');
  }
  
  if (!orgId) {
    throw new Error('AXIOM_ORG_ID non configurato');
  }
  
  try {
    const response = await axios.post(url, events, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': orgId
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log(`✅ Axiom risposta: ${response.status} - ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorDetails = error.response.data || {};
      const errorMsg = errorDetails.message || errorDetails.error || JSON.stringify(errorDetails);
      console.error(`❌ Axiom API error ${error.response.status}:`, errorMsg);
      console.error(`   URL: ${url}`);
      console.error(`   Response data:`, JSON.stringify(errorDetails, null, 2));
      throw new Error(`Axiom API error: ${error.response.status} - ${errorMsg}`);
    }
    console.error(`❌ Errore network:`, error.message);
    throw error;
  }
}

/**
 * Converte record centralized_logs in formato Axiom
 */
function convertCentralizedLogToAxiom(row) {
  // Gestisci timestamp con try-catch per evitare errori
  let timestamp;
  try {
    timestamp = convertTimestamp(row.timestamp || row.created_at);
  } catch (error) {
    console.warn(`⚠️ Errore conversione timestamp per record ${row.id}:`, error.message);
    timestamp = new Date().toISOString();
  }
  
  const logEntry = {
    _time: timestamp,
    level: decodeLogLevel(row.level),
    message: row.message || '',
    log_type: 'application',
    // NOTA: pid e hostname rimossi - non necessari per GDPR
    user_id: row.user_id || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    endpoint: row.endpoint || null,
    request_id: row.request_id || null,
    session_id: row.session_id || null
  };
  
  // NOTA: NON aggiungiamo tutti i campi da meta_data per evitare di inviare dati non necessari per GDPR
  // I campi essenziali sono già stati aggiunti sopra
  // Se necessario in futuro, aggiungi solo campi specifici da meta_data qui
  // if (row.meta_data) {
  //   try {
  //     const meta = typeof row.meta_data === 'string' 
  //       ? JSON.parse(row.meta_data) 
  //       : row.meta_data;
  //     // NON fare Object.assign(logEntry, meta) - aggiunge troppi campi non necessari (freed, afterGC, etc.)
  //   } catch (e) {
  //     // Ignora errori parsing
  //   }
  // }
  
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
  // Gestisci timestamp con try-catch per evitare errori
  let timestamp;
  try {
    timestamp = convertTimestamp(row.timestamp || row.created_at);
  } catch (error) {
    console.warn(`⚠️ Errore conversione timestamp per audit record ${row.id || 'unknown'}:`, error.message);
    timestamp = new Date().toISOString();
  }
  
  const logEntry = {
    _time: timestamp,
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
    resource_type: row.resource_type || null,
    resource_id: row.resource_id || null,
    details: row.details || null
  };
  
  // NOTA: NON aggiungiamo tutti i campi da meta_data per evitare di inviare dati non necessari per GDPR
  // I campi essenziali sono già stati aggiunti sopra
  // Se necessario in futuro, aggiungi solo campi specifici da meta_data qui
  // if (row.meta_data) {
  //   try {
  //     const meta = typeof row.meta_data === 'string' 
  //       ? JSON.parse(row.meta_data) 
  //       : row.meta_data;
  //     // NON fare Object.assign(logEntry, meta) - aggiunge troppi campi non necessari (freed, afterGC, etc.)
  //   } catch (e) {
  //     // Ignora errori parsing
  //   }
  // }
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

/**
 * Migra centralized_logs
 */
async function migrateCentralizedLogs() {
  assertLegacyAxiomMigrationUnavailable();
  const { pool, axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato');
  }
  
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  // Conta record totali
  const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
  const totalRecords = parseInt(countResult.rows[0].count);
  
  if (totalRecords === 0) {
    console.log('📊 centralized_logs: 0 record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  console.log(`📊 centralized_logs: ${totalRecords.toLocaleString()} record da migrare`);
  
  let migrated = 0;
  let offset = 0;
  let batches = 0;
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(MIGRATION_CONFIG.batchSize, maxRecords - migrated);
    
    const result = await pool.query(`
      SELECT * FROM centralized_logs
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `, [currentBatchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertCentralizedLogToAxiom(row));
    
    // Prova prima con SDK, poi fallback a HTTP
    try {
      if (axiom && typeof axiom.ingestEvents === 'function') {
        console.log(`   📤 Invio tramite SDK Axiom...`);
        await axiom.ingestEvents(dataset, axiomLogs);
        console.log(`   ✅ SDK: ${axiomLogs.length} eventi inviati`);
      } else {
        throw new Error('SDK non disponibile, uso HTTP');
      }
    } catch (sdkError) {
      console.log(`   ⚠️ SDK fallito: ${sdkError.message}, provo HTTP...`);
      // Fallback a HTTP
      await sendToAxiomHTTP(dataset, axiomLogs);
    }
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < maxRecords) {
      await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Migrazione centralized_logs completata: ${migrated.toLocaleString()} record in ${batches} batch`);
  
  return { migrated, batches };
}

/**
 * Migra audit_logs
 */
async function migrateAuditLogs() {
  assertLegacyAxiomMigrationUnavailable();
  const { pool, axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato');
  }
  
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
  
  if (totalRecords === 0) {
    console.log(`📊 ${tableName}: 0 record da migrare`);
    return { migrated: 0, batches: 0 };
  }
  
  console.log(`📊 ${tableName}: ${totalRecords.toLocaleString()} record da migrare`);
  
  let migrated = 0;
  let offset = 0;
  let batches = 0;
  const maxRecords = MIGRATION_CONFIG.maxRecords || totalRecords;
  
  while (migrated < maxRecords) {
    const currentBatchSize = Math.min(MIGRATION_CONFIG.batchSize, maxRecords - migrated);
    
    let query;
    if (tableName === 'audit_logs_compressed') {
      // Se è la tabella compressa, potrebbe avere una struttura diversa
      query = `
        SELECT * FROM ${tableName}
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
      `;
    } else {
      query = `
        SELECT * FROM ${tableName}
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
      `;
    }
    
    const result = await pool.query(query, [currentBatchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertAuditLogToAxiom(row));
    
    // Prova prima con SDK, poi fallback a HTTP
    try {
      if (axiom && typeof axiom.ingestEvents === 'function') {
        console.log(`   📤 Invio tramite SDK Axiom...`);
        await axiom.ingestEvents(dataset, axiomLogs);
        console.log(`   ✅ SDK: ${axiomLogs.length} eventi inviati`);
      } else {
        throw new Error('SDK non disponibile, uso HTTP');
      }
    } catch (sdkError) {
      console.log(`   ⚠️ SDK fallito: ${sdkError.message}, provo HTTP...`);
      // Fallback a HTTP
      await sendToAxiomHTTP(dataset, axiomLogs);
    }
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record inviati (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < maxRecords) {
      await new Promise(resolve => setTimeout(resolve, MIGRATION_CONFIG.delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Migrazione ${tableName} completata: ${migrated.toLocaleString()} record in ${batches} batch`);
  
  return { migrated, batches };
}

/**
 * Funzione principale di migrazione
 */
async function migrateNeonToAxiom(options = {}) {
  assertLegacyAxiomMigrationUnavailable();
  const { tables = ['centralized_logs', 'audit_logs'], dryRun = false } = options;
  
  const { axiom } = initializeServices();
  
  if (!axiom) {
    throw new Error('Axiom non configurato. Verifica AXIOM_ENABLED, AXIOM_API_TOKEN e AXIOM_ORG_ID');
  }
  
  console.log('🚀 Avvio migrazione dati da Neon a Axiom...\n');
  console.log(`📋 Dataset di destinazione:`);
  console.log(`   - centralized_logs → ${process.env.AXIOM_DATASET || 'centralized_logs'}`);
  console.log(`   - audit_logs → ${process.env.AXIOM_REALTIME_DATASET || 'real-time'}\n`);
  
  if (dryRun) {
    console.log('🧪 MODALITÀ DRY RUN - Nessun dato verrà inviato\n');
    
    const { pool } = initializeServices();
    
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
    
    return { dryRun: true, tables };
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
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error);
    throw error;
  }
}

module.exports = {
  migrateNeonToAxiom,
  migrateCentralizedLogs,
  migrateAuditLogs
};

