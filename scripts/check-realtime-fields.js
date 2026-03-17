/**
 * Script per verificare tutti i campi presenti nel dataset real-time su Axiom
 */

require('dotenv').config();

// Configurazione
const AXIOM_API_TOKEN = process.env.AXIOM_API_TOKEN;
const AXIOM_ORG_ID = process.env.AXIOM_ORG_ID;
const AXIOM_REGION = (process.env.AXIOM_REGION || 'eu').toLowerCase();
const DATASET_NAME = process.env.AXIOM_REALTIME_DATASET || 'real-time';

/**
 * Verifica i campi presenti su Axiom
 */
async function checkAllFields() {
  console.log('🔍 Verifica campi nel dataset real-time...\n');
  
  const Axiom = require('@axiomhq/axiom-node');
  const axiom = new Axiom.Client({
    token: AXIOM_API_TOKEN,
    orgId: AXIOM_ORG_ID,
    region: AXIOM_REGION
  });
  
  try {
    const query = `['${DATASET_NAME}'] | limit 20`;
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Ultime 24 ore
    const endTime = new Date();
    
    const response = await axiom.query(query, {
      startTime,
      endTime
    });
    
    if (response.matches && response.matches.length > 0) {
      console.log(`✅ Trovati ${response.matches.length} record\n`);
      
      // Raccogli tutti i campi unici
      const allFields = new Set();
      const auditLogs = [];
      const securityEvents = [];
      
      response.matches.forEach((record, index) => {
        // I dati possono essere in record.data (se inviati come array) o direttamente in record
        let actualRecord = record;
        if (record.data) {
          try {
            actualRecord = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
          } catch (e) {
            actualRecord = record;
          }
        }
        
        // Raccogli tutti i campi
        Object.keys(actualRecord).forEach(field => {
          if (!field.startsWith('_')) { // Escludi campi di sistema
            allFields.add(field);
          }
        });
        
        // Classifica per tipo
        if (actualRecord.action !== undefined || actualRecord.resource !== undefined) {
          auditLogs.push({ index, record: actualRecord });
        } else if (actualRecord.type !== undefined && actualRecord.severity !== undefined) {
          securityEvents.push({ index, record: actualRecord });
        }
      });
      
      console.log('📊 Campi trovati nel dataset:');
      console.log('─'.repeat(50));
      Array.from(allFields).sort().forEach(field => {
        console.log(`   • ${field}`);
      });
      console.log('─'.repeat(50));
      console.log(`\n📋 Totale campi: ${allFields.size}\n`);
      
      // Analizza audit logs
      if (auditLogs.length > 0) {
        console.log(`🔍 Audit Logs trovati: ${auditLogs.length}`);
        console.log('─'.repeat(50));
        auditLogs.forEach(({ index, record }) => {
          console.log(`\n   Record #${index + 1}:`);
          console.log(`   • _time: ${record._time || '<nil>'}`);
          console.log(`   • user_id: ${record.user_id || '<nil>'}`);
          console.log(`   • ip_address: ${record.ip_address || '<nil>'}`);
          console.log(`   • action: ${record.action || '<nil>'}`);
          console.log(`   • resource: ${record.resource || '<nil>'}`);
          console.log(`   • resource_id: ${record.resource_id || '<nil>'}`);
          console.log(`   • success: ${record.success !== undefined ? record.success : '<nil>'}`);
          console.log(`   • error_message: ${record.error_message || '<nil>'}`);
          console.log(`   • session_id: ${record.session_id || '<nil>'}`);
          
          // Verifica campi non GDPR
          const nonGDPRFields = [];
          if (record.log_type) nonGDPRFields.push('log_type');
          if (record.type && record.action) nonGDPRFields.push('type (duplicato)');
          if (record.user_agent) nonGDPRFields.push('user_agent');
          if (record.details && typeof record.details === 'object') {
            const detailsKeys = Object.keys(record.details);
            if (detailsKeys.length > 0) {
              nonGDPRFields.push(`details.* (${detailsKeys.join(', ')})`);
            }
          }
          
          if (nonGDPRFields.length > 0) {
            console.log(`   ⚠️  Campi non GDPR: ${nonGDPRFields.join(', ')}`);
          } else {
            console.log(`   ✅ Solo campi GDPR-obbligatori`);
          }
        });
        console.log('\n');
      }
      
      // Analizza security events
      if (securityEvents.length > 0) {
        console.log(`🔒 Security Events trovati: ${securityEvents.length}`);
        console.log('─'.repeat(50));
        securityEvents.forEach(({ index, record }) => {
          console.log(`\n   Record #${index + 1}:`);
          console.log(`   • _time: ${record._time || '<nil>'}`);
          console.log(`   • user_id: ${record.user_id || '<nil>'}`);
          console.log(`   • ip_address: ${record.ip_address || '<nil>'}`);
          console.log(`   • type: ${record.type || '<nil>'}`);
          console.log(`   • severity: ${record.severity || '<nil>'}`);
          console.log(`   • session_id: ${record.session_id || '<nil>'}`);
          console.log(`   • details: ${record.details ? JSON.stringify(record.details).substring(0, 100) : '<nil>'}`);
          
          // Verifica campi non GDPR
          const nonGDPRFields = [];
          if (record.log_type) nonGDPRFields.push('log_type');
          if (record.user_email) nonGDPRFields.push('user_email');
          if (record.user_agent) nonGDPRFields.push('user_agent');
          if (record.details && typeof record.details === 'object') {
            const detailsKeys = Object.keys(record.details);
            const allowedDetailsKeys = ['message'];
            const nonAllowedKeys = detailsKeys.filter(k => !allowedDetailsKeys.includes(k));
            if (nonAllowedKeys.length > 0) {
              nonGDPRFields.push(`details.* (${nonAllowedKeys.join(', ')})`);
            }
          }
          
          if (nonGDPRFields.length > 0) {
            console.log(`   ⚠️  Campi non GDPR: ${nonGDPRFields.join(', ')}`);
          } else {
            console.log(`   ✅ Solo campi GDPR-obbligatori`);
          }
        });
        console.log('\n');
      }
      
      // Riepilogo
      console.log('📊 Riepilogo:');
      console.log('─'.repeat(50));
      console.log(`   • Audit logs: ${auditLogs.length}`);
      console.log(`   • Security events: ${securityEvents.length}`);
      console.log(`   • Altri: ${response.matches.length - auditLogs.length - securityEvents.length}`);
      
    } else {
      console.log('⚠️  Nessun record trovato');
      console.log('   Potrebbe essere un problema di indexing delay');
      console.log('   Attendi qualche minuto e riprova');
    }
  } catch (error) {
    console.error('❌ Errore durante verifica:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

/**
 * Main
 */
async function main() {
  if (!AXIOM_API_TOKEN || !AXIOM_ORG_ID) {
    console.error('❌ AXIOM_API_TOKEN e AXIOM_ORG_ID devono essere configurati');
    process.exit(1);
  }
  
  await checkAllFields();
}

// Esegui
if (require.main === module) {
  main();
}

module.exports = { checkAllFields };

