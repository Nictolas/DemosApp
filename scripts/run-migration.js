'use strict';

// Historical one-off migration tool. Disable before loading env, SQL or HTTP.
require('../api/services/legacyAxiomMigrationGate').exitRetiredLegacyAxiomMigration();

// Script per eseguire la migrazione da Neon a Axiom
// Supporta sia migrazione locale (con DATABASE_URL) che remota (via Render API)

const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkLocalConfig() {
  console.log('🔍 Verifica configurazione locale...\n');
  
  const hasDatabaseUrl = process.env.DATABASE_URL && 
    !process.env.DATABASE_URL.includes('username:password') && 
    !process.env.DATABASE_URL.includes('your-');
  
  const hasAxiomConfig = process.env.AXIOM_API_TOKEN && 
    process.env.AXIOM_ORG_ID;
  
  return { hasDatabaseUrl, hasAxiomConfig };
}

async function runLocalMigration() {
  console.log('🚀 Avvio migrazione locale...\n');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Prima dry-run
    console.log('📊 Esecuzione dry-run per vedere quanti record ci sono...\n');
    const { stdout: dryRunOutput } = await execPromise('node scripts/migrate-local.js dry-run', {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    console.log(dryRunOutput);
    
    // Chiedi conferma
    const confirm = await question('\n❓ Procedere con la migrazione? (s/n): ');
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
      console.log('❌ Migrazione annullata');
      rl.close();
      return;
    }
    
    // Esegui migrazione
    console.log('\n🚀 Avvio migrazione...\n');
    const { stdout: migrateOutput } = await execPromise('node scripts/migrate-local.js migrate', {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024
    });
    console.log(migrateOutput);
    
    console.log('\n✅ Migrazione completata!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
  } finally {
    rl.close();
  }
}

async function runRemoteMigration() {
  const axios = require('axios');
  const RENDER_URL = 'https://demos-c7k0.onrender.com';
  const API_BASE = `${RENDER_URL}/api`;
  
  console.log('🌐 Migrazione tramite Render API...\n');
  console.log(`📍 URL: ${API_BASE}\n`);
  
  try {
    // Chiedi token admin
    const token = await question('🔑 Inserisci il token JWT admin (o premi Invio per usare quello dal .env): ');
    const authToken = token.trim() || process.env.JWT_TOKEN || process.env.ADMIN_TOKEN;
    
    if (!authToken) {
      console.error('❌ Token non fornito. Impossibile procedere con la migrazione remota.');
      console.log('💡 Puoi:');
      console.log('   1. Aggiungere DATABASE_URL al .env per migrazione locale');
      console.log('   2. Fornire un token admin valido');
      rl.close();
      return;
    }
    
    // Verifica status
    console.log('\n📊 Verifica quanti record ci sono...\n');
    const statusResponse = await axios.get(`${API_BASE}/admin/axiom-migration/status`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (statusResponse.data.success) {
      console.log('📈 Statistiche:');
      console.log(JSON.stringify(statusResponse.data.stats, null, 2));
      console.log('\n📋 Configurazione Axiom:');
      console.log(JSON.stringify(statusResponse.data.axiomConfig, null, 2));
      
      // Chiedi conferma
      const confirm = await question('\n❓ Procedere con la migrazione? (s/n): ');
      if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
        console.log('❌ Migrazione annullata');
        rl.close();
        return;
      }
      
      // Avvia migrazione
      console.log('\n🚀 Avvio migrazione su Render...\n');
      const migrateResponse = await axios.post(
        `${API_BASE}/admin/axiom-migration/migrate`,
        {
          tables: ['centralized_logs', 'audit_logs'],
          dryRun: false
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000 // Risposta immediata
        }
      );
      
      console.log('✅ Migrazione avviata in background su Render!');
      console.log('📊 Risposta:', JSON.stringify(migrateResponse.data, null, 2));
      console.log('\n💡 La migrazione è in esecuzione in background.');
      console.log('💡 Controlla i log su Render per vedere il progresso.');
      
    } else {
      console.error('❌ Errore nel recupero statistiche:', statusResponse.data);
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Errore API:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ Nessuna risposta dal server Render');
      console.error('💡 Verifica che il servizio sia online');
    } else {
      console.error('❌ Errore:', error.message);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  console.log('🚀 Migrazione Neon → Axiom\n');
  console.log('='.repeat(50) + '\n');
  
  const config = await checkLocalConfig();
  
  if (config.hasDatabaseUrl && config.hasAxiomConfig) {
    console.log('✅ Configurazione locale completa!');
    console.log('💡 Eseguirò la migrazione localmente\n');
    await runLocalMigration();
  } else if (config.hasAxiomConfig) {
    console.log('⚠️  DATABASE_URL non configurato localmente');
    console.log('💡 Posso eseguire la migrazione tramite Render API\n');
    
    const choice = await question('❓ Usare Render API? (s/n): ');
    if (choice.toLowerCase() === 's' || choice.toLowerCase() === 'si') {
      await runRemoteMigration();
    } else {
      console.log('\n💡 Per migrazione locale, aggiungi DATABASE_URL al file .env');
      console.log('💡 Ottieni DATABASE_URL da: https://console.neon.tech');
      rl.close();
    }
  } else {
    console.error('❌ Configurazione Axiom mancante!');
    console.log('💡 Configura AXIOM_API_TOKEN e AXIOM_ORG_ID nel file .env');
    rl.close();
  }
}

main().catch(error => {
  console.error('💥 Errore:', error);
  rl.close();
  process.exit(1);
});

