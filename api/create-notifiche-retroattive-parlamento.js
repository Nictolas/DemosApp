require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Crea notifiche retroattive per tutti i voti già presenti in voti_camera
 */
async function creaNotificheRetroattive() {
  try {
    console.log('='.repeat(60));
    console.log('CREAZIONE NOTIFICHE RETROATTIVE PARLAMENTO');
    console.log('='.repeat(60));
    
    // Recupera tutti i voti dalla tabella voti_camera che hanno votazione e voto
    const votiResult = await pool.query(`
      SELECT 
        vc.politico_nome,
        vc.camera,
        vc.votazione,
        vc.voto,
        vc.data_votazione,
        u.id as politico_id
      FROM voti_camera vc
      LEFT JOIN users u ON CONCAT(u.nome, ' ', u.cognome) = vc.politico_nome AND u.ruolo = 'P'
      WHERE vc.votazione IS NOT NULL 
        AND vc.voto IS NOT NULL
        AND vc.votazione != ''
        AND vc.voto != ''
      ORDER BY vc.politico_nome
    `);
    
    console.log(`\n[*] Trovati ${votiResult.rows.length} voti con dati completi`);
    
    let notificheCreate = 0;
    let notificheEsistenti = 0;
    let errori = 0;
    
    for (const voto of votiResult.rows) {
      try {
        if (!voto.politico_id) {
          console.log(`[!] Politico ${voto.politico_nome} non trovato nella tabella users, skip`);
          continue;
        }
        
        // Crea hash univoco (senza data per evitare duplicati con date diverse)
        const hashInput = `${voto.politico_nome}-${voto.votazione}`.toLowerCase().trim();
        const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');
        
        // Verifica se la notifica esiste già
        const existingNotifica = await pool.query(
          'SELECT id FROM notifiche_voti_parlamento WHERE votazione_hash = $1',
          [votazioneHash]
        );
        
        if (existingNotifica.rows.length > 0) {
          notificheEsistenti++;
          continue; // Notifica già esistente
        }
        
        // Trova gli utenti che hanno scelto questo rappresentante
        const campoRappresentante = voto.camera === 'Senato' ? 'rappresentante_senato' : 'rappresentante_camera';
        const utentiResult = await pool.query(
          `SELECT id FROM users WHERE ${campoRappresentante} = $1 AND status = 'a'`,
          [voto.politico_id]
        );
        
        if (utentiResult.rows.length === 0) {
          continue; // Nessun utente ha scelto questo rappresentante
        }
        
        // Crea la notifica
        const titolo = voto.votazione;
        const testo = `Il voto di ${voto.politico_nome}: ${voto.voto}`;
        
        await pool.query(
          `INSERT INTO notifiche_voti_parlamento (
            id_utente, politico, camera, titolo, testo, voto, data, votazione_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (votazione_hash) DO NOTHING`,
          [voto.politico_id, voto.politico_nome, voto.camera, titolo, testo, voto.voto, voto.data_votazione, votazioneHash]
        );
        
        notificheCreate++;
        console.log(`[OK] Notifica creata per ${voto.politico_nome} (${utentiResult.rows.length} utenti interessati)`);
        
      } catch (error) {
        errori++;
        console.error(`[ERR] Errore per ${voto.politico_nome}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`[OK] Notifiche create: ${notificheCreate}`);
    console.log(`[!] Notifiche già esistenti: ${notificheEsistenti}`);
    console.log(`[ERR] Errori: ${errori}`);
    console.log(`[*] Totale voti processati: ${votiResult.rows.length}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('[ERR] Errore generale:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  creaNotificheRetroattive()
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { creaNotificheRetroattive };

