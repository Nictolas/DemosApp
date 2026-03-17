const { pool } = require('./middleware/auth');

async function testDashboardData() {
  try {
    console.log('🔍 Test dati dashboard - Solo dati reali...');
    
    // Test endpoint /stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_actions
      FROM audit_logs
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    console.log('📊 Statistiche generali:');
    console.log(`- Totale azioni: ${stats.total_actions}`);
    console.log(`- Azioni riuscite: ${stats.successful_actions}`);
    console.log(`- Azioni fallite: ${stats.failed_actions}`);
    
    // Test endpoint /violations
    const violationsQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs 
      WHERE success = false 
      GROUP BY action
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const violationsResult = await pool.query(violationsQuery);
    console.log('\n🚨 Violazioni recenti:');
    violationsResult.rows.forEach(violation => {
      console.log(`- ${violation.action}: ${violation.count} volte`);
    });
    
    // Test endpoint /logs
    const logsQuery = `
      SELECT action, user_id, success, timestamp
      FROM audit_logs 
      ORDER BY timestamp DESC 
      LIMIT 5
    `;
    
    const logsResult = await pool.query(logsQuery);
    console.log('\n📋 Log recenti:');
    logsResult.rows.forEach(log => {
      console.log(`- ${log.action} | ${log.user_id} | ${log.success ? 'Success' : 'Failed'} | ${log.timestamp}`);
    });
    
    // Verifica che non ci siano più dati mock
    const mockDataQuery = `
      SELECT COUNT(*) as mock_count
      FROM audit_logs 
      WHERE user_id = 'anonymous' OR timestamp > NOW()
    `;
    
    const mockResult = await pool.query(mockDataQuery);
    console.log('\n✅ Verifica dati mock:');
    console.log(`- Record mock rimanenti: ${mockResult.rows[0].mock_count}`);
    
    if (mockResult.rows[0].mock_count === '0') {
      console.log('✅ Nessun dato mock trovato!');
    } else {
      console.log('⚠️ Ancora presenti dati mock');
    }
    
    await pool.end();
    console.log('\n✅ Test completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await pool.end();
  }
}

testDashboardData();
