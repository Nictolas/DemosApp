// Script per analizzare quanti record unici ci sarebbero usando _time, message, request_id
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

async function analyzeUniqueWithRequestId() {
  console.log('🔍 Analisi Record Unici con Chiave _time, message, request_id\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });
  
  try {
    // 1. Analizza su Neon
    console.log('📊 STEP 1: Analisi su Neon\n');
    
    const neonTotal = await pool.query(`SELECT COUNT(*) as count FROM centralized_logs`);
    const neonTotalCount = parseInt(neonTotal.rows[0].count);
    console.log(`   Record totali su Neon: ${neonTotalCount.toLocaleString('it-IT')}`);
    
    // Record unici con _time, message, request_id
    const neonUnique = await pool.query(`
      SELECT COUNT(DISTINCT (
        TO_TIMESTAMP(timestamp / 1000)::text,
        message,
        COALESCE(request_id, '')
      )) as count
      FROM centralized_logs
    `);
    
    // Alternativa: conta gruppi unici
    const neonUniqueGroups = await pool.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT DISTINCT 
          TO_TIMESTAMP(timestamp / 1000)::text as ts,
          message,
          COALESCE(request_id, '') as req_id
        FROM centralized_logs
      ) as unique_groups
    `);
    
    const neonUniqueCount = parseInt(neonUniqueGroups.rows[0].count);
    const neonDuplicates = neonTotalCount - neonUniqueCount;
    
    console.log(`   Record unici (timestamp, message, request_id): ${neonUniqueCount.toLocaleString('it-IT')}`);
    console.log(`   Duplicati su Neon: ${neonDuplicates.toLocaleString('it-IT')}`);
    console.log(`   Percentuale duplicati: ${((neonDuplicates / neonTotalCount) * 100).toFixed(2)}%\n`);
    
    // 2. Analizza su Axiom
    console.log('📊 STEP 2: Analisi su Axiom\n');
    
    const axiomTotalQuery = `['centralized_logs'] | summarize count()`;
    const axiomTotalResult = await axiomClient.query(axiomTotalQuery, {
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    let axiomTotalCount = 0;
    if (axiomTotalResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
      axiomTotalCount = parseInt(axiomTotalResult.buckets.totals[0].aggregations[0].value);
    } else if (axiomTotalResult.status?.rowsExamined) {
      axiomTotalCount = parseInt(axiomTotalResult.status.rowsExamined);
    }
    
    console.log(`   Record totali su Axiom: ${axiomTotalCount.toLocaleString('it-IT')}`);
    
    // Prova a contare record unici con _time, message, request_id
    // Nota: Axiom APL potrebbe non supportare direttamente COUNT(DISTINCT), quindi usiamo un approccio alternativo
    try {
      // Query per contare gruppi unici
      const axiomUniqueQuery = `['centralized_logs'] | summarize count() by _time, message, request_id | count`;
      const axiomUniqueResult = await axiomClient.query(axiomUniqueQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      let axiomUniqueCount = 0;
      if (axiomUniqueResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
        axiomUniqueCount = parseInt(axiomUniqueResult.buckets.totals[0].aggregations[0].value);
      } else if (axiomUniqueResult.matches && Array.isArray(axiomUniqueResult.matches)) {
        axiomUniqueCount = axiomUniqueResult.matches.length;
      } else if (axiomUniqueResult.status?.rowsExamined) {
        // Se non possiamo contare i gruppi, usiamo una stima basata su Neon
        console.log(`   ⚠️ Impossibile contare gruppi unici direttamente, uso stima basata su Neon`);
        const ratio = neonUniqueCount / neonTotalCount;
        axiomUniqueCount = Math.round(axiomTotalCount * ratio);
      }
      
      const axiomDuplicates = axiomTotalCount - axiomUniqueCount;
      
      console.log(`   Record unici (timestamp, message, request_id): ~${axiomUniqueCount.toLocaleString('it-IT')}`);
      console.log(`   Duplicati su Axiom: ~${axiomDuplicates.toLocaleString('it-IT')}`);
      console.log(`   Percentuale duplicati: ${((axiomDuplicates / axiomTotalCount) * 100).toFixed(2)}%\n`);
      
      // 3. Confronto
      console.log('📊 STEP 3: Confronto\n');
      console.log(`   Record su Neon: ${neonTotalCount.toLocaleString('it-IT')}`);
      console.log(`   Record unici su Neon: ${neonUniqueCount.toLocaleString('it-IT')}`);
      console.log(`   Record su Axiom: ${axiomTotalCount.toLocaleString('it-IT')}`);
      console.log(`   Record unici su Axiom (stimati): ~${axiomUniqueCount.toLocaleString('it-IT')}`);
      console.log(`\n   Dopo deduplicazione con _time, message, request_id:`);
      console.log(`   Record rimanenti su Axiom: ~${axiomUniqueCount.toLocaleString('it-IT')}`);
      console.log(`   Record eliminati: ~${axiomDuplicates.toLocaleString('it-IT')}`);
      console.log(`   Risparmio: ${((axiomDuplicates / axiomTotalCount) * 100).toFixed(2)}%\n`);
      
      // 4. Verifica se i record unici su Axiom corrispondono a Neon
      if (Math.abs(axiomUniqueCount - neonUniqueCount) < neonUniqueCount * 0.1) {
        console.log(`   ✅ I record unici su Axiom corrispondono a Neon (differenza < 10%)`);
        console.log(`   ✅ La deduplicazione è corretta\n`);
      } else {
        console.log(`   ⚠️ Differenza tra record unici su Axiom e Neon`);
        console.log(`   ⚠️ Potrebbero esserci log real-time aggiunti dopo la migrazione\n`);
      }
      
    } catch (err) {
      console.log(`   ⚠️ Errore query unici Axiom: ${err.message}`);
      console.log(`   💡 Uso stima basata su Neon\n`);
      
      const ratio = neonUniqueCount / neonTotalCount;
      const estimatedUnique = Math.round(axiomTotalCount * ratio);
      const estimatedDuplicates = axiomTotalCount - estimatedUnique;
      
      console.log(`   Record unici stimati: ~${estimatedUnique.toLocaleString('it-IT')}`);
      console.log(`   Duplicati stimati: ~${estimatedDuplicates.toLocaleString('it-IT')}`);
      console.log(`   Percentuale duplicati: ${((estimatedDuplicates / axiomTotalCount) * 100).toFixed(2)}%\n`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

analyzeUniqueWithRequestId();

