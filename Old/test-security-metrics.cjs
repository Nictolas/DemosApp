// Test del security-metrics.js aggiornato per compressione
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testSecurityMetrics() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Test security-metrics.js aggiornato...\n');
    
    // 1. Test vista audit_logs_decompressed
    console.log('1. Test vista audit_logs_decompressed...');
    
    const viewTest = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_agent) as unique_user_agents,
        COUNT(DISTINCT action) as unique_actions
      FROM audit_logs_decompressed
      LIMIT 1;
    `);
    
    const viewStats = viewTest.rows[0];
    console.log(`   ✅ Vista funziona: ${viewStats.total_records} record, ${viewStats.unique_ips} IP unici, ${viewStats.unique_actions} azioni uniche`);
    
    // 2. Test query JWT stats
    console.log('\n2. Test query JWT stats...');
    
    const jwtStatsTest = await client.query(`
      SELECT 
        COUNT(CASE WHEN action = 'LOGIN' AND success = true THEN 1 END) as login_successes,
        COUNT(CASE WHEN action = 'LOGOUT' AND success = true THEN 1 END) as logout_successes,
        COUNT(CASE WHEN action = 'TOKEN_EXPIRED' OR (action = 'AUTH_FAILED' AND error_message LIKE '%expired%') THEN 1 END) as expired_tokens,
        COUNT(CASE WHEN action = 'AUTH_FAILED' AND success = false THEN 1 END) as suspicious_activity
      FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
    `);
    
    const jwtStats = jwtStatsTest.rows[0];
    console.log(`   ✅ JWT Stats: ${jwtStats.login_successes} login, ${jwtStats.logout_successes} logout, ${jwtStats.expired_tokens} expired`);
    
    // 3. Test query rate limiting
    console.log('\n3. Test query rate limiting...');
    
    const rateLimitTest = await client.query(`
      SELECT 
        COUNT(DISTINCT ip_address) as blocked_ips,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 minute' THEN 1 END) as requests_per_minute
      FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
        AND ip_address IS NOT NULL
    `);
    
    const rateLimitStats = rateLimitTest.rows[0];
    console.log(`   ✅ Rate Limiting: ${rateLimitStats.blocked_ips} IP unici, ${rateLimitStats.total_requests} richieste totali`);
    
    // 4. Test query system health
    console.log('\n4. Test query system health...');
    
    const systemHealthTest = await client.query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 minute' THEN 1 END) as requests_per_minute,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests
      FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '2 hours'
        AND user_id IS NOT NULL
        AND user_id != 'anonymous'
    `);
    
    const systemStats = systemHealthTest.rows[0];
    console.log(`   ✅ System Health: ${systemStats.active_users} utenti attivi, ${systemStats.total_requests} richieste totali`);
    
    // 5. Test query real-time events
    console.log('\n5. Test query real-time events...');
    
    const realTimeTest = await client.query(`
      SELECT 
        id,
        action,
        resource,
        details,
        ip_address,
        user_agent,
        timestamp,
        success,
        error_message,
        CASE 
          WHEN success = false AND action LIKE '%AUTH%' THEN 'high'
          WHEN success = false AND action LIKE '%SECURITY%' THEN 'medium'
          ELSE 'low'
        END as severity
      FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '5 minutes'
        AND (success = false OR action LIKE '%SECURITY%' OR action LIKE '%AUTH%')
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    
    console.log(`   ✅ Real-time Events: ${realTimeTest.rows.length} eventi trovati`);
    
    // 6. Test query real violations
    console.log('\n6. Test query real violations...');
    
    const violationsTest = await client.query(`
      SELECT 
        COUNT(*) as total_real_violations,
        COUNT(CASE WHEN action = 'AUTH_FAILED' AND error_message NOT LIKE '%HTTP 500%' THEN 1 END) as auth_failures,
        COUNT(CASE WHEN error_message LIKE '%Unauthorized%' OR error_message LIKE '%Forbidden%' THEN 1 END) as access_denied,
        COUNT(CASE WHEN error_message LIKE '%Invalid credentials%' THEN 1 END) as invalid_credentials,
        COUNT(CASE WHEN error_message LIKE '%Token expired%' OR error_message LIKE '%Invalid token%' THEN 1 END) as token_issues,
        COUNT(CASE WHEN action LIKE '%SECURITY%' THEN 1 END) as security_events
      FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '30 days'
        AND success = false
        AND NOT (
          error_message LIKE '%HTTP 500%' OR 
          error_message LIKE '%Errore nella registrazione%' OR
          error_message LIKE '%Internal Server Error%' OR
          error_message LIKE '%Database Error%'
        )
        AND (
          action LIKE '%SECURITY%' OR 
          action LIKE '%AUTH%' OR 
          action LIKE '%PERMISSION%' OR
          error_message LIKE '%Unauthorized%' OR
          error_message LIKE '%Forbidden%' OR
          error_message LIKE '%Invalid credentials%' OR
          error_message LIKE '%Access denied%' OR
          error_message LIKE '%Token expired%' OR
          error_message LIKE '%Invalid token%'
        )
    `);
    
    const violationsStats = violationsTest.rows[0];
    console.log(`   ✅ Real Violations: ${violationsStats.total_real_violations} violazioni reali, ${violationsStats.auth_failures} auth failures`);
    
    // 7. Test esempi di dati decompressi
    console.log('\n7. Esempi di dati decompressi...');
    
    if (realTimeTest.rows.length > 0) {
      const sampleEvent = realTimeTest.rows[0];
      console.log('   Esempio evento decompresso:');
      console.log(`     • Action: ${sampleEvent.action}`);
      console.log(`     • IP: ${sampleEvent.ip_address}`);
      console.log(`     • User Agent: ${sampleEvent.user_agent}`);
      console.log(`     • Timestamp: ${sampleEvent.timestamp}`);
      console.log(`     • Success: ${sampleEvent.success}`);
      console.log(`     • Severity: ${sampleEvent.severity}`);
    }
    
    // 8. Test performance
    console.log('\n8. Test performance...');
    
    const startTime = Date.now();
    await client.query(`
      SELECT COUNT(*) FROM audit_logs_decompressed 
      WHERE timestamp >= NOW() - INTERVAL '24 hours';
    `);
    const endTime = Date.now();
    
    console.log(`   ✅ Query performance: ${endTime - startTime}ms`);
    
    console.log('\n✅ Tutti i test del security-metrics.js completati con successo!');
    
  } catch (error) {
    console.error('❌ Errore test security-metrics.js:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  testSecurityMetrics()
    .then(() => {
      console.log('\n🎉 Test security-metrics.js completato!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Errore test:', error);
      process.exit(1);
    });
}

module.exports = { testSecurityMetrics };
