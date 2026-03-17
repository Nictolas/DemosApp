/**
 * Script di test per verificare che le letture da Axiom funzionino correttamente
 */

require('dotenv').config();

async function testAxiomReads() {
  console.log('🧪 Test letture da Axiom...\n');
  
  // Verifica variabili ambiente
  if (process.env.AXIOM_ENABLED !== 'true') {
    console.log('⚠️  AXIOM_ENABLED non è "true" - i test useranno il fallback a Neon');
  }
  
  if (!process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
    console.log('⚠️  Token o Org ID Axiom mancanti - i test useranno il fallback a Neon');
  }
  
  try {
    const { getAuditLogs, getCentralizedLogs, queryAxiom, countAxiomRecords } = require('../api/utils/axiomQueryHelper');
    
    console.log('1️⃣  Test getAuditLogs()...');
    try {
      const auditLogs = await getAuditLogs({
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10
      });
      console.log(`   ✅ Trovati ${auditLogs.length} audit logs`);
      if (auditLogs.length > 0) {
        console.log(`   📝 Primo log:`, JSON.stringify(auditLogs[0], null, 2));
      }
    } catch (error) {
      console.log(`   ❌ Errore: ${error.message}`);
    }
    
    console.log('\n2️⃣  Test getCentralizedLogs()...');
    try {
      const centralizedLogs = await getCentralizedLogs({
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10
      });
      console.log(`   ✅ Trovati ${centralizedLogs.length} centralized logs`);
      if (centralizedLogs.length > 0) {
        console.log(`   📝 Primo log:`, JSON.stringify(centralizedLogs[0], null, 2));
      }
    } catch (error) {
      console.log(`   ❌ Errore: ${error.message}`);
    }
    
    console.log('\n3️⃣  Test countAxiomRecords()...');
    try {
      const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
      const count = await countAxiomRecords(dataset, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      console.log(`   ✅ Count per ${dataset}: ${count}`);
    } catch (error) {
      console.log(`   ❌ Errore: ${error.message}`);
    }
    
    console.log('\n4️⃣  Test queryAxiom()...');
    try {
      const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
      const query = `['${dataset}'] | limit 5`;
      const results = await queryAxiom(query, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      console.log(`   ✅ Query completata, ${results.length} risultati`);
    } catch (error) {
      console.log(`   ❌ Errore: ${error.message}`);
    }
    
    console.log('\n✅ Test completati!');
    
  } catch (error) {
    console.error('❌ Errore generale nei test:', error);
    process.exit(1);
  }
}

// Esegui test
testAxiomReads().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

