/**
 * Script per pulire il dataset real-time su Axiom e ricrearlo con solo campi GDPR-obbligatori
 * 
 * Questo script:
 * 1. Estrae tutti i record dal dataset real-time
 * 2. Filtra solo audit e security logs (esclude performance metrics)
 * 3. Pulisce i campi non GDPR-obbligatori
 * 4. Cancella il dataset originale
 * 5. Ricrea il dataset
 * 6. Re-ingesta i record puliti
 */

require('dotenv').config();
const axios = require('axios');
const { Axiom } = require('@axiomhq/axiom-node');

// Configurazione
const AXIOM_API_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_ORG_ID = process.env.AXIOM_ORG_ID;
const AXIOM_REGION = (process.env.AXIOM_REGION || 'eu').toLowerCase();
const DATASET_NAME = process.env.AXIOM_REALTIME_DATASET || 'real-time';

// Campi GDPR-obbligatori per audit logs
const GDPR_AUDIT_FIELDS = [
  '_time',
  'user_id',
  'ip_address',
  'action',
  'resource',
  'resource_id',
  'success',
  'error_message',
  'session_id'
];

// Campi GDPR-obbligatori per security events
const GDPR_SECURITY_FIELDS = [
  '_time',
  'user_id',
  'ip_address',
  'type',
  'severity',
  'details',
  'session_id'
];

// Campi da rimuovere (non GDPR-obbligatori)
const FIELDS_TO_REMOVE = [
  'log_type',
  'type', // Duplicato per audit (mantenuto per security)
  'user_agent',
  'user_email',
  'details.method',
  'details.path',
  'details.endpoint',
  'details.query_params',
  'details.body_fields',
  'details.auth_method',
  'details.consent_type',
  'details.field',
  'details.operation',
  'details.request_type',
  'details.timestamp',
  'details.user_id',
  'details.success',
  'details.reason',
  'body_fields',
  'method',
  'path',
  'operation',
  'query_params',
  'level',
  'message',
  'timestamp',
  'resource',
  'resource_type',
  'resource_id',
  'success'
];

/**
 * Pulisce un record rimuovendo campi non GDPR-obbligatori
 */
function cleanRecord(record) {
  const cleaned = {};
  
  // Determina il tipo di log (audit o security)
  const isAudit = record.action !== undefined || record.resource !== undefined;
  const isSecurity = record.type !== undefined && record.severity !== undefined;
  
  // Seleziona i campi GDPR-obbligatori in base al tipo
  const gdprFields = isAudit ? GDPR_AUDIT_FIELDS : (isSecurity ? GDPR_SECURITY_FIELDS : []);
  
  // Copia solo i campi GDPR-obbligatori
  gdprFields.forEach(field => {
    if (record[field] !== undefined) {
      cleaned[field] = record[field];
    }
  });
  
  // Rimuovi campi non GDPR-obbligatori
  FIELDS_TO_REMOVE.forEach(field => {
    if (cleaned[field] !== undefined) {
      delete cleaned[field];
    }
  });
  
  // Pulisci campi nested in details (se presente)
  if (cleaned.details && typeof cleaned.details === 'object') {
    const cleanedDetails = {};
    // Mantieni solo campi essenziali in details
    if (cleaned.details.error) cleanedDetails.error = cleaned.details.error;
    if (cleaned.details.message) cleanedDetails.message = cleaned.details.message;
    cleaned.details = Object.keys(cleanedDetails).length > 0 ? cleanedDetails : null;
  }
  
  return cleaned;
}

/**
 * Estrae tutti i record dal dataset usando query APL
 */
