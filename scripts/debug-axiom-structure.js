// Script per debuggare la struttura dei dati su Axiom
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let Axiom;
let axiomClient;

try {
  Axiom = require('@axiomhq/axiom-node');
  const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
  axiomClient = new Axiom.Client({
    token: process.env.AXIOM_API_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
    region: region
  });
} catch (sdkErr) {
  console.error('⚠️ SDK Axiom non disponibile:', sdkErr.message);
  process.exit(1);
}

async function debugStructure() {
  console.log('🔍 Debug struttura dati Axiom\n');
  
  try {
    const query = `['centralized_logs'] | limit 5`;
    const result = await axiomClient.query(query, {
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date()
    });
    
    console.log('📊 Struttura risultato:\n');
    console.log(JSON.stringify(result, null, 2).substring(0, 2000));
    
    // Prova a estrarre i dati
    console.log('\n\n📊 Tentativo estrazione dati:\n');
    
    let rows = [];
    if (result.matches && Array.isArray(result.matches)) {
      console.log('✅ Trovato in result.matches');
      rows = result.matches;
    } else if (result.buckets && Array.isArray(result.buckets)) {
      console.log('✅ Trovato in result.buckets');
      rows = result.buckets.flatMap(b => {
        if (b.rows && Array.isArray(b.rows)) return b.rows;
        if (b.data && Array.isArray(b.data)) return b.data;
        return [];
      });
    } else if (result.data?.rows) {
      console.log('✅ Trovato in result.data.rows');
      rows = result.data.rows;
    } else if (result.rows) {
      console.log('✅ Trovato in result.rows');
      rows = result.rows;
    } else {
      console.log('⚠️ Nessun dato trovato');
    }
    
    if (rows.length > 0) {
      console.log(`\n📋 Primo record (${rows.length} totali):\n`);
      const firstRow = rows[0];
      console.log(JSON.stringify(firstRow, null, 2).substring(0, 2000));
      
      // Analizza campi
      console.log('\n📋 Campi presenti:\n');
      Object.keys(firstRow).forEach(key => {
        const value = firstRow[key];
        const valueStr = value === null ? 'NULL' : 
                        typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' :
                        String(value).substring(0, 100);
        console.log(`   ${key}: ${valueStr}`);
      });
      
      // Se c'è campo "data", analizzalo
      if (firstRow.data) {
        console.log('\n📋 Campo "data" trovato:\n');
        if (typeof firstRow.data === 'string') {
          try {
            const dataObj = JSON.parse(firstRow.data);
            console.log('   Tipo: JSON string (parsed)');
            console.log('   Campi dentro "data":');
            Object.keys(dataObj).forEach(key => {
              const val = dataObj[key];
              const valStr = val === null ? 'NULL' : 
                            typeof val === 'object' ? JSON.stringify(val).substring(0, 50) + '...' :
                            String(val).substring(0, 50);
              console.log(`      ${key}: ${valStr}`);
            });
          } catch (e) {
            console.log('   Tipo: String (non JSON)');
            console.log(`   Valore: ${firstRow.data.substring(0, 200)}`);
          }
        } else {
          console.log('   Tipo: Object');
          console.log(JSON.stringify(firstRow.data, null, 2).substring(0, 500));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  }
}

debugStructure();

