// Test tutte le varianti possibili per capire il problema
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_BASE_URL = AXIOM_REGION === 'eu' 
  ? 'https://api.eu.axiom.co' 
  : 'https://api.axiom.co';

async function testVarianti() {
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  const testEvent = {
    _time: new Date().toISOString(),
    level: 'INFO',
    message: 'Test',
    log_type: 'test'
  };
  
  const url = `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest`;
  
  console.log('🔍 Test Varianti Autenticazione Axiom\n');
  console.log(`📍 URL: ${url}`);
  console.log(`🔑 Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
  console.log(`🏢 Org ID: ${orgId || 'MISSING'}\n`);
  
  // Prova 1: Con X-Axiom-Org-Id (standard)
  console.log('📤 Prova 1: Con header X-Axiom-Org-Id...');
  try {
    const r1 = await axios.post(url, [testEvent], {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': orgId
      },
      timeout: 30000
    });
    console.log('✅ SUCCESSO!', r1.status);
    return;
  } catch (e1) {
    console.log(`❌ ${e1.response?.status || e1.message}`);
  }
  
  // Prova 2: Senza X-Axiom-Org-Id
  console.log('\n📤 Prova 2: Senza header X-Axiom-Org-Id...');
  try {
    const r2 = await axios.post(url, [testEvent], {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    console.log('✅ SUCCESSO!', r2.status);
    return;
  } catch (e2) {
    console.log(`❌ ${e2.response?.status || e2.message}`);
  }
  
  // Prova 3: Con orgId nell'URL
  console.log('\n📤 Prova 3: Con orgId nell\'URL...');
  try {
    const urlWithOrg = `${AXIOM_BASE_URL}/v1/datasets/${dataset}/ingest?orgId=${orgId}`;
    const r3 = await axios.post(urlWithOrg, [testEvent], {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    console.log('✅ SUCCESSO!', r3.status);
    return;
  } catch (e3) {
    console.log(`❌ ${e3.response?.status || e3.message}`);
  }
  
  // Prova 4: Verifica se il problema è il dataset
  console.log('\n📤 Prova 4: Verifica dataset "real-time"...');
  try {
    const urlRealtime = `${AXIOM_BASE_URL}/v1/datasets/real-time/ingest`;
    const r4 = await axios.post(urlRealtime, [testEvent], {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': orgId
      },
      timeout: 30000
    });
    console.log('✅ SUCCESSO con real-time!', r4.status);
    console.log('💡 Il problema potrebbe essere con il dataset "centralized_logs"');
    return;
  } catch (e4) {
    console.log(`❌ ${e4.response?.status || e4.message}`);
  }
  
  console.log('\n❌ Tutte le prove fallite. Il problema è sicuramente con il token o i permessi.');
}

testVarianti();



