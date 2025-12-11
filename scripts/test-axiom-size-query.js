// Test query APL per calcolare dimensione reale
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testSizeQuery() {
  console.log('🔍 Test Query APL per dimensione reale\n');
  
  try {
    const Axiom = require('@axiomhq/axiom-node');
    
    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    const client = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    
    const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
    
    // Prova query che calcola la dimensione totale
    console.log('📊 Provo query per dimensione...\n');
    
    // Query 1: Count totale
    try {
      const countQuery = `['${dataset}'] | summarize count()`;
      const countResult = await client.query(countQuery, {
        startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      
      const count = countResult.buckets?.totals?.[0]?.aggregations?.[0]?.value || 0;
      const rowsExamined = countResult.status?.rowsExamined || 0;
      
      console.log(`✅ Count totale: ${count.toLocaleString()}`);
      console.log(`✅ Rows examined: ${rowsExamined.toLocaleString()}`);
      
      // Dalla dashboard Axiom abbiamo visto: 983K eventi = 321.97 MB
      // Quindi: 321.97 MB / 983K = ~335 bytes per evento
      // Ma questo è solo per quel dataset specifico
      
      // Prova a calcolare usando i dati che abbiamo visto
      const bytesPerEvent = 335;
      const estimatedMB = (rowsExamined * bytesPerEvent) / (1024 * 1024);
      
      console.log(`\n💾 Dimensione stimata (335 bytes/evento): ${estimatedMB.toFixed(2)} MB`);
      console.log(`\n⚠️ NOTA: Axiom non espone la dimensione reale via API/SDK.`);
      console.log(`   La dimensione mostrata su Axiom Dashboard (321.97 MB) non è disponibile via API.`);
      console.log(`   Possiamo solo calcolarla basandoci sul rapporto che abbiamo osservato.`);
      
    } catch (err) {
      console.error('❌ Query fallita:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

testSizeQuery();

