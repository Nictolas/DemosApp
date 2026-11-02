'use strict';
// Legacy helper printed partial credentials and advertised an unapproved migration.
// Refuse before reading .env or revealing any connection-string/token prefix.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per verificare la configurazione necessaria per la migrazione
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔍 Verifica configurazione migrazione Neon → Axiom\n');

const requiredVars = {
  'DATABASE_URL': {
    description: 'Connection string Neon',
    check: (val) => val && !val.includes('username:password') && !val.includes('your-')
  },
  'AXIOM_API_TOKEN': {
    description: 'Axiom API Token',
    check: (val) => val && val.startsWith('xaat-')
  },
  'AXIOM_ORG_ID': {
    description: 'Axiom Organization ID',
    check: (val) => val && val.length > 0
  }
};

const optionalVars = {
  'AXIOM_DATASET': {
    description: 'Dataset Axiom per centralized_logs',
    default: 'centralized_logs'
  },
  'AXIOM_REALTIME_DATASET': {
    description: 'Dataset Axiom per audit_logs',
    default: 'real-time'
  },
  'AXIOM_REGION': {
    description: 'Regione Axiom',
    default: 'eu'
  },
  'AXIOM_ANONYMIZE': {
    description: 'Anonimizzazione GDPR',
    default: 'false'
  }
};

let allOk = true;

console.log('📋 Variabili richieste:');
for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const isValid = config.check(value);
  
  if (isValid) {
    const masked = varName === 'DATABASE_URL' 
      ? value.substring(0, 20) + '...' 
      : value.substring(0, 10) + '...';
    console.log(`   ✅ ${varName}: ${masked}`);
  } else {
    console.log(`   ❌ ${varName}: MANCANTE o NON VALIDO`);
    console.log(`      ${config.description}`);
    allOk = false;
  }
}

console.log('\n📋 Variabili opzionali:');
for (const [varName, config] of Object.entries(optionalVars)) {
  const value = process.env[varName] || config.default;
  console.log(`   ${process.env[varName] ? '✅' : '⚪'} ${varName}: ${value} ${!process.env[varName] ? '(default)' : ''}`);
}

if (!allOk) {
  console.log('\n❌ Configurazione incompleta!');
  console.log('\n💡 Per completare la configurazione:');
  console.log('   1. Apri il file .env nella root del progetto');
  console.log('   2. Aggiungi le variabili mancanti');
  console.log('\n💡 Per ottenere DATABASE_URL:');
  console.log('   - Vai su https://console.neon.tech');
  console.log('   - Seleziona il tuo progetto');
  console.log('   - Vai su "Connection Details"');
  console.log('   - Copia la connection string');
  process.exit(1);
}

console.log('\n✅ Configurazione completa!');
console.log('\n🚀 Puoi procedere con la migrazione:');
console.log('   node scripts/migrate-local.js dry-run    # Per vedere quanti record ci sono');
console.log('   node scripts/migrate-local.js migrate    # Per eseguire la migrazione');

