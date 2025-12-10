// Test diretto ingest con il nuovo token
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_BASE_URL = AXIOM_REGION === 'eu' 
  ? 'https://api.eu.axiom.co' 
  : 'https://api.axiom.co';

async function testIngest() {
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  console.log('🔍 Test Ingest Diretto\n');
  console.log(`🔑 Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
  console.log(`🏢 Org ID: ${orgId || 'MISSING'}`);
  console.log(`📊 Dataset: ${dataset}\n`);
  
  const testEvent = {
    _time: new Date().toISOString(),
    level: 'INFO',
    message: 'Test evento migrazione - ' + new Date().toISOString(),
    log_type: 'test'
  };
  
  const url = `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`;
  
  console.log(`📤 Invio a: ${url}\n`);
  
  try {
    const response = await axios.post(url, [testEvent], {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': orgId
      },
      timeout: 30000
    });
    
    console.log('✅ SUCCESSO! Evento inviato correttamente!');
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    console.log('\n🎉 Il token funziona! Puoi procedere con la migrazione.');
    return true;
  } catch (error) {
    if (error.response) {
      console.error(`❌ ERRORE ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.error('\n💡 Il token ha ancora 403. Possibili cause:');
        console.error('   1. Il token non ha permessi "Ingest" per il dataset');
        console.error('   2. Il dataset non esiste');
        console.error('   3. Il token è stato creato per un\'altra organization');
        console.error('   4. C\'è un problema con la regione EU');
      }
    } else {
      console.error('❌ Errore network:', error.message);
    }
    return false;
  }
}

testIngest();

