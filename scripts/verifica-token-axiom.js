// Script per verificare quale token ha i permessi
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AXIOM_REGION = process.env.AXIOM_REGION || 'eu';
const AXIOM_BASE_URL = AXIOM_REGION === 'eu' 
  ? 'https://api.eu.axiom.co' 
  : 'https://api.axiom.co';

async function verificaToken() {
  const token = process.env.AXIOM_API_TOKEN;
  const orgId = process.env.AXIOM_ORG_ID;
  
  console.log('🔍 Verifica Token Axiom\n');
  console.log(`🔑 Token: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
  console.log(`🏢 Org ID: ${orgId || 'MISSING'}\n`);
  
  // Test 1: Verifica se il token può listare i datasets
  console.log('📋 Test 1: Lista datasets...');
  try {
    const response = await axios.get(
      `${AXIOM_BASE_URL}/v1/datasets`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Axiom-Org-Id': orgId
        },
        timeout: 30000
      }
    );
    console.log('✅ SUCCESSO! Token ha accesso. Datasets:');
    response.data.forEach(ds => {
      console.log(`   - ${ds.name} (${ds.id})`);
    });
    return true;
  } catch (error) {
    if (error.response) {
      console.error(`❌ ERRORE ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 403) {
        console.error('\n💡 DIAGNOSI:');
        console.error('   Il token NON ha permessi base per accedere all\'API.');
        console.error('   Possibili cause:');
        console.error('   1. Il token nel .env NON corrisponde a "demosapp-backup"');
        console.error('   2. Il token è stato creato per un\'altra organization');
        console.error('   3. Il token è scaduto o revocato');
        console.error('\n🔧 SOLUZIONE:');
        console.error('   1. Vai su Axiom → Settings → API Tokens');
        console.error('   2. Seleziona "demosapp-backup"');
        console.error('   3. Clicca "Regenerate token"');
        console.error('   4. Copia il NUOVO token');
        console.error('   5. Aggiorna AXIOM_API_TOKEN in .env e su Render');
      }
    } else {
      console.error('❌ Errore network:', error.message);
    }
    return false;
  }
}

verificaToken();

