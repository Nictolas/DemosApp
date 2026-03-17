// Script per fare login come admin e avviare la migrazione Axiom
const axios = require('axios');

const RENDER_URL = 'https://demos-c7k0.onrender.com';
const API_BASE = `${RENDER_URL}/api`;

const ADMIN_EMAIL = 'nicolasmicheletti90@gmail.com';
const ADMIN_PASSWORD = '123123';

async function loginAndMigrate() {
  try {
    console.log('🔐 Login come admin...\n');
    
    // Step 1: Login
    console.log(`🌐 Tentativo connessione a: ${API_BASE}/auth/login`);
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }, {
      timeout: 60000, // 60 secondi (Render può essere lento al risveglio)
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accetta qualsiasi status < 500
      }
    });
    
    if (!loginResponse.data.success || !loginResponse.data.accessToken) {
      console.error('❌ Login fallito:', loginResponse.data);
      return;
    }
    
    const accessToken = loginResponse.data.accessToken;
    console.log('✅ Login effettuato con successo!');
    console.log(`👤 Utente: ${loginResponse.data.user.email} (${loginResponse.data.user.ruolo})`);
    console.log(`🎫 Token ottenuto: ${accessToken.substring(0, 50)}...\n`);
    
    // Step 2: Verifica status migrazione
    console.log('📊 Verifica quanti record ci sono da migrare...\n');
    const statusResponse = await axios.get(`${API_BASE}/admin/axiom-migration/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (statusResponse.data.success) {
      console.log('📈 Statistiche:');
      console.log(JSON.stringify(statusResponse.data.stats, null, 2));
      console.log('\n📋 Configurazione Axiom:');
      console.log(JSON.stringify(statusResponse.data.axiomConfig, null, 2));
    } else {
      console.error('❌ Errore recupero statistiche:', statusResponse.data);
      return;
    }
    
    // Step 3: Chiedi conferma
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  ATTENZIONE: Stai per avviare la migrazione reale!');
    console.log('   I dati verranno inviati ad Axiom.');
    console.log('='.repeat(60));
    console.log('\n💡 Per avviare la migrazione, esegui:');
    console.log('   node scripts/start-migration-with-login.js --confirm\n');
    
    // Step 4: Avvia migrazione se confermato
    if (process.argv.includes('--confirm')) {
      console.log('🚀 Avvio migrazione...\n');
      
      const migrateResponse = await axios.post(
        `${API_BASE}/admin/axiom-migration/migrate`,
        {
          tables: ['centralized_logs', 'audit_logs'],
          dryRun: false
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000 // Risposta immediata
        }
      );
      
      console.log('✅ Migrazione avviata in background su Render!');
      console.log('📊 Risposta:', JSON.stringify(migrateResponse.data, null, 2));
      console.log('\n💡 La migrazione è in esecuzione in background.');
      console.log('💡 Controlla i log su Render per vedere il progresso:');
      console.log('   https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg/logs');
      console.log('\n💡 Verifica su Axiom quando completata:');
      console.log('   https://app.axiom.co/demos-institute-jrim/datasets/centralized_logs');
      console.log('   https://app.axiom.co/demos-institute-jrim/datasets/real-time');
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Errore API:', error.response.status);
      console.error('   Dettagli:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('❌ Nessuna risposta dal server Render');
      console.error('💡 Verifica che il servizio sia online');
    } else {
      console.error('❌ Errore:', error.message);
    }
    process.exit(1);
  }
}

loginAndMigrate();

