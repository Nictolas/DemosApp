/**
 * Script per testare l'invio di log GDPR-compliant al dataset real-time
 * Questo script invia alcuni log di esempio per verificare che i campi appaiano su Axiom
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Configurazione
const AXIOM_API_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_ORG_ID = process.env.AXIOM_ORG_ID;
const AXIOM_REGION = (process.env.AXIOM_REGION || 'eu').toLowerCase();
const DATASET_NAME = process.env.AXIOM_REALTIME_DATASET || 'real-time';

/**
 * Genera session_id per coerenza con centralized_logs
 */
function generateSessionId(userId) {
  const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const sessionKey = `${userId}-${timeWindow}`;
  const sessionId = crypto
    .createHash('sha256')
    .update(sessionKey)
    .digest('hex')
    .substring(0, 16);
  return `audit_${sessionId}`;
}

/**
 * Invia audit log di esempio
 */
async function sendTestAuditLog() {
  console.log('📤 Invio audit log di esempio...');
  
  const userId = 'test-user-' + crypto.randomUUID().substring(0, 8);
  const sessionId = generateSessionId(userId);
  
  const auditLog = {
    _time: new Date().toISOString(),
    user_id: userId,
    ip_address: '192.168.1.100',
    action: 'DATA_ACCESS',
    resource: 'users',
    resource_id: 'user-123',
    success: true,
    error_message: null,
    session_id: sessionId
  };
  
  await sendToAxiom([auditLog]);
  console.log('✅ Audit log inviato');
  console.log('   Campi:', Object.keys(auditLog).join(', '));
}

/**
 * Invia security event di esempio
 */
async function sendTestSecurityEvent() {
  console.log('📤 Invio security event di esempio...');
  
  const userId = 'test-user-' + crypto.randomUUID().substring(0, 8);
  const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const sessionKey = `${userId}-${timeWindow}`;
  const sessionId = crypto
    .createHash('sha256')
    .update(sessionKey)
    .digest('hex')
    .substring(0, 16);
  
  const securityEvent = {
    _time: new Date().toISOString(),
    user_id: userId,
    ip_address: '192.168.1.200',
    type: 'UNAUTHORIZED_ACCESS',
    severity: 'high',
    details: {
      message: 'Tentativo di accesso non autorizzato',
      endpoint: '/api/admin/users'
    },
    session_id: `security_${sessionId}`
  };
  
  await sendToAxiom([securityEvent]);
  console.log('✅ Security event inviato');
  console.log('   Campi:', Object.keys(securityEvent).join(', '));
}

/**
 * Invia log ad Axiom
 */
async function sendToAxiom(events) {
  const region = AXIOM_REGION;
  const edgeDomain = region === 'eu' 
    ? 'eu-central-1.aws.edge.axiom.co' 
    : 'us-east-1.aws.edge.axiom.co';
  const url = `https://${edgeDomain}/v1/ingest/${DATASET_NAME}`;
  
  try {
    const response = await axios.post(url, events, {
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': AXIOM_ORG_ID
      },
      timeout: 10000
    });
    
    console.log('   ✅ Status:', response.status);
    if (response.data) {
      console.log('   📊 Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('   ❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Verifica i campi presenti su Axiom usando API REST
 */
async function checkFields() {
  console.log('\n🔍 Verifica campi su Axiom...');
  
  const region = AXIOM_REGION;
  const edgeDomain = region === 'eu' 
    ? 'eu-central-1.aws.edge.axiom.co' 
    : 'us-east-1.aws.edge.axiom.co';
  const url = `https://${edgeDomain}/v1/datasets/${DATASET_NAME}/query`;
  
  try {
    const query = {
      apl: `['${DATASET_NAME}'] | limit 1`,
      startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Ultima ora
      endTime: new Date().toISOString()
    };
    
    const response = await axios.post(url, query, {
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Axiom-Org-Id': AXIOM_ORG_ID
      },
      timeout: 10000
    });
    
    if (response.data.matches && response.data.matches.length > 0) {
      const record = response.data.matches[0];
      console.log('✅ Record trovato');
      console.log('   Campi presenti:', Object.keys(record).join(', '));
      console.log('\n   Contenuto record:');
      console.log(JSON.stringify(record, null, 2));
    } else {
      console.log('⚠️  Nessun record trovato (potrebbe essere un problema di indexing delay)');
      console.log('   Attendi qualche minuto e riprova');
      console.log('   Oppure vai su Axiom Dashboard → Dataset real-time → Query');
    }
  } catch (error) {
    console.log('⚠️  Errore durante verifica (normale se c\'è indexing delay):', error.message);
    console.log('   I log sono stati inviati correttamente, attendi qualche minuto');
  }
}

/**
 * Main
 */
async function main() {
  console.log('🧪 Test invio log GDPR-compliant al dataset real-time\n');
  
  if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
    console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
    process.exit(1);
  }
  
  try {
    // 1. Invia audit log
    await sendTestAuditLog();
    console.log('');
    
    // 2. Invia security event
    await sendTestSecurityEvent();
    console.log('');
    
    // 3. Attendi qualche secondo per l'indexing
    console.log('⏳ Attesa 5 secondi per l\'indexing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Verifica campi
    await checkFields();
    
    console.log('\n✅ Test completato!');
    console.log('\n📝 Prossimi passi:');
    console.log('   1. Vai su Axiom Dashboard → Dataset real-time → Fields');
    console.log('   2. Dovresti vedere i campi GDPR-obbligatori');
    console.log('   3. Se non li vedi, attendi qualche minuto (indexing delay)');
  } catch (error) {
    console.error('\n❌ Errore durante test:', error.message);
    process.exit(1);
  }
}

// Esegui
if (require.main === module) {
  main();
}

module.exports = { sendTestAuditLog, sendTestSecurityEvent };

