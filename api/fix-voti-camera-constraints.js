require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixConstraints() {
  try {
    console.log('[*] Correzione constraint tabella voti_camera...');
    
    // Rimuovi NOT NULL da data_votazione se presente
    try {
      await pool.query('ALTER TABLE voti_camera ALTER COLUMN data_votazione DROP NOT NULL');
      console.log('[OK] Rimosso NOT NULL da data_votazione');
    } catch (e) {
      if (!e.message.includes('does not exist')) {
        console.log(`[!] ${e.message}`);
      }
    }
    
    // Inserisci i politici
    const politici = [
      {
        nome: 'Giorgia Meloni',
        camera: 'Camera',
        url: 'https://parlamento19.openpolis.it/persone/giorgia-meloni-1977-01-15'
      },
      {
        nome: 'Matteo Salvini',
        camera: 'Camera',
        url: 'https://parlamento19.openpolis.it/persone/matteo-salvini-1973-03-09'
      }
    ];
    
    console.log('\n[*] Inserimento politici...');
    for (const politico of politici) {
      try {
        await pool.query(`
          INSERT INTO voti_camera (politico_nome, camera, url_openpolis)
          VALUES ($1, $2, $3)
          ON CONFLICT (politico_nome) 
          DO UPDATE SET 
            camera = EXCLUDED.camera,
            url_openpolis = EXCLUDED.url_openpolis
        `, [politico.nome, politico.camera, politico.url]);
        console.log(`[OK] ${politico.nome}`);
      } catch (e) {
        console.log(`[!] ${politico.nome}: ${e.message}`);
      }
    }
    
    // Verifica inserimenti
    const result = await pool.query('SELECT politico_nome, camera, url_openpolis FROM voti_camera');
    console.log(`\n[OK] Totale politici nel database: ${result.rows.length}`);
    result.rows.forEach(r => {
      console.log(`  - ${r.politico_nome} (${r.camera})`);
    });
    
    console.log('\n[OK] Correzione completata!');
    
  } catch (error) {
    console.error('[ERR] Errore:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  fixConstraints()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { fixConstraints };


