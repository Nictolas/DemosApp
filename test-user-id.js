const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkUser() {
  try {
    // Cerca utenti con email simile
    const result2 = await pool.query('SELECT id, email, nome FROM users WHERE email LIKE $1', ['%nicolas%']);
    console.log('Users with similar email:', result2.rows);
    
    // Cerca utenti con ID che contiene 5e51ec52
    const result3 = await pool.query('SELECT id, email, nome FROM users WHERE id::text LIKE $1', ['%5e51ec52%']);
    console.log('Users with ID containing 5e51ec52:', result3.rows);
    
    // Mostra tutti gli utenti per vedere la struttura
    const result4 = await pool.query('SELECT id, email, nome FROM users ORDER BY created_at DESC LIMIT 5');
    console.log('Recent users:', result4.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

checkUser();
