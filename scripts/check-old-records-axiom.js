// Script per verificare se ci sono record vecchi su Axiom (migrati)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let Axiom;
let axiomClient;

try {
  Axiom = require('@axiomhq/axiom-node');
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  axiomClient = new Axiom.Client({
    token: process.env.AXIOM_API_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
    region: region
  });
} catch (sdkErr) {
  console.error('❌ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

async function checkOldRecords() {
  const dataset = 'centralized_logs';
  
  console.log('🔍 Verifica record vecchi su Axiom (migrati)\n');
  
  try {
    // Query per record più vecchi di oggi (i migrati dovrebbero essere vecchi)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    console.log(`📊 Query record più vecchi di ${yesterday.toISOString()}...`);
    const oldQuery = `['${dataset}'] | summarize count()`;
    const oldResult = await axiomClient.query(oldQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: yesterday
    });
    
    let oldCount = 0;
    if (oldResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      oldCount = parseInt(oldResult.buckets.totals[0].aggregations[0].value);
    } else if (oldResult.status?.rowsExamined) {
      oldCount = parseInt(oldResult.status.rowsExamined);
    }
    
    console.log(`✅ Record vecchi (prima di ieri): ${oldCount.toLocaleString('it-IT')}\n`);
    
    // Query per record di oggi (log real-time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📊 Query record di oggi (${today.toISOString()})...`);
    const todayQuery = `['${dataset}'] | summarize count()`;
    const todayResult = await axiomClient.query(todayQuery, {
      startTime: today,
      endTime: new Date()
    });
    
    let todayCount = 0;
    if (todayResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      todayCount = parseInt(todayResult.buckets.totals[0].aggregations[0].value);
    } else if (todayResult.status?.rowsExamined) {
      todayCount = parseInt(todayResult.status.rowsExamined);
    }
    
    console.log(`✅ Record di oggi (real-time): ${todayCount.toLocaleString('it-IT')}\n`);
    
    // Estrai alcuni record vecchi di esempio
    console.log('📊 Estrazione record vecchi di esempio (primi 5)...');
    const sampleOldQuery = `['${dataset}'] | order by _time asc | limit 5`;
    const sampleOldResult = await axiomClient.query(sampleOldQuery, {
      startTime: new Date('2025-10-01'), // Inizio ottobre (i record migrati dovrebbero essere più vecchi)
      endTime: yesterday
    });
    
    let sampleOlds = [];
    if (sampleOldResult.matches && Array.isArray(sampleOldResult.matches)) {
      sampleOlds = sampleOldResult.matches;
    } else if (sampleOldResult.buckets && Array.isArray(sampleOldResult.buckets)) {
      sampleOlds = sampleOldResult.buckets.flatMap(b => b.rows || b.data || []);
    } else if (sampleOldResult.data?.rows && Array.isArray(sampleOldResult.data.rows)) {
      sampleOlds = sampleOldResult.data.rows;
    } else if (sampleOldResult.rows && Array.isArray(sampleOldResult.rows)) {
      sampleOlds = sampleOldResult.rows;
    }
    
    if (sampleOlds.length > 0) {
      console.log(`✅ Trovati ${sampleOlds.length} record vecchi di esempio:\n`);
      sampleOlds.forEach((sampleOld, idx) => {
        const data = sampleOld.data || sampleOld;
        console.log(`Record ${idx + 1}:`);
        console.log(`   _time: ${sampleOld._time || data._time}`);
        console.log(`   level: ${data.level}`);
        console.log(`   message: ${(data.message || '').substring(0, 50)}...`);
        console.log(`   log_type: ${data.log_type || 'N/A'}`);
        console.log(`   user_id: ${data.user_id || 'null'}`);
        console.log(`   ip_address: ${data.ip_address || 'null'}`);
        console.log(`   endpoint: ${data.endpoint || 'null'}`);
        console.log(`   session_id: ${data.session_id || 'null'}`);
        console.log(`   user_agent: ${data.user_agent ? (data.user_agent.substring(0, 30) + '...') : 'null'}`);
        console.log(`   request_id: ${data.request_id ? '❌ PRESENTE (NON GDPR!)' : '✅ assente (corretto)'}`);
        console.log('');
      });
      
      // Verifica campi non GDPR
      const nonGDPRFields = ['pid', 'hostname', 'freed', 'afterGC', 'beforeGC'];
      const foundNonGDPR = [];
      sampleOlds.forEach(sampleOld => {
        const data = sampleOld.data || sampleOld;
        nonGDPRFields.forEach(field => {
          if (data[field] !== undefined && !foundNonGDPR.includes(field)) {
            foundNonGDPR.push(field);
          }
        });
      });
      
      if (foundNonGDPR.length > 0) {
        console.log(`⚠️ ATTENZIONE: Campi non GDPR trovati: ${foundNonGDPR.join(', ')}`);
      } else {
        console.log(`✅ Nessun campo non GDPR trovato (pulizia corretta)`);
      }
    } else {
      console.log('⚠️ Nessun record vecchio trovato');
    }
    
  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

checkOldRecords()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });

