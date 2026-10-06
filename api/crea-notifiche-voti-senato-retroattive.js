/**
 * Script per creare notifiche retroattive per i voti del Senato già salvati
 * in parlamento_voti_nominali ma per cui non sono state ancora create notifiche
 */

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

/**
 * Crea notifiche per un singolo voto
 */
async function creaNotificaPerVoto(voto) {
  try {
    const { nome_politico, camera, voto: tipoVoto, uri_votazione } = voto;
    
    if (!nome_politico || !uri_votazione || !tipoVoto) {
      return false;
    }
    
    // Recupera il titolo della votazione
    const votazioneResult = await pool.query(
      'SELECT titolo, data_votazione FROM parlamento WHERE uri = $1',
      [uri_votazione]
    );
    
    if (votazioneResult.rows.length === 0) {
      console.log(`[!] Votazione ${uri_votazione} non trovata, skip`);
      return false;
    }
    
    const titoloVotazione = votazioneResult.rows[0].titolo;
    const dataVotazione = votazioneResult.rows[0].data_votazione;
    
    // Crea hash univoco
    const hashInput = `${nome_politico}-${titoloVotazione}`.toLowerCase().trim();
    const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');
    
    // Verifica se la notifica esiste già
    const existingNotifica = await pool.query(
      'SELECT id FROM notifiche_voti_parlamento WHERE votazione_hash = $1',
      [votazioneHash]
    );
    
    if (existingNotifica.rows.length > 0) {
      return false; // Notifica già esistente
    }
    
    // Trova il politico nella tabella users
    let politicoResult = await pool.query(
      `SELECT id FROM users 
       WHERE CONCAT(nome, ' ', cognome) = $1 
         AND ruolo = 'P' 
         AND grado_elezione = $2`,
      [nome_politico, camera === 'Senato' ? 'S' : 'C']
    );
    
    // Se non trovato, prova a dividere nome e cognome
    if (politicoResult.rows.length === 0) {
      const partiNome = nome_politico.trim().split(' ');
      if (partiNome.length >= 2) {
        const nome = partiNome[0];
        const cognome = partiNome.slice(1).join(' ');
        politicoResult = await pool.query(
          `SELECT id FROM users 
           WHERE nome = $1 AND cognome = $2 
             AND ruolo = 'P' 
             AND grado_elezione = $3`,
          [nome, cognome, camera === 'Senato' ? 'S' : 'C']
        );
      }
    }
    
    if (politicoResult.rows.length === 0) {
      console.log(`[!] Politico ${nome_politico} non trovato nella tabella users, skip`);
      return false;
    }
    
    const politicoId = politicoResult.rows[0].id;
    
    // Trova gli utenti che hanno questo rappresentante
    const campoRappresentante = camera === 'Senato' ? 'rappresentante_senato' : 'rappresentante_camera';
    const utentiResult = await pool.query(
      `SELECT id FROM users WHERE ${campoRappresentante} = $1 AND status = 'a'`,
      [politicoId]
    );
    
    if (utentiResult.rows.length === 0) {
      return false; // Nessun utente ha scelto questo rappresentante
    }
    
    // Crea la notifica
    const titolo = titoloVotazione;
    const testo = `Il voto di ${nome_politico}: ${tipoVoto}`;
    
    try {
      await pool.query(
        `INSERT INTO notifiche_voti_parlamento (
          id_utente, politico, camera, titolo, testo, voto, data, votazione_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (votazione_hash) DO NOTHING`,
        [politicoId, nome_politico, camera, titolo, testo, tipoVoto, dataVotazione, votazioneHash]
      );
      
      console.log(`[OK] Notifica creata per ${utentiResult.rows.length} utenti - ${nome_politico}: ${tipoVoto}`);
      return true;
    } catch (error) {
      if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
        console.error(`[ERR] Errore creazione notifica per ${nome_politico}:`, error.message);
      }
      return false;
    }
    
  } catch (error) {
    console.error(`[ERR] Errore nella creazione notifica:`, error.message);
    return false;
  }
}

async function processaVotiRetroattivi() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 PROCESSAMENTO NOTIFICHE RETROATTIVE PER VOTI SENATO');
  console.log('='.repeat(80) + '\n');
  
  try {
    // Recupera tutti i voti del Senato dalla tabella parlamento_voti_nominali
    const votiResult = await pool.query(`
      SELECT DISTINCT 
        nome_politico, 
        camera, 
        voto, 
        uri_votazione
      FROM parlamento_voti_nominali
      WHERE camera = 'Senato'
      ORDER BY uri_votazione, nome_politico
    `);
    
    console.log(`📊 Trovati ${votiResult.rows.length} voti del Senato da processare\n`);
    
    let notificheCreate = 0;
    let notificheEsistenti = 0;
    let errori = 0;
    let politiciNonTrovati = 0;
    let nessunUtente = 0;
    
    for (const voto of votiResult.rows) {
      const risultato = await creaNotificaPerVoto(voto);
      
      if (risultato === true) {
        notificheCreate++;
      } else if (risultato === false) {
        // Potrebbe essere già esistente, politico non trovato, o nessun utente
        // (i log specifici sono già stati stampati dalla funzione)
        notificheEsistenti++;
      } else {
        errori++;
      }
      
      // Pausa per non sovraccaricare il database
      if ((notificheCreate + notificheEsistenti + errori) % 50 === 0) {
        console.log(`\n📊 Progresso: ${notificheCreate} create, ${notificheEsistenti} esistenti/skip, ${errori} errori\n`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ PROCESSAMENTO COMPLETATO');
    console.log('='.repeat(80));
    console.log(`📊 Statistiche:`);
    console.log(`   - Notifiche create: ${notificheCreate}`);
    console.log(`   - Notifiche già esistenti/skip: ${notificheEsistenti}`);
    console.log(`   - Errori: ${errori}`);
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Errore durante il processamento:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui lo script
processaVotiRetroattivi().catch(console.error);
