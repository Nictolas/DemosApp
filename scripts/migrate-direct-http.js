'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per migrare dati da Neon a Axiom usando API HTTP diretta
// Bypassa problemi di regione SDK locale
const { Pool } = require('pg');
const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Verifica configurazione
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('username:password')) {
  console.error('❌ DATABASE_URL non configurato correttamente');
  process.exit(1);
}

if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
  console.error('❌ Configurazione Axiom mancante');
  process.exit(1);
}

// Inizializza database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configurazione Axiom HTTP API
const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_BASE_URL = AXIOM_REGION === 'eu' 
  ? 'https://api.eu.axiom.co' 
  : 'https://api.axiom.co';

// Funzione per inviare ad Axiom via HTTP
async function sendToAxiom(dataset, events) {
  const url = `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`;
  
  try {
    const response = await axios.post(url, events, {
      headers: {
        'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
      },
      timeout: 60000,
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

// Funzioni di conversione (copiate da migrate-local.js)
function convertTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  try {
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    if (typeof timestamp === 'number') {
      if (timestamp > 1000000000000) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) return date.toISOString();
      } else {
        const date = new Date(timestamp * 1000);
        if (!isNaN(date.getTime())) return date.toISOString();
      }
    }
    if (timestamp instanceof Date && !isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
    return new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

function decodeLogLevel(code) {
  const mapping = { 'E': 'ERROR', 'W': 'WARN', 'I': 'INFO', 'D': 'DEBUG', 'T': 'TRACE' };
  return mapping[code] || code;
}

function anonymizeData(data, anonymize = false, anonymizeUserId = false) {
  if (!anonymize) return data;
  const anonymized = { ...data };
  if (anonymized.ip_address && typeof anonymized.ip_address === 'string') {
    const parts = anonymized.ip_address.split('.');
    if (parts.length === 4) {
      anonymized.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
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
      const meta = typeof row.meta_data === 'string' ? JSON.parse(row.meta_data) : row.meta_data;
      Object.assign(logEntry, meta);
    } catch (e) {}
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
      const meta = typeof row.meta_data === 'string' ? JSON.parse(row.meta_data) : row.meta_data;
      Object.assign(logEntry, meta);
    } catch (e) {}
  }
  
  return anonymizeData(
    logEntry,
    process.env.AXIOM_ANONYMIZE === 'true',
    process.env.AXIOM_ANONYMIZE_USER_ID === 'true'
  );
}

// Migrazione centralized_logs
async function migrateCentralizedLogs() {
  console.log('📊 Migrazione centralized_logs...\n');
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  const countResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
  const totalRecords = parseInt(countResult.rows[0].count);
  console.log(`📈 Record totali: ${totalRecords.toLocaleString()}\n`);
  
  if (totalRecords === 0) {
    console.log('✅ Nessun record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  const batchSize = 1000;
  let migrated = 0;
  let batches = 0;
  let offset = 0;
  
  while (migrated < totalRecords) {
    const result = await pool.query(`
      SELECT id, timestamp, level, pid, hostname, message,
        user_id, ip_address, user_agent, endpoint,
        request_id, session_id, meta_data, created_at
      FROM centralized_logs
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertCentralizedLogToAxiom(row));
    await sendToAxiom(dataset, axiomLogs);
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < totalRecords) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Migrazione centralized_logs completata: ${migrated.toLocaleString()} record in ${batches} batch\n`);
  return { migrated, batches };
}

// Migrazione audit_logs
async function migrateAuditLogs() {
  console.log('📊 Migrazione audit_logs...\n');
  const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
  
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs_compressed'
    )
  `);
  
  const tableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
  const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const totalRecords = parseInt(countResult.rows[0].count);
  console.log(`📈 Record totali: ${totalRecords.toLocaleString()} (tabella: ${tableName})\n`);
  
  if (totalRecords === 0) {
    console.log('✅ Nessun record da migrare');
    return { migrated: 0, batches: 0 };
  }
  
  const batchSize = 1000;
  let migrated = 0;
  let batches = 0;
  let offset = 0;
  
  while (migrated < totalRecords) {
    const result = await pool.query(`
      SELECT * FROM ${tableName}
      ORDER BY created_at ASC
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);
    
    if (result.rows.length === 0) break;
    
    const axiomLogs = result.rows.map(row => convertAuditLogToAxiom(row));
    await sendToAxiom(dataset, axiomLogs);
    
    migrated += result.rows.length;
    offset += result.rows.length;
    batches++;
    
    console.log(`   ✅ Batch ${batches}: ${result.rows.length} record (totale: ${migrated.toLocaleString()}/${totalRecords.toLocaleString()})`);
    
    if (migrated < totalRecords) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Migrazione ${tableName} completata: ${migrated.toLocaleString()} record in ${batches} batch\n`);
  return { migrated, batches };
}

// Main
async function main() {
  const command = process.argv[2] || 'migrate';
  
  if (command === 'dry-run') {
    console.log('🧪 DRY RUN - Conta record...\n');
    const centralizedCount = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    const auditCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs_compressed'
      )
    `);
    const auditTable = auditCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
    const auditCount = await pool.query(`SELECT COUNT(*) as count FROM ${auditTable}`);
    
    console.log(`📊 centralized_logs: ${parseInt(centralizedCount.rows[0].count).toLocaleString()} record`);
    console.log(`📊 audit_logs: ${parseInt(auditCount.rows[0].count).toLocaleString()} record`);
    await pool.end();
    return;
  }
  
  console.log('🚀 Avvio migrazione Neon → Axiom (API HTTP diretta)\n');
  console.log(`🌍 Regione Axiom: ${AXIOM_REGION}`);
  console.log(`📍 API Base: ${AXIOM_BASE_URL}\n`);
  
  try {
    const results = {};
    results.centralized_logs = await migrateCentralizedLogs();
    results.audit_logs = await migrateAuditLogs();
    
    console.log('🎉 Migrazione completata!');
    console.log('\n📊 Riepilogo:');
    Object.entries(results).forEach(([table, result]) => {
      console.log(`   - ${table}: ${result.migrated.toLocaleString()} record in ${result.batches} batch`);
    });
    
  } catch (error) {
    console.error('\n❌ Errore durante la migrazione:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('💥 Errore:', error);
  process.exit(1);
});

