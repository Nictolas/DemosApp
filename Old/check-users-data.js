const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUsersData() {
  try {
    console.log('🔍 Controllo dati esistenti nella tabella users...');
    
    // Conta utenti totali
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Totale utenti: ${totalUsers.rows[0].count}`);
    
    // Controlla struttura tabella users
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Struttura tabella users:');
    tableStructure.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Controlla se ci sono colonne GDPR
    const gdprColumns = tableStructure.rows.filter(col => 
      col.column_name.includes('consent') || 
      col.column_name.includes('gdpr') || 
      col.column_name.includes('privacy') ||
      col.column_name.includes('terms') ||
      col.column_name.includes('marketing')
    );
    
    if (gdprColumns.length > 0) {
      console.log('\n✅ Colonne GDPR trovate:');
      gdprColumns.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('\n❌ Nessuna colonna GDPR trovata');
    }
    
    // Mostra alcuni utenti di esempio
    const sampleUsers = await pool.query(`
      SELECT id, nome, email, created_at, updated_at
      FROM users 
      WHERE id IS NOT NULL 
      LIMIT 5
    `);
    
    console.log('\n👥 Esempi di utenti:');
    sampleUsers.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.nome} (${user.email}) - Creato: ${user.created_at}`);
    });
    
    // Controlla se ci sono consensi salvati
    const consentData = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN gdpr_consent IS NOT NULL THEN 1 END) as with_gdpr_consent,
        COUNT(CASE WHEN privacy_consent IS NOT NULL THEN 1 END) as with_privacy_consent,
        COUNT(CASE WHEN terms_accepted IS NOT NULL THEN 1 END) as with_terms_accepted
      FROM users
    `);
    
    console.log('\n📋 Statistiche consensi:');
    console.log(`- Utenti totali: ${consentData.rows[0].total_users}`);
    console.log(`- Con consenso GDPR: ${consentData.rows[0].with_gdpr_consent}`);
    console.log(`- Con consenso privacy: ${consentData.rows[0].with_privacy_consent}`);
    console.log(`- Con termini accettati: ${consentData.rows[0].with_terms_accepted}`);
    
    // Controlla se ci sono dati di audit esistenti
    const auditStats = await pool.query(`
      SELECT 
        COUNT(*) as total_audit_logs,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as with_user_id,
        COUNT(CASE WHEN action LIKE '%GDPR%' THEN 1 END) as gdpr_actions,
        COUNT(CASE WHEN action LIKE '%CONSENT%' THEN 1 END) as consent_actions,
        COUNT(CASE WHEN action LIKE '%LOGIN%' THEN 1 END) as login_actions
      FROM audit_logs
    `);
    
    console.log('\n📊 Statistiche audit logs esistenti:');
    console.log(`- Totale log: ${auditStats.rows[0].total_audit_logs}`);
    console.log(`- Con user_id: ${auditStats.rows[0].with_user_id}`);
    console.log(`- Azioni GDPR: ${auditStats.rows[0].gdpr_actions}`);
    console.log(`- Azioni consenso: ${auditStats.rows[0].consent_actions}`);
    console.log(`- Azioni login: ${auditStats.rows[0].login_actions}`);
    
    await pool.end();
    console.log('\n✅ Controllo completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await pool.end();
  }
}

checkUsersData();
