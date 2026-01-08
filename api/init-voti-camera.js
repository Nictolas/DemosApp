require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initVotiCamera() {
  try {
    console.log('[*] Inizializzazione tabella voti_camera...');
    
    // Leggi e esegui lo script SQL
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, 'create-voti-camera-table.sql');
    
    if (fs.existsSync(sqlFile)) {
      const sql = fs.readFileSync(sqlFile, 'utf-8');
      // Esegui le query (separate da ;)
      const queries = sql.split(';').filter(q => q.trim().length > 0);
      
      for (const query of queries) {
        if (query.trim()) {
          try {
            await pool.query(query);
          } catch (e) {
            // Ignora errori se la tabella/indice esiste già
            if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
              console.log(`[!] Warning: ${e.message}`);
            }
          }
        }
      }
      console.log('[OK] Tabella creata/verificata');
    }
    
    // Inserisci alcuni politici di esempio
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
    
    console.log('\n[*] Inserimento politici di esempio...');
    for (const politico of politici) {
      try {
        await pool.query(`
          INSERT INTO voti_camera (politico_nome, camera, url_openpolis)
          VALUES ($1, $2, $3)
          ON CONFLICT (politico_nome) 
          DO UPDATE SET url_openpolis = EXCLUDED.url_openpolis
        `, [politico.nome, politico.camera, politico.url]);
        console.log(`[OK] ${politico.nome}`);
      } catch (e) {
        console.log(`[!] ${politico.nome}: ${e.message}`);
      }
    }
    
    console.log('\n[OK] Inizializzazione completata!');
    
  } catch (error) {
    console.error('[ERR] Errore:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initVotiCamera()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { initVotiCamera };


