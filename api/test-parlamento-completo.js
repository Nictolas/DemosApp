const { Pool } = require('pg');
const axios = require('axios');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testParlamentoCompleto() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST COMPLETO SISTEMA VOTI PARLAMENTO');
  console.log('='.repeat(80));
  
  try {
    // 1. Verifica tabella parlamento
    console.log('\n1️⃣ Verifica tabella "parlamento"...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parlamento'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`   ${tableExists ? '✅' : '❌'} Tabella parlamento: ${tableExists ? 'ESISTE' : 'NON ESISTE'}`);
    
    if (!tableExists) {
      console.log('   ⚠️ La tabella non esiste. Esegui prima il file create-votazioni-parlamento-completa.sql');
      return;
    }
    
    // 2. Verifica tabella votazioni_parlamento
    console.log('\n2️⃣ Verifica tabella "votazioni_parlamento"...');
    const tableCheck2 = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'votazioni_parlamento'
      );
    `);
    
    const tableExists2 = tableCheck2.rows[0].exists;
    console.log(`   ${tableExists2 ? '✅' : '⚠️'} Tabella votazioni_parlamento: ${tableExists2 ? 'ESISTE' : 'NON ESISTE'}`);
    
    // 3. Conta record
    console.log('\n3️⃣ Conta record...');
    const countParlamento = await pool.query('SELECT COUNT(*) as count FROM parlamento');
    const countVotazioni = await pool.query('SELECT COUNT(*) as count FROM votazioni_parlamento');
    console.log(`   📊 Record in parlamento: ${countParlamento.rows[0].count}`);
    console.log(`   📊 Record in votazioni_parlamento: ${countVotazioni.rows[0].count}`);
    
    // 4. Test query con JOIN (simula endpoint /ultime)
    console.log('\n4️⃣ Test query con JOIN (simula endpoint /ultime)...');
    
    const queryCamera = `
      SELECT 
        p.id,
        p.uri,
        p.votazione_id,
        p.camera,
        p.titolo,
        p.descrizione,
        p.data_votazione,
        p.esito,
        p.uri_seduta,
        p.numero_seduta,
        p.titolo_seduta,
        p.legislatura,
        p.favorevoli,
        p.contrari,
        p.presenti,
        p.votanti,
        p.maggioranza,
        p.tipo_votazione,
        p.approvato,
        p.metadati,
        p.created_at,
        p.updated_at,
        p.data_sincronizzazione,
        vp.descrizione_votazione as descrizione_openpolis,
        vp.spiegazione as spiegazione_ai
      FROM parlamento p
      LEFT JOIN votazioni_parlamento vp ON (
        LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
        AND p.camera = vp.camera
        AND (
          (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
          (p.data_votazione = vp.data_votazione)
        )
      )
      WHERE p.titolo IS NOT NULL 
        AND p.titolo != ''
        AND p.titolo != 'N/A'
        AND p.camera = 'Camera'
      ORDER BY 
        COALESCE(p.data_votazione, p.data_sincronizzazione) DESC NULLS LAST,
        p.data_sincronizzazione DESC NULLS LAST,
        p.updated_at DESC NULLS LAST
      LIMIT 3
    `;
    
    try {
      const resultCamera = await pool.query(queryCamera);
      console.log(`   ✅ Query Camera: ${resultCamera.rows.length} risultati`);
      
      if (resultCamera.rows.length > 0) {
        resultCamera.rows.forEach((v, i) => {
          console.log(`\n   ${i + 1}. ${v.titolo}`);
          console.log(`      Data: ${v.data_votazione || 'N/A'}`);
          console.log(`      Esito: ${v.esito || 'N/A'}`);
          console.log(`      Descrizione SPARQL: ${(v.descrizione || v.titolo || '').substring(0, 60)}...`);
          console.log(`      Descrizione Openpolis: ${v.descrizione_openpolis ? v.descrizione_openpolis.substring(0, 60) + '...' : 'N/A (non arricchita)'}`);
          console.log(`      Spiegazione AI: ${v.spiegazione_ai ? '✅ Disponibile' : '❌ Non disponibile'}`);
          console.log(`      Metadati: ${Object.keys(v.metadati || {}).length} campi`);
        });
      }
    } catch (error) {
      console.error(`   ❌ Errore query Camera: ${error.message}`);
    }
    
    const querySenato = `
      SELECT 
        p.id,
        p.uri,
        p.votazione_id,
        p.camera,
        p.titolo,
        p.descrizione,
        p.data_votazione,
        p.esito,
        p.uri_seduta,
        p.numero_seduta,
        p.titolo_seduta,
        p.legislatura,
        p.favorevoli,
        p.contrari,
        p.presenti,
        p.votanti,
        p.maggioranza,
        p.tipo_votazione,
        p.approvato,
        p.metadati,
        p.created_at,
        p.updated_at,
        p.data_sincronizzazione,
        vp.descrizione_votazione as descrizione_openpolis,
        vp.spiegazione as spiegazione_ai
      FROM parlamento p
      LEFT JOIN votazioni_parlamento vp ON (
        LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
        AND p.camera = vp.camera
        AND (
          (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
          (p.data_votazione = vp.data_votazione)
        )
      )
      WHERE p.titolo IS NOT NULL 
        AND p.titolo != ''
        AND p.titolo != 'N/A'
        AND p.camera = 'Senato'
      ORDER BY 
        COALESCE(p.data_votazione, p.data_sincronizzazione) DESC NULLS LAST,
        p.data_sincronizzazione DESC NULLS LAST,
        p.updated_at DESC NULLS LAST
      LIMIT 3
    `;
    
    try {
      const resultSenato = await pool.query(querySenato);
      console.log(`\n   ✅ Query Senato: ${resultSenato.rows.length} risultati`);
      
      if (resultSenato.rows.length > 0) {
        resultSenato.rows.forEach((v, i) => {
          console.log(`\n   ${i + 1}. ${v.titolo}`);
          console.log(`      Data: ${v.data_votazione || 'N/A'}`);
          console.log(`      Esito: ${v.esito || 'N/A'}`);
          console.log(`      Favorevoli: ${v.favorevoli || 'N/A'}, Contrari: ${v.contrari || 'N/A'}`);
          console.log(`      Presenti: ${v.presenti || 'N/A'}, Votanti: ${v.votanti || 'N/A'}`);
          console.log(`      Descrizione SPARQL: ${(v.descrizione || v.titolo || '').substring(0, 60)}...`);
          console.log(`      Descrizione Openpolis: ${v.descrizione_openpolis ? v.descrizione_openpolis.substring(0, 60) + '...' : 'N/A (non arricchita)'}`);
          console.log(`      Spiegazione AI: ${v.spiegazione_ai ? '✅ Disponibile' : '❌ Non disponibile'}`);
          console.log(`      Metadati: ${Object.keys(v.metadati || {}).length} campi`);
          if (v.metadati) {
            const meta = v.metadati;
            console.log(`      - Astenuti: ${meta.astenuti || 'N/A'}`);
            console.log(`      - Numero Legale: ${meta.numeroLegale || 'N/A'}`);
            console.log(`      - Presidente: ${meta.presidente || 'N/A'}`);
            console.log(`      - Tipo Seduta: ${meta.sedutaTipo || 'N/A'}`);
          }
        });
      }
    } catch (error) {
      console.error(`   ❌ Errore query Senato: ${error.message}`);
    }
    
    // 5. Test formattazione dati (simula quello che fa l'endpoint)
    console.log('\n5️⃣ Test formattazione dati (simula endpoint)...');
    
    if (resultSenato && resultSenato.rows.length > 0) {
      const primo = resultSenato.rows[0];
      const descrizioneCompleta = primo.descrizione_openpolis || 
                                 primo.descrizione || 
                                 primo.titolo || 
                                 'Votazione parlamentare';
      
      const formato = {
        id: primo.id,
        titolo_votazione: primo.titolo || 'Votazione parlamentare',
        descrizione_votazione: descrizioneCompleta,
        data_votazione: primo.data_votazione || null,
        esito: primo.esito,
        favorevoli: primo.favorevoli,
        contrari: primo.contrari,
        presenti: primo.presenti,
        votanti: primo.votanti,
        maggioranza: primo.maggioranza,
        astenuti: primo.metadati?.astenuti || null,
        numero_legale: primo.metadati?.numeroLegale || null,
        presidente: primo.metadati?.presidente || null,
        tipo_seduta: primo.metadati?.sedutaTipo || null,
        spiegazione: primo.spiegazione_ai || null,
        dati_arricchiti: !!primo.descrizione_openpolis
      };
      
      console.log('   ✅ Formato dati (esempio):');
      console.log(JSON.stringify(formato, null, 2));
    }
    
    // 6. Verifica matching tra tabelle
    console.log('\n6️⃣ Verifica matching tra parlamento e votazioni_parlamento...');
    
    const matchQuery = `
      SELECT 
        COUNT(*) as total_parlamento,
        COUNT(vp.id) as matched,
        COUNT(*) - COUNT(vp.id) as not_matched
      FROM parlamento p
      LEFT JOIN votazioni_parlamento vp ON (
        LOWER(TRIM(p.titolo)) = LOWER(TRIM(vp.titolo_votazione))
        AND p.camera = vp.camera
        AND (
          (p.data_votazione IS NULL AND vp.data_votazione IS NULL) OR
          (p.data_votazione = vp.data_votazione)
        )
      )
      WHERE p.titolo IS NOT NULL 
        AND p.titolo != ''
        AND p.titolo != 'N/A'
    `;
    
    try {
      const matchResult = await pool.query(matchQuery);
      const match = matchResult.rows[0];
      console.log(`   📊 Totale votazioni in parlamento: ${match.total_parlamento}`);
      console.log(`   ✅ Matched con votazioni_parlamento: ${match.matched}`);
      console.log(`   ⚠️ Non matched: ${match.not_matched}`);
      if (match.total_parlamento > 0) {
        const percentuale = ((match.matched / match.total_parlamento) * 100).toFixed(1);
        console.log(`   📈 Percentuale match: ${percentuale}%`);
      }
    } catch (error) {
      console.error(`   ❌ Errore verifica matching: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETATO');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Errore generale:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testParlamentoCompleto().catch(console.error);
