require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkPolitici() {
  try {
    // Verifica politici con ruolo P
    const result = await pool.query(`
      SELECT ruolo, grado_elezione, status, COUNT(*) as count 
      FROM users 
      WHERE ruolo = 'P' 
      GROUP BY ruolo, grado_elezione, status
      ORDER BY grado_elezione, status
    `);
    
    console.log('Politici nella tabella users:');
    result.rows.forEach(row => {
      console.log(`  ruolo=${row.ruolo}, grado_elezione=${row.grado_elezione || 'NULL'}, status=${row.status}, count=${row.count}`);
    });
    
    // Verifica politici con ruolo P e grado_elezione C o S
    const result2 = await pool.query(`
      SELECT nome, cognome, ruolo, grado_elezione, status
      FROM users 
      WHERE ruolo = 'P' 
        AND (grado_elezione = 'C' OR grado_elezione = 'S')
      LIMIT 10
    `);
    
    console.log(`\nPolitici con ruolo='P' e grado_elezione='C' o 'S': ${result2.rows.length}`);
    result2.rows.forEach(row => {
      console.log(`  - ${row.nome} ${row.cognome} (grado_elezione=${row.grado_elezione}, status=${row.status})`);
    });
    
  } catch (error) {
    console.error('ERR:', error.message);
  } finally {
    await pool.end();
  }
}

checkPolitici();

