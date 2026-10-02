const { Pool } = require('pg');
const axios = require('axios');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function testParlamento() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST TABELLA PARLAMENTO E RECUPERO DATI SPARQL');
  console.log('='.repeat(80));
  
  try {
    // 1. Verifica se la tabella esiste
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
    
    // 2. Conta record esistenti
    console.log('\n2️⃣ Conta record esistenti...');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM parlamento');
    const count = parseInt(countResult.rows[0].count);
    console.log(`   📊 Record nella tabella: ${count}`);
    
    // 3. Test recupero da SPARQL Camera
    console.log('\n3️⃣ Test recupero da SPARQL Camera...');
    try {
      const queryCamera = `
        PREFIX ocd: <http://dati.camera.it/ocd/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?votazione ?label ?approvato ?seduta ?sedutaData ?sedutaNumero ?sedutaTitle ?sedutaLegislatura
        WHERE {
          ?votazione a <http://dati.camera.it/ocd/votazione> .
          FILTER(CONTAINS(STR(?votazione), "vs19"))
          OPTIONAL { ?votazione rdfs:label ?label . }
          OPTIONAL { ?votazione ocd:approvato ?approvato . }
          OPTIONAL { 
            ?votazione ocd:rif_seduta ?seduta .
            OPTIONAL { ?seduta ocd:data ?sedutaData . }
            OPTIONAL { ?seduta ocd:identifier ?sedutaNumero . }
            OPTIONAL { ?seduta ocd:title ?sedutaTitle . }
            OPTIONAL { 
              ?seduta ocd:rif_leg ?legislatura .
              OPTIONAL { ?legislatura ocd:numero ?sedutaLegislatura . }
            }
          }
        }
        ORDER BY DESC(?votazione)
        LIMIT 3
      `;
      
      const params = new URLSearchParams();
      params.append('query', queryCamera);
      params.append('format', 'json');
      
      const response = await axios.get(`http://dati.camera.it/sparql?${params.toString()}`, {
        headers: {
          'Accept': 'application/sparql-results+json, application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
      });
      
      const bindings = response.data?.results?.bindings || [];
      console.log(`   ✅ Recuperate ${bindings.length} votazioni dalla Camera`);
      
      if (bindings.length > 0) {
        const primo = bindings[0];
        console.log('\n   📄 Esempio votazione Camera:');
        console.log(`      URI: ${primo.votazione?.value}`);
        console.log(`      Label: ${primo.label?.value || 'N/A'}`);
        console.log(`      Approvato: ${primo.approvato?.value || 'N/A'}`);
        console.log(`      Data Seduta: ${primo.sedutaData?.value || 'N/A'}`);
        console.log(`      Numero Seduta: ${primo.sedutaNumero?.value || 'N/A'}`);
        console.log(`      Legislatura: ${primo.sedutaLegislatura?.value || 'N/A'}`);
      }
    } catch (error) {
      console.error(`   ❌ Errore SPARQL Camera: ${error.message}`);
    }
    
    // 4. Test recupero da SPARQL Senato
    console.log('\n4️⃣ Test recupero da SPARQL Senato...');
    try {
      const querySenato = `
        PREFIX osr: <http://dati.senato.it/osr/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT DISTINCT ?votazione ?label ?favorevoli ?contrari ?presenti ?votanti ?maggioranza 
                        ?tipoVotazione ?seduta ?sedutaData ?sedutaNumero ?sedutaLegislatura
        WHERE {
          ?votazione a osr:Votazione .
          OPTIONAL { ?votazione rdfs:label ?label . }
          OPTIONAL { ?votazione osr:favorevoli ?favorevoli . }
          OPTIONAL { ?votazione osr:contrari ?contrari . }
          OPTIONAL { ?votazione osr:presenti ?presenti . }
          OPTIONAL { ?votazione osr:votanti ?votanti . }
          OPTIONAL { ?votazione osr:maggioranza ?maggioranza . }
          OPTIONAL { ?votazione osr:tipoVotazione ?tipoVotazione . }
          OPTIONAL { 
            ?votazione osr:seduta ?seduta .
            OPTIONAL { ?seduta osr:dataSeduta ?sedutaData . }
            OPTIONAL { ?seduta osr:numeroSeduta ?sedutaNumero . }
            OPTIONAL { ?seduta osr:legislatura ?sedutaLegislatura . }
          }
        }
        ORDER BY DESC(?votazione)
        LIMIT 3
      `;
      
      const params = new URLSearchParams();
      params.append('query', querySenato);
      params.append('format', 'json');
      
      const response = await axios.get(`https://dati.senato.it/sparql?${params.toString()}`, {
        headers: {
          'Accept': 'application/sparql-results+json, application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
      });
      
      const bindings = response.data?.results?.bindings || [];
      console.log(`   ✅ Recuperate ${bindings.length} votazioni dal Senato`);
      
      if (bindings.length > 0) {
        const primo = bindings[0];
        console.log('\n   📄 Esempio votazione Senato:');
        console.log(`      URI: ${primo.votazione?.value}`);
        console.log(`      Label: ${primo.label?.value || 'N/A'}`);
        console.log(`      Favorevoli: ${primo.favorevoli?.value || 'N/A'}`);
        console.log(`      Contrari: ${primo.contrari?.value || 'N/A'}`);
        console.log(`      Data Seduta: ${primo.sedutaData?.value || 'N/A'}`);
        console.log(`      Numero Seduta: ${primo.sedutaNumero?.value || 'N/A'}`);
        console.log(`      Legislatura: ${primo.sedutaLegislatura?.value || 'N/A'}`);
      }
    } catch (error) {
      console.error(`   ❌ Errore SPARQL Senato: ${error.message}`);
    }
    
    // 5. Test query ultime votazioni dalla tabella
    console.log('\n5️⃣ Test query ultime votazioni dalla tabella parlamento...');
    try {
      const queryCamera = await pool.query(`
        SELECT 
          p.id, p.uri, p.titolo, p.data_votazione, p.esito, p.camera,
          p.numero_seduta, p.legislatura, p.favorevoli, p.contrari
        FROM parlamento p
        WHERE p.camera = 'Camera'
        ORDER BY COALESCE(p.data_votazione, p.data_sincronizzazione) DESC NULLS LAST
        LIMIT 3
      `);
      
      console.log(`   ✅ Trovate ${queryCamera.rows.length} votazioni Camera nella tabella`);
      if (queryCamera.rows.length > 0) {
        queryCamera.rows.forEach((v, i) => {
          console.log(`\n   ${i + 1}. ${v.titolo}`);
          console.log(`      Data: ${v.data_votazione || 'N/A'}`);
          console.log(`      Esito: ${v.esito || 'N/A'}`);
          console.log(`      Seduta: ${v.numero_seduta || 'N/A'}`);
        });
      }
      
      const querySenato = await pool.query(`
        SELECT 
          p.id, p.uri, p.titolo, p.data_votazione, p.esito, p.camera,
          p.numero_seduta, p.legislatura, p.favorevoli, p.contrari
        FROM parlamento p
        WHERE p.camera = 'Senato'
        ORDER BY COALESCE(p.data_votazione, p.data_sincronizzazione) DESC NULLS LAST
        LIMIT 3
      `);
      
      console.log(`\n   ✅ Trovate ${querySenato.rows.length} votazioni Senato nella tabella`);
      if (querySenato.rows.length > 0) {
        querySenato.rows.forEach((v, i) => {
          console.log(`\n   ${i + 1}. ${v.titolo}`);
          console.log(`      Data: ${v.data_votazione || 'N/A'}`);
          console.log(`      Esito: ${v.esito || 'N/A'}`);
          console.log(`      Favorevoli: ${v.favorevoli || 'N/A'}, Contrari: ${v.contrari || 'N/A'}`);
        });
      }
    } catch (error) {
      console.error(`   ❌ Errore query tabella: ${error.message}`);
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

testParlamento().catch(console.error);
