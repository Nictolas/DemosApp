const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Set 'Save bees and farmers' -> no");
    await client.query("UPDATE ice SET quorum='no' WHERE nome='Save bees and farmers'");

    console.log("🔄 Upsert 'End The Slaughter Age'");
    const { rows } = await client.query("SELECT id FROM ice WHERE nome=$1", ['End The Slaughter Age']);
    if (rows.length === 0) {
      await client.query(
        "INSERT INTO ice (id, nome, descrizione, quorum, datainizio, datafine, sitoweb, data_creazione) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())",
        ['End The Slaughter Age', '', 'no', '2022-06-05', '2023-06-06', 'https://citizens-initiative.europa.eu/initiatives/details/2022/000003_en']
      );
    } else {
      await client.query(
        "UPDATE ice SET descrizione=$2, quorum=$3, datainizio=$4, datafine=$5, sitoweb=$6 WHERE nome=$1",
        ['End The Slaughter Age', '', 'no', '2022-06-05', '2023-06-06', 'https://citizens-initiative.europa.eu/initiatives/details/2022/000003_en']
      );
    }

    const check = await client.query("SELECT nome, quorum, datainizio, datafine, sitoweb FROM ice WHERE nome IN ('Save bees and farmers','End The Slaughter Age') ORDER BY nome");
    console.table(check.rows);
  } catch (e) {
    console.error('❌ Errore:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


