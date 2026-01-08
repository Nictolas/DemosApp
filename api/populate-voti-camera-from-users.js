require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Funzione per normalizzare i nomi (rimuove accenti, caratteri speciali)
function normalizeSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Funzione per formattare la data come YYYY-MM-DD
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

async function populateVotiCamera() {
  try {
    console.log('='.repeat(60));
    console.log('POPOLAZIONE voti_camera DA users');
    console.log('='.repeat(60));
    
    // Recupera tutti i politici dalla tabella users
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.data_nascita,
        CONCAT(u.nome, ' ', u.cognome) as politico_nome,
        CASE 
          WHEN u.grado_elezione = 'C' THEN 'Camera'
          WHEN u.grado_elezione = 'S' THEN 'Senato'
          ELSE 'Camera'
        END as camera
      FROM users u
      WHERE u.ruolo = 'P' 
        AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
        AND u.status = 'a'
      ORDER BY u.cognome, u.nome
    `);
    
    console.log(`\n[*] Trovati ${result.rows.length} politici nella tabella users`);
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    
    // Inserisci o aggiorna ogni politico
    for (const politico of result.rows) {
      try {
        // Costruisci l'URL Openpolis
        const nomeSlug = normalizeSlug(politico.nome);
        const cognomeSlug = normalizeSlug(politico.cognome);
        const dataFormattata = formatDate(politico.data_nascita);
        
        let urlOpenpolis;
        if (dataFormattata) {
          urlOpenpolis = `https://parlamento19.openpolis.it/persone/${nomeSlug}-${cognomeSlug}-${dataFormattata}`;
        } else {
          urlOpenpolis = `https://parlamento19.openpolis.it/persone/${nomeSlug}-${cognomeSlug}`;
        }
        
        // Inserisci o aggiorna
        const insertResult = await pool.query(`
          INSERT INTO voti_camera (politico_nome, camera, url_openpolis)
          VALUES ($1, $2, $3)
          ON CONFLICT (politico_nome) 
          DO UPDATE SET 
            camera = EXCLUDED.camera,
            url_openpolis = EXCLUDED.url_openpolis,
            ultimo_aggiornamento = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
        `, [politico.politico_nome, politico.camera, urlOpenpolis]);
        
        if (insertResult.rows[0].inserted) {
          inserted++;
          console.log(`[OK] Inserito: ${politico.politico_nome} (${politico.camera})`);
        } else {
          updated++;
          console.log(`[OK] Aggiornato: ${politico.politico_nome} (${politico.camera})`);
        }
        
      } catch (error) {
        errors++;
        console.error(`[ERR] Errore per ${politico.politico_nome}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`[OK] Inseriti: ${inserted}`);
    console.log(`[OK] Aggiornati: ${updated}`);
    console.log(`[ERR] Errori: ${errors}`);
    console.log(`[*] Totale: ${result.rows.length}`);
    
    // Verifica il risultato
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM voti_camera
      WHERE politico_nome IN (
        SELECT CONCAT(nome, ' ', cognome) 
        FROM users 
        WHERE ruolo = 'P' 
          AND (grado_elezione = 'C' OR grado_elezione = 'S')
          AND status = 'a'
      )
    `);
    
    console.log(`\n[OK] Totale record in voti_camera: ${countResult.rows[0].total}`);
    
  } catch (error) {
    console.error('[ERR] Errore generale:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  populateVotiCamera()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { populateVotiCamera };


