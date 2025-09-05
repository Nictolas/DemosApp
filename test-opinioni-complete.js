const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testOpinioniComplete() {
  try {
    console.log('🧪 TEST COMPLETO OPINIONI');
    
    // 1. Test API opinioni-list per ogni grado
    const grados = ['Nazionale', 'Regionale', 'Europeo', 'Comunale'];
    
    for (const grado of grados) {
      console.log(`\n🔍 Test per grado: ${grado}`);
      
      try {
        const response = await fetch(`http://localhost:3001/api/opinioni-list?grado=${grado}`);
        const data = await response.json();
        
        if (data.success) {
          console.log(`✅ ${grado}: ${data.data.length} opinioni caricate`);
          if (data.data.length > 0) {
            console.log(`   Prima opinione: ${data.data[0].text} (ID: ${data.data[0].id})`);
          }
        } else {
          console.log(`❌ ${grado}: Errore - ${data.error}`);
        }
      } catch (error) {
        console.log(`❌ ${grado}: Errore connessione - ${error.message}`);
      }
    }
    
    // 2. Test salvataggio opinioni
    console.log('\n🔍 Test salvataggio opinioni...');
    
    const testOpinions = {
      'energia_nucleare': 'Favorevole',
      'caccia': 'Contrario',
      'comunale_cassonetti_intelligenti_con_tessera': 'Indeciso'
    };
    
    try {
      const response = await fetch('http://localhost:3001/api/opinioni/salva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Token di test
        },
        body: JSON.stringify({
          opinions: testOpinions
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Salvataggio test: SUCCESSO');
      } else {
        console.log(`❌ Salvataggio test: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ Salvataggio test: Errore connessione - ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  } finally {
    await pool.end();
  }
}

testOpinioniComplete();
