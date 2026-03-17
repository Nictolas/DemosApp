/**
 * Script per inserire record GDPR-compliant nel dataset real-time ricreato
 * 
 * Questo script inserisce record di esempio con SOLO campi GDPR-obbligatori
 * per verificare che il dataset funzioni correttamente.
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
 * Genera session_id per audit logs
 */
function generateAuditSessionId(userId) {
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
 * Genera session_id per security events
 */
function generateSecuritySessionId(userId) {
  const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const sessionKey = `${userId}-${timeWindow}`;
  const sessionId = crypto
    .createHash('sha256')
    .update(sessionKey)
    .digest('hex')
    .substring(0, 16);
  return `security_${sessionId}`;
}

/**
 * Crea audit log GDPR-compliant
 */
function createAuditLog(userId, action, resource, resourceId, success, errorMessage = null) {
  return {
    _time: new Date().toISOString(),
    user_id: userId,
    ip_address: '192.168.1.100',
    action: action,
    resource: resource,
    resource_id: resourceId,
    success: success,
    error_message: errorMessage,
    session_id: generateAuditSessionId(userId)
  };
}

/**
 * Crea security event GDPR-compliant
 */
function createSecurityEvent(userId, type, severity, message) {
  return {
    _time: new Date().toISOString(),
    user_id: userId,
    ip_address: '192.168.1.200',
    type: type,
    severity: severity,
    details: message ? { message: message } : null,
    session_id: generateSecuritySessionId(userId)
  };
}

/**
 * Invia record ad Axiom
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
    
    return {
      success: true,
      ingested: response.data?.ingested || events.length,
      failed: response.data?.failed || 0
    };
  } catch (error) {
    console.error('   ❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Inserimento record GDPR-compliant nel dataset real-time\n');
  
  if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
    console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
    process.exit(1);
  }
  
  try {
    // Crea record GDPR-compliant di esempio
    const records = [];
    
    // Audit logs GDPR-compliant
    console.log('📝 Creazione audit logs GDPR-compliant...');
    const userId1 = 'user-' + crypto.randomUUID().substring(0, 8);
    records.push(createAuditLog(userId1, 'DATA_ACCESS', 'users', 'user-123', true));
    records.push(createAuditLog(userId1, 'DATA_MODIFY', 'users', 'user-123', true));
    
    const userId2 = 'user-' + crypto.randomUUID().substring(0, 8);
    records.push(createAuditLog(userId2, 'DATA_ACCESS', 'votes', 'vote-456', true));
    records.push(createAuditLog(userId2, 'DATA_DELETE', 'opinions', 'opinion-789', false, 'Permission denied'));
    
    console.log(`   ✅ Creati ${records.length} audit logs`);
    
    // Security events GDPR-compliant
    console.log('🔒 Creazione security events GDPR-compliant...');
    const userId3 = 'user-' + crypto.randomUUID().substring(0, 8);
    records.push(createSecurityEvent(userId3, 'UNAUTHORIZED_ACCESS', 'high', 'Tentativo di accesso non autorizzato'));
    records.push(createSecurityEvent(userId3, 'SUSPICIOUS_REQUEST', 'medium', 'Richiesta sospetta rilevata'));
    
    const userId4 = 'user-' + crypto.randomUUID().substring(0, 8);
    records.push(createSecurityEvent(userId4, 'FAILED_LOGIN', 'low', 'Tentativo di login fallito'));
    
    console.log(`   ✅ Creati ${records.length - 4} security events`);
    console.log(`\n📊 Totale record da inserire: ${records.length}\n`);
    
    // Mostra esempio di record
    console.log('📋 Esempio audit log:');
    console.log(JSON.stringify(records[0], null, 2));
    console.log('\n📋 Esempio security event:');
    console.log(JSON.stringify(records[4], null, 2));
    console.log('');
    
    // Verifica campi presenti
    console.log('🔍 Verifica campi GDPR-obbligatori:');
    const auditLog = records[0];
    const securityEvent = records[4];
    
    console.log('\n   Audit Log campi:');
    console.log(`   ✅ _time: ${auditLog._time ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ user_id: ${auditLog.user_id ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ ip_address: ${auditLog.ip_address ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ action: ${auditLog.action ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ resource: ${auditLog.resource ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ resource_id: ${auditLog.resource_id ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ success: ${auditLog.success !== undefined ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ error_message: ${auditLog.error_message !== undefined ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ session_id: ${auditLog.session_id ? 'presente' : 'MANCANTE'}`);
    
    console.log('\n   Security Event campi:');
    console.log(`   ✅ _time: ${securityEvent._time ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ user_id: ${securityEvent.user_id ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ ip_address: ${securityEvent.ip_address ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ type: ${securityEvent.type ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ severity: ${securityEvent.severity ? 'presente' : 'MANCANTE'}`);
    console.log(`   ✅ details: ${securityEvent.details ? 'presente (solo message)' : 'null'}`);
    console.log(`   ✅ session_id: ${securityEvent.session_id ? 'presente' : 'MANCANTE'}`);
    
    // Verifica che NON ci siano campi non GDPR
    const nonGDPRFields = [];
    records.forEach(record => {
      Object.keys(record).forEach(key => {
        if (!['_time', 'user_id', 'ip_address', 'action', 'resource', 'resource_id', 'success', 'error_message', 'session_id', 'type', 'severity', 'details'].includes(key)) {
          if (!nonGDPRFields.includes(key)) {
            nonGDPRFields.push(key);
          }
        }
      });
    });
    
    if (nonGDPRFields.length > 0) {
      console.log(`\n   ⚠️  Campi non GDPR trovati: ${nonGDPRFields.join(', ')}`);
    } else {
      console.log(`\n   ✅ Nessun campo non GDPR trovato`);
    }
    
    // Verifica che details contenga solo message
    records.forEach((record, index) => {
      if (record.details && typeof record.details === 'object') {
        const detailsKeys = Object.keys(record.details);
        const nonMessageKeys = detailsKeys.filter(k => k !== 'message');
        if (nonMessageKeys.length > 0) {
          console.log(`\n   ⚠️  Record #${index + 1}: details contiene campi non GDPR: ${nonMessageKeys.join(', ')}`);
        }
      }
    });
    
    console.log('\n📤 Invio record ad Axiom...');
    const result = await sendToAxiom(records);
    
    if (result.success) {
      console.log(`\n✅ Record inseriti con successo!`);
      console.log(`   ✅ Ingestati: ${result.ingested}`);
      console.log(`   ❌ Falliti: ${result.failed}`);
      
      console.log('\n📝 Prossimi passi:');
      console.log('   1. Attendi 2-5 minuti per l\'indexing');
      console.log('   2. Vai su Axiom Dashboard → Dataset real-time → Fields');
      console.log('   3. Verifica che ci siano solo campi GDPR-obbligatori:');
      console.log('      - Audit logs: _time, user_id, ip_address, action, resource, resource_id, success, error_message, session_id');
      console.log('      - Security events: _time, user_id, ip_address, type, severity, details (solo message), session_id');
      console.log('   4. Verifica che NON ci siano: details.endpoint, details.url, log_type, user_agent, user_email');
    } else {
      console.error(`\n❌ Errore durante inserimento: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    process.exit(1);
  }
}

// Esegui
if (require.main === module) {
  main();
}

module.exports = { createAuditLog, createSecurityEvent };

