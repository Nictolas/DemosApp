/**
 * Script per verificare gli audit logs nel dataset real-time su Axiom
 */

require('dotenv').config();

const { getAuditLogs, getSecurityEvents, queryAxiom, countAxiomRecords } = require('../api/utils/axiomQueryHelper');

async function verificaAuditLogs() {
  console.log('🔍 Verifica Audit Logs nel dataset real-time\n');
  
  const dataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  
  console.log(`📅 Periodo: ${startTime.toISOString()} → ${endTime.toISOString()}\n`);
  
  // 1. Count totale nel dataset real-time
  console.log('1️⃣  Count totale nel dataset real-time:');
  try {
    const totalCount = await countAxiomRecords(dataset, { startTime, endTime });
    console.log(`   ✅ Count totale: ${totalCount}`);
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 2. Query diretta per vedere tutti i record
  console.log('\n2️⃣  Query diretta (tutti i record):');
  try {
    const query = `['${dataset}'] | order by _time desc | limit 50`;
    const allRecords = await queryAxiom(query, { startTime, endTime });
    console.log(`   ✅ Trovati ${allRecords.length} record`);
    
    // Analizza i tipi di record
    const auditLogs = [];
    const securityEvents = [];
    const other = [];
    
    allRecords.forEach(record => {
      const action = record.action || (record.data && record.data.action);
      const resource = record.resource || (record.data && record.data.resource);
      const type = record.type || (record.data && record.data.type);
      const severity = record.severity || (record.data && record.data.severity);
      
      if (action && resource) {
        auditLogs.push(record);
      } else if (type && severity) {
        securityEvents.push(record);
      } else {
        other.push(record);
      }
    });
    
    console.log(`   📊 Audit Logs: ${auditLogs.length}`);
    console.log(`   📊 Security Events: ${securityEvents.length}`);
    console.log(`   📊 Altri: ${other.length}`);
    
    if (auditLogs.length > 0) {
      console.log(`\n   📝 Primo Audit Log:`, JSON.stringify(auditLogs[0], null, 2));
    }
    if (securityEvents.length > 0) {
      console.log(`\n   📝 Primo Security Event:`, JSON.stringify(securityEvents[0], null, 2));
    }
    if (other.length > 0) {
      console.log(`\n   📝 Primo Altro:`, JSON.stringify(other[0], null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 3. getAuditLogs() - solo audit logs
  console.log('\n3️⃣  getAuditLogs() - solo audit logs:');
  try {
    const auditLogs = await getAuditLogs({
      startTime,
      endTime,
      limit: 100
    });
    console.log(`   ✅ Trovati ${auditLogs.length} audit logs`);
    
    if (auditLogs.length > 0) {
      console.log(`\n   📝 Primi 3 audit logs:`);
      auditLogs.slice(0, 3).forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. Action: ${log.action}, Resource: ${log.resource}, Success: ${log.success}`);
        console.log(`      User: ${log.user_id}, Time: ${log._time}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 4. getSecurityEvents() - solo security events
  console.log('\n4️⃣  getSecurityEvents() - solo security events:');
  try {
    const securityEvents = await getSecurityEvents({
      startTime,
      endTime,
      limit: 100
    });
    console.log(`   ✅ Trovati ${securityEvents.length} security events`);
    
    if (securityEvents.length > 0) {
      console.log(`\n   📝 Primi 3 security events:`);
      securityEvents.slice(0, 3).forEach((event, idx) => {
        console.log(`\n   ${idx + 1}. Type: ${event.type}, Severity: ${event.severity}`);
        console.log(`      User: ${event.user_id}, Time: ${event._time}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 5. Query APL per contare audit logs
  console.log('\n5️⃣  Query APL per contare audit logs (con action e resource):');
  try {
    // Prova a contare i record che hanno action e resource
    const query = `['${dataset}'] | where action != null AND resource != null | summarize count()`;
    const countResult = await queryAxiom(query, { startTime, endTime });
    console.log(`   ✅ Count audit logs (APL): ${countResult.length > 0 ? countResult[0] : 'N/A'}`);
  } catch (error) {
    console.log(`   ⚠️  Query APL fallita (normale se APL non supporta != null): ${error.message}`);
    
    // Alternativa: conta tutti e filtra lato server
    console.log(`\n   🔄 Alternativa: conta tutti e filtra lato server...`);
    try {
      const allQuery = `['${dataset}'] | limit 1000`;
      const allRecords = await queryAxiom(allQuery, { startTime, endTime });
      const auditCount = allRecords.filter(r => {
        const action = r.action || (r.data && r.data.action);
        const resource = r.resource || (r.data && r.data.resource);
        return action && resource;
      }).length;
      console.log(`   ✅ Audit logs (filtro lato server su ${allRecords.length} record): ${auditCount}`);
    } catch (err) {
      console.log(`   ❌ Errore: ${err.message}`);
    }
  }
  
  // 6. Query APL per contare security events
  console.log('\n6️⃣  Query APL per contare security events (con type e severity):');
  try {
    const query = `['${dataset}'] | where type != null AND severity != null | summarize count()`;
    const countResult = await queryAxiom(query, { startTime, endTime });
    console.log(`   ✅ Count security events (APL): ${countResult.length > 0 ? countResult[0] : 'N/A'}`);
  } catch (error) {
    console.log(`   ⚠️  Query APL fallita (normale se APL non supporta != null): ${error.message}`);
    
    // Alternativa: conta tutti e filtra lato server
    console.log(`\n   🔄 Alternativa: conta tutti e filtra lato server...`);
    try {
      const allQuery = `['${dataset}'] | limit 1000`;
      const allRecords = await queryAxiom(allQuery, { startTime, endTime });
      const securityCount = allRecords.filter(r => {
        const type = r.type || (r.data && r.data.type);
        const severity = r.severity || (r.data && r.data.severity);
        return type && severity;
      }).length;
      console.log(`   ✅ Security events (filtro lato server su ${allRecords.length} record): ${securityCount}`);
    } catch (err) {
      console.log(`   ❌ Errore: ${err.message}`);
    }
  }
}

verificaAuditLogs().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

