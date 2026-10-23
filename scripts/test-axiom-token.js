// Script per testare il token Axiom
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_EDGE_DOMAIN = process.env.AXIOM_EDGE_DOMAIN
  || (AXIOM_REGION === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
const AXIOM_BASE_URL = `https://${AXIOM_EDGE_DOMAIN}`;

async function testToken() {
  console.log('🔍 Test token Axiom...\n');
  console.log(`📍 Regione: ${AXIOM_REGION}`);
  console.log(`📍 API Base: ${AXIOM_BASE_URL}`);
  console.log('Token Axiom configurato:', Boolean(process.env.AXIOM_API_TOKEN));
  console.log(`🏢 Org ID: ${process.env.AXIOM_ORG_ID || 'NON CONFIGURATO'}\n`);
  
  // Test 1: Lista datasets
  console.log('📋 Test 1: Lista datasets...');
  try {
    const datasetsUrl = `${AXIOM_BASE_URL}/v1/datasets`;
    const response = await axios.get(datasetsUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
        'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
      },
      timeout: 30000
    });
    console.log('✅ Successo! Datasets disponibili:');
    response.data.forEach(ds => {
      console.log(`   - ${ds.name} (${ds.id})`);
    });
  } catch (error) {
    if (error.response) {
      console.error(`❌ Errore ${error.response.status}:`, error.response.data);
    } else {
      console.error('❌ Errore:', error.message);
    }
  }
  
  // Test 2: Ingest di un singolo evento
  console.log('\n📤 Test 2: Ingest evento di test...');
  try {
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    const ingestUrl = `${AXIOM_BASE_URL}/v1/ingest/${dataset}`;
    
    const testEvent = {
      _time: new Date().toISOString(),
      level: 'INFO',
      message: 'Test evento migrazione',
      log_type: 'test'
    };
    
    const response = await axios.post(ingestUrl, [testEvent], {
      headers: {
        'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
      },
      timeout: 30000
    });
    
    console.log('✅ Successo! Evento inviato:', response.data);
  } catch (error) {
    if (error.response) {
      console.error(`❌ Errore ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      if (error.response.status === 403) {
        console.error('\n💡 Possibili cause:');
        console.error('   1. Il token non ha permessi "Ingest"');
        console.error('   2. L\'Org ID non è corretto');
        console.error('   3. Il dataset non esiste o non hai accesso');
        console.error('\n💡 Verifica su Axiom:');
        console.error('   - Vai su Settings → API Tokens');
        console.error('   - Controlla che il token abbia permessi "Ingest" e "Query"');
        console.error('   - Verifica che l\'Org ID sia corretto in Settings → Organization');
      }
    } else {
      console.error('❌ Errore:', error.message);
    }
  }
}

testToken();

