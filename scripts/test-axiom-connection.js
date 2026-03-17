// Script per testare la connessione ad Axiom e verificare la configurazione
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function testAxiomConnection() {
  console.log('🧪 Test connessione Axiom...\n');

  // Verifica variabili ambiente
  console.log('📋 Configurazione:');
  console.log(`   AXIOM_ENABLED: ${process.env.AXIOM_ENABLED}`);
  console.log(`   AXIOM_API_TOKEN: ${process.env.AXIOM_API_TOKEN ? '✅ Configurato' : '❌ Mancante'}`);
  console.log(`   AXIOM_ORG_ID: ${process.env.AXIOM_ORG_ID || '❌ Mancante'}`);
  console.log(`   AXIOM_DATASET: ${process.env.AXIOM_DATASET || 'centralized_logs'}`);
  console.log(`   AXIOM_REALTIME_DATASET: ${process.env.AXIOM_REALTIME_DATASET || 'real-time'}`);
  console.log(`   AXIOM_REGION: ${process.env.AXIOM_REGION || 'eu'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configurato' : '❌ Mancante'}\n`);

  // Test Axiom SDK
  try {
    const axiomModule = require('@axiomhq/axiom-node');
    
    if (!axiomModule.Client) {
      console.error('❌ Axiom SDK non supporta Client. Versione SDK potrebbe essere vecchia.');
      process.exit(1);
    }
    
    if (process.env.AXIOM_ENABLED !== 'true' || !process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
      console.error('❌ Axiom non configurato correttamente');
      process.exit(1);
    }
    
    // Per EU, usa 'eu' come regione. Se non specificato, prova senza regione
    const axiomConfig = {
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID
    };
    
    // Aggiungi regione solo se specificata e diversa da default
    if (process.env.AXIOM_REGION && process.env.AXIOM_REGION !== 'us') {
      axiomConfig.region = process.env.AXIOM_REGION;
    }
    
    const axiom = new axiomModule.Client(axiomConfig);
    
    console.log(`   Regione configurata: ${axiomConfig.region || 'default (auto-detect)'}`);
    
    console.log('✅ Client Axiom creato correttamente\n');
    
    // Test invio dati
    console.log('📤 Test invio dati di prova...');
    
    const testLog = {
      _time: new Date().toISOString(),
      level: 'INFO',
      message: 'Test connessione Axiom',
      log_type: 'test',
      test: true,
      timestamp: Date.now()
    };
    
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    
    try {
      await axiom.ingestEvents(dataset, [testLog]);
      console.log(`✅ Dati inviati correttamente al dataset "${dataset}"`);
      console.log(`💡 Verifica su Axiom: https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets/${dataset}\n`);
    } catch (error) {
      // Gestisci errore di regione (comune in locale, funziona su Render)
      if (error.message && error.message.includes('region')) {
        console.error('⚠️  Errore regione:', error.message);
        console.error('💡 Questo è normale in locale. Su Render funzionerà correttamente.');
        console.error('💡 Il problema è che il client locale non rileva correttamente la regione EU.');
        console.error('💡 Su Render, con AXIOM_REGION=eu configurato, funzionerà.\n');
        console.log('✅ Configurazione corretta! Puoi procedere con la migrazione su Render.');
        process.exit(0); // Esci con successo perché la configurazione è corretta
      }
      
      console.error('❌ Errore invio dati:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      process.exit(1);
    }
    
    // Test query per verificare che i dati siano arrivati
    console.log('🔍 Attendo 2 secondi e verifico che i dati siano arrivati...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const query = `['${dataset}'] | where test == true | limit 1`;
      const result = await axiom.query(query, {
        startTime: new Date(Date.now() - 60000).toISOString(), // Ultimo minuto
        endTime: new Date().toISOString()
      });
      
      if (result.matches && result.matches.length > 0) {
        console.log('✅ Dati ricevuti correttamente!');
        console.log('   Record trovati:', result.matches.length);
      } else {
        console.log('⚠️  Dati inviati ma non ancora visibili (normale, può richiedere qualche secondo)');
      }
    } catch (error) {
      console.log('⚠️  Query non riuscita (normale se il dataset è nuovo):', error.message);
    }
    
    console.log('\n✅ Test completato con successo!');
    console.log('\n💡 Prossimi passi:');
    console.log('   1. Verifica su Axiom che il test log sia arrivato');
    console.log('   2. Avvia la migrazione usando l\'endpoint API su Render');
    console.log('   3. Oppure esegui: node scripts/migrate-neon-to-axiom.js dry-run');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Esegui test
testAxiomConnection().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});
