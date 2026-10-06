/**
 * Script per verificare come viene usato session_id nei log su Neon
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

async function checkSessionId() {
  try {
    console.log('📊 Verifica distribuzione session_id su Neon...\n');

    // Distribuzione session_id
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN session_id IS NULL THEN 'NULL'
          WHEN session_id = '' THEN 'EMPTY'
          ELSE 'HAS_VALUE'
        END as status,
        COUNT(*) as count
      FROM centralized_logs
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('📋 Distribuzione:');
    result.rows.forEach(r => {
      console.log(`   ${r.status}: ${r.count.toLocaleString()} log`);
    });

    // Totale
    const total = await pool.query('SELECT COUNT(*) as total FROM centralized_logs');
    const withSession = await pool.query('SELECT COUNT(*) as count FROM centralized_logs WHERE session_id IS NOT NULL AND session_id != \'\'');
    
    console.log(`\n📈 Totale log: ${parseInt(total.rows[0].total).toLocaleString()}`);
    console.log(`📈 Con session_id valido: ${parseInt(withSession.rows[0].count).toLocaleString()}`);
    console.log(`📈 Senza session_id: ${(parseInt(total.rows[0].total) - parseInt(withSession.rows[0].count)).toLocaleString()}`);

    // Esempi di session_id se presenti
    const examples = await pool.query(`
      SELECT DISTINCT session_id 
      FROM centralized_logs 
      WHERE session_id IS NOT NULL AND session_id != ''
      LIMIT 5
    `);

    if (examples.rows.length > 0) {
      console.log('\n📝 Esempi di session_id trovati:');
      examples.rows.forEach(r => {
        console.log(`   - ${r.session_id}`);
      });
    } else {
      console.log('\n⚠️ Nessun session_id valido trovato nei log');
      console.log('   Questo significa che l\'app non usa sessioni Express');
      console.log('   e session_id è sempre NULL nei log esistenti');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSessionId();

