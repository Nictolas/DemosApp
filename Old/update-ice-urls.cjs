const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const updates = [
  { nome: 'Stop Vivisection', url: 'https://citizens-initiative.europa.eu/initiatives/details/2012/000007/stop-vivisection_it' },
  { nome: 'Minority SafePack', url: 'https://citizens-initiative.europa.eu/initiatives/details/2017/000004/minority-safepack-one-million-signatures-diversity-europe_it' },
  { nome: 'Salvare i cosmetici cruelty‑free', url: 'https://citizens-initiative.europa.eu/initiatives/details/2021/000006_it' },
  { nome: 'End the Cage Age', url: 'https://citizens-initiative.europa.eu/initiatives/details/2018/000004/end-cage-age_it' },
  { nome: 'Stop Finning', url: 'https://citizens-initiative.europa.eu/initiatives/details/2020/000001_en' },
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔄 Aggiornamento URL Commissione Europea per ICE...');
    for (const u of updates) {
      const res = await client.query('UPDATE ice SET sitoweb = $1 WHERE nome = $2', [u.url, u.nome]);
      console.log(`➡️  ${u.nome}: aggiornate ${res.rowCount} righe`);
    }

    console.log("\n🔄 Imposto quorum = 'no' per 'Save bees and farmers'");
    const q = await client.query("UPDATE ice SET quorum = 'no' WHERE nome = 'Save bees and farmers'");
    console.log('➡️  Save bees and farmers (quorum no):', q.rowCount);

    const verify = await client.query('SELECT nome, sitoweb, quorum FROM ice WHERE nome = ANY($1) ORDER BY nome', [updates.map(u => u.nome).concat(['Save bees and farmers'])]);
    console.table(verify.rows);
  } catch (e) {
    console.error('❌ Errore aggiornamento:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();


