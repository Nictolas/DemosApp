// Test diretto dell'API Axiom per vedere la risposta esatta
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_BASE_URL = AXIOM_REGION === 'eu' 
  ? 'https://api.eu.axiom.co' 
  : 'https://api.axiom.co';

async function testDirect() {
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  console.log('🔍 Test diretto API Axiom\n');
  console.log(`📍 URL: ${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`);
  console.log(`🔑 Token: ${token ? token.substring(0, 15) + '...' : 'MISSING'}`);
  console.log(`🏢 Org ID: ${orgId || 'MISSING'}\n`);
  
  // Test con evento minimo
  const testEvent = {
    _time: new Date().toISOString(),
    level: 'INFO',
    message: 'Test evento da script',
    log_type: 'application'
  };
  
  try {
    // Prova 1: Con X-Axiom-Org-Id
    console.log('📤 Prova 1: Con header X-Axiom-Org-Id...');
    const response1 = await axios.post(
      `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`,
      [testEvent],
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': orgId
        },
        timeout: 30000
      }
    );
    console.log('✅ Successo!', response1.status, response1.data);
    return;
  } catch (error1) {
    console.log('❌ Errore:', error1.response?.status, error1.response?.data);
    
    // Prova 2: Senza X-Axiom-Org-Id (forse non serve)
    console.log('\n📤 Prova 2: Senza header X-Axiom-Org-Id...');
    try {
      const response2 = await axios.post(
        `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`,
        [testEvent],
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      console.log('✅ Successo!', response2.status, response2.data);
      return;
    } catch (error2) {
      console.log('❌ Errore:', error2.response?.status, error2.response?.data);
      
      // Prova 3: Verifica se il dataset esiste
      console.log('\n📤 Prova 3: Verifica lista datasets...');
      try {
        const response3 = await axios.get(
          `${AXIOM_BASE_URL}/v1/datasets`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Axiom-Org-Id': orgId
            },
            timeout: 30000
          }
        );
        console.log('✅ Datasets disponibili:');
        response3.data.forEach(ds => {
          console.log(`   - ${ds.name} (${ds.id})`);
        });
      } catch (error3) {
        console.log('❌ Errore lista datasets:', error3.response?.status, error3.response?.data);
      }
    }
  }
}

testDirect();



