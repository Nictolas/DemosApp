// Script per verificare i record migrati su Axiom
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

async function verifyMigratedRecords() {
  const dataset = 'centralized_logs';
  
  console.log('🔍 Verifica record migrati su Axiom\n');
  
  try {
    // Estrai alcuni record (primi per _time)
    console.log('📊 Estrazione primi 5 record (ordinati per _time)...');
    const query = `['${dataset}'] | limit 5`;
    const result = await axiomClient.query(query, {
      startTime: new Date('2025-10-01'),
      endTime: new Date('2025-12-12')
    });
    
    let records = [];
    if (result.matches && Array.isArray(result.matches)) {
      records = result.matches;
    } else if (result.buckets && Array.isArray(result.buckets)) {
      records = result.buckets.flatMap(b => b.rows || b.data || []);
    } else if (result.data?.rows && Array.isArray(result.data.rows)) {
      records = result.data.rows;
    } else if (result.rows && Array.isArray(result.rows)) {
      records = result.rows;
    }
    
    console.log(`✅ Trovati ${records.length} record\n`);
    
    if (records.length > 0) {
      records.forEach((record, idx) => {
        const data = record.data || record;
        console.log(`Record ${idx + 1}:`);
        console.log(`   _time: ${record._time || data._time}`);
        console.log(`   level: ${data.level}`);
        console.log(`   message: ${(data.message || '').substring(0, 50)}...`);
        console.log(`   log_type: ${data.log_type || 'N/A'}`);
        console.log(`   user_id: ${data.user_id || 'null'}`);
        console.log(`   ip_address: ${data.ip_address || 'null'}`);
        console.log(`   endpoint: ${data.endpoint || 'null'}`);
        console.log(`   session_id: ${data.session_id || 'null'}`);
        console.log(`   user_agent: ${data.user_agent ? (data.user_agent.substring(0, 30) + '...') : 'null'}`);
        console.log(`   request_id: ${data.request_id ? '❌ PRESENTE (NON GDPR!)' : '✅ assente (corretto)'}`);
        
        // Verifica campi non GDPR
        const nonGDPRFields = ['pid', 'hostname', 'freed', 'afterGC', 'beforeGC'];
        const foundNonGDPR = nonGDPRFields.filter(f => data[f] !== undefined);
        if (foundNonGDPR.length > 0) {
          console.log(`   ⚠️ Campi non GDPR: ${foundNonGDPR.join(', ')}`);
        }
        console.log('');
      });
    }
    
    // Conteggio totale
    console.log('📊 Conteggio totale record...');
    const countQuery = `['${dataset}'] | summarize count()`;
    const countResult = await axiomClient.query(countQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let totalCount = 0;
    if (countResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      totalCount = parseInt(countResult.buckets.totals[0].aggregations[0].value);
    } else if (countResult.status?.rowsExamined) {
      totalCount = parseInt(countResult.status.rowsExamined);
    }
    
    console.log(`✅ Record totali su Axiom: ${totalCount.toLocaleString('it-IT')}\n`);
    
    // Confronto con Neon
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    const neonCountResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    const neonCount = parseInt(neonCountResult.rows[0].count);
    await pool.end();
    
    console.log(`📊 Confronto:`);
    console.log(`   Neon: ${neonCount.toLocaleString('it-IT')} record`);
    console.log(`   Axiom: ${totalCount.toLocaleString('it-IT')} record`);
    
    if (totalCount >= neonCount) {
      console.log(`\n✅ PERFETTO: Tutti i record sono stati migrati!`);
    } else {
      const diff = neonCount - totalCount;
      console.log(`\n⚠️ Mancano ${diff.toLocaleString('it-IT')} record su Axiom`);
    }
    
  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

verifyMigratedRecords()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });



