// Carica le variabili d'ambiente prima di tutto
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const ministeroSync = require('../services/ministeroSync');
const logger = require('../services/centralizedLogger');

async function testSync() {
  console.log('🔄 Test sincronizzazione iniziative/referendum dal Ministero...');
  console.log('─'.repeat(80));
  
  try {
    console.log('📡 Chiamata API Ministero...');
    const results = await ministeroSync.syncAll();
    
    console.log('\n✅ Sincronizzazione completata!');
    console.log('─'.repeat(80));
    console.log(`📊 Risultati:`);
    console.log(`   • Nuove iniziative create: ${results.created}`);
    console.log(`   • Iniziative aggiornate: ${results.updated}`);
    console.log(`   • Errori: ${results.errors}`);
    console.log(`   • Totale processate: ${results.created + results.updated + results.errors}`);
    console.log('─'.repeat(80));
    
    // Verifica i dati nel database
    const { pool } = require('../middleware/auth');
    
    console.log('\n📋 Verifica dati nel database...');
    
    // Conta totale
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM iniziative_ministero');
    console.log(`   • Totale iniziative nel database: ${totalResult.rows[0].total}`);
    
    // Conta per tipo
    const tipoResult = await pool.query(`
      SELECT tipo, COUNT(*) as count 
      FROM iniziative_ministero 
      GROUP BY tipo 
      ORDER BY count DESC
    `);
    console.log('\n   📊 Per tipo:');
    tipoResult.rows.forEach(row => {
      console.log(`      • ${row.tipo}: ${row.count}`);
    });
    
    // Conta per stato
    const statoResult = await pool.query(`
      SELECT stato, COUNT(*) as count 
      FROM iniziative_ministero 
      GROUP BY stato 
      ORDER BY count DESC
    `);
    console.log('\n   📊 Per stato:');
    statoResult.rows.forEach(row => {
      console.log(`      • ${row.stato}: ${row.count}`);
    });
    
    // Mostra prime 3 iniziative
    const sampleResult = await pool.query(`
      SELECT 
        id_ministero, 
        titolo, 
        tipo, 
        stato, 
        firme_raccolte, 
        quorum, 
        quorum_raggiunto,
        data_inizio,
        data_fine
      FROM iniziative_ministero 
      ORDER BY data_ultimo_aggiornamento DESC 
      LIMIT 3
    `);
    
    console.log('\n   📋 Prime 3 iniziative/referendum:');
    sampleResult.rows.forEach((row, index) => {
      console.log(`\n   ${index + 1}. ${row.titolo.substring(0, 60)}...`);
      console.log(`      ID: ${row.id_ministero}`);
      console.log(`      Tipo: ${row.tipo}`);
      console.log(`      Stato: ${row.stato}`);
      console.log(`      Firme: ${row.firme_raccolte.toLocaleString('it-IT')} / ${row.quorum.toLocaleString('it-IT')}`);
      console.log(`      Quorum raggiunto: ${row.quorum_raggiunto ? '✅ Sì' : '❌ No'}`);
      console.log(`      Date: ${row.data_inizio || 'N/A'} → ${row.data_fine || 'N/A'}`);
    });
    
    // Statistiche firme
    const firmeResult = await pool.query(`
      SELECT 
        SUM(firme_raccolte) as totale_firme,
        SUM(quorum) as totale_quorum,
        COUNT(*) FILTER (WHERE quorum_raggiunto = true) as quorum_raggiunti
      FROM iniziative_ministero
    `);
    
    console.log('\n   📈 Statistiche totali:');
    console.log(`      • Totale firme raccolte: ${parseInt(firmeResult.rows[0].totale_firme || 0).toLocaleString('it-IT')}`);
    console.log(`      • Totale quorum richiesti: ${parseInt(firmeResult.rows[0].totale_quorum || 0).toLocaleString('it-IT')}`);
    console.log(`      • Referendum/Iniziative con quorum raggiunto: ${firmeResult.rows[0].quorum_raggiunti}`);
    
    await pool.end();
    
    console.log('\n✅ Test completato con successo!');
    console.log('\n🎯 Prossimi passi:');
    console.log('   • Verifica i dati con: GET /api/ministero/database');
    console.log('   • Il job automatico sincronizzerà ogni 6 ore');
    
  } catch (error) {
    console.error('\n❌ Errore durante la sincronizzazione:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Esegui
testSync()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Errore fatale:', error);
    process.exit(1);
  });