async function extractAllRecords() {
  console.log('📥 Estrazione record dal dataset real-time...');
  
  const axiom = new Axiom({
    token: AXIOM_API_TOKEN,
    orgId: AXIOM_ORG_ID,
    region: AXIOM_REGION
  });
  
  const allRecords = [];
  let offset = 0;
  const limit = 10000;
  let hasMore = true;
  
  while (hasMore) {
    try {
      // Query APL per estrarre record in batch
      const query = `['${DATASET_NAME}'] | limit ${limit} | offset ${offset}`;
      
      const result = await axiom.query(query, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Ultimo anno
        endTime: new Date()
      });
      
      if (result.matches && result.matches.length > 0) {
        allRecords.push(...result.matches);
        offset += limit;
        console.log(`   📊 Estratti ${allRecords.length} record...`);
        
        if (result.matches.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('❌ Errore durante estrazione:', error.message);
      hasMore = false;
    }
  }
  
  console.log(`✅ Totale record estratti: ${allRecords.length}`);
  return allRecords;
}

/**
 * Filtra solo audit e security logs (esclude performance)
 */
function filterGDPRLogs(records) {
  console.log('🔍 Filtraggio log GDPR-obbligatori...');
  
  const filtered = records.filter(record => {
    // Escludi performance metrics
    if (record.log_type === 'performance' || record.cpu_usage !== undefined) {
      return false;
    }
    
    // Includi solo audit e security
    return record.action !== undefined || 
           record.resource !== undefined || 
           (record.type !== undefined && record.severity !== undefined);
  });
  
  console.log(`✅ Log GDPR-obbligatori trovati: ${filtered.length} (su ${records.length} totali)`);
  return filtered;
}

/**
 * Cancella il dataset
 */
async function deleteDataset() {
  console.log(`🗑️  Cancellazione dataset ${DATASET_NAME}...`);
  
  const region = AXIOM_REGION;
  const edgeDomain = region === 'eu' 
    ? 'eu-central-1.aws.edge.axiom.co' 
    : 'us-east-1.aws.edge.axiom.co';
  const url = `https://${edgeDomain}/v1/datasets/${DATASET_NAME}`;
  
  try {
    await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'X-Axiom-Org-Id': AXIOM_ORG_ID
      }
    });
    console.log('✅ Dataset cancellato');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Dataset non trovato (già cancellato o non esiste)');
    } else {
      throw error;
    }
  }
}

/**
 * Crea il dataset
 */
async function createDataset() {
  console.log(`➕ Creazione dataset ${DATASET_NAME}...`);
  
  const region = AXIOM_REGION;
  const edgeDomain = region === 'eu' 
    ? 'eu-central-1.aws.edge.axiom.co' 
    : 'us-east-1.aws.edge.axiom.co';
  const url = `https://${edgeDomain}/v1/datasets/${DATASET_NAME}`;
  
  try {
    await axios.post(url, {
      name: DATASET_NAME,
      description: 'Real-time logs GDPR-compliant (audit + security only)'
    }, {
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': AXIOM_ORG_ID
      }
    });
    console.log('✅ Dataset creato');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('⚠️  Dataset già esistente');
    } else {
      throw error;
    }
  }
}

/**
 * Re-ingesta i record puliti
 */
async function reingestRecords(records) {
  console.log(`📤 Re-ingestione ${records.length} record puliti...`);
  
  const region = AXIOM_REGION;
  const edgeDomain = region === 'eu' 
    ? 'eu-central-1.aws.edge.axiom.co' 
    : 'us-east-1.aws.edge.axiom.co';
  const url = `https://${edgeDomain}/v1/ingest/${DATASET_NAME}`;
  
  // Invia in batch di 1000
  const batchSize = 1000;
  let ingested = 0;
  let failed = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      await axios.post(url, batch, {
        headers: {
          'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': AXIOM_ORG_ID
        },
        timeout: 30000
      });
      
      ingested += batch.length;
      console.log(`   ✅ Ingestati ${ingested}/${records.length} record...`);
    } catch (error) {
      failed += batch.length;
      console.error(`   ❌ Errore ingestione batch ${i}-${i + batch.length}:`, error.response?.status || error.message);
    }
  }
  
  console.log(`\n📊 Risultati:`);
  console.log(`   ✅ Ingestati: ${ingested}`);
  console.log(`   ❌ Falliti: ${failed}`);
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Pulizia dataset real-time per GDPR compliance\n');
  
  if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
    console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
    process.exit(1);
  }
  
  try {
    // 1. Estrai tutti i record
    const allRecords = await extractAllRecords();
    
    if (allRecords.length === 0) {
      console.log('⚠️  Nessun record trovato nel dataset');
      return;
    }
    
    // 2. Filtra solo audit e security (escludi performance)
    const gdprLogs = filterGDPRLogs(allRecords);
    
    // 3. Pulisci i record
    console.log('🧹 Pulizia campi non GDPR-obbligatori...');
    const cleanedRecords = gdprLogs.map(cleanRecord);
    console.log(`✅ ${cleanedRecords.length} record puliti`);
    
    // 4. Cancella dataset
    await deleteDataset();
    
    // 5. Crea dataset
    await createDataset();
    
    // 6. Re-ingesta record puliti
    if (cleanedRecords.length > 0) {
      await reingestRecords(cleanedRecords);
    }
    
    console.log('\n✅ Pulizia completata!');
  } catch (error) {
    console.error('\n❌ Errore durante pulizia:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Esegui
if (require.main === module) {
  main();
}

module.exports = { cleanRecord, filterGDPRLogs };

