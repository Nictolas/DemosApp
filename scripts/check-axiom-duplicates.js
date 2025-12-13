// Script per verificare duplicati su Axiom e confrontare con Neon
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

async function checkDuplicates() {
  console.log('🔍 Verifica duplicati e confronto Neon vs Axiom\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // 1. Conta record su Neon
    console.log('📊 STEP 1: Conteggio record su Neon\n');
    
    const centralizedCount = await pool.query('SELECT COUNT(*) as count FROM centralized_logs');
    const neonCentralized = parseInt(centralizedCount.rows[0].count);
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs_compressed'
      )
    `);
    const auditTableName = tableCheck.rows[0].exists ? 'audit_logs_compressed' : 'audit_logs';
    const auditCount = await pool.query(`SELECT COUNT(*) as count FROM ${auditTableName}`);
    const neonAudit = parseInt(auditCount.rows[0].count);
    
    console.log(`   ✅ centralized_logs su Neon: ${neonCentralized.toLocaleString('it-IT')} record`);
    console.log(`   ✅ ${auditTableName} su Neon: ${neonAudit.toLocaleString('it-IT')} record`);
    console.log(`   📦 Totale Neon: ${(neonCentralized + neonAudit).toLocaleString('it-IT')} record\n`);
    
    // 2. Verifica statistiche di migrazione
    console.log('📊 STEP 2: Statistiche di migrazione salvate\n');
    
    let migrationStats = {};
    try {
      const statsResult = await pool.query(`
        SELECT dataset_name, events_migrated, batches_count, migrated_at
        FROM axiom_migration_stats
        ORDER BY migrated_at DESC
      `);
      
      if (statsResult.rows.length > 0) {
        console.log('   📋 Migrazioni eseguite:');
        statsResult.rows.forEach((row, idx) => {
          console.log(`      ${idx + 1}. ${row.dataset_name}: ${parseInt(row.events_migrated).toLocaleString('it-IT')} eventi in ${row.batches_count} batch (${new Date(row.migrated_at).toLocaleString('it-IT')})`);
          if (migrationStats[row.dataset_name]) {
            migrationStats[row.dataset_name] += parseInt(row.events_migrated);
          } else {
            migrationStats[row.dataset_name] = parseInt(row.events_migrated);
          }
        });
        
        const centralizedMigrated = migrationStats['centralized_logs'] || migrationStats[process.env.AXIOM_DATASET || 'centralized_logs'] || 0;
        const realtimeMigrated = migrationStats['real-time'] || migrationStats[process.env.AXIOM_REALTIME_DATASET || 'real-time'] || 0;
        
        console.log(`\n   📊 Totale migrato (somma di tutte le migrazioni):`);
        console.log(`      - centralized_logs: ${centralizedMigrated.toLocaleString('it-IT')} eventi`);
        console.log(`      - real-time: ${realtimeMigrated.toLocaleString('it-IT')} eventi`);
        
        if (centralizedMigrated > neonCentralized || realtimeMigrated > neonAudit) {
          console.log(`\n   ⚠️ ATTENZIONE: I record migrati sono PIÙ dei record su Neon!`);
          console.log(`      Questo suggerisce che la migrazione è stata eseguita più volte.`);
        }
      } else {
        console.log('   ℹ️ Nessuna statistica di migrazione trovata\n');
      }
    } catch (statsErr) {
      console.log('   ⚠️ Impossibile leggere statistiche di migrazione:', statsErr.message);
    }
    
    // 3. Conta eventi su Axiom
    console.log('\n📊 STEP 3: Conteggio eventi su Axiom\n');
    
    const centralizedDataset = process.env.AXIOM_DATASET || 'centralized_logs';
    const realtimeDataset = process.env.AXIOM_REALTIME_DATASET || 'real-time';
    
    let axiomCentralized = 0;
    let axiomRealtime = 0;
    
    try {
      const centralizedQuery = `['${centralizedDataset}'] | summarize count()`;
      const centralizedResult = await axiomClient.query(centralizedQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      axiomCentralized = parseInt(centralizedResult.buckets?.totals?.[0]?.aggregations?.[0]?.value 
        || centralizedResult.status?.rowsExamined 
        || 0);
      
      console.log(`   ✅ ${centralizedDataset} su Axiom: ${axiomCentralized.toLocaleString('it-IT')} eventi`);
    } catch (err) {
      console.log(`   ❌ Errore conteggio ${centralizedDataset}:`, err.message);
    }
    
    try {
      const realtimeQuery = `['${realtimeDataset}'] | summarize count()`;
      const realtimeResult = await axiomClient.query(realtimeQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      axiomRealtime = parseInt(realtimeResult.buckets?.totals?.[0]?.aggregations?.[0]?.value 
        || realtimeResult.status?.rowsExamined 
        || 0);
      
      console.log(`   ✅ ${realtimeDataset} su Axiom: ${axiomRealtime.toLocaleString('it-IT')} eventi`);
    } catch (err) {
      console.log(`   ❌ Errore conteggio ${realtimeDataset}:`, err.message);
    }
    
    const axiomTotal = axiomCentralized + axiomRealtime;
    console.log(`   📦 Totale Axiom: ${axiomTotal.toLocaleString('it-IT')} eventi\n`);
    
    // 4. Confronto e analisi
    console.log('📊 STEP 4: Analisi e confronto\n');
    console.log('   📈 Confronto record:');
    console.log(`      centralized_logs: Neon ${neonCentralized.toLocaleString('it-IT')} vs Axiom ${axiomCentralized.toLocaleString('it-IT')}`);
    if (axiomCentralized > neonCentralized) {
      const diff = axiomCentralized - neonCentralized;
      const ratio = ((diff / neonCentralized) * 100).toFixed(1);
      console.log(`      ⚠️ Axiom ha ${diff.toLocaleString('it-IT')} record in PIÙ (${ratio}% in più)`);
      console.log(`      🔴 POSSIBILI DUPLICATI: La migrazione potrebbe essere stata eseguita più volte`);
    } else if (axiomCentralized < neonCentralized) {
      const diff = neonCentralized - axiomCentralized;
      console.log(`      ℹ️ Neon ha ancora ${diff.toLocaleString('it-IT')} record non migrati`);
    } else {
      console.log(`      ✅ I numeri corrispondono perfettamente`);
    }
    
    console.log(`\n      ${realtimeDataset}: Neon ${neonAudit.toLocaleString('it-IT')} vs Axiom ${axiomRealtime.toLocaleString('it-IT')}`);
    if (axiomRealtime > neonAudit) {
      const diff = axiomRealtime - neonAudit;
      const ratio = ((diff / neonAudit) * 100).toFixed(1);
      console.log(`      ⚠️ Axiom ha ${diff.toLocaleString('it-IT')} record in PIÙ (${ratio}% in più)`);
      console.log(`      🔴 POSSIBILI DUPLICATI: La migrazione potrebbe essere stata eseguita più volte`);
    } else if (axiomRealtime < neonAudit) {
      const diff = neonAudit - axiomRealtime;
      console.log(`      ℹ️ Neon ha ancora ${diff.toLocaleString('it-IT')} record non migrati`);
    } else {
      console.log(`      ✅ I numeri corrispondono perfettamente`);
    }
    
    // 5. Calcolo dimensione
    console.log('\n   💾 Analisi dimensione:');
    const bytesPerEvent = 335; // Basato su osservazioni reali
    const axiomCentralizedMB = (axiomCentralized * bytesPerEvent) / (1024 * 1024);
    const axiomRealtimeMB = (axiomRealtime * bytesPerEvent) / (1024 * 1024);
    const axiomTotalMB = axiomCentralizedMB + axiomRealtimeMB;
    
    console.log(`      Axiom centralized_logs: ~${axiomCentralizedMB.toFixed(2)} MB (${axiomCentralized.toLocaleString('it-IT')} eventi × ${bytesPerEvent} bytes)`);
    console.log(`      Axiom ${realtimeDataset}: ~${axiomRealtimeMB.toFixed(2)} MB (${axiomRealtime.toLocaleString('it-IT')} eventi × ${bytesPerEvent} bytes)`);
    console.log(`      Totale Axiom: ~${axiomTotalMB.toFixed(2)} MB`);
    
    // 6. Verifica duplicati (campo _time)
    console.log('\n📊 STEP 5: Verifica duplicati per timestamp\n');
    
    try {
      const duplicateQuery = `['${centralizedDataset}'] | summarize count() by _time | where count > 1 | count`;
      const duplicateResult = await axiomClient.query(duplicateQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      const duplicateCount = parseInt(duplicateResult.buckets?.totals?.[0]?.aggregations?.[0]?.value || 0);
      if (duplicateCount > 0) {
        console.log(`   ⚠️ Trovati ${duplicateCount.toLocaleString('it-IT')} timestamp con più di un evento in ${centralizedDataset}`);
        console.log(`   🔴 Questo conferma la presenza di duplicati`);
      } else {
        console.log(`   ✅ Nessun timestamp duplicato trovato in ${centralizedDataset} (o query non supportata)`);
      }
    } catch (dupErr) {
      console.log(`   ⚠️ Impossibile verificare duplicati: ${dupErr.message}`);
    }
    
    // 7. Raccomandazioni
    console.log('\n📋 RACCOMANDAZIONI:\n');
    
    if (axiomCentralized > neonCentralized || axiomRealtime > neonAudit) {
      console.log('   🔴 DUPLICATI RILEVATI:');
      console.log('      1. Esegui lo script di deduplicazione:');
      console.log('         node scripts/deduplicate-axiom.js centralized_logs');
      console.log(`         node scripts/deduplicate-axiom.js ${realtimeDataset}`);
      console.log('      2. Verifica il nuovo dataset su Axiom Dashboard');
      console.log('      3. Se corretto, elimina il dataset originale e rinomina quello deduplicato');
    } else {
      console.log('   ℹ️ I dati sembrano corretti, ma se la dimensione è maggiore su Axiom:');
      console.log('      - Axiom memorizza i dati in formato JSON (più pesante di PostgreSQL compresso)');
      console.log('      - Axiom aggiunge metadata ai log');
      console.log('      - La compressione di Neon potrebbe ridurre la dimensione apparente');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Errore:', error);
    await pool.end();
    process.exit(1);
  }
}

checkDuplicates();

