const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugUserChiara() {
  try {
    console.log('🔍 Debug utente chiara.nardone0@gmail.com...');
    
    // Cerca l'utente per email
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      ['chiara.nardone0@gmail.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Utente chiara.nardone0@gmail.com NON TROVATO');
      
      // Cerca varianti dell'email
      const variants = [
        'chiara.nardone@gmail.com',
        'chiaranardone0@gmail.com',
        'chiara.nardone0@',
        'nardone0@gmail.com'
      ];
      
      console.log('🔍 Cerco varianti...');
      for (const variant of variants) {
        const variantResult = await pool.query(
          'SELECT email FROM users WHERE email ILIKE $1',
          [`%${variant}%`]
        );
        if (variantResult.rows.length > 0) {
          console.log(`  ✅ Trovato: ${variantResult.rows[0].email}`);
        }
      }
    } else {
      const user = userResult.rows[0];
      console.log('✅ Utente trovato:');
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Nome: ${user.nome} ${user.cognome}`);
      console.log(`  - Status: ${user.status}`);
      console.log(`  - Ruolo: ${user.ruolo}`);
      console.log(`  - is_admin: ${user.is_admin}`);
      console.log(`  - is_premium: ${user.is_premium}`);
      console.log(`  - premium: ${user.premium}`);
      console.log(`  - Created: ${user.created_at}`);
    }
    
    // Confronta con nicolasmicheletti90@gmail.com
    console.log('\n🔍 Confronto con nicolasmicheletti90@gmail.com...');
    const nicolasResult = await pool.query(
      'SELECT id, email, nome, cognome, status, ruolo, is_admin FROM users WHERE email = $1',
      ['nicolasmicheletti90@gmail.com']
    );
    
    if (nicolasResult.rows.length > 0) {
      const nicolas = nicolasResult.rows[0];
      console.log('✅ Nicolas trovato:');
      console.log(`  - ID: ${nicolas.id}`);
      console.log(`  - Email: ${nicolas.email}`);
      console.log(`  - Nome: ${nicolas.nome} ${nicolas.cognome}`);
      console.log(`  - Status: ${nicolas.status}`);
      console.log(`  - Ruolo: ${nicolas.ruolo}`);
      console.log(`  - is_admin: ${nicolas.is_admin}`);
    } else {
      console.log('❌ Nicolas NON TROVATO');
    }
    
    // Conta tutti gli utenti
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\n📊 Totale utenti nel database: ${totalUsers.rows[0].count}`);
    
    // Lista alcuni utenti per debug
    const sampleUsers = await pool.query(`
      SELECT email, nome, cognome, status, ruolo 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📋 Ultimi 5 utenti:');
    sampleUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} - ${user.nome} ${user.cognome} (${user.status})`);
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug utente:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

debugUserChiara()
  .then(() => {
    console.log('🎉 Debug completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Errore durante il debug:', error);
    process.exit(1);
  });
