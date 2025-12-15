/**
 * Script per ricreare completamente il dataset real-time con solo campi GDPR-obbligatori
 * 
 * Questo script:
 * 1. Estrae tutti i record dal dataset real-time
 * 2. Pulisce i campi non GDPR-obbligatori
 * 3. Cancella il dataset originale
 * 4. Ricrea il dataset
 * 5. Re-ingesta i record puliti
 */

require('dotenv').config();
const axios = require('axios');

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

/**
 * Pulisce un record rimuovendo campi non GDPR-obbligatori
 */
function cleanRecord(record) {
  // Determina il tipo di log
  const isAudit = record.action !== undefined || record.resource !== undefined;
  const isSecurity = record.type !== undefined && record.severity !== undefined;
  
  if (!isAudit && !isSecurity) {
    // Record non riconosciuto, salta
    return null;
  }
  
  const cleaned = {};
  
  // Seleziona i campi GDPR-obbligatori in base al tipo
  const gdprFields = isAudit ? GDPR_AUDIT_FIELDS : GDPR_SECURITY_FIELDS;
  
  // Copia solo i campi GDPR-obbligatori
  gdprFields.forEach(field => {
    if (record[field] !== undefined) {
      cleaned[field] = record[field];
    } else if (field === '_time' && record._time === undefined) {
      // Se _time non è presente, usa il timestamp corrente
      cleaned._time = new Date().toISOString();
    }
  });
  
  // Pulisci details per security events (mantieni solo message)
  if (cleaned.details && typeof cleaned.details === 'object') {
    const cleanedDetails = {};
    // Mantieni solo message se presente
    if (cleaned.details.message) {
      cleanedDetails.message = cleaned.details.message;
    }
    // Se non c'è message, rimuovi details completamente
    cleaned.details = Object.keys(cleanedDetails).length > 0 ? cleanedDetails : null;
  } else if (cleaned.details && typeof cleaned.details === 'string') {
    // Se details è una stringa, mantienila (può essere un messaggio)
    // Ma verifica che non sia troppo lunga o contenere dati non essenziali
    if (cleaned.details.length > 500) {
      cleaned.details = cleaned.details.substring(0, 500) + '...';
    }
  }
  
  // Assicurati che _time sia sempre presente
  if (!cleaned._time) {
    cleaned._time = new Date().toISOString();
  }
  
  return cleaned;
}

/**
 * Estrae tutti i record dal dataset usando query APL
 */
async function extractAllRecords() {
  console.log('📥 Estrazione record dal dataset real-time...');
  
  const Axiom = require('@axiomhq/axiom-node');
  const axiom = new Axiom.Client({
    token: AXIOM_API_TOKEN,
    orgId: AXIOM_ORG_ID,
    region: AXIOM_REGION
  });
  
  const allRecords = [];
  const limit = 100000; // Estrai fino a 100k record
  
  try {
    // Query APL per estrarre tutti i record (senza offset, Axiom non lo supporta)
    const query = `['${DATASET_NAME}'] | limit ${limit}`;
    
    console.log('   ⏳ Estrazione in corso (può richiedere alcuni minuti)...');
    
    const result = await axiom.query(query, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Ultimo anno
      endTime: new Date()
    });
    
    if (result.matches && result.matches.length > 0) {
      result.matches.forEach(record => {
        // I dati possono essere in record.data (se inviati come array) o direttamente in record
        let actualRecord = record;
        if (record.data) {
          try {
            actualRecord = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
          } catch (e) {
            actualRecord = record;
          }
        }
        
        // Aggiungi _time se presente nel record originale
        if (record._time) {
          actualRecord._time = record._time;
        } else if (record._sysTime) {
          actualRecord._time = new Date(record._sysTime).toISOString();
        }
        
        allRecords.push(actualRecord);
      });
      
      console.log(`   📊 Estratti ${allRecords.length} record...`);
    }
  } catch (error) {
    console.error('❌ Errore durante estrazione:', error.message);
    // Continua comunque con la ricreazione del dataset
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
  const apiDomain = region === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
  const baseUrl = `https://${apiDomain}`;
  const url = `${baseUrl}/v1/datasets/${DATASET_NAME}`;
  
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
  const apiDomain = region === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
  const baseUrl = `https://${apiDomain}`;
  const url = `${baseUrl}/v1/datasets`;
  
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
      const response = await axios.post(url, batch, {
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
      if (error.response?.data) {
        console.error('   Dettagli:', JSON.stringify(error.response.data, null, 2));
      }
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
  console.log('🚀 Ricreazione dataset real-time per GDPR compliance\n');
  
  if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
    console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
    process.exit(1);
  }
  
  try {
    // 1. Estrai tutti i record
    const allRecords = await extractAllRecords();
    
    if (allRecords.length === 0) {
      console.log('⚠️  Nessun record trovato nel dataset');
      console.log('   Il dataset verrà comunque ricreato vuoto');
    } else {
      // 2. Filtra solo audit e security (escludi performance)
      const gdprLogs = filterGDPRLogs(allRecords);
      
      // 3. Pulisci i record
      console.log('🧹 Pulizia campi non GDPR-obbligatori...');
      const cleanedRecords = gdprLogs
        .map(cleanRecord)
        .filter(record => record !== null); // Rimuovi record null
      
      console.log(`✅ ${cleanedRecords.length} record puliti`);
      
      // Mostra esempio di record pulito
      if (cleanedRecords.length > 0) {
        console.log('\n📋 Esempio record pulito:');
        console.log(JSON.stringify(cleanedRecords[0], null, 2));
      }
      
      // 4. Cancella dataset
      await deleteDataset();
      
      // 5. Crea dataset
      await createDataset();
      
      // 6. Re-ingesta record puliti
      if (cleanedRecords.length > 0) {
        await reingestRecords(cleanedRecords);
      } else {
        console.log('\n⚠️  Nessun record da re-ingestare');
      }
    }
    
    console.log('\n✅ Ricreazione completata!');
    console.log('\n📝 Prossimi passi:');
    console.log('   1. Attendi 2-5 minuti per l\'indexing');
    console.log('   2. Verifica su Axiom Dashboard → Dataset real-time → Fields');
    console.log('   3. Dovresti vedere solo campi GDPR-obbligatori');
  } catch (error) {
    console.error('\n❌ Errore durante ricreazione:', error.message);
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

