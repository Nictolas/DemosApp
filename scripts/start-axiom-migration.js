'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per avviare la migrazione Axiom da Render
// Uso: node scripts/start-axiom-migration.js [--dry-run] [--tables=centralized_logs,audit_logs]

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const https = require('https');
const http = require('http');

// Configurazione
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || process.env.BACKEND_URL || 'https://demos-backend.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.JWT_SECRET; // Token admin per autenticazione

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function checkStatus() {
  console.log('📊 Verifica statistiche migrazione...\n');
  
  try {
    const url = `${RENDER_BACKEND_URL}/api/admin/axiom-migration/status`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const response = await makeRequest(url, options);
    
    if (response.status === 200) {
      console.log('✅ Statistiche:');
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } else {
      console.error('❌ Errore:', response.status, response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Errore richiesta:', error.message);
    return null;
  }
}

async function startMigration(tables = ['centralized_logs', 'audit_logs'], dryRun = false) {
  console.log('🚀 Avvio migrazione...\n');
  console.log(`   Tables: ${tables.join(', ')}`);
  console.log(`   Dry Run: ${dryRun}\n`);
  
  try {
    const url = `${RENDER_BACKEND_URL}/api/admin/axiom-migration/migrate`;
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: {
        tables,
        dryRun
      }
    };
    
    const response = await makeRequest(url, options);
    
    if (response.status === 200) {
      console.log('✅ Migrazione avviata!');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n💡 La migrazione è in esecuzione in background.');
      console.log('💡 Monitora i log su Render per vedere il progresso.');
      return response.data;
    } else {
      console.error('❌ Errore:', response.status, response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Errore richiesta:', error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tablesArg = args.find(arg => arg.startsWith('--tables='));
  const tables = tablesArg 
    ? tablesArg.split('=')[1].split(',')
    : ['centralized_logs', 'audit_logs'];
  
  if (!ADMIN_TOKEN) {
    console.error('❌ ADMIN_TOKEN o JWT_SECRET non configurato nel .env');
    console.error('💡 Aggiungi ADMIN_TOKEN=tuo-token-admin nel file .env');
    process.exit(1);
  }
  
  console.log('🔧 Configurazione:');
  console.log(`   Backend URL: ${RENDER_BACKEND_URL}`);
  console.log(`   Admin Token: ${ADMIN_TOKEN ? '✅ Configurato' : '❌ Mancante'}\n`);
  
  // Prima verifica lo status
  const stats = await checkStatus();
  
  if (!stats) {
    console.error('❌ Impossibile recuperare statistiche. Verifica la configurazione.');
    process.exit(1);
  }
  
  if (dryRun) {
    console.log('\n🧪 Modalità DRY RUN - Nessuna migrazione verrà avviata');
    process.exit(0);
  }
  
  // Chiedi conferma
  console.log('\n⚠️  ATTENZIONE: Questo avvierà la migrazione reale dei dati.');
  console.log('   I dati verranno inviati ad Axiom.');
  console.log('\n💡 Per avviare la migrazione, esegui:');
  console.log('   node scripts/start-axiom-migration.js --confirm');
  
  if (args.includes('--confirm')) {
    await startMigration(tables, false);
  } else {
    console.log('\n💡 Aggiungi --confirm per avviare realmente la migrazione');
  }
}

main().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

