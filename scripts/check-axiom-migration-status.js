// Script per verificare lo stato della migrazione su Axiom
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

async function checkAxiomMigrationStatus() {
  console.log('🔍 Verifica stato migrazione su Axiom\n');
  
  const dataset = 'centralized_logs';
  
  try {
    // Step 1: Verifica se il dataset esiste
    console.log('📊 Step 1: Verifica esistenza dataset...');
    const datasets = await axiomClient.datasets.list();
    const datasetExists = datasets.some(ds => ds.name === dataset);
    
    if (!datasetExists) {
      console.log(`❌ Dataset ${dataset} NON esiste su Axiom`);
      console.log('   ⚠️ La migrazione non è stata completata');
      return;
    }
    
    console.log(`✅ Dataset ${dataset} esiste su Axiom\n`);
    
    // Step 2: Conta i record
    console.log('📊 Step 2: Conteggio record...');
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
    
    // Step 3: Verifica campi presenti (solo GDPR)
    console.log('📊 Step 3: Verifica campi presenti (solo GDPR)...');
    const sampleQuery = `['${dataset}'] | limit 10`;
    const sampleResult = await axiomClient.query(sampleQuery, {
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let sampleRecords = [];
    if (sampleResult.matches && Array.isArray(sampleResult.matches)) {
      sampleRecords = sampleResult.matches;
    } else if (sampleResult.buckets && Array.isArray(sampleResult.buckets)) {
      sampleRecords = sampleResult.buckets.flatMap(b => b.rows || b.data || []);
    } else if (sampleResult.data?.rows && Array.isArray(sampleResult.data.rows)) {
      sampleRecords = sampleResult.data.rows;
    } else if (sampleResult.rows && Array.isArray(sampleResult.rows)) {
      sampleRecords = sampleResult.rows;
    }
    
    if (sampleRecords.length > 0) {
      const firstRecord = sampleRecords[0];
      const data = firstRecord.data || firstRecord;
      const fields = Object.keys(data).filter(k => !k.startsWith('_'));
      
      console.log(`✅ Campi trovati (${fields.length}):`);
      fields.forEach(field => {
        console.log(`   - ${field}`);
      });
      
      // Verifica campi GDPR obbligatori
      const requiredGDPRFields = ['_time', 'level', 'message', 'user_id', 'ip_address', 'endpoint', 'session_id', 'user_agent'];
      const hasTime = firstRecord._time || data._time;
      const missingFields = requiredGDPRFields.filter(f => {
        if (f === '_time') return !hasTime;
        return !data[f];
      });
      
      if (missingFields.length > 0) {
        console.log(`\n⚠️ Campi GDPR mancanti: ${missingFields.join(', ')}`);
      } else {
        console.log(`\n✅ Tutti i campi GDPR obbligatori sono presenti`);
      }
      
      // Verifica campi NON GDPR (non dovrebbero esserci)
      const nonGDPRFields = ['pid', 'hostname', 'request_id', 'freed', 'afterGC', 'beforeGC'];
      const foundNonGDPR = nonGDPRFields.filter(f => data[f] !== undefined);
      
      if (foundNonGDPR.length > 0) {
        console.log(`\n⚠️ ATTENZIONE: Campi non GDPR trovati: ${foundNonGDPR.join(', ')}`);
        console.log('   ⚠️ Questi campi non dovrebbero essere presenti');
      } else {
        console.log(`\n✅ Nessun campo non GDPR trovato (pulizia corretta)`);
      }
      
      // Mostra un record di esempio
      console.log(`\n📋 Record di esempio:`);
      console.log(JSON.stringify({
        _time: firstRecord._time || data._time,
        level: data.level,
        message: data.message?.substring(0, 50) + '...',
        user_id: data.user_id,
        ip_address: data.ip_address,
        endpoint: data.endpoint,
        session_id: data.session_id,
        user_agent: data.user_agent?.substring(0, 30) + '...'
      }, null, 2));
    } else {
      console.log('⚠️ Nessun record trovato per l\'analisi');
    }
    
    // Step 4: Confronta con Neon
    console.log('\n📊 Step 4: Confronto con Neon...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    try {
      const neonCountResult = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
      const neonCount = parseInt(neonCountResult.rows[0].count);
      
      console.log(`✅ Record su Neon: ${neonCount.toLocaleString('it-IT')}`);
      console.log(`✅ Record su Axiom: ${totalCount.toLocaleString('it-IT')}`);
      
      if (totalCount === neonCount) {
        console.log(`\n✅ PERFETTO: Tutti i record sono stati migrati!`);
      } else if (totalCount < neonCount) {
        console.log(`\n⚠️ ATTENZIONE: Mancano ${(neonCount - totalCount).toLocaleString('it-IT')} record su Axiom`);
        console.log(`   ⚠️ Migrazione incompleta`);
      } else {
        console.log(`\n⚠️ ATTENZIONE: Ci sono più record su Axiom che su Neon`);
        console.log(`   ⚠️ Possibile duplicazione`);
      }
    } catch (neonErr) {
      console.log('⚠️ Impossibile confrontare con Neon:', neonErr.message);
    } finally {
      await pool.end();
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

// Esegui verifica
checkAxiomMigrationStatus()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });



