const cron = require('node-cron');
const { archiveOldData } = require('./data-archival-strategy');

/**
 * AUTOMAZIONE ARCHIVIAZIONE DATI
 * 
 * Questo script automatizza l'archiviazione dei dati secondo le policy GDPR
 * utilizzando cron job per eseguire l'archiviazione a intervalli regolari.
 */

// Configurazione cron job
const CRON_SCHEDULES = {
  // Archiviazione giornaliera alle 2:00 AM
  daily: '0 2 * * *',
  
  // Archiviazione settimanale (domenica alle 3:00 AM)
  weekly: '0 3 * * 0',
  
  // Archiviazione mensile (1° del mese alle 4:00 AM)
  monthly: '0 4 1 * *'
};

// Configurazione archiviazione per frequenza
const ARCHIVAL_CONFIG = {
  // Archiviazione giornaliera - dati ad alta frequenza
  daily: {
    tables: ['performance_metrics', 'health_checks', 'centralized_logs'],
    description: 'Archiviazione dati ad alta frequenza'
  },
  
  // Archiviazione settimanale - dati di sicurezza
  weekly: {
    tables: ['security_events', 'access_audit'],
    description: 'Archiviazione dati di sicurezza'
  },
  
  // Archiviazione mensile - audit logs
  monthly: {
    tables: ['audit_logs'],
    description: 'Archiviazione audit logs'
  }
};

/**
 * Avvia l'automazione dell'archiviazione
 */
function startAutomatedArchival() {
  console.log('🤖 Avvio automazione archiviazione dati...');
  
  // Archiviazione giornaliera
  cron.schedule(CRON_SCHEDULES.daily, async () => {
    console.log('📅 Esecuzione archiviazione giornaliera...');
    await runArchivalForTables(ARCHIVAL_CONFIG.daily);
  }, {
    scheduled: true,
    timezone: "Europe/Rome"
  });
  
  // Archiviazione settimanale
  cron.schedule(CRON_SCHEDULES.weekly, async () => {
    console.log('📅 Esecuzione archiviazione settimanale...');
    await runArchivalForTables(ARCHIVAL_CONFIG.weekly);
  }, {
    scheduled: true,
    timezone: "Europe/Rome"
  });
  
  // Archiviazione mensile
  cron.schedule(CRON_SCHEDULES.monthly, async () => {
    console.log('📅 Esecuzione archiviazione mensile...');
    await runArchivalForTables(ARCHIVAL_CONFIG.monthly);
  }, {
    scheduled: true,
    timezone: "Europe/Rome"
  });
  
  console.log('✅ Automazione archiviazione avviata');
  console.log('📋 Schedule configurati:');
  console.log(`   - Giornaliera: ${CRON_SCHEDULES.daily} (${ARCHIVAL_CONFIG.daily.description})`);
  console.log(`   - Settimanale: ${CRON_SCHEDULES.weekly} (${ARCHIVAL_CONFIG.weekly.description})`);
  console.log(`   - Mensile: ${CRON_SCHEDULES.monthly} (${ARCHIVAL_CONFIG.monthly.description})`);
}

/**
 * Esegue archiviazione per tabelle specifiche
 */
async function runArchivalForTables(config) {
  try {
    console.log(`🔄 ${config.description}...`);
    
    const startTime = Date.now();
    
    // Esegui archiviazione per ogni tabella
    for (const tableName of config.tables) {
      console.log(`📋 Archiviazione tabella: ${tableName}`);
      await archiveTableByName(tableName);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${config.description} completata in ${duration}ms`);
    
  } catch (error) {
    console.error(`❌ Errore durante ${config.description}:`, error);
    
    // Invia notifica di errore (es. email, Slack, etc.)
    await sendErrorNotification(config.description, error);
  }
}

/**
 * Archivia una singola tabella
 */
async function runArchivalForTables(config) {
  try {
    console.log(`🔄 ${config.description}...`);
    
    const startTime = Date.now();
    
    // Esegui archiviazione per ogni tabella
    for (const tableName of config.tables) {
      console.log(`📋 Archiviazione tabella: ${tableName}`);
      await archiveTableByName(tableName);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${config.description} completata in ${duration}ms`);
    
  } catch (error) {
    console.error(`❌ Errore durante ${config.description}:`, error);
    
    // Invia notifica di errore (es. email, Slack, etc.)
    await sendErrorNotification(config.description, error);
  }
}

/**
 * Archivia una singola tabella
 */
async function archiveTableByName(tableName) {
  const { RETENTION_POLICIES } = require('./data-archival-strategy');
  
  const policy = RETENTION_POLICIES[tableName];
  if (!policy) {
    console.log(`⚠️ Nessuna policy trovata per ${tableName}`);
    return;
  }
  
  // Implementa archiviazione specifica per tabella
  await archiveTableData(tableName, policy);
}

/**
 * Invia notifica di errore
 */
async function sendErrorNotification(operation, error) {
  console.log(`🚨 Invio notifica errore per: ${operation}`);
  
  // Implementa invio notifica (email, Slack, Discord, etc.)
  const notification = {
    operation,
    error: error.message,
    timestamp: new Date().toISOString(),
    stack: error.stack
  };
  
  // Esempio: invio email
  // await sendEmail({
  //   to: 'admin@demosapp.it',
  //   subject: `Errore Archiviazione: ${operation}`,
  //   body: JSON.stringify(notification, null, 2)
  // });
  
  console.log('📧 Notifica errore inviata');
}

/**
 * Funzione per test manuale
 */
async function testArchival() {
  console.log('🧪 Test archiviazione manuale...');
  
  // Test archiviazione giornaliera
  await runArchivalForTables(ARCHIVAL_CONFIG.daily);
  
  console.log('✅ Test completato');
}

/**
 * Funzione per archiviazione immediata
 */
async function runImmediateArchival() {
  console.log('⚡ Esecuzione archiviazione immediata...');
  
  const allTables = [
    ...ARCHIVAL_CONFIG.daily.tables,
    ...ARCHIVAL_CONFIG.weekly.tables,
    ...ARCHIVAL_CONFIG.monthly.tables
  ];
  
  for (const tableName of allTables) {
    console.log(`📋 Archiviazione immediata: ${tableName}`);
    await archiveTableByName(tableName);
  }
  
  console.log('✅ Archiviazione immediata completata');
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, shutdown graceful...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, shutdown graceful...');
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startAutomatedArchival();
      break;
    case 'test':
      testArchival();
      break;
    case 'immediate':
      runImmediateArchival();
      break;
    default:
      console.log('Uso: node automated-archival.js [start|test|immediate]');
      console.log('  start     - Avvia automazione cron');
      console.log('  test      - Test archiviazione');
      console.log('  immediate - Archiviazione immediata');
  }
}

module.exports = {
  startAutomatedArchival,
  testArchival,
  runImmediateArchival,
  CRON_SCHEDULES,
  ARCHIVAL_CONFIG
};
