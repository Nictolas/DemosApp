const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Simuliamo l'AuditService per il test
class TestAuditService {
  static async logAction({
    userId,
    action,
    resource,
    resourceId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    success = true,
    errorMessage = null
  }) {
    try {
      const query = `
        INSERT INTO audit_logs_compressed (
          id, user_id, action, resource, resource_id, details, 
          ip_address, user_agent, timestamp, success, error_message, created_at
        ) VALUES (gen_random_uuid(), $1, compress_audit_action($2), compress_audit_resource($3), $4, $5, compress_ip_address($6), compress_audit_user_agent($7), $8, $9, $10, $11)
        RETURNING id
      `;
      
      const now = Date.now(); // Timestamp in millisecondi
      
      const values = [
        userId,
        action, // Sarà compresso dalla funzione compress_audit_action
        resource, // Sarà compresso dalla funzione compress_audit_resource
        resourceId,
        JSON.stringify(details),
        ipAddress, // Sarà compresso dalla funzione compress_ip_address
        userAgent, // Sarà compresso dalla funzione compress_audit_user_agent
        now, // timestamp
        success,
        errorMessage,
        now // created_at
      ];

      const result = await pool.query(query, values);
      
      console.log(`📝 Audit log creato: ${action} su ${resource} per utente ${userId}`);
      return { id: result.rows[0].id, timestamp: new Date(now) };
    } catch (error) {
      console.error('❌ Errore nel logging audit:', error);
      return null;
    }
  }

  static async getUserAuditLogs(userId, filters = {}) {
    try {
      let query = `
        SELECT id, action, resource, resource_id, details, 
               ip_address, user_agent, timestamp, success, error_message
        FROM audit_logs_decompressed 
        WHERE user_id = $1
      `;
      
      const values = [userId];
      let paramCount = 1;

      if (filters.action) {
        paramCount++;
        query += ` AND action = $${paramCount}`;
        values.push(filters.action);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Errore nel recupero audit logs:', error);
      throw error;
    }
  }

  static async getAuditStats(days = 30) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT action) as unique_actions
        FROM audit_logs_decompressed 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Errore nel recupero statistiche:', error);
      throw error;
    }
  }
}

async function testAuditService() {
  const client = await pool.connect();
  try {
    console.log('🧪 Test AuditService aggiornato...');

    // 1. Test scrittura log con compressione
    console.log('\n1. Test scrittura log con compressione...');
    const logResult = await TestAuditService.logAction({
      userId: 'test-user-123',
      action: 'DATA_ACCESS',
      resource: 'users',
      resourceId: 'user-456',
      details: { method: 'GET', endpoint: '/api/users' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      success: true
    });
    
    if (logResult) {
      console.log(`   ✅ Log creato con ID: ${logResult.id}`);
    } else {
      console.log('   ❌ Errore nella creazione del log');
    }

    // 2. Test lettura log decompressi
    console.log('\n2. Test lettura log decompressi...');
    const userLogs = await TestAuditService.getUserAuditLogs('test-user-123', { limit: 5 });
    console.log(`   ✅ Trovati ${userLogs.length} log per l'utente`);
    
    if (userLogs.length > 0) {
      const sampleLog = userLogs[0];
      console.log('   Esempio log decompresso:');
      console.log(`     • Action: ${sampleLog.action}`);
      console.log(`     • Resource: ${sampleLog.resource}`);
      console.log(`     • IP: ${sampleLog.ip_address}`);
      console.log(`     • User Agent: ${sampleLog.user_agent}`);
      console.log(`     • Success: ${sampleLog.success}`);
    }

    // 3. Test statistiche
    console.log('\n3. Test statistiche...');
    const stats = await TestAuditService.getAuditStats(30);
    console.log(`   ✅ Statistiche ultimi 30 giorni:`);
    console.log(`     • Azioni totali: ${stats.total_actions}`);
    console.log(`     • Azioni riuscite: ${stats.successful_actions}`);
    console.log(`     • Azioni fallite: ${stats.failed_actions}`);
    console.log(`     • Utenti unici: ${stats.unique_users}`);
    console.log(`     • Azioni uniche: ${stats.unique_actions}`);

    // 4. Test performance
    console.log('\n4. Test performance...');
    const startTime = process.hrtime.bigint();
    await TestAuditService.getUserAuditLogs('test-user-123');
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    console.log(`   ✅ Query performance: ${durationMs.toFixed(0)}ms`);

    // 5. Verifica compressione
    console.log('\n5. Verifica compressione...');
    const compressedData = await client.query(`
      SELECT action, resource, ip_address, user_agent
      FROM audit_logs_compressed
      WHERE user_id = 'test-user-123'
      ORDER BY timestamp DESC
      LIMIT 1;
    `);
    
    if (compressedData.rows.length > 0) {
      const compressed = compressedData.rows[0];
      console.log('   Dati compressi:');
      console.log(`     • Action: ${compressed.action} (compressa)`);
      console.log(`     • Resource: ${compressed.resource} (compressa)`);
      console.log(`     • IP: ${compressed.ip_address} (compressa)`);
      console.log(`     • User Agent: ${compressed.user_agent} (compressa)`);
    }

    console.log('\n✅ Test AuditService completato con successo!');

  } finally {
    client.release();
    await pool.end();
  }
}

testAuditService().catch(console.error);
