// Test list datasets per vedere se ci sono statistiche aggregate
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testListDatasets() {
  console.log('🔍 Test List Datasets per statistiche\n');
  
  try {
    const Axiom = require('@axiomhq/axiom-node');
    
    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    const client = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    
    console.log('📊 Lista tutti i dataset...\n');
    const datasets = await client.datasets.list();
    
    console.log(`✅ Trovati ${datasets.length} dataset:\n`);
    
    for (const ds of datasets) {
      console.log(`📦 Dataset: ${ds.name}`);
      console.log(`   ID: ${ds.id}`);
      console.log(`   Regione: ${ds.region}`);
      console.log(`   Tipo: ${ds.kind}`);
      console.log(`   Retention: ${ds.retentionDays} giorni`);
      console.log(`   Campi: ${ds.fields ? ds.fields.length : 0}`);
      
      // Cerca statistiche nei campi disponibili
      if (ds.stats) {
        console.log(`   📊 Stats:`, JSON.stringify(ds.stats, null, 2));
      }
      
      // Prova a fare una query per ottenere count e dimensione
      try {
        const query = `['${ds.name}'] | summarize count()`;
        const result = await client.query(query, {
          startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Ultimi 30 giorni
          endTime: new Date()
        });
        
        const count = result.buckets?.totals?.[0]?.aggregations?.[0]?.value || 0;
        const rowsExamined = result.status?.rowsExamined || 0;
        
        console.log(`   📈 Eventi (ultimi 30 giorni): ${count.toLocaleString()}`);
        console.log(`   📊 Rows examined: ${rowsExamined.toLocaleString()}`);
        
        // Stima dimensione (basata su 335 bytes per evento dalla dashboard)
        const estimatedMB = (rowsExamined * 335) / (1024 * 1024);
        console.log(`   💾 Dimensione stimata: ~${estimatedMB.toFixed(2)} MB`);
      } catch (queryErr) {
        console.log(`   ⚠️ Query fallita: ${queryErr.message}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testListDatasets();

