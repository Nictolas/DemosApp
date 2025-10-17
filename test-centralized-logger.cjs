// Test del centralizedLogger aggiornato per compressione
const logger = require('./api/services/centralizedLogger');

async function testCentralizedLogger() {
  console.log('🧪 Test centralizedLogger aggiornato...\n');
  
  try {
    // 1. Test scrittura log con compressione
    console.log('1. Test scrittura log con compressione...');
    
    await logger.info('Test log con compressione', {
      userId: 'test-user-123',
      ipAddress: '10.201.190.129/32',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      endpoint: '/api/users/profile',
      requestId: 'req-test-456',
      sessionId: 'sess-test-789'
    });
    
    console.log('✅ Log scritto con successo');
    
    // 2. Test funzioni di compressione
    console.log('\n2. Test funzioni di compressione...');
    
    const testIP = logger.compressIPAddress('10.201.190.129/32');
    console.log(`   IP compressione: 10.201.190.129/32 → ${testIP}`);
    
    const testUA = logger.compressUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    console.log(`   User Agent compressione: Chrome-Windows → ${testUA}`);
    
    const testEndpoint = logger.compressEndpoint('/api/users/profile');
    console.log(`   Endpoint compressione: /api/users/profile → ${testEndpoint}`);
    
    // 3. Test statistiche log
    console.log('\n3. Test statistiche log...');
    
    const stats = await logger.getLogStats(1);
    console.log(`   Statistiche ultimo giorno: ${stats.length} gruppi trovati`);
    
    if (stats.length > 0) {
      console.log('   Esempi statistiche:');
      stats.slice(0, 3).forEach(stat => {
        console.log(`     • ${stat.level}: ${stat.count} record (${stat.date})`);
      });
    }
    
    // 4. Test esportazione log
    console.log('\n4. Test esportazione log...');
    
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Ultimo giorno
    const endDate = new Date();
    
    const exportedLogs = await logger.exportLogs(startDate, endDate, 'INFO');
    console.log(`   Log esportati: ${exportedLogs.length} record`);
    
    if (exportedLogs.length > 0) {
      const sampleLog = exportedLogs[0];
      console.log('   Esempio log esportato:');
      console.log(`     • Timestamp: ${sampleLog.timestamp}`);
      console.log(`     • Level: ${sampleLog.level}`);
      console.log(`     • IP: ${sampleLog.ip_address}`);
      console.log(`     • User Agent: ${sampleLog.user_agent}`);
      console.log(`     • Endpoint: ${sampleLog.endpoint}`);
    }
    
    console.log('\n✅ Tutti i test del centralizedLogger completati con successo!');
    
  } catch (error) {
    console.error('❌ Errore test centralizedLogger:', error);
    throw error;
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  testCentralizedLogger()
    .then(() => {
      console.log('\n🎉 Test centralizedLogger completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore test:', error);
      process.exit(1);
    });
}

module.exports = { testCentralizedLogger };
