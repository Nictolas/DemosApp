// Script per verificare lo stato della migrazione
const axios = require('axios');

const RENDER_URL = 'https://demos-c7k0.onrender.com';
const API_BASE = `${RENDER_URL}/api`;

const ADMIN_EMAIL = 'nicolasmicheletti90@gmail.com';
const ADMIN_PASSWORD = '123123';

async function checkMigrationStatus() {
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
    
    // Verifica statistiche (quanti record ci sono da migrare)
    console.log('📊 Statistiche record da migrare:\n');
    const statusResponse = await axios.get(`${API_BASE}/admin/axiom-migration/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (statusResponse.data.success) {
      console.log('📈 Record totali in Neon:');
      console.log(`   - centralized_logs: ${statusResponse.data.stats.centralized_logs.total.toLocaleString()}`);
      console.log(`   - audit_logs: ${statusResponse.data.stats.audit_logs.total.toLocaleString()}`);
      console.log(`   - TOTALE: ${(statusResponse.data.stats.centralized_logs.total + statusResponse.data.stats.audit_logs.total).toLocaleString()}\n`);
    }
    
    // Verifica su Axiom (se possibile)
    console.log('💡 Per verificare i dati su Axiom:');
    console.log(`   https://app.axiom.co/${process.env.AXIOM_ORG_ID || 'demos-institute-jrim'}/datasets/centralized_logs`);
    console.log(`   https://app.axiom.co/${process.env.AXIOM_ORG_ID || 'demos-institute-jrim'}/datasets/real-time\n`);
    
    console.log('💡 Per vedere i log della migrazione su Render:');
    console.log('   https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg/logs\n');
    console.log('   Cerca messaggi come:');
    console.log('   - "✅ Batch X: Y record"');
    console.log('   - "✅ Migrazione centralized_logs completata"');
    console.log('   - "✅ Migrazione audit_logs completata"');
    console.log('   - "🎉 Migrazione completata!"\n');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Errore API:', error.response.status, error.response.data);
    } else {
      console.error('❌ Errore:', error.message);
    }
  }
}

checkMigrationStatus();

