// Test diretto API dataset per vedere cosa restituisce
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_API_DOMAIN = AXIOM_REGION === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
const AXIOM_BASE_URL = `https://${AXIOM_API_DOMAIN}`;

async function testDatasetAPI() {
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  console.log('🔍 Test API Dataset\n');
  console.log(`📍 URL: ${AXIOM_BASE_URL}/v1/datasets/${dataset}`);
  console.log(`🔑 Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
  console.log(`🏢 Org ID: ${orgId || 'MISSING'}\n`);
  
  try {
    const response = await axios.get(
      `${AXIOM_BASE_URL}/v1/datasets/${dataset}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Axiom-Org-Id': orgId
        },
        timeout: 30000
      }
    );
    
    console.log('✅ SUCCESSO! Risposta ricevuta:\n');
    console.log('📦 Risposta completa:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Analizza struttura
    console.log('\n📊 Analisi struttura:');
    console.log('   Keys principali:', Object.keys(response.data));
    if (response.data.stats) {
      console.log('   Keys stats:', Object.keys(response.data.stats));
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ ERRORE ${error.response.status}:`);
      console.error(JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.error('\n💡 L\'API dataset restituisce 403, come le query APL.');
        console.error('   Questo significa che il token non ha permessi READ per i dataset.');
      }
    } else {
      console.error('❌ Errore network:', error.message);
    }
  }
}

testDatasetAPI();

