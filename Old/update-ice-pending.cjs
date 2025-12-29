const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Imposto 'Save bees and farmers' -> pending");
    const res = await client.query(
      "UPDATE ice SET quorum = 'pending' WHERE nome = 'Save bees and farmers'"
    );
    console.log('Aggiornate pending:', res.rowCount);
    const check = await client.query("SELECT nome, quorum FROM ice WHERE nome = 'Save bees and farmers'");
    console.table(check.rows);
  } catch (e) {
    console.error('❌ Errore:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


