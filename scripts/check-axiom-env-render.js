// Script per verificare le variabili Axiom su Render tramite API
const axios = require('axios');

const RENDER_URL = 'https://demos-c7k0.onrender.com';
const API_BASE = `${RENDER_URL}/api`;

const ADMIN_EMAIL = 'nicolasmicheletti90@gmail.com';
const ADMIN_PASSWORD = '123123';

async function checkAxiomConfig() {
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
    
    // Verifica configurazione Axiom
    console.log('🔍 Verifica configurazione Axiom su Render...\n');
    
    try {
      const statusResponse = await axios.get(
        `${API_BASE}/admin/axiom-migration/status`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      if (statusResponse.data.success) {
        console.log('✅ Configurazione Axiom su Render:');
        console.log(JSON.stringify(statusResponse.data.axiomConfig, null, 2));
        console.log('\n📊 Statistiche migrazione:');
        console.log(JSON.stringify(statusResponse.data.stats, null, 2));
      } else {
        console.error('❌ Errore:', statusResponse.data);
      }
      
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

checkAxiomConfig();


