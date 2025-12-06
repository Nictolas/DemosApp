// Script di test per verificare la connessione ad Axiom
require('dotenv').config();

let Axiom;
let axiom;

try {
  Axiom = require('@axiomhq/axiom-node');
  
  console.log('🔍 Verifica configurazione Axiom...\n');
  
  // Verifica variabili d'ambiente
  const requiredVars = ['AXIOM_API_TOKEN', 'AXIOM_ORG_ID', 'AXIOM_DATASET', 'AXIOM_REALTIME_DATASET'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variabili d\'ambiente mancanti:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
  
  console.log('✅ Variabili d\'ambiente configurate:');
  console.log(`   - AXIOM_ENABLED: ${process.env.AXIOM_ENABLED}`);
  console.log(`   - AXIOM_ORG_ID: ${process.env.AXIOM_ORG_ID}`);
  console.log(`   - AXIOM_DATASET: ${process.env.AXIOM_DATASET}`);
  console.log(`   - AXIOM_REALTIME_DATASET: ${process.env.AXIOM_REALTIME_DATASET}`);
  console.log(`   - AXIOM_REGION: ${process.env.AXIOM_REGION || 'eu'}`);
  console.log('');
  
  if (process.env.AXIOM_ENABLED !== 'true') {
    console.log('⚠️ AXIOM_ENABLED non è "true", Axiom è disabilitato');
    process.exit(0);
  }
  
  // Inizializza Axiom
  axiom = new Axiom({
    token: process.env.AXIOM_API_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
    region: process.env.AXIOM_REGION || 'eu'
  });
  
  console.log('✅ Client Axiom inizializzato\n');
  
  // Test invio log
  console.log('📤 Test invio log ad Axiom...\n');
  
  const testLogs = [
    {
      _time: new Date().toISOString(),
      level: 'INFO',
      message: 'Test connessione Axiom - centralized_logs',
      log_type: 'application',
      test: true
    },
    {
      _time: new Date().toISOString(),
      log_type: 'performance',
      message: 'Test connessione Axiom - real-time (performance)',
      cpu_usage: 25.5,
      memory_usage: 1024000,
      test: true
    },
    {
      _time: new Date().toISOString(),
      log_type: 'security',
      message: 'Test connessione Axiom - real-time (security)',
      type: 'test_event',
      severity: 'low',
      test: true
    },
    {
      _time: new Date().toISOString(),
      log_type: 'audit',
      message: 'Test connessione Axiom - real-time (audit)',
      action: 'TEST_ACTION',
      resource: 'test',
      test: true
    }
  ];
  
  // Invia al dataset centralized_logs
  console.log(`📤 Invio log di test a "${process.env.AXIOM_DATASET}"...`);
  await axiom.datasets.ingest(process.env.AXIOM_DATASET, [testLogs[0]]);
  console.log('   ✅ Log inviato con successo\n');
  
  // Invia al dataset real-time
  console.log(`📤 Invio log di test a "${process.env.AXIOM_REALTIME_DATASET}"...`);
  await axiom.datasets.ingest(process.env.AXIOM_REALTIME_DATASET, testLogs.slice(1));
  console.log('   ✅ Log inviati con successo\n');
  
  console.log('✅ Test completato con successo!');
  console.log('\n📊 Verifica su Axiom:');
  console.log(`   - Dataset "${process.env.AXIOM_DATASET}": https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets/${process.env.AXIOM_DATASET}`);
  console.log(`   - Dataset "${process.env.AXIOM_REALTIME_DATASET}": https://app.axiom.co/${process.env.AXIOM_ORG_ID}/datasets/${process.env.AXIOM_REALTIME_DATASET}`);
  console.log('\n💡 Clicca "Open in Stream" per vedere i log in tempo reale');
  
} catch (error) {
  console.error('❌ Errore durante il test:', error.message);
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}

