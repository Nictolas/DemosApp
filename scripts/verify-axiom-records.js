// Script per verificare i record su Axiom con query diverse
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
  console.log('✅ SDK Axiom inizializzato\n');
} catch (sdkErr) {
  console.error('❌ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

async function verifyAxiomRecords() {
  const dataset = 'centralized_logs';
  
  console.log('🔍 Verifica record su Axiom con query multiple\n');
  
  try {
    // Query 1: Conteggio semplice
    console.log('📊 Query 1: Conteggio semplice...');
    const countQuery1 = `['${dataset}'] | summarize count()`;
    const result1 = await axiomClient.query(countQuery1, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let count1 = 0;
    if (result1.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      count1 = parseInt(result1.buckets.totals[0].aggregations[0].value);
    } else if (result1.status?.rowsExamined) {
      count1 = parseInt(result1.status.rowsExamined);
    }
    console.log(`   Risultato: ${count1.toLocaleString('it-IT')} record\n`);
    
    // Query 2: Conteggio per log_type
    console.log('📊 Query 2: Conteggio per log_type...');
    const countQuery2 = `['${dataset}'] | summarize count() by log_type`;
    const result2 = await axiomClient.query(countQuery2, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    console.log('   Risultato:');
    if (result2.buckets && Array.isArray(result2.buckets)) {
      result2.buckets.forEach(bucket => {
        const logType = bucket.groupBy?.log_type || 'unknown';
        const count = bucket.aggregations?.[0]?.value || 0;
        console.log(`     - ${logType}: ${parseInt(count).toLocaleString('it-IT')} record`);
      });
    }
    console.log('');
    
    // Query 3: Estrai alcuni record recenti
    console.log('📊 Query 3: Estrazione record recenti (ultimi 10)...');
    const recentQuery = `['${dataset}'] | order by _time desc | limit 10`;
    const result3 = await axiomClient.query(recentQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let recentRecords = [];
    if (result3.matches && Array.isArray(result3.matches)) {
      recentRecords = result3.matches;
    } else if (result3.buckets && Array.isArray(result3.buckets)) {
      recentRecords = result3.buckets.flatMap(b => b.rows || b.data || []);
    } else if (result3.data?.rows && Array.isArray(result3.data.rows)) {
      recentRecords = result3.data.rows;
    } else if (result3.rows && Array.isArray(result3.rows)) {
      recentRecords = result3.rows;
    }
    
    console.log(`   Trovati ${recentRecords.length} record recenti`);
    if (recentRecords.length > 0) {
      const first = recentRecords[0];
      const data = first.data || first;
      console.log(`   Primo record:`);
      console.log(`     _time: ${first._time || data._time}`);
      console.log(`     level: ${data.level}`);
      console.log(`     message: ${(data.message || '').substring(0, 60)}...`);
      console.log(`     log_type: ${data.log_type}`);
      console.log(`     user_id: ${data.user_id || 'null'}`);
      console.log(`     endpoint: ${data.endpoint || 'null'}`);
      console.log(`     session_id: ${data.session_id || 'null'}`);
      console.log(`     request_id: ${data.request_id ? 'PRESENTE (NON GDPR!)' : 'assente'}`);
    }
    console.log('');
    
    // Query 4: Estrai alcuni record vecchi (per verificare se i migrati ci sono)
    console.log('📊 Query 4: Estrazione record vecchi (primi 10 per _time)...');
    const oldQuery = `['${dataset}'] | order by _time asc | limit 10`;
    const result4 = await axiomClient.query(oldQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let oldRecords = [];
    if (result4.matches && Array.isArray(result4.matches)) {
      oldRecords = result4.matches;
    } else if (result4.buckets && Array.isArray(result4.buckets)) {
      oldRecords = result4.buckets.flatMap(b => b.rows || b.data || []);
    } else if (result4.data?.rows && Array.isArray(result4.data.rows)) {
      oldRecords = result4.data.rows;
    } else if (result4.rows && Array.isArray(result4.rows)) {
      oldRecords = result4.rows;
    }
    
    console.log(`   Trovati ${oldRecords.length} record vecchi`);
    if (oldRecords.length > 0) {
      const first = oldRecords[0];
      const data = first.data || first;
      console.log(`   Primo record (più vecchio):`);
      console.log(`     _time: ${first._time || data._time}`);
      console.log(`     level: ${data.level}`);
      console.log(`     message: ${(data.message || '').substring(0, 60)}...`);
      console.log(`     log_type: ${data.log_type}`);
      console.log(`     user_id: ${data.user_id || 'null'}`);
      console.log(`     endpoint: ${data.endpoint || 'null'}`);
      console.log(`     session_id: ${data.session_id || 'null'}`);
      console.log(`     request_id: ${data.request_id ? 'PRESENTE (NON GDPR!)' : 'assente'}`);
    }
    
  } catch (error) {
    console.error('\n❌ Errore durante la verifica:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

verifyAxiomRecords()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });


