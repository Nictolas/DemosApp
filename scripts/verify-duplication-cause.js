// Script per verificare se l'alto numero di record deriva davvero da duplicazione
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
  console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

const { Pool } = require('pg');

async function verifyDuplication() {
  console.log('🔍 Verifica approfondita: perché ci sono così tanti record?\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // 1. Conta record su Neon
    const neonCount = await pool.query(`SELECT COUNT(*) as count FROM centralized_logs`);
    const neonTotal = parseInt(neonCount.rows[0].count);
    
    // 2. Conta record su Axiom
    const axiomQuery = `['centralized_logs'] | summarize count()`;
    const axiomResult = await axiomClient.query(axiomQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let axiomTotal = 0;
    if (axiomResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      axiomTotal = parseInt(axiomResult.buckets.totals[0].aggregations[0].value);
    } else if (axiomResult.status?.rowsExamined) {
      axiomTotal = parseInt(axiomResult.status.rowsExamined);
    }
    
    console.log(`📊 Record su Neon: ${neonTotal.toLocaleString('it-IT')}`);
    console.log(`📊 Record su Axiom: ${axiomTotal.toLocaleString('it-IT')}`);
    console.log(`📊 Rapporto: ${(axiomTotal / neonTotal).toFixed(2)}x\n`);
    
    // 3. Verifica se ci sono record su Axiom che NON esistono su Neon (log real-time)
    console.log('📊 STEP 1: Verifica log real-time (record aggiunti dopo migrazione)\n');
    
    // Prendi l'ultimo timestamp su Neon
    const lastNeonRecord = await pool.query(`
      SELECT MAX(created_at) as max_ts FROM centralized_logs
    `);
    const lastNeonTs = lastNeonRecord.rows[0].max_ts;
    console.log(`   Ultimo record su Neon: ${new Date(parseInt(lastNeonTs)).toLocaleString('it-IT')}`);
    
    // Conta record su Axiom dopo l'ultimo record su Neon
    if (lastNeonTs) {
      const realtimeQuery = `['centralized_logs'] | where _time > timestamp(${parseInt(lastNeonTs)}) | summarize count()`;
      try {
        const realtimeResult = await axiomClient.query(realtimeQuery, {
          startTime: new Date(parseInt(lastNeonTs)),
          endTime: new Date()
        });
        
        let realtimeCount = 0;
        if (realtimeResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
          realtimeCount = parseInt(realtimeResult.buckets.totals[0].aggregations[0].value);
        } else if (realtimeResult.status?.rowsExamined) {
          realtimeCount = parseInt(realtimeResult.status.rowsExamined);
        }
        
        console.log(`   Record su Axiom dopo ultimo record Neon: ${realtimeCount.toLocaleString('it-IT')}`);
        
        if (realtimeCount > 0) {
          const realtimePercentage = ((realtimeCount / axiomTotal) * 100).toFixed(2);
          console.log(`   Percentuale log real-time: ${realtimePercentage}%`);
        }
      } catch (err) {
        console.log(`   ⚠️ Errore query real-time: ${err.message}`);
      }
    }
    
    // 4. Analizza campi unici per vedere se ci sono duplicati esatti
    console.log('\n📊 STEP 2: Analisi campi unici\n');
    
    // Prendi un campione di record da Neon
    const neonSample = await pool.query(`
      SELECT 
        TO_TIMESTAMP(timestamp / 1000)::text as ts,
        level,
        message,
        user_id,
        endpoint
      FROM centralized_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    console.log(`   Campione Neon: ${neonSample.rows.length} record`);
    
    // Per ogni record del campione, verifica quante volte appare su Axiom
    let duplicatesFound = 0;
    let uniqueFound = 0;
    let notFound = 0;
    
    for (const neonRow of neonSample.rows.slice(0, 10)) { // Testa solo i primi 10 per non sovraccaricare
      const ts = neonRow.ts;
      const message = neonRow.message?.substring(0, 50) || '';
      
      // Cerca su Axiom record con stesso timestamp e message
      const searchQuery = `['centralized_logs'] | where _time == timestamp("${ts}") and message == "${message.replace(/"/g, '\\"')}" | summarize count()`;
      
      try {
        const searchResult = await axiomClient.query(searchQuery, {
          startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endTime: new Date()
        });
        
        let count = 0;
        if (searchResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
          count = parseInt(searchResult.buckets.totals[0].aggregations[0].value);
        } else if (searchResult.status?.rowsExamined) {
          count = parseInt(searchResult.status.rowsExamined);
        }
        
        if (count === 0) {
          notFound++;
        } else if (count === 1) {
          uniqueFound++;
        } else {
          duplicatesFound++;
          console.log(`      ⚠️ Record trovato ${count} volte: "${message.substring(0, 30)}..."`);
        }
      } catch (err) {
        // Ignora errori query
      }
    }
    
    console.log(`\n   Risultati campione:`);
    console.log(`      Record unici: ${uniqueFound}`);
    console.log(`      Record duplicati: ${duplicatesFound}`);
    console.log(`      Record non trovati: ${notFound}`);
    
    // 5. Verifica distribuzione timestamp su Axiom
    console.log('\n📊 STEP 3: Distribuzione timestamp su Axiom\n');
    
    // Prendi un campione di record da Axiom
    const axiomSampleQuery = `['centralized_logs'] | limit 1000`;
    const axiomSampleResult = await axiomClient.query(axiomSampleQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let axiomSampleRows = [];
    if (axiomSampleResult.matches && Array.isArray(axiomSampleResult.matches)) {
      axiomSampleRows = axiomSampleResult.matches;
    } else if (axiomSampleResult.buckets && Array.isArray(axiomSampleResult.buckets)) {
      axiomSampleRows = axiomSampleResult.buckets.flatMap(b => b.rows || b.data || []);
    }
    
    // Raggruppa per timestamp (arrotondato al minuto)
    const timestampGroups = {};
    axiomSampleRows.forEach(row => {
      if (row._time) {
        const time = new Date(row._time);
        const minuteKey = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
        timestampGroups[minuteKey] = (timestampGroups[minuteKey] || 0) + 1;
      }
    });
    
    // Trova timestamp con più record
    const sortedGroups = Object.entries(timestampGroups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log(`   Top 10 timestamp con più record (campione di ${axiomSampleRows.length}):`);
    sortedGroups.forEach(([time, count]) => {
      if (count > 1) {
        console.log(`      ${time}: ${count} record ⚠️`);
      } else {
        console.log(`      ${time}: ${count} record`);
      }
    });
    
    // 6. Verifica se ci sono pattern di duplicazione
    console.log('\n📊 STEP 4: Pattern di duplicazione\n');
    
    // Conta quanti timestamp unici ci sono
    const uniqueTimestamps = new Set();
    axiomSampleRows.forEach(row => {
      if (row._time) {
        uniqueTimestamps.add(row._time);
      }
    });
    
    console.log(`   Timestamp unici nel campione: ${uniqueTimestamps.size}`);
    console.log(`   Record totali nel campione: ${axiomSampleRows.length}`);
    console.log(`   Rapporto: ${(axiomSampleRows.length / uniqueTimestamps.size).toFixed(2)}x`);
    
    if (axiomSampleRows.length / uniqueTimestamps.size > 1.5) {
      console.log(`   ⚠️ Evidenza di duplicazione: molti record con stesso timestamp`);
    }
    
    // 7. Conclusioni
    console.log('\n📊 STEP 5: Conclusioni\n');
    
    const ratio = axiomTotal / neonTotal;
    const estimatedDuplicates = axiomTotal - neonTotal;
    
    console.log(`   Record su Neon: ${neonTotal.toLocaleString('it-IT')}`);
    console.log(`   Record su Axiom: ${axiomTotal.toLocaleString('it-IT')}`);
    console.log(`   Differenza: ${estimatedDuplicates.toLocaleString('it-IT')}`);
    console.log(`   Rapporto: ${ratio.toFixed(2)}x\n`);
    
    if (ratio > 20 && ratio < 22) {
      console.log(`   ✅ EVIDENZA FORTE: Il rapporto di ~21x suggerisce che la migrazione`);
      console.log(`      è stata eseguita circa ${Math.round(ratio)} volte.`);
    } else if (ratio > 10) {
      console.log(`   ⚠️ EVIDENZA: Il rapporto di ${ratio.toFixed(2)}x suggerisce duplicazione,`);
      console.log(`      ma potrebbe anche includere log real-time.`);
    } else {
      console.log(`   ℹ️ Il rapporto di ${ratio.toFixed(2)}x potrebbe includere log real-time`);
      console.log(`      o altre fonti di dati.`);
    }
    
    if (duplicatesFound > 0) {
      console.log(`\n   ✅ CONFERMA: Trovati record duplicati nel campione.`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyDuplication();

