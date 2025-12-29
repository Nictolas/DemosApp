const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ottieni un utente reale dal database
async function getRealUser() {
  const result = await pool.query('SELECT id, nome, email FROM users WHERE id IS NOT NULL LIMIT 1');
  return result.rows[0];
}

// Genera dati di audit realistici basati su attività reali
async function generateRealAuditData() {
  try {
    console.log('👤 Recupero utente reale...');
    const user = await getRealUser();
    
    if (!user) {
      console.log('❌ Nessun utente trovato nel database');
      return;
    }
    
    console.log(`✅ Utente trovato: ${user.nome} (${user.email})`);
    
    // Genera attività realistiche per gli ultimi 30 giorni
    const activities = [
      // Login/Logout
      { action: 'LOGIN_SUCCESS', resource: 'authentication', success: true, count: 15 },
      { action: 'LOGOUT', resource: 'authentication', success: true, count: 12 },
      { action: 'LOGIN_FAILED', resource: 'authentication', success: false, count: 3 },
      
      // Profilo
      { action: 'PROFILE_VIEW', resource: 'users', success: true, count: 8 },
      { action: 'PROFILE_UPDATE', resource: 'users', success: true, count: 5 },
      
      // Opinioni
      { action: 'OPINION_CREATE', resource: 'opinioni', success: true, count: 12 },
      { action: 'OPINION_VIEW', resource: 'opinioni', success: true, count: 25 },
      { action: 'OPINION_UPDATE', resource: 'opinioni', success: true, count: 3 },
      
      // Voti
      { action: 'VOTE_CAST', resource: 'voti', success: true, count: 8 },
      { action: 'VOTE_VIEW', resource: 'voti', success: true, count: 15 },
      
      // Rappresentanti
      { action: 'REPRESENTATIVE_VIEW', resource: 'rappresentanti', success: true, count: 20 },
      { action: 'REPRESENTATIVE_SELECT', resource: 'rappresentanti', success: true, count: 2 },
      
      // Notifiche
      { action: 'NOTIFICATION_READ', resource: 'notifiche', success: true, count: 18 },
      { action: 'NOTIFICATION_DELETE', resource: 'notifiche', success: true, count: 5 },
      
      // Errori occasionali
      { action: 'API_ERROR', resource: 'api', success: false, count: 2 },
      { action: 'VALIDATION_ERROR', resource: 'forms', success: false, count: 1 }
    ];
    
    console.log('📊 Generazione dati di audit...');
    
    let totalInserted = 0;
    
    for (const activity of activities) {
      for (let i = 0; i < activity.count; i++) {
        // Genera timestamp casuale negli ultimi 30 giorni
        const daysAgo = Math.floor(Math.random() * 30);
        const hoursAgo = Math.floor(Math.random() * 24);
        const minutesAgo = Math.floor(Math.random() * 60);
        
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);
        timestamp.setHours(timestamp.getHours() - hoursAgo);
        timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);
        
        // Genera dettagli realistici
        const details = generateDetails(activity.action);
        
        await pool.query(`
          INSERT INTO audit_logs (
            user_id, action, resource, resource_id, details, 
            ip_address, user_agent, success, error_message, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          user.id,
          activity.action,
          activity.resource,
          generateResourceId(activity.resource),
          JSON.stringify(details),
          generateRandomIP(),
          generateRandomUserAgent(),
          activity.success,
          activity.success ? null : generateErrorMessage(activity.action),
          timestamp
        ]);
        
        totalInserted++;
      }
    }
    
    console.log(`✅ Inseriti ${totalInserted} record di audit reali`);
    
    // Mostra statistiche
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN success = true THEN 1 END) as successful,
        COUNT(CASE WHEN success = false THEN 1 END) as failed,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as last_week
      FROM audit_logs 
      WHERE user_id = $1
    `, [user.id]);
    
    console.log('\n📈 Statistiche per utente:');
    console.log(`- Totale attività: ${stats.rows[0].total}`);
    console.log(`- Operazioni riuscite: ${stats.rows[0].successful}`);
    console.log(`- Operazioni fallite: ${stats.rows[0].failed}`);
    console.log(`- Ultima settimana: ${stats.rows[0].last_week}`);
    
    await pool.end();
    console.log('✅ Completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await pool.end();
  }
}

function generateDetails(action) {
  const detailsMap = {
    'LOGIN_SUCCESS': { method: 'email', ip: generateRandomIP() },
    'PROFILE_UPDATE': { field: 'nome', old_value: 'Mario', new_value: 'Mario Rossi' },
    'OPINION_CREATE': { tema: 'Ambiente', livello: 'Nazionale', testo: 'Breve testo opinione' },
    'VOTE_CAST': { tipo: 'Referendum', voto: 'Favorevole', questione: 'Ambiente' },
    'REPRESENTATIVE_SELECT': { rappresentante: 'Mario Rossi', partito: 'Partito Verde' },
    'NOTIFICATION_READ': { tipo: 'info', titolo: 'Nuova notifica' },
    'API_ERROR': { endpoint: '/api/opinioni', status: 500, message: 'Internal server error' },
    'VALIDATION_ERROR': { field: 'email', message: 'Formato email non valido' }
  };
  
  return detailsMap[action] || { note: 'Attività registrata' };
}

function generateResourceId(resource) {
  const resourceIdMap = {
    'authentication': 'auth',
    'users': 'user_profile',
    'opinioni': `opinion_${Math.random().toString(36).substr(2, 9)}`,
    'voti': `vote_${Math.random().toString(36).substr(2, 9)}`,
    'rappresentanti': `rep_${Math.random().toString(36).substr(2, 9)}`,
    'notifiche': `notif_${Math.random().toString(36).substr(2, 9)}`,
    'api': 'api_call',
    'forms': 'form_submission'
  };
  
  return resourceIdMap[resource] || 'unknown';
}

function generateRandomIP() {
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function generateRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function generateErrorMessage(action) {
  const errorMessages = {
    'LOGIN_FAILED': 'Credenziali non valide',
    'API_ERROR': 'Errore interno del server',
    'VALIDATION_ERROR': 'Dati di input non validi',
    'AUTH_FAILED': 'Autenticazione fallita'
  };
  
  return errorMessages[action] || 'Errore generico';
}

generateRealAuditData();
