// Script per testare l'ingest su Axiom
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const axios = require('axios');

async function testIngest() {
  const dataset = 'centralized_logs';
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  const edgeDomain = process.env.AXIOM_EDGE_DOMAIN
    || (region === 'eu' ? 'eu-central-1.aws.edge.axiom.co' : 'us-east-1.aws.edge.axiom.co');
  const edgeUrl = `https://${edgeDomain}`;
  
  console.log('🧪 Test ingest su Axiom\n');
  
  // Crea un record di test (formato GDPR)
  const testRecord = {
    _time: new Date('2025-10-01T10:00:00.000Z').toISOString(),
    level: 'INFO',
    message: 'TEST MIGRATION - Questo è un record di test',
    log_type: 'application',
    user_id: 'test-user-123',
    ip_address: '192.168.1.100',
    endpoint: '/api/test',
    session_id: 'test-session-123',
    user_agent: 'Test Agent'
  };
  
  console.log('📤 Invio record di test...');
  console.log(JSON.stringify(testRecord, null, 2));
  console.log('');
  
  try {
    const response = await axios.post(
      `${edgeUrl}/v1/ingest/${dataset}`,
      [testRecord],
      {
        headers: {
          'Authorization': `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Axiom-Org-Id': process.env.AXIOM_ORG_ID
        },
        timeout: 60000
      }
    );
    
    console.log(`✅ Record inviato con successo!`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, response.data);
    
    // Attendi qualche secondo e verifica se il record è presente
    console.log('\n⏳ Attendo 5 secondi per l\'indicizzazione...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verifica se il record è presente
    const Axiom = require('@axiomhq/axiom-node');
    const axiomClient = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    
    const verifyQuery = `['${dataset}'] | where message == "TEST MIGRATION - Questo è un record di test" | limit 1`;
    const verifyResult = await axiomClient.query(verifyQuery, {
      startTime: new Date('2025-10-01'),
      endTime: new Date()
    });
    
    let found = false;
    if (verifyResult.matches && verifyResult.matches.length > 0) {
      found = true;
    } else if (verifyResult.buckets && verifyResult.buckets.length > 0) {
      const flat = verifyResult.buckets.flatMap(b => b.rows || b.data || []);
      found = flat.length > 0;
    }
    
    if (found) {
      console.log('✅ Record trovato su Axiom! L\'ingest funziona correttamente.');
    } else {
      console.log('⚠️ Record non trovato. Potrebbe essere ancora in indicizzazione.');
    }
    
  } catch (error) {
    console.error('❌ Errore durante l\'ingest:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testIngest()
  .then(() => {
    console.log('\n✅ Test completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });


