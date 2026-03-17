const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testVotiPolitici() {
  console.log('='.repeat(80));
  console.log('TEST SINCRONIZZAZIONE VOTI POLITICI');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. Verifica che la tabella esista
    console.log('1️⃣ Verifica esistenza tabella...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voti_politici'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ La tabella voti_politici non esiste!');
      console.log('💡 Esegui lo script SQL: create-voti-politici-table.sql');
      return;
    }
    console.log('✅ Tabella voti_politici esiste');
    console.log();

    // 2. Conta i record attuali
    console.log('2️⃣ Conta record attuali...');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Record attuali nella tabella: ${currentCount}`);
    console.log();

    // 3. Test query SPARQL
    console.log('3️⃣ Test query SPARQL...');
    
    // Query ottimizzata per ottenere label, approvato e seduta
    let sparqlQuery = `
      PREFIX ocd: <http://dati.camera.it/ocd/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT DISTINCT ?votazione ?label ?approvato ?seduta
      WHERE {
        ?votazione a <http://dati.camera.it/ocd/votazione> .
        OPTIONAL { ?votazione rdfs:label ?label . }
        OPTIONAL { ?votazione ocd:approvato ?approvato . }
        OPTIONAL { ?votazione ocd:rif_seduta ?seduta . }
      }
      ORDER BY DESC(?votazione)
      LIMIT 50
    `;
    
    console.log('🔍 Query con URI corretto (votazione minuscolo)...');

    const sparqlEndpoint = 'http://dati.camera.it/sparql';
    const params = new URLSearchParams();
    params.append('query', sparqlQuery);
    params.append('format', 'json');
    
    console.log('🔍 Endpoint:', sparqlEndpoint);
    console.log('🔍 Query:', sparqlQuery.substring(0, 200) + '...');
    
    // Prova con GET invece di POST
    const response = await axios.get(`${sparqlEndpoint}?${params.toString()}`, {
      headers: {
        'Accept': 'application/sparql-results+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    console.log('✅ SPARQL Response status:', response.status);
    let bindings = response.data?.results?.bindings || [];
    console.log(`📊 SPARQL Results (query semplice): ${bindings.length} bindings trovati`);
    
    
    console.log();

    if (bindings.length === 0) {
      console.log('⚠️ ATTENZIONE: SPARQL non restituisce dati!');
      console.log('📋 Response data:', JSON.stringify(response.data, null, 2).substring(0, 500));
      console.log();
      console.log('💡 Possibili cause:');
      console.log('   - L\'endpoint SPARQL potrebbe non essere disponibile');
      console.log('   - La query potrebbe non essere corretta');
      console.log('   - Potrebbero non esserci votazioni disponibili');
      console.log('   - L\'endpoint potrebbe richiedere autenticazione o parametri aggiuntivi');
      return;
    }

    // 4. Processa i risultati (nuova struttura)
    console.log('4️⃣ Processa risultati SPARQL...');
    const votazioni = {};
    for (const result of bindings) {
      const votazioneUri = result.votazione?.value;
      if (!votazioneUri) continue;

      if (!votazioni[votazioneUri]) {
        votazioni[votazioneUri] = {
          uri: votazioneUri,
          votazione_id: votazioneUri.split('/').pop() || votazioneUri,
          legislatura: null,
          data_votazione: null,
          descrizione: result.label?.value || null,
          esito: result.approvato?.value === '1' || result.approvato?.value === 1 ? 'Approvato' : 
                 result.approvato?.value === '0' || result.approvato?.value === 0 ? 'Non Approvato' : null,
          sigla_atto: null,
          numero_atto: null,
          tipo_atto: null,
          seduta: result.seduta?.value || null,
          metadati: {
            label: result.label?.value || null,
            approvato: result.approvato?.value || null,
            seduta: result.seduta?.value || null
          }
        };
      }
    }

    console.log(`✅ Processate ${Object.keys(votazioni).length} votazioni uniche`);
    console.log();

    // 5. Prova a salvare nel database
    console.log('5️⃣ Test salvataggio nel database...');
    const votazioniArray = Object.values(votazioni);
    let savedCount = 0;
    let errorCount = 0;

    for (const votazione of votazioniArray.slice(0, 3)) { // Salva solo i primi 3 per test
      try {
        const result = await pool.query(
          `INSERT INTO voti_politici (
            uri, votazione_id, legislatura, data_votazione, descrizione,
            esito, sigla_atto, numero_atto, tipo_atto, metadati
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (uri) 
          DO UPDATE SET
            data_votazione = EXCLUDED.data_votazione,
            descrizione = EXCLUDED.descrizione,
            esito = EXCLUDED.esito,
            sigla_atto = EXCLUDED.sigla_atto,
            numero_atto = EXCLUDED.numero_atto,
            tipo_atto = EXCLUDED.tipo_atto,
            metadati = EXCLUDED.metadati,
            data_aggiornamento = CURRENT_TIMESTAMP`,
          [
            votazione.uri,
            votazione.votazione_id,
            votazione.legislatura,
            votazione.data_votazione,
            votazione.descrizione,
            votazione.esito,
            votazione.sigla_atto,
            votazione.numero_atto,
            votazione.tipo_atto,
            JSON.stringify({
            ...votazione.metadati,
            seduta: votazione.seduta || null
          })
          ]
        );
        savedCount++;
        console.log(`  ✅ Salvata votazione: ${votazione.votazione_id}`);
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Errore nel salvare ${votazione.votazione_id}:`, error.message);
      }
    }

    console.log();
    console.log(`📊 Risultati salvataggio: ${savedCount} salvate, ${errorCount} errori`);
    console.log();

    // 6. Verifica finale
    console.log('6️⃣ Verifica finale...');
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM voti_politici');
    const finalCountValue = parseInt(finalCount.rows[0].count);
    console.log(`📊 Record totali nella tabella: ${finalCountValue}`);
    
    if (finalCountValue > currentCount) {
      console.log(`✅ SUCCESSO: ${finalCountValue - currentCount} nuovi record aggiunti!`);
    } else {
      console.log('⚠️ Nessun nuovo record aggiunto');
    }

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testVotiPolitici();

