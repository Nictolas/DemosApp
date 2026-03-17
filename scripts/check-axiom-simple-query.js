// Script per verificare se ci sono dati su Axiom con query semplice
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_API_DOMAIN = AXIOM_REGION === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
const AXIOM_API_URL = `https://${AXIOM_API_DOMAIN}`;

async function checkAxiomData() {
  console.log('🔍 Verifica dati su Axiom con query semplice...\n');
  console.log(`📍 API URL: ${AXIOM_API_URL}`);
  console.log(`🔑 Token: ${process.env.AXIOM_API_TOKEN ? process.env.AXIOM_API_TOKEN.substring(0, 20) + '...' : 'NON CONFIGURATO'}`);
  console.log(`🏢 Org ID: ${process.env.AXIOM_ORG_ID || 'NON CONFIGURATO'}\n`);
  
  const datasets = [
    { name: process.env.AXIOM_DATASET || 'centralized_logs', label: 'Centralized Logs' },
    { name: process.env.AXIOM_REALTIME_DATASET || 'real-time', label: 'Audit Logs' }
  ];
  
  for (const ds of datasets) {
    console.log(`\n📊 Dataset: ${ds.name} (${ds.label})`);
    
    // Query semplice: prendi solo i primi 10 record
    console.log('   Query: Prendi primi 10 record...');
    try {
      const aplQuery = `['${ds.name}'] | limit 10`;
      const response = await axios.post(
        `${AXIOM_API_URL}/v1/datasets/_apl`,
        { apl: aplQuery },
        {
          headers: {
            'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
          },
          timeout: 30000
        }
      );
      
      console.log('   ✅ Risposta ricevuta');
      const data = response.data || {};
      
      if (data?.data?.rows && Array.isArray(data.data.rows)) {
        console.log(`   📈 Record trovati: ${data.data.rows.length}`);
        if (data.data.rows.length > 0) {
          console.log('   ✅ CI SONO DATI!');
          console.log('   📝 Primo record:', JSON.stringify(data.data.rows[0], null, 2));
        } else {
          console.log('   ⚠️ Nessun record trovato - il dataset potrebbe essere vuoto');
        }
      } else {
        console.log('   📦 Struttura risposta:', JSON.stringify(data, null, 2));
      }
      
    } catch (error) {
      if (error.response) {
        console.error(`   ❌ Errore ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`   ❌ Errore:`, error.message);
      }
    }
    
    // Prova anche con count
    console.log('\n   Query: Count totale...');
    try {
      const aplQuery = `['${ds.name}'] | summarize count()`;
      const response = await axios.post(
        `${AXIOM_API_URL}/v1/datasets/_apl`,
        { apl: aplQuery },
        {
          headers: {
            'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
          },
          timeout: 30000
        }
      );
      
      console.log('   ✅ Risposta ricevuta');
      const data = response.data || {};
      console.log('   📦 Risposta completa:', JSON.stringify(data, null, 2));
      
      // Estrai count
      let count = 0;
      if (data?.data?.rows && Array.isArray(data.data.rows) && data.data.rows.length > 0) {
        const firstRow = data.data.rows[0];
        if (typeof firstRow === 'object') {
          const firstKey = Object.keys(firstRow)[0];
          count = Number(firstRow[firstKey]) || 0;
        } else if (Array.isArray(firstRow)) {
          count = Number(firstRow[0]) || 0;
        }
      } else if (typeof data?.count === 'number') {
        count = data.count;
      } else if (data?.matches?.total) {
        count = Number(data.matches.total) || 0;
      }
      
      console.log(`   📈 Count totale: ${count.toLocaleString('it-IT')}`);
      
    } catch (error) {
      if (error.response) {
        console.error(`   ❌ Errore ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`   ❌ Errore:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Verifica completata');
}

checkAxiomData();

