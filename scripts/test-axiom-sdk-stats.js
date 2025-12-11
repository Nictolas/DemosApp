// Test SDK Axiom per ottenere statistiche
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testAxiomSDKStats() {
  console.log('🔍 Test SDK Axiom per statistiche\n');
  
  try {
    const Axiom = require('@axiomhq/axiom-node');
    
    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    const client = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    
    console.log(`📍 Regione: ${region}`);
    console.log(`🔑 Token: ${process.env.AXIOM_API_TOKEN ? process.env.AXIOM_API_TOKEN.substring(0, 20) + '...' : 'MISSING'}`);
    console.log(`🏢 Org ID: ${process.env.AXIOM_ORG_ID || 'MISSING'}\n`);
    
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    
    // Prova vari metodi dell'SDK
    console.log('📊 Provo metodi SDK disponibili...\n');
    
    // Metodo 1: getDataset
    try {
      console.log('1. Provo client.getDataset()...');
      const datasetInfo = await client.datasets.get(dataset);
      console.log('✅ Risposta getDataset:');
      console.log(JSON.stringify(datasetInfo, null, 2));
    } catch (err) {
      console.error('❌ getDataset fallito:', err.message);
    }
    
    // Metodo 2: listDatasets (potrebbe avere statistiche)
    try {
      console.log('\n2. Provo client.datasets.list()...');
      const datasets = await client.datasets.list();
      console.log('✅ Risposta listDatasets:');
      const targetDataset = datasets.find(ds => ds.name === dataset);
      if (targetDataset) {
        console.log('📊 Dataset trovato:');
        console.log(JSON.stringify(targetDataset, null, 2));
      } else {
        console.log('⚠️ Dataset non trovato nella lista');
        console.log('📋 Tutti i dataset:', datasets.map(ds => ds.name).join(', '));
      }
    } catch (err) {
      console.error('❌ listDatasets fallito:', err.message);
    }
    
    // Metodo 3: query con summarize per ottenere count
    try {
      console.log('\n3. Provo query APL con SDK...');
      const query = `['${dataset}'] | summarize count()`;
      const result = await client.query(query, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Ultimi 7 giorni
        endTime: new Date()
      });
      console.log('✅ Risposta query SDK:');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('❌ Query SDK fallito:', err.message);
      if (err.response) {
        console.error('   Status:', err.response.status);
        console.error('   Data:', JSON.stringify(err.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Errore inizializzazione SDK:', error.message);
  }
}

testAxiomSDKStats();

