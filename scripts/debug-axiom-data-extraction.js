/**
 * Script per debuggare l'estrazione dei dati da Axiom
 */

require('dotenv').config();

const { getCentralizedLogs, countAxiomRecords, queryAxiom } = require('../api/utils/axiomQueryHelper');

async function debugDataExtraction() {
  console.log('🔍 Debug estrazione dati da Axiom\n');
  
  const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endTime = new Date();
  
  console.log(`📅 Periodo: ${startTime.toISOString()} → ${endTime.toISOString()}\n`);
  
  // 1. Count totale
  console.log('1️⃣  Count totale con countAxiomRecords():');
  try {
    const totalCount = await countAxiomRecords(dataset, { startTime, endTime });
    console.log(`   ✅ Count: ${totalCount}`);
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 2. Query diretta con limit alto
  console.log('\n2️⃣  Query diretta con limit 200:');
  try {
    const directQuery = `['${dataset}'] | order by _time desc | limit 200`;
    const directResults = await queryAxiom(directQuery, { startTime, endTime });
    console.log(`   ✅ Risultati diretti: ${directResults.length}`);
    
    if (directResults.length > 0) {
      console.log(`   📝 Primo record (raw):`, JSON.stringify(directResults[0], null, 2));
      console.log(`   📝 Struttura primo record:`, Object.keys(directResults[0]));
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 3. getCentralizedLogs con limit alto
  console.log('\n3️⃣  getCentralizedLogs() con limit 200:');
  try {
    const logs = await getCentralizedLogs({
      startTime,
      endTime,
      limit: 200
    });
    console.log(`   ✅ Risultati: ${logs.length}`);
    
    if (logs.length > 0) {
      console.log(`   📝 Primo log:`, JSON.stringify(logs[0], null, 2));
      console.log(`   📝 Struttura primo log:`, Object.keys(logs[0]));
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 4. getCentralizedLogs con limit 5 (default del test)
  console.log('\n4️⃣  getCentralizedLogs() con limit 5 (default test):');
  try {
    const logs = await getCentralizedLogs({
      startTime,
      endTime,
      limit: 5
    });
    console.log(`   ✅ Risultati: ${logs.length}`);
    
    if (logs.length > 0) {
      console.log(`   📝 Primo log:`, JSON.stringify(logs[0], null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 5. Verifica distribuzione temporale
  console.log('\n5️⃣  Distribuzione temporale (ultimi 10 record):');
  try {
    const timeQuery = `['${dataset}'] | order by _time desc | limit 10`;
    const timeResults = await queryAxiom(timeQuery, { startTime, endTime });
    console.log(`   ✅ Trovati ${timeResults.length} record`);
    
    timeResults.forEach((record, idx) => {
      const time = record._time || (record.data && record.data._time) || 'N/A';
      const message = record.message || (record.data && record.data.message) || 'N/A';
      console.log(`   ${idx + 1}. ${time} - ${(message || '').substring(0, 50)}`);
    });
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
  
  // 6. Verifica se i dati sono dentro 'data'
  console.log('\n6️⃣  Verifica struttura record (campo data):');
  try {
    const sampleQuery = `['${dataset}'] | limit 3`;
    const samples = await queryAxiom(sampleQuery, { startTime, endTime });
    
    samples.forEach((record, idx) => {
      console.log(`\n   Record ${idx + 1}:`);
      console.log(`   - Ha campo 'data'? ${!!record.data}`);
      console.log(`   - Ha campo '_time'? ${!!record._time}`);
      console.log(`   - Ha campo 'message'? ${!!record.message}`);
      console.log(`   - Keys dirette:`, Object.keys(record).slice(0, 10));
      
      if (record.data) {
        const dataType = typeof record.data;
        console.log(`   - Tipo 'data': ${dataType}`);
        if (dataType === 'string') {
          try {
            const parsed = JSON.parse(record.data);
            console.log(`   - 'data' (parsed) keys:`, Object.keys(parsed).slice(0, 10));
          } catch (e) {
            console.log(`   - 'data' non è JSON valido`);
          }
        } else if (dataType === 'object') {
          console.log(`   - 'data' (object) keys:`, Object.keys(record.data).slice(0, 10));
        }
      }
    });
  } catch (error) {
    console.log(`   ❌ Errore: ${error.message}`);
  }
}

debugDataExtraction().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

