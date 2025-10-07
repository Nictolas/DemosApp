const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("🔄 Imposto 'Save bees and farmers' -> no");
    await client.query("UPDATE ice SET quorum='no' WHERE nome='Save bees and farmers'");

    console.log("🔄 Inserisco/Aggiorno 'End The Slaughter Age'");
    await client.query(
      "INSERT INTO ice (id, nome, descrizione, quorum, datainizio, datafine, sitoweb, data_creazione) VALUES (gen_random_uuid(), 'End The Slaughter Age', '', 'no', '2022-06-05', '2023-06-06', 'https://citizens-initiative.europa.eu/initiatives/details/2022/000003_en', NOW()) ON CONFLICT (nome) DO UPDATE SET quorum='no', datainizio=excluded.datainizio, datafine=excluded.datafine, sitoweb=excluded.sitoweb"
    );

    const check = await client.query("SELECT nome, quorum, datainizio, datafine, sitoweb FROM ice WHERE nome IN ('Save bees and farmers', 'End The Slaughter Age') ORDER BY nome");
    console.table(check.rows);
  } catch (e) {
    console.error('❌ Errore:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


