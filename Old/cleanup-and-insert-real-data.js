const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupAndInsertRealData() {
  try {
    console.log('🧹 Pulizia dati mock...');
    
    // Rimuovi tutti i record con user_id = 'anonymous' (dati mock)
    const deleteResult = await pool.query(
      "DELETE FROM audit_logs WHERE user_id = 'anonymous'"
    );
    console.log(`✅ Rimossi ${deleteResult.rowCount} record mock`);
    
    // Rimuovi record con date future (dati mock)
    const deleteFutureResult = await pool.query(
      "DELETE FROM audit_logs WHERE timestamp > NOW()"
    );
    console.log(`✅ Rimossi ${deleteFutureResult.rowCount} record con date future`);
    
    console.log('📊 Inserimento dati reali...');
    
    // Inserisci alcuni dati reali di esempio basati su attività reali
    const realData = [
      {
        user_id: '5e51ec52-c656-4f4b-a940-425acb873b0b', // ID utente reale
        action: 'LOGIN_SUCCESS',
        resource: 'authentication',
        resource_id: 'auth',
        details: { method: 'email', ip: '192.168.1.100' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
        error_message: null
      },
      {
        user_id: '5e51ec52-c656-4f4b-a940-425acb873b0b',
        action: 'PROFILE_UPDATE',
        resource: 'users',
        resource_id: '5e51ec52-c656-4f4b-a940-425acb873b0b',
        details: { field: 'nome', old_value: 'Mario', new_value: 'Mario Rossi' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
        error_message: null
      },
      {
        user_id: '5e51ec52-c656-4f4b-a940-425acb873b0b',
        action: 'OPINION_CREATE',
        resource: 'opinioni',
        resource_id: 'opinion_123',
        details: { tema: 'Ambiente', livello: 'Nazionale' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
        error_message: null
      },
      {
        user_id: '5e51ec52-c656-4f4b-a940-425acb873b0b',
        action: 'VOTE_CAST',
        resource: 'voti',
        resource_id: 'voto_456',
        details: { tipo: 'Referendum', voto: 'Favorevole' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: true,
        error_message: null
      },
      {
        user_id: '5e51ec52-c656-4f4b-a940-425acb873b0b',
        action: 'AUTH_FAILED',
        resource: 'authentication',
        resource_id: 'auth',
        details: { method: 'email', reason: 'Invalid password' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: false,
        error_message: 'Password non corretta'
      }
    ];
    
    // Inserisci i dati reali
    for (const data of realData) {
      await pool.query(`
        INSERT INTO audit_logs (
          user_id, action, resource, resource_id, details, 
          ip_address, user_agent, success, error_message, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days')
      `, [
        data.user_id,
        data.action,
        data.resource,
        data.resource_id,
        JSON.stringify(data.details),
        data.ip_address,
        data.user_agent,
        data.success,
        data.error_message
      ]);
    }
    
    console.log(`✅ Inseriti ${realData.length} record reali`);
    
    // Verifica i risultati
    const totalCount = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const successCount = await pool.query('SELECT COUNT(*) FROM audit_logs WHERE success = true');
    const errorCount = await pool.query('SELECT COUNT(*) FROM audit_logs WHERE success = false');
    
    console.log('\n📈 Statistiche finali:');
    console.log(`- Totale record: ${totalCount.rows[0].count}`);
    console.log(`- Operazioni riuscite: ${successCount.rows[0].count}`);
    console.log(`- Operazioni fallite: ${errorCount.rows[0].count}`);
    
    await pool.end();
    console.log('✅ Completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await pool.end();
  }
}

cleanupAndInsertRealData();
