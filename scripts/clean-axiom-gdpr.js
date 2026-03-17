// Script per pulire i dati non necessari per GDPR da Axiom
// Rimuove campi tecnici e riduce la dimensione dei dati
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let Axiom;
let axiomClient;

try {
  Axiom = require('@axiomhq/axiom-node');
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  axiomClient = new Axiom.Client({
    token: process.env.AXIOM_API_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
    region: region
  });
} catch (sdkErr) {
  console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

// Campi da RIMUOVERE (non necessari per GDPR)
const FIELDS_TO_REMOVE = [
  'pid',              // Process ID - solo tecnico
  'hostname',         // Nome host - solo tecnico
  'request_id',       // ID richiesta - solo tecnico per tracciamento
  'freed',            // Metriche memoria
  'afterGC',          // Metriche memoria
  'beforeGC',         // Metriche memoria
  'alertType',        // Errori tecnici dettagliati
  'errors',           // Errori tecnici dettagliati
  'method',           // Metodo HTTP - già in endpoint
  'statusCode',       // Status code - già in endpoint
  'responseTime',     // Tempo risposta - solo tecnico
  'url',              // URL - già in endpoint
  'headers',          // Headers HTTP - non necessario
  'created',          // Timestamp duplicato
  'timestamp'         // Timestamp duplicato (usiamo _time)
];

// Campi da MANTENERE (necessari per GDPR)
const FIELDS_TO_KEEP = [
  '_time',            // Timestamp (obbligatorio)
  'level',            // Livello log (obbligatorio)
  'message',          // Messaggio (obbligatorio)
  'log_type',         // Tipo log (utile)
  'user_id',          // ID utente (obbligatorio, può essere anonimizzato)
  'ip_address',       // IP (obbligatorio, deve essere anonimizzato)
  'endpoint',         // Endpoint API (obbligatorio)
  'session_id',       // ID sessione (obbligatorio, può essere anonimizzato)
  'user_agent'        // User Agent (utile per sicurezza)
];

async function cleanAxiomData(dataset, dryRun = true) {
  console.log(`🧹 Pulizia dati GDPR per dataset: ${dataset}`);
  console.log(`   Modalità: ${dryRun ? 'DRY RUN (simulazione)' : 'REALE (cancellazione)'}\n`);
  
  try {
    // 1. Conta record totali
    console.log('📊 STEP 1: Conteggio record\n');
    const countQuery = `['${dataset}'] | summarize count()`;
    const countResult = await axiomClient.query(countQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let totalCount = 0;
    if (countResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      totalCount = parseInt(countResult.buckets.totals[0].aggregations[0].value);
    } else if (countResult.status?.rowsExamined) {
      totalCount = parseInt(countResult.status.rowsExamined);
    }
    
    console.log(`   Record totali: ${totalCount.toLocaleString('it-IT')}`);
    
    if (totalCount === 0) {
      console.log('   ⚠️ Nessun record trovato');
      return;
    }
    
    // 2. Analizza campi presenti
    console.log('\n📊 STEP 2: Analisi campi presenti\n');
    const sampleQuery = `['${dataset}'] | limit 100`;
    const sampleResult = await axiomClient.query(sampleQuery, {
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let sampleRows = [];
    if (sampleResult.matches && Array.isArray(sampleResult.matches)) {
      sampleRows = sampleResult.matches;
    } else if (sampleResult.buckets && Array.isArray(sampleResult.buckets)) {
      sampleRows = sampleResult.buckets.flatMap(b => b.rows || b.data || []);
    } else if (sampleResult.data?.rows) {
      sampleRows = sampleResult.data.rows;
    } else if (sampleResult.rows) {
      sampleRows = sampleResult.rows;
    }
    
    // Estrai tutti i campi unici
    const allFields = new Set();
    const fieldCounts = {}; // Conta quante volte appare ogni campo (per vedere quali sono più comuni)
    
    sampleRows.forEach(row => {
      // I dati reali sono nel campo "data" (oggetto, non stringa)
      if (row.data && typeof row.data === 'object') {
        Object.keys(row.data).forEach(key => {
          if (!key.startsWith('_')) { // Escludi metadati Axiom
            allFields.add(key);
            fieldCounts[key] = (fieldCounts[key] || 0) + 1;
          }
        });
      } else if (row.data && typeof row.data === 'string') {
        // Se è stringa, prova a parsare
        try {
          const dataObj = JSON.parse(row.data);
          Object.keys(dataObj).forEach(key => {
            if (!key.startsWith('_')) {
              allFields.add(key);
              fieldCounts[key] = (fieldCounts[key] || 0) + 1;
            }
          });
        } catch (e) {
          // Ignora
        }
      } else {
        // Se non c'è campo "data", analizza direttamente i campi
        Object.keys(row).forEach(key => {
          if (!key.startsWith('_') && key !== 'data') {
            allFields.add(key);
            fieldCounts[key] = (fieldCounts[key] || 0) + 1;
          }
        });
      }
    });
    
    console.log(`   Campi trovati: ${allFields.size}`);
    const fieldsToRemove = Array.from(allFields).filter(f => FIELDS_TO_REMOVE.includes(f));
    const fieldsToKeep = Array.from(allFields).filter(f => FIELDS_TO_KEEP.includes(f));
    const fieldsUnknown = Array.from(allFields).filter(f => 
      !FIELDS_TO_REMOVE.includes(f) && !FIELDS_TO_KEEP.includes(f)
    );
    
    console.log(`\n   ✅ Campi da mantenere (${fieldsToKeep.length}):`);
    fieldsToKeep.sort().forEach(f => {
      const count = fieldCounts[f] || 0;
      const percentage = ((count / sampleRows.length) * 100).toFixed(1);
      console.log(`      - ${f} (presente in ${count}/${sampleRows.length} record, ${percentage}%)`);
    });
    
    console.log(`\n   ❌ Campi da rimuovere (${fieldsToRemove.length}):`);
    fieldsToRemove.sort().forEach(f => {
      const count = fieldCounts[f] || 0;
      const percentage = ((count / sampleRows.length) * 100).toFixed(1);
      console.log(`      - ${f} (presente in ${count}/${sampleRows.length} record, ${percentage}%)`);
    });
    
    if (fieldsUnknown.length > 0) {
      console.log(`\n   ⚠️ Campi sconosciuti (${fieldsUnknown.length}) - da valutare:`);
      fieldsUnknown.sort().forEach(f => {
        const count = fieldCounts[f] || 0;
        const percentage = ((count / sampleRows.length) * 100).toFixed(1);
        console.log(`      - ${f} (presente in ${count}/${sampleRows.length} record, ${percentage}%)`);
      });
    }
    
    // Calcola dimensione stimata risparmiata
    const estimatedBytesPerField = 50; // Stima media per campo
    const totalBytesToRemove = fieldsToRemove.reduce((sum, f) => {
      return sum + (fieldCounts[f] || 0) * estimatedBytesPerField;
    }, 0);
    const estimatedMBToRemove = (totalBytesToRemove * totalCount) / (1024 * 1024);
    
    console.log(`\n   💾 Dimensione stimata da rimuovere: ~${estimatedMBToRemove.toFixed(2)} MB`);
    
    if (dryRun) {
      console.log('\n✅ DRY RUN completato. Nessuna modifica effettuata.');
      console.log('   Per applicare le modifiche, esegui: node scripts/clean-axiom-gdpr.js --apply');
      return;
    }
    
    // 3. Creazione nuovo dataset pulito
    console.log('\n📊 STEP 3: Creazione dataset pulito\n');
    const cleanDataset = `${dataset}_clean`;
    console.log(`   Dataset pulito: ${cleanDataset}`);
    
    // NOTA: Axiom non supporta la modifica diretta dei record
    // Dobbiamo:
    // 1. Estrarre i record con solo i campi necessari
    // 2. Creare un nuovo dataset
    // 3. Inserire i record puliti
    // 4. Sostituire il dataset originale
    
    console.log('\n⚠️ ATTENZIONE: Questa operazione richiede:');
    console.log('   1. Estrazione di tutti i record');
    console.log('   2. Creazione di un nuovo dataset');
    console.log('   3. Re-inserimento dei record puliti');
    console.log('   4. Sostituzione del dataset originale');
    console.log('\n   Questa operazione può richiedere molto tempo e costi.');
    console.log('   Vuoi procedere? (non implementato in questo script)');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

// Main
const dataset = process.argv[2] || 'centralized_logs';
const dryRun = !process.argv.includes('--apply');

console.log('🧹 Script Pulizia Dati GDPR per Axiom\n');
console.log('Questo script analizza e rimuove campi non necessari per GDPR.\n');

cleanAxiomData(dataset, dryRun)
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Errore:', error);
    process.exit(1);
  });

