#!/usr/bin/env node
/**
 * Script di test per l'endpoint /api/voti-politici/ultime
 * Verifica che l'endpoint funzioni correttamente e restituisca le ultime 3 votazioni
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token'; // Sostituisci con un token valido

async function testEndpointUltime() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST ENDPOINT /api/voti-politici/ultime');
  console.log('='.repeat(80));
  console.log(`URL: ${API_BASE_URL}/api/voti-politici/ultime?limit=3`);
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Richiesta base con limit=3
    console.log('📋 Test 1: Richiesta ultime 3 votazioni');
    const response1 = await axios.get(`${API_BASE_URL}/api/voti-politici/ultime?limit=3`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    console.log(`✅ Status: ${response1.status}`);
    console.log(`✅ Success: ${response1.data.success}`);
    console.log(`✅ Count: ${response1.data.count || 0}`);
    
    if (response1.data.data && Array.isArray(response1.data.data)) {
      console.log(`✅ Votazioni trovate: ${response1.data.data.length}`);
      
      if (response1.data.data.length > 0) {
        console.log('\n📊 Prima votazione (più recente):');
        const prima = response1.data.data[0];
        console.log(`   - ID: ${prima.id}`);
        console.log(`   - Camera: ${prima.camera || 'N/A'}`);
        console.log(`   - Data: ${prima.data_votazione || 'N/A'}`);
        console.log(`   - Esito: ${prima.esito || 'N/A'}`);
        console.log(`   - Descrizione: ${(prima.descrizione || '').substring(0, 60)}...`);
      }
    } else {
      console.log('⚠️ Nessuna votazione trovata');
    }

    // Test 2: Richiesta con limit personalizzato
    console.log('\n📋 Test 2: Richiesta con limit=5');
    const response2 = await axios.get(`${API_BASE_URL}/api/voti-politici/ultime?limit=5`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    console.log(`✅ Status: ${response2.status}`);
    console.log(`✅ Count: ${response2.data.count || 0}`);
    console.log(`✅ Votazioni trovate: ${response2.data.data?.length || 0}`);

    // Test 3: Verifica ordinamento (la prima deve essere la più recente)
    if (response1.data.data && response1.data.data.length > 1) {
      console.log('\n📋 Test 3: Verifica ordinamento cronologico');
      const dates = response1.data.data
        .map(v => v.data_votazione || v.data_sincronizzazione)
        .filter(d => d != null)
        .map(d => new Date(d));
      
      let isOrdered = true;
      for (let i = 1; i < dates.length; i++) {
        if (dates[i] > dates[i-1]) {
          isOrdered = false;
          break;
        }
      }
      
      console.log(`✅ Ordinamento corretto: ${isOrdered ? 'SÌ' : 'NO'}`);
      if (!isOrdered) {
        console.log('⚠️ Le votazioni non sono ordinate correttamente (più recente prima)');
      }
    }

    // Test 4: Verifica struttura dati
    if (response1.data.data && response1.data.data.length > 0) {
      console.log('\n📋 Test 4: Verifica struttura dati');
      const votazione = response1.data.data[0];
      const campiRichiesti = ['id', 'uri', 'votazione_id', 'camera', 'descrizione', 'esito'];
      const campiPresenti = campiRichiesti.filter(campo => votazione.hasOwnProperty(campo));
      
      console.log(`✅ Campi presenti: ${campiPresenti.length}/${campiRichiesti.length}`);
      campiPresenti.forEach(campo => {
        console.log(`   ✓ ${campo}: ${votazione[campo] ? 'OK' : 'NULL'}`);
      });
      
      const campiMancanti = campiRichiesti.filter(campo => !campiPresenti.includes(campo));
      if (campiMancanti.length > 0) {
        console.log(`⚠️ Campi mancanti: ${campiMancanti.join(', ')}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETATI');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    } else {
      console.error(`   Message: ${error.message}`);
    }
    process.exit(1);
  }
}

// Esegui il test
testEndpointUltime().catch(err => {
  console.error('❌ Errore generale:', err);
  process.exit(1);
});
