// Script automatizzato per deduplicare i dati su Axiom
// Questo script usa l'API per eseguire la deduplicazione
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const axios = require('axios');

// Configurazione
const API_BASE_URL = process.env.API_BASE_URL || 'https://demos-c7k0.onrender.com/api';
const DATASET = 'centralized_logs';

// Token di autenticazione (devi inserirlo manualmente o usare variabile d'ambiente)
const AUTH_TOKEN = process.env.AXIOM_DEDUP_TOKEN || null;

async function deduplicateDataset() {
  console.log('🧹 Script Deduplicazione Axiom\n');
  console.log(`📊 Dataset: ${DATASET}`);
  console.log(`🌐 API: ${API_BASE_URL}\n`);
  
  if (!AUTH_TOKEN) {
    console.error('❌ ERRORE: Token di autenticazione mancante!');
    console.error('   Imposta AXIOM_DEDUP_TOKEN nel file .env o passalo come parametro');
    console.error('   Puoi ottenere il token dal localStorage del browser (chiave "auth_token")');
    process.exit(1);
  }
  
  try {
    // Step 1: Trova duplicati
    console.log('📊 STEP 1: Analisi duplicati...\n');
    const findResponse = await axios.post(
      `${API_BASE_URL}/admin/axiom-data/find-duplicates`,
      { dataset: DATASET },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minuti
      }
    );
    
    if (!findResponse.data.success) {
      console.error('❌ Errore analisi duplicati:', findResponse.data.error);
      process.exit(1);
    }
    
    const { duplicatesCount, totalCount, uniqueCount } = findResponse.data.data;
    
    console.log(`   Record totali: ${totalCount.toLocaleString('it-IT')}`);
    console.log(`   Record unici: ${uniqueCount.toLocaleString('it-IT')}`);
    console.log(`   Duplicati: ${duplicatesCount.toLocaleString('it-IT')}`);
    console.log(`   Percentuale duplicati: ${((duplicatesCount / totalCount) * 100).toFixed(2)}%\n`);
    
    if (duplicatesCount === 0) {
      console.log('✅ Nessun duplicato trovato. Niente da fare!');
      process.exit(0);
    }
    
    // Step 2: Conferma
    console.log('⚠️ ATTENZIONE: Questa operazione:');
    console.log('   1. Creerà un nuovo dataset con record unici');
    console.log('   2. Eliminerà il dataset originale');
    console.log('   3. Rinominerà il nuovo dataset con il nome originale');
    console.log('   4. È IRREVERSIBILE\n');
    
    // In modalità automatica, procediamo (ma potresti voler aggiungere una conferma)
    console.log('🚀 Procedo con la deduplicazione...\n');
    
    // Step 3: Rimuovi duplicati
    console.log('📊 STEP 2: Rimozione duplicati (questo può richiedere molto tempo)...\n');
    console.log('   ⏳ Attendi, questa operazione può richiedere diversi minuti...\n');
    
    const removeResponse = await axios.post(
      `${API_BASE_URL}/admin/axiom-data/remove-duplicates`,
      { dataset: DATASET },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minuti (per dataset grandi)
      }
    );
    
    if (!removeResponse.data.success) {
      console.error('❌ Errore rimozione duplicati:', removeResponse.data.error);
      console.error('   Messaggio:', removeResponse.data.message);
      process.exit(1);
    }
    
    const { recordsDeduplicated, duplicatesRemoved } = removeResponse.data.data;
    
    console.log('✅ Deduplicazione completata!\n');
    console.log(`   Record deduplicati: ${recordsDeduplicated.toLocaleString('it-IT')}`);
    console.log(`   Duplicati rimossi: ${duplicatesRemoved.toLocaleString('it-IT')}`);
    console.log(`   Messaggio: ${removeResponse.data.data.message}\n`);
    
    // Step 4: Verifica
    console.log('📊 STEP 3: Verifica risultato...\n');
    
    const verifyResponse = await axios.post(
      `${API_BASE_URL}/admin/axiom-data/find-duplicates`,
      { dataset: DATASET },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    if (verifyResponse.data.success) {
      const { duplicatesCount: newDuplicates, totalCount: newTotal } = verifyResponse.data.data;
      console.log(`   Record totali dopo deduplicazione: ${newTotal.toLocaleString('it-IT')}`);
      console.log(`   Duplicati rimanenti: ${newDuplicates.toLocaleString('it-IT')}`);
      
      if (newDuplicates === 0) {
        console.log('   ✅ Nessun duplicato rimanente!');
      } else {
        console.log(`   ⚠️ Ancora ${newDuplicates.toLocaleString('it-IT')} duplicati rimanenti`);
      }
    }
    
    console.log('\n✅ Processo completato con successo!');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Errore API:', error.response.status, error.response.statusText);
      console.error('   Dettagli:', error.response.data);
    } else if (error.request) {
      console.error('❌ Errore di rete: Nessuna risposta dal server');
      console.error('   Verifica che il server sia raggiungibile');
    } else {
      console.error('❌ Errore:', error.message);
    }
    process.exit(1);
  }
}

// Esegui
deduplicateDataset();

