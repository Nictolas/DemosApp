// Script per deduplicare dati su Axiom
// Axiom non supporta DELETE diretto, quindi creiamo un nuovo dataset pulito
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_API_DOMAIN = AXIOM_REGION === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
const AXIOM_BASE_URL = `https://${AXIOM_API_DOMAIN}`;
const AXIOM_EDGE_DOMAIN = process.env.AXIOM_EDGE_DOMAIN
  || (AXIOM_REGION === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
const AXIOM_EDGE_URL = `https://${AXIOM_EDGE_DOMAIN}`;

async function deduplicateDataset(datasetName, uniqueFields = null) {
  console.log(`🔍 Deduplicazione dataset: ${datasetName}\n`);
  
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  
  if (!token || !orgId) {
    console.error('❌ AXIOM_API_TOKEN o AXIOM_ORG_ID non configurati');
    process.exit(1);
  }
  
  // Determina i campi univoci in base al dataset
  let uniqueKey;
  if (!uniqueFields) {
    if (datasetName === 'centralized_logs' || datasetName.includes('centralized')) {
      // Per centralized_logs: usa _time + message + user_id + endpoint come chiave unica
      uniqueKey = '_time, message, user_id, endpoint';
      console.log(`📍 Campi univoci: ${uniqueKey}\n`);
    } else if (datasetName === 'real-time' || datasetName.includes('real-time')) {
      // Per real-time: usa _time + log_type + action + user_id + resource_id
      uniqueKey = '_time, log_type, action, user_id, resource_id';
      console.log(`📍 Campi univoci: ${uniqueKey}\n`);
    } else {
      // Default: solo _time
      uniqueKey = '_time';
      console.log(`📍 Campo univoco: ${uniqueKey}\n`);
    }
  } else {
    uniqueKey = uniqueFields;
    console.log(`📍 Campi univoci: ${uniqueKey}\n`);
  }
  
  const tempDataset = `${datasetName}_deduped_${Date.now()}`;
  
  try {
    // Step 1: Query per ottenere solo record unici usando APL
    console.log('📊 Step 1: Query record unici...');
    // Usa arg_max per prendere l'ultimo record per ogni combinazione unica
    const aplQuery = `['${datasetName}'] | summarize arg_max(_time, *) by ${uniqueKey}`;
    
    const queryResponse = await axios.post(
      `${AXIOM_BASE_URL}/v1/datasets/_apl`,
      { 
        apl: aplQuery,
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Ultimo anno
        endTime: new Date().toISOString()
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': orgId
        },
        timeout: 300000 // 5 minuti per query lunghe
      }
    );
    
    const uniqueRecords = queryResponse.data?.data?.rows || [];
    console.log(`✅ Trovati ${uniqueRecords.length} record unici\n`);
    
    if (uniqueRecords.length === 0) {
      console.log('⚠️ Nessun record trovato');
      return;
    }
    
    // Step 2: Crea nuovo dataset temporaneo
    console.log(`📦 Step 2: Creazione dataset temporaneo: ${tempDataset}...`);
    try {
      await axios.post(
        `${AXIOM_BASE_URL}/v1/datasets`,
        {
          name: tempDataset,
          description: `Dataset deduplicato da ${datasetName}`
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Axiom-Org-Id': orgId
          }
        }
      );
      console.log(`✅ Dataset ${tempDataset} creato\n`);
    } catch (createErr) {
      if (createErr.response?.status === 409) {
        console.log(`⚠️ Dataset ${tempDataset} già esiste, lo uso\n`);
      } else {
        throw createErr;
      }
    }
    
    // Step 3: Invia record unici al nuovo dataset in batch
    console.log(`📤 Step 3: Invio record unici al nuovo dataset...`);
    const batchSize = 1000;
    let sent = 0;
    
    for (let i = 0; i < uniqueRecords.length; i += batchSize) {
      const batch = uniqueRecords.slice(i, i + batchSize);
      
      await axios.post(
        `${AXIOM_EDGE_URL}/v1/ingest/${tempDataset}`,
        batch,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Axiom-Org-Id': orgId
          },
          timeout: 60000
        }
      );
      
      sent += batch.length;
      console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} record inviati (totale: ${sent}/${uniqueRecords.length})`);
    }
    
    console.log(`\n✅ Deduplicazione completata!`);
    console.log(`\n📋 Prossimi passi:`);
    console.log(`   1. Verifica il dataset ${tempDataset} su Axiom Dashboard`);
    console.log(`   2. Se tutto è corretto, elimina il dataset originale ${datasetName}`);
    console.log(`   3. Rinomina ${tempDataset} in ${datasetName}`);
    console.log(`\n⚠️ ATTENZIONE: Questa operazione richiede intervento manuale su Axiom Dashboard`);
    
  } catch (error) {
    console.error('❌ Errore deduplicazione:', error.response?.data || error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Esegui
const dataset = process.argv[2] || process.env.AXIOM_DATASET || 'centralized_logs';
const uniqueFields = process.argv[3] || null; // Se null, usa campi predefiniti

console.log('🚀 Deduplicazione Axiom\n');
console.log(`📊 Dataset: ${dataset}\n`);

deduplicateDataset(dataset, uniqueFields);

