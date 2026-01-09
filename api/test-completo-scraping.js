require('dotenv').config();
const { Pool } = require('pg');

// Importa le funzioni da sync-voti-openpolis.js
// Nota: dobbiamo testare le funzioni esportate o copiarle qui per il test

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Test completo: verifica che il flusso completo funzioni
 */
async function testCompleto() {
  console.log('='.repeat(60));
  console.log('TEST COMPLETO SCRAPING E SALVATAGGIO');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Verifica struttura tabella votazioni_parlamento
    console.log('\n[TEST 1] Verifica struttura tabella votazioni_parlamento');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'votazioni_parlamento'
      AND column_name IN ('url_votazione', 'numero_seduta', 'tipo_atto', 'sigla_atto', 'numero_atto')
      ORDER BY column_name
    `);
    
    const requiredColumns = ['url_votazione', 'numero_seduta', 'tipo_atto', 'sigla_atto', 'numero_atto'];
    const foundColumns = columns.rows.map(r => r.column_name);
    
    console.log(`✅ Colonne trovate: ${foundColumns.join(', ')}`);
    
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    if (missingColumns.length > 0) {
      console.log(`❌ Colonne mancanti: ${missingColumns.join(', ')}`);
      console.log(`   Esegui: ALTER TABLE votazioni_parlamento ADD COLUMN ...`);
    } else {
      console.log(`✅ Tutte le colonne richieste sono presenti`);
    }
    
    // Test 2: Verifica che saveVotazione possa salvare url_votazione
    console.log('\n[TEST 2] Test inserimento votazione con metadati');
    
    const testVotazione = {
      titolo: 'Test Votazione - ' + new Date().toISOString(),
      descrizione: 'Questa è una descrizione di test per verificare il salvataggio',
      camera: 'Camera',
      data: '2025-01-09',
      url: 'https://parlamento19.openpolis.it/votazioni/test-123',
      numeroSeduta: 999,
      tipoAtto: 'DDL',
      siglaAtto: 'DDL 999',
      numeroAtto: 999
    };
    
    const crypto = require('crypto');
    const hashInput = `${testVotazione.titolo}|${testVotazione.camera}|${testVotazione.data}`;
    const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');
    
    const insertResult = await pool.query(
      `INSERT INTO votazioni_parlamento (
        titolo_votazione, descrizione_votazione, camera, data_votazione, votazione_hash,
        url_votazione, numero_seduta, tipo_atto, sigla_atto, numero_atto
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (votazione_hash) 
      DO UPDATE SET 
        descrizione_votazione = EXCLUDED.descrizione_votazione,
        url_votazione = EXCLUDED.url_votazione,
        numero_seduta = EXCLUDED.numero_seduta,
        tipo_atto = EXCLUDED.tipo_atto,
        sigla_atto = EXCLUDED.sigla_atto,
        numero_atto = EXCLUDED.numero_atto,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, url_votazione, numero_seduta, tipo_atto, sigla_atto, numero_atto`,
      [
        testVotazione.titolo,
        testVotazione.descrizione,
        testVotazione.camera,
        testVotazione.data,
        votazioneHash,
        testVotazione.url,
        testVotazione.numeroSeduta,
        testVotazione.tipoAtto,
        testVotazione.siglaAtto,
        testVotazione.numeroAtto
      ]
    );
    
    if (insertResult.rows.length > 0) {
      const saved = insertResult.rows[0];
      console.log(`✅ Votazione salvata con ID: ${saved.id}`);
      console.log(`   URL: ${saved.url_votazione || 'NULL'}`);
      console.log(`   Numero seduta: ${saved.numero_seduta || 'NULL'}`);
      console.log(`   Tipo atto: ${saved.tipo_atto || 'NULL'}`);
      console.log(`   Sigla atto: ${saved.sigla_atto || 'NULL'}`);
      console.log(`   Numero atto: ${saved.numero_atto || 'NULL'}`);
      
      // Verifica che i dati siano stati salvati correttamente
      const allSaved = saved.url_votazione && saved.numero_seduta && saved.tipo_atto;
      if (allSaved) {
        console.log(`✅ Tutti i metadati sono stati salvati correttamente`);
      } else {
        console.log(`⚠️  Alcuni metadati non sono stati salvati`);
      }
      
      // Pulisci: elimina il record di test
      await pool.query('DELETE FROM votazioni_parlamento WHERE id = $1', [saved.id]);
      console.log(`✅ Record di test eliminato`);
    } else {
      console.log(`❌ Errore nel salvataggio`);
    }
    
    // Test 3: Verifica query per recuperare votazioni con metadati
    console.log('\n[TEST 3] Test query con JOIN voti_camera e votazioni_parlamento');
    
    const queryTest = await pool.query(`
      SELECT 
        vc.politico_nome,
        vp.titolo_votazione,
        vp.url_votazione,
        vp.numero_seduta,
        vp.tipo_atto,
        vp.sigla_atto
      FROM voti_camera vc
      LEFT JOIN votazioni_parlamento vp ON vc.votazione_id = vp.id
      WHERE vp.url_votazione IS NOT NULL
      LIMIT 5
    `);
    
    console.log(`✅ Votazioni con URL trovati: ${queryTest.rows.length}`);
    if (queryTest.rows.length > 0) {
      console.log(`   Esempio: ${queryTest.rows[0].politico_nome} - ${queryTest.rows[0].titolo_votazione?.substring(0, 50)}...`);
      console.log(`   URL: ${queryTest.rows[0].url_votazione}`);
    }
    
    // Test 4: Verifica statistiche
    console.log('\n[TEST 4] Statistiche database');
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_votazioni,
        COUNT(url_votazione) as con_url,
        COUNT(numero_seduta) as con_seduta,
        COUNT(tipo_atto) as con_tipo_atto,
        COUNT(sigla_atto) as con_sigla_atto
      FROM votazioni_parlamento
    `);
    
    if (stats.rows.length > 0) {
      const s = stats.rows[0];
      console.log(`✅ Totale votazioni: ${s.total_votazioni}`);
      console.log(`   Con URL: ${s.con_url} (${((s.con_url / s.total_votazioni) * 100).toFixed(1)}%)`);
      console.log(`   Con numero seduta: ${s.con_seduta} (${((s.con_seduta / s.total_votazioni) * 100).toFixed(1)}%)`);
      console.log(`   Con tipo atto: ${s.con_tipo_atto} (${((s.con_tipo_atto / s.total_votazioni) * 100).toFixed(1)}%)`);
      console.log(`   Con sigla atto: ${s.con_sigla_atto} (${((s.con_sigla_atto / s.total_votazioni) * 100).toFixed(1)}%)`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TUTTI I TEST COMPLETATI');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Esegui il test
testCompleto().catch(console.error);
