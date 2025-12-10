// Script per testare direttamente la migrazione e vedere gli errori
const axios = require('axios');

const RENDER_URL = 'https://demos-c7k0.onrender.com';
const API_BASE = `${RENDER_URL}/api`;

const ADMIN_EMAIL = 'nicolasmicheletti90@gmail.com';
const ADMIN_PASSWORD = '123123';

async function testMigration() {
  try {
    console.log('🔐 Login come admin...\n');
    
    // Login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500
    });
    
    if (!loginResponse.data.success || !loginResponse.data.accessToken) {
      console.error('❌ Login fallito:', loginResponse.data);
      return;
    }
    
    const accessToken = loginResponse.data.accessToken;
    console.log('✅ Login effettuato\n');
    
    // Avvia migrazione e aspetta la risposta (non in background)
    console.log('🚀 Avvio migrazione (modalità sincrona per vedere errori)...\n');
    
    try {
      const migrateResponse = await axios.post(
        `${API_BASE}/admin/axiom-migration/migrate`,
        {
          tables: ['centralized_logs'],
          dryRun: false
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 300000 // 5 minuti per migrazione completa
        }
      );
      
      console.log('✅ Risposta immediata:', JSON.stringify(migrateResponse.data, null, 2));
      console.log('\n💡 La migrazione è in background. Controlla i log su Render nei prossimi 30 secondi.');
      console.log('💡 Cerca messaggi come:');
      console.log('   - "🚀 Avvio migrazione dati da Neon a Axiom..."');
      console.log('   - "✅ Batch 1: 1000 record"');
      console.log('   - "❌ Errore migrazione:" (se ci sono errori)\n');
      
    } catch (error) {
      if (error.response) {
        console.error('❌ Errore API:', error.response.status);
        console.error('   Dettagli:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('❌ Errore:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

testMigration();

