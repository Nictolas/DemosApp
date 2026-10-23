// Script per verificare quanti record ci sono effettivamente su Axiom
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
// Per le query APL, usa l'API principale, non l'edge domain
const AXIOM_API_DOMAIN = AXIOM_REGION === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
const AXIOM_API_URL = `https://${AXIOM_API_DOMAIN}`;

async function verifyAxiomData() {
  console.log('🔍 Verifica dati su Axiom...\n');
  console.log(`📍 Regione: ${AXIOM_REGION}`);
  console.log(`📍 API URL: ${AXIOM_API_URL}`);
  console.log('Token Axiom configurato:', Boolean(process.env.AXIOM_API_TOKEN));
  console.log(`🏢 Org ID: ${process.env.AXIOM_ORG_ID || 'NON CONFIGURATO'}\n`);
  
  const datasets = [
    { name: process.env.AXIOM_DATASET || 'centralized_logs', label: 'Centralized Logs' },
    { name: process.env.AXIOM_REALTIME_DATASET || 'real-time', label: 'Audit Logs' }
  ];
  
  for (const ds of datasets) {
    console.log(`\n📊 Query dataset: ${ds.name} (${ds.label})`);
    try {
      const aplQuery = `['${ds.name}'] | summarize count()`;
      console.log(`   Query APL: ${aplQuery}`);
      
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
      
      console.log(`   ✅ Risposta ricevuta`);
      console.log(`   📦 Dati risposta:`, JSON.stringify(response.data, null, 2));
      
      // Estrarre il conteggio
      let count = 0;
      const data = response.data || {};
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
      
      console.log(`   📈 Record trovati: ${count.toLocaleString('it-IT')}`);
      
    } catch (error) {
      if (error.response) {
        console.error(`   ❌ Errore ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
        if (error.response.status === 401 || error.response.status === 403) {
          console.error(`   💡 Possibile problema di autenticazione o permessi`);
        }
      } else {
        console.error(`   ❌ Errore:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Verifica completata');
}

verifyAxiomData();

