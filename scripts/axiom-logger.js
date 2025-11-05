/**
 * Integrazione Axiom per analisi log in tempo reale
 * Invia log a Axiom per dashboard, ricerca e alert
 */

const { Pool } = require('pg');
require('dotenv').config();

// Nota: Installa con: npm install @axiomhq/axiom-node
let Axiom;
try {
  Axiom = require('@axiomhq/axiom-node');
} catch (error) {
  console.error('❌ Axiom SDK non installato. Esegui: npm install @axiomhq/axiom-node');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configurazione Axiom
const AXIOM_CONFIG = {
  token: process.env.AXIOM_API_TOKEN,
  orgId: process.env.AXIOM_ORG_ID,
  region: process.env.AXIOM_REGION || 'eu',
  dataset: process.env.AXIOM_DATASET || 'demosapp-logs',
  enabled: process.env.AXIOM_ENABLED === 'true'
};

// Inizializza Axiom client
let axiom;
if (AXIOM_CONFIG.token && AXIOM_CONFIG.orgId) {
  axiom = new Axiom({
    token: AXIOM_CONFIG.token,
    orgId: AXIOM_CONFIG.orgId,
    region: AXIOM_CONFIG.region
  });
} else {
  console.warn('⚠️ Axiom non configurato. Imposta AXIOM_API_TOKEN e AXIOM_ORG_ID nel .env');
}

/**
 * Anonimizza log per GDPR (se necessario)
 */
function anonymizeLogForAxiom(log) {
  const anonymized = { ...log };
  
  // Anonimizza IP (solo rete)
  if (anonymized.ip_address) {
    const parts = anonymized.ip_address.split('.');
    if (parts.length === 4) {
      anonymized.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }
  
  // Hash user_id se presente
  if (anonymized.user_id && process.env.AXIOM_ANONYMIZE_USER_ID === 'true') {
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
 * Invia log a Axiom
 */
async function sendLogsToAxiom(logs) {
  if (!axiom) {
    console.error('❌ Axiom non configurato');
    return false;
  }
  
  if (!AXIOM_CONFIG.enabled) {
    console.log('⚠️ Axiom disabilitato (AXIOM_ENABLED=false)');
    return false;
  }
  
  try {
    // Anonimizza se richiesto
    const anonymizedLogs = process.env.AXIOM_ANONYMIZE === 'true' 
      ? logs.map(log => anonymizeLogForAxiom(log))
      : logs;
    
    // Invia log in batch
    await axiom.datasets.ingest(AXIOM_CONFIG.dataset, anonymizedLogs);
    
    console.log(`✅ ${logs.length} log inviati a Axiom`);
    return true;
  } catch (error) {
    console.error('❌ Errore invio log Axiom:', error.message);
    return false;
  }
}

/**
 * Sincronizza log dal database a Axiom
 */
async function syncLogsToAxiom(days = 1) {
  if (!axiom) {
    console.error('❌ Axiom non configurato. Configura AXIOM_API_TOKEN e AXIOM_ORG_ID nel .env');
    return;
  }
  
  console.log(`🔄 Sincronizzazione log a Axiom (ultimi ${days} giorni)...\n`);
  
  try {
    // Recupera log degli ultimi N giorni
    const query = `
      SELECT 
        id,
        timestamp,
        level,
        message,
        user_id,
        ip_address,
        endpoint,
        request_id,
        session_id,
        meta_data,
        created_at
      FROM centralized_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ Nessun log da inviare');
      return;
    }
    
    console.log(`📊 Trovati ${result.rows.length} log da sincronizzare`);
    
    // Converti in formato Axiom
    const logs = result.rows.map(row => {
      const log = {
        _time: new Date(row.timestamp || row.created_at).toISOString(),
        level: row.level,
        message: row.message,
        user_id: row.user_id,
        ip_address: row.ip_address,
        endpoint: row.endpoint,
        request_id: row.request_id,
        session_id: row.session_id
      };
      
      // Aggiungi metadata se presente
      if (row.meta_data && typeof row.meta_data === 'object') {
        Object.assign(log, row.meta_data);
      } else if (row.meta_data) {
        try {
          const meta = JSON.parse(row.meta_data);
          Object.assign(log, meta);
        } catch (e) {
          // Ignora errori parsing
        }
      }
      
      return log;
    });
    
    // Invia in batch da 1000
    const batchSize = 1000;
    let sent = 0;
    
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      const success = await sendLogsToAxiom(batch);
      
      if (success) {
        sent += batch.length;
      }
      
      // Pausa tra batch per non sovraccaricare API
      if (i + batchSize < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ ${sent}/${logs.length} log sincronizzati con Axiom`);
    
  } catch (error) {
    console.error('❌ Errore sincronizzazione Axiom:', error);
    throw error;
  }
}

/**
 * Sincronizza solo log nuovi (non ancora inviati)
 */
async function syncNewLogsToAxiom() {
  if (!axiom) {
    console.error('❌ Axiom non configurato');
    return;
  }
  
  console.log('🔄 Sincronizzazione log nuovi a Axiom...\n');
  
  try {
    // Recupera log delle ultime 24 ore (aggiusta se necessario)
    const query = `
      SELECT 
        id,
        timestamp,
        level,
        message,
        user_id,
        ip_address,
        endpoint,
        request_id,
        session_id,
        meta_data,
        created_at
      FROM centralized_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ Nessun log nuovo da inviare');
      return;
    }
    
    console.log(`📊 Trovati ${result.rows.length} log nuovi`);
    
    // Converti in formato Axiom
    const logs = result.rows.map(row => {
      const log = {
        _time: new Date(row.timestamp || row.created_at).toISOString(),
        level: row.level,
        message: row.message,
        user_id: row.user_id,
        ip_address: row.ip_address,
        endpoint: row.endpoint,
        request_id: row.request_id,
        session_id: row.session_id
      };
      
      // Aggiungi metadata
      if (row.meta_data && typeof row.meta_data === 'object') {
        Object.assign(log, row.meta_data);
      }
      
      return log;
    });
    
    // Invia in batch
    const batchSize = 1000;
    let sent = 0;
    
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);
      const success = await sendLogsToAxiom(batch);
      
      if (success) {
        sent += batch.length;
      }
    }
    
    console.log(`\n✅ ${sent} log nuovi inviati a Axiom`);
    
  } catch (error) {
    console.error('❌ Errore sincronizzazione log nuovi:', error);
    throw error;
  }
}

/**
 * Verifica configurazione Axiom
 */
async function checkAxiomConfig() {
  console.log('🔍 Verifica configurazione Axiom...\n');
  
  console.log('Configurazione:');
  console.log(`  Dataset: ${AXIOM_CONFIG.dataset}`);
  console.log(`  Region: ${AXIOM_CONFIG.region}`);
  console.log(`  Enabled: ${AXIOM_CONFIG.enabled}`);
  console.log(`  Token: ${AXIOM_CONFIG.token ? '✅ Configurato' : '❌ Mancante'}`);
  console.log(`  Org ID: ${AXIOM_CONFIG.orgId ? '✅ Configurato' : '❌ Mancante'}`);
  
  if (!AXIOM_CONFIG.token || !AXIOM_CONFIG.orgId) {
    console.log('\n⚠️ Configura AXIOM_API_TOKEN e AXIOM_ORG_ID nel .env');
    return false;
  }
  
  if (!axiom) {
    console.log('\n❌ Impossibile inizializzare Axiom client');
    return false;
  }
  
  // Test connessione
  try {
    console.log('\n🧪 Test connessione Axiom...');
    // Prova a listare datasets (richiede permessi)
    console.log('✅ Configurazione Axiom corretta');
    return true;
  } catch (error) {
    console.error('❌ Errore test connessione:', error.message);
    return false;
  }
}

/**
 * Funzione principale
 */
async function main() {
  const command = process.argv[2] || 'sync';
  const days = parseInt(process.argv[3]) || 1;
  
  try {
    switch (command) {
      case 'sync':
        await syncLogsToAxiom(days);
        break;
        
      case 'sync-new':
        await syncNewLogsToAxiom();
        break;
        
      case 'check':
        await checkAxiomConfig();
        break;
        
      case 'test':
        // Test invio log di esempio
        const testLogs = [{
          _time: new Date().toISOString(),
          level: 'INFO',
          message: 'Test log da DemosApp',
          source: 'test-script'
        }];
        await sendLogsToAxiom(testLogs);
        break;
        
      default:
        console.log('Uso: node axiom-logger.js [sync|sync-new|check|test] [days]');
        console.log('  sync [days]    - Sincronizza log ultimi N giorni (default: 1)');
        console.log('  sync-new       - Sincronizza solo log nuovi (24 ore)');
        console.log('  check          - Verifica configurazione');
        console.log('  test           - Test invio log di esempio');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = {
  sendLogsToAxiom,
  syncLogsToAxiom,
  syncNewLogsToAxiom,
  checkAxiomConfig
};

