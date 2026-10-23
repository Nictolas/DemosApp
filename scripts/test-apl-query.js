// Script per testare diversi formati di query APL
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_API_DOMAIN = AXIOM_REGION === 'eu' ? 'api.eu.axiom.co' : 'api.axiom.co';
const AXIOM_API_URL = `https://${AXIOM_API_DOMAIN}`;

async function testAPLQueries() {
  console.log('🔍 Test diversi formati di query APL...\n');
  console.log(`📍 API URL: ${AXIOM_API_URL}`);
  console.log('Token Axiom configurato:', Boolean(process.env.AXIOM_API_TOKEN));
  console.log(`🏢 Org ID: ${process.env.AXIOM_ORG_ID || 'NON CONFIGURATO'}\n`);
  
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  
  // Test 1: Formato attuale
  console.log('📊 Test 1: Formato attuale (apl nel body)');
  try {
    const response = await axios.post(
      `${AXIOM_API_URL}/v1/datasets/_apl`,
      { apl: `['${dataset}'] | summarize count()` },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 30000
      }
    );
    console.log('   ✅ Successo!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`   ❌ Errore ${error.response?.status}:`, error.response?.data || error.message);
  }
  
  // Test 2: Con formato tabular
  console.log('\n📊 Test 2: Con parametro format=tabular');
  try {
    const response = await axios.post(
      `${AXIOM_API_URL}/v1/datasets/_apl?format=tabular`,
      { apl: `['${dataset}'] | summarize count()` },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 30000
      }
    );
    console.log('   ✅ Successo!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`   ❌ Errore ${error.response?.status}:`, error.response?.data || error.message);
  }
  
  // Test 3: Query diretta nel body senza oggetto apl
  console.log('\n📊 Test 3: Query diretta nel body');
  try {
    const response = await axios.post(
      `${AXIOM_API_URL}/v1/datasets/_apl`,
      { query: `['${dataset}'] | summarize count()` },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 30000
      }
    );
    console.log('   ✅ Successo!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`   ❌ Errore ${error.response?.status}:`, error.response?.data || error.message);
  }
  
  // Test 4: Endpoint alternativo /v1/query
  console.log('\n📊 Test 4: Endpoint alternativo /v1/query');
  try {
    const response = await axios.post(
      `${AXIOM_API_URL}/v1/query`,
      { 
        apl: `['${dataset}'] | summarize count()`,
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString()
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 30000
      }
    );
    console.log('   ✅ Successo!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`   ❌ Errore ${error.response?.status}:`, error.response?.data || error.message);
  }
  
  // Test 5: Endpoint dataset specifico
  console.log('\n📊 Test 5: Endpoint dataset specifico');
  try {
    const response = await axios.post(
      `${AXIOM_API_URL}/v1/datasets/${dataset}/query`,
      { 
        apl: `['${dataset}'] | summarize count()`
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 30000
      }
    );
    console.log('   ✅ Successo!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error(`   ❌ Errore ${error.response?.status}:`, error.response?.data || error.message);
  }
}

testAPLQueries();

