// Script per verificare la struttura dei dati su Neon vs Axiom
const { Pool } = require('pg');
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

async function checkStructures() {
  console.log('🔍 Verifica struttura dati Neon vs Axiom\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // 1. Verifica struttura tabella Neon
    console.log('📊 STEP 1: Struttura tabella centralized_logs su Neon\n');
    const neonStructure = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'centralized_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('   Colonne su Neon:');
    neonStructure.rows.forEach((col, idx) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`      ${idx + 1}. ${col.column_name}: ${col.data_type}${length}`);
    });
    
    // 2. Verifica un record di esempio su Neon
    console.log('\n📊 STEP 2: Record di esempio su Neon\n');
    const neonSample = await pool.query(`
      SELECT * FROM centralized_logs 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (neonSample.rows.length > 0) {
      const sample = neonSample.rows[0];
      console.log('   Campi presenti nel record:');
      Object.keys(sample).forEach((key, idx) => {
        const value = sample[key];
        const valueStr = value === null ? 'NULL' : 
                        typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
                        String(value).substring(0, 50);
        console.log(`      ${idx + 1}. ${key}: ${valueStr}`);
      });
      
      // Verifica dimensione meta_data
      if (sample.meta_data) {
        const metaStr = typeof sample.meta_data === 'string' 
          ? sample.meta_data 
          : JSON.stringify(sample.meta_data);
        console.log(`\n   ⚠️ meta_data dimensione: ${(metaStr.length / 1024).toFixed(2)} KB`);
        if (metaStr.length > 1000) {
          console.log(`   ⚠️ meta_data è molto grande e potrebbe contenere dati non necessari`);
        }
      }
    }
    
    // 3. Verifica un record di esempio su Axiom
    console.log('\n📊 STEP 3: Record di esempio su Axiom\n');
    let axiomSample = null;
    try {
      const axiomQuery = `['centralized_logs'] | limit 1`;
      const axiomResult = await axiomClient.query(axiomQuery, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      if (axiomResult.matches && Array.isArray(axiomResult.matches) && axiomResult.matches.length > 0) {
        axiomSample = axiomResult.matches[0];
      } else if (axiomResult.buckets && Array.isArray(axiomResult.buckets) && axiomResult.buckets.length > 0) {
        const firstBucket = axiomResult.buckets[0];
        if (firstBucket.rows && Array.isArray(firstBucket.rows) && firstBucket.rows.length > 0) {
          axiomSample = firstBucket.rows[0];
        } else if (firstBucket.data && Array.isArray(firstBucket.data) && firstBucket.data.length > 0) {
          axiomSample = firstBucket.data[0];
        }
      } else if (axiomResult.data && Array.isArray(axiomResult.data) && axiomResult.data.length > 0) {
        axiomSample = axiomResult.data[0];
      } else if (axiomResult.data?.rows && Array.isArray(axiomResult.data.rows) && axiomResult.data.rows.length > 0) {
        axiomSample = axiomResult.data.rows[0];
      } else if (axiomResult.rows && Array.isArray(axiomResult.rows) && axiomResult.rows.length > 0) {
        axiomSample = axiomResult.rows[0];
      }
      
      if (axiomSample) {
        console.log('   Campi presenti nel record Axiom:');
        Object.keys(axiomSample).forEach((key, idx) => {
          const value = axiomSample[key];
          const valueStr = value === null ? 'NULL' : 
                          typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
                          String(value).substring(0, 50);
          console.log(`      ${idx + 1}. ${key}: ${valueStr}`);
        });
        
        // Calcola dimensione approssimativa
        const sampleStr = JSON.stringify(axiomSample);
        console.log(`\n   📦 Dimensione record Axiom: ~${(sampleStr.length / 1024).toFixed(2)} KB`);
        
        // Se c'è un campo "data" con JSON, analizzalo
        if (axiomSample.data && typeof axiomSample.data === 'string') {
          try {
            const dataObj = JSON.parse(axiomSample.data);
            console.log(`\n   📋 Campi dentro "data":`);
            Object.keys(dataObj).forEach((key, idx) => {
              const val = dataObj[key];
              const valStr = val === null ? 'NULL' : 
                            typeof val === 'object' ? JSON.stringify(val).substring(0, 30) + '...' :
                            String(val).substring(0, 30);
              console.log(`      ${idx + 1}. ${key}: ${valStr}`);
            });
            
            // Estrai i campi reali dal JSON per il confronto
            axiomSample = { ...axiomSample, ...dataObj };
          } catch (e) {
            console.log(`   ⚠️ Impossibile parsare campo "data"`);
          }
        }
      } else {
        console.log('   ⚠️ Nessun record trovato su Axiom');
      }
    } catch (axiomErr) {
      console.error('   ❌ Errore query Axiom:', axiomErr.message);
    }
    
    // 4. Confronto campi
    console.log('\n📊 STEP 4: Confronto campi\n');
    if (neonSample.rows.length > 0 && axiomSample) {
      const neonFields = Object.keys(neonSample.rows[0]);
      // Rimuovi i campi metadati di Axiom (_time, _sysTime, _rowId, data) per il confronto
      const axiomFields = Object.keys(axiomSample).filter(f => !['_time', '_sysTime', '_rowId', 'data'].includes(f));
      
      console.log('   Campi solo su Neon:');
      const onlyNeon = neonFields.filter(f => !axiomFields.includes(f));
      if (onlyNeon.length > 0) {
        onlyNeon.forEach(f => console.log(`      - ${f}`));
      } else {
        console.log('      (nessuno)');
      }
      
      console.log('\n   Campi solo su Axiom (esclusi metadati):');
      const onlyAxiom = axiomFields.filter(f => !neonFields.includes(f));
      if (onlyAxiom.length > 0) {
        onlyAxiom.forEach(f => console.log(`      - ${f}`));
      } else {
        console.log('      (nessuno)');
      }
      
      console.log('\n   Campi comuni:');
      const common = neonFields.filter(f => axiomFields.includes(f));
      console.log(`      ${common.length} campi comuni`);
      
      // Verifica campi extra su Axiom che potrebbero non essere necessari
      console.log('\n   ⚠️ Campi extra su Axiom che potrebbero non essere necessari:');
      const extraFields = onlyAxiom.filter(f => 
        !['log_type', 'level', 'message', 'pid', 'hostname'].includes(f)
      );
      if (extraFields.length > 0) {
        extraFields.forEach(f => {
          const val = axiomSample[f];
          const valStr = val === null ? 'NULL' : 
                        typeof val === 'object' ? JSON.stringify(val).substring(0, 50) + '...' :
                        String(val).substring(0, 50);
          console.log(`      - ${f}: ${valStr}`);
        });
      } else {
        console.log('      (nessuno)');
      }
    }
    
    // 5. Verifica se vengono ancora salvati dati su Neon
    console.log('\n📊 STEP 5: Verifica salvataggio su Neon\n');
    const recentNeonCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM centralized_logs 
      WHERE created_at > (EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000)::bigint
    `);
    const recentCount = parseInt(recentNeonCount.rows[0].count);
    
    if (recentCount > 0) {
      console.log(`   ⚠️ ATTENZIONE: ${recentCount} record salvati su Neon nell'ultima ora!`);
      console.log(`   ⚠️ I log vengono ancora salvati su Neon.`);
      console.log(`   💡 Verifica che LOG_TO_DATABASE=false o che writeToDatabase sia disabilitato`);
    } else {
      console.log(`   ✅ Nessun nuovo record su Neon nell'ultima ora`);
      console.log(`   ✅ I log non vengono più salvati su Neon (come previsto)`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

checkStructures();

