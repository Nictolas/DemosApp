/**
 * Script per testare l'invio di log GDPR-compliant ad Axiom
 * Verifica che tutti i 6 campi obbligatori vengano inviati correttamente
 */

require('dotenv').config();
const axios = require('axios');

const AXIOM_API_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_ORG_ID = process.env.AXIOM_ORG_ID;
const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_DATASET = process.env.AXIOM_DATASET || 'centralized_logs';

if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
  console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
  process.exit(1);
}

const region = AXIOM_REGION.toLowerCase();
const edgeDomain = process.env.AXIOM_EDGE_DOMAIN 
  || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
const url = `https://${edgeDomain}/v1/ingest/${AXIOM_DATASET}`;

// Crea un log di test con TUTTI i 6 campi GDPR obbligatori
const testLog = {
  _time: new Date().toISOString(),
  message: 'TEST: Verifica campi GDPR obbligatori',
  user_id: 'test-user-id-12345',  // Valore di test (non null)
  ip_address: '192.168.1.100',     // Valore di test (non null)
  endpoint: '/api/test/gdpr-fields', // Valore di test (non null)
  session_id: 'test-session-12345'   // Valore di test (non null)
};

// Crea anche un log con valori null per verificare che i campi vengano comunque inviati
const testLogNull = {
  _time: new Date().toISOString(),
  message: 'TEST: Verifica campi GDPR con valori null',
  user_id: null,      // null per verificare che il campo venga comunque inviato
  ip_address: null,   // null per verificare che il campo venga comunque inviato
  endpoint: null,     // null per verificare che il campo venga comunque inviato
  session_id: null    // null per verificare che il campo venga comunque inviato
};

async function testAxiomIngest() {
  console.log('🧪 Test invio log GDPR-compliant ad Axiom\n');
  console.log('📋 Configurazione:');
  console.log(`   Dataset: ${AXIOM_DATASET}`);
  console.log(`   Region: ${AXIOM_REGION}`);
  console.log(`   URL: ${url}\n`);

  console.log('📤 Log 1 (con valori):');
  console.log(JSON.stringify(testLog, null, 2));
  console.log('\n📤 Log 2 (con valori null):');
  console.log(JSON.stringify(testLogNull, null, 2));
  console.log('\n');

  try {
    // Invia entrambi i log
    const response = await axios.post(url, [testLog, testLogNull], {
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': AXIOM_ORG_ID
      },
      timeout: 10000
    });

    console.log('✅ Log inviati con successo!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    console.log('\n⏳ Attendi 10-30 secondi per l\'indicizzazione su Axiom...');
    console.log('📊 Poi verifica su Axiom Dashboard → Stream → centralized_logs');
    console.log('   Cerca i log con message contenente "TEST: Verifica campi GDPR"');
    console.log('   Verifica che entrambi i log abbiano tutti e 6 i campi:');
    console.log('   - _time');
    console.log('   - message');
    console.log('   - user_id');
    console.log('   - ip_address');
    console.log('   - endpoint');
    console.log('   - session_id');

  } catch (error) {
    console.error('❌ Errore invio log:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testAxiomIngest();

