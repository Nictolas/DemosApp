// Script per analizzare perché ci sono così tanti record su Axiom
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

async function analyzeRecords() {
  console.log('🔍 Analisi record Axiom vs Neon\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });
  
  try {
    // 1. Conta record su Neon
    console.log('📊 STEP 1: Conteggio record su Neon\n');
    const neonCount = await pool.query(`
      SELECT COUNT(*) as count FROM centralized_logs
    `);
    const neonTotal = parseInt(neonCount.rows[0].count);
    console.log(`   Record su Neon: ${neonTotal.toLocaleString('it-IT')}`);
    
    // 2. Conta record su Axiom
    console.log('\n📊 STEP 2: Conteggio record su Axiom\n');
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
    console.log(`   Record su Axiom: ${axiomTotal.toLocaleString('it-IT')}`);
    
    // 3. Confronto
    console.log('\n📊 STEP 3: Confronto\n');
    const difference = axiomTotal - neonTotal;
    const ratio = neonTotal > 0 ? (axiomTotal / neonTotal).toFixed(2) : 'N/A';
    console.log(`   Differenza: ${difference > 0 ? '+' : ''}${difference.toLocaleString('it-IT')} record su Axiom`);
    console.log(`   Rapporto: ${ratio}x (Axiom rispetto a Neon)`);
    
    if (axiomTotal > neonTotal * 1.1) {
      console.log(`   ⚠️ ATTENZIONE: Axiom ha ${ratio}x più record di Neon!`);
      console.log(`   ⚠️ Probabile causa: migrazione eseguita più volte o duplicati`);
    }
    
    // 4. Distribuzione temporale su Neon
    console.log('\n📊 STEP 4: Distribuzione temporale su Neon\n');
    const neonDistribution = await pool.query(`
      SELECT 
        DATE_TRUNC('day', TO_TIMESTAMP(created_at / 1000)) as day,
        COUNT(*) as count
      FROM centralized_logs
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `);
    
    console.log('   Ultimi 30 giorni su Neon:');
    neonDistribution.rows.forEach(row => {
      const day = new Date(row.day).toLocaleDateString('it-IT');
      console.log(`      ${day}: ${parseInt(row.count).toLocaleString('it-IT')} record`);
    });
    
    // 5. Distribuzione temporale su Axiom (per giorno)
    console.log('\n📊 STEP 5: Distribuzione temporale su Axiom (ultimi 30 giorni)\n');
    try {
      const axiomDistributionQuery = `['centralized_logs'] | summarize count() by bin(_time, 1d) | order by _time desc | limit 30`;
      const axiomDistributionResult = await axiomClient.query(axiomDistributionQuery, {
        startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      if (axiomDistributionResult.buckets && Array.isArray(axiomDistributionResult.buckets)) {
        console.log('   Ultimi 30 giorni su Axiom:');
        axiomDistributionResult.buckets.forEach(bucket => {
          const time = bucket.time || bucket._time;
          const count = bucket.rows?.[0]?.count || bucket.aggregations?.[0]?.value || 0;
          if (time) {
            const day = new Date(time).toLocaleDateString('it-IT');
            console.log(`      ${day}: ${parseInt(count).toLocaleString('it-IT')} record`);
          }
        });
      } else {
        console.log('   ⚠️ Impossibile ottenere distribuzione temporale da Axiom');
      }
    } catch (err) {
      console.log(`   ⚠️ Errore query distribuzione Axiom: ${err.message}`);
    }
    
    // 6. Verifica duplicati per timestamp
    console.log('\n📊 STEP 6: Verifica duplicati per timestamp\n');
    try {
      // Query corretta: prima raggruppa, poi filtra, poi somma
      const duplicatesQuery = `['centralized_logs'] | summarize count() as cnt by _time | where cnt > 1 | summarize sum(cnt - 1)`;
      const duplicatesResult = await axiomClient.query(duplicatesQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      let duplicatesCount = 0;
      if (duplicatesResult.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
        duplicatesCount = parseInt(duplicatesResult.buckets.totals[0].aggregations[0].value);
      } else if (duplicatesResult.matches && Array.isArray(duplicatesResult.matches) && duplicatesResult.matches.length > 0) {
        // Se restituisce matches, cerca il valore della somma
        duplicatesResult.matches.forEach(match => {
          if (typeof match === 'object') {
            Object.values(match).forEach(val => {
              if (typeof val === 'number') {
                duplicatesCount = val;
              }
            });
          }
        });
      }
      
      if (duplicatesCount > 0) {
        console.log(`   ⚠️ Trovati ${duplicatesCount.toLocaleString('it-IT')} duplicati (stesso _time)`);
        const duplicatesPercentage = ((duplicatesCount / axiomTotal) * 100).toFixed(2);
        console.log(`   ⚠️ Percentuale duplicati: ${duplicatesPercentage}%`);
      } else {
        console.log(`   ✅ Nessun duplicato trovato per timestamp`);
      }
    } catch (err) {
      console.log(`   ⚠️ Errore verifica duplicati: ${err.message}`);
      console.log(`   💡 Query potrebbe non essere supportata, prova con l'endpoint /find-duplicates`);
    }
    
    // 7. Verifica record con stesso _time e message
    console.log('\n📊 STEP 7: Verifica duplicati per _time + message\n');
    try {
      const duplicatesQuery2 = `['centralized_logs'] | summarize count() as cnt by _time, message | where cnt > 1 | summarize sum(cnt - 1)`;
      const duplicatesResult2 = await axiomClient.query(duplicatesQuery2, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      let duplicatesCount2 = 0;
      if (duplicatesResult2.buckets?.totals?.[0]?.aggregations?.[0]?.value) {
        duplicatesCount2 = parseInt(duplicatesResult2.buckets.totals[0].aggregations[0].value);
      } else if (duplicatesResult2.matches && Array.isArray(duplicatesResult2.matches) && duplicatesResult2.matches.length > 0) {
        duplicatesResult2.matches.forEach(match => {
          if (typeof match === 'object') {
            Object.values(match).forEach(val => {
              if (typeof val === 'number') {
                duplicatesCount2 = val;
              }
            });
          }
        });
      }
      
      if (duplicatesCount2 > 0) {
        console.log(`   ⚠️ Trovati ${duplicatesCount2.toLocaleString('it-IT')} duplicati (stesso _time + message)`);
        const duplicatesPercentage2 = ((duplicatesCount2 / axiomTotal) * 100).toFixed(2);
        console.log(`   ⚠️ Percentuale duplicati: ${duplicatesPercentage2}%`);
      } else {
        console.log(`   ✅ Nessun duplicato trovato per _time + message`);
      }
    } catch (err) {
      console.log(`   ⚠️ Errore verifica duplicati: ${err.message}`);
      console.log(`   💡 Query potrebbe non essere supportata, prova con l'endpoint /find-duplicates`);
    }
    
    // 8. Verifica statistiche migrazione
    console.log('\n📊 STEP 8: Statistiche migrazione\n');
    try {
      // Verifica se la tabella esiste
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'axiom_migration_stats'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        const migrationStats = await pool.query(`
          SELECT 
            dataset_name,
            events_migrated,
            batches_count,
            created_at
          FROM axiom_migration_stats
          ORDER BY created_at DESC
          LIMIT 10
        `);
        
        if (migrationStats.rows.length > 0) {
          console.log('   Ultime migrazioni:');
          let totalMigrated = 0;
          migrationStats.rows.forEach(row => {
            const events = parseInt(row.events_migrated || 0);
            totalMigrated += events;
            const date = new Date(row.created_at).toLocaleString('it-IT');
            console.log(`      ${date}: ${events.toLocaleString('it-IT')} eventi (${row.dataset_name})`);
          });
          console.log(`\n   Totale eventi migrati (secondo statistiche): ${totalMigrated.toLocaleString('it-IT')}`);
          
          if (totalMigrated > axiomTotal * 0.9 && totalMigrated < axiomTotal * 1.1) {
            console.log(`   ✅ Il totale migrato corrisponde ai record su Axiom`);
          } else {
            console.log(`   ⚠️ Il totale migrato (${totalMigrated.toLocaleString('it-IT')}) non corrisponde ai record su Axiom (${axiomTotal.toLocaleString('it-IT')})`);
            console.log(`   ⚠️ Differenza: ${(axiomTotal - totalMigrated).toLocaleString('it-IT')} record`);
            
            if (totalMigrated * 20 > axiomTotal && totalMigrated * 22 < axiomTotal) {
              console.log(`   💡 Sembra che la migrazione sia stata eseguita ~21 volte!`);
            }
          }
        } else {
          console.log('   ⚠️ Nessuna statistica di migrazione trovata nella tabella');
        }
      } else {
        console.log('   ⚠️ Tabella axiom_migration_stats non esiste');
        console.log('   💡 Le migrazioni potrebbero essere state eseguite prima della creazione della tabella');
      }
    } catch (err) {
      console.log(`   ⚠️ Errore query statistiche migrazione: ${err.message}`);
    }
    
    // 9. Riepilogo
    console.log('\n📊 STEP 9: Riepilogo\n');
    console.log(`   Record su Neon: ${neonTotal.toLocaleString('it-IT')}`);
    console.log(`   Record su Axiom: ${axiomTotal.toLocaleString('it-IT')}`);
    console.log(`   Differenza: ${difference > 0 ? '+' : ''}${difference.toLocaleString('it-IT')}`);
    console.log(`   Rapporto: ${ratio}x`);
    
    if (axiomTotal > neonTotal * 1.5) {
      console.log(`\n   ⚠️ CONCLUSIONE: Axiom ha molti più record di Neon.`);
      console.log(`   ⚠️ Possibili cause:`);
      console.log(`      1. Migrazione eseguita più volte`);
      console.log(`      2. Duplicati nella migrazione`);
      console.log(`      3. Log real-time aggiunti dopo la migrazione`);
      console.log(`   💡 Soluzione: Eseguire deduplicazione`);
    } else if (axiomTotal < neonTotal * 0.9) {
      console.log(`\n   ⚠️ CONCLUSIONE: Axiom ha meno record di Neon.`);
      console.log(`   ⚠️ Possibile causa: Migrazione incompleta`);
    } else {
      console.log(`\n   ✅ CONCLUSIONE: I numeri sono coerenti.`);
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

analyzeRecords();

