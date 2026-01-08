require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Base URL Openpolis
const OPENPOLIS_BASE_URL = 'https://parlamento19.openpolis.it';

/**
 * Ottiene l'ultima votazione da una pagina Openpolis
 * Formato URL: https://parlamento19.openpolis.it/persone/nome-cognome-data-nascita
 */
async function getUltimaVotazione(urlOpenpolis) {
  try {
    const response = await axios.get(urlOpenpolis, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Cerca la sezione "Votazione" o "Voti chiave"
    // La prima riga della tabella è l'ultima votazione
    let votazione = null;
    let voto = null;
    let dataVotazione = null;
    
    // Cerca la tabella delle votazioni - prova diversi selettori
    // Dalla struttura HTML di Openpolis, la tabella ha colonne: Votazione, Voto, Voto del gruppo
    let table = null;
    
    // Cerca tutte le tabelle e trova quella con header "Votazione", "Voto"
    $('table').each((i, elem) => {
      const $table = $(elem);
      const rows = $table.find('tr');
      
      if (rows.length > 1) {
        // Controlla l'header
        const headerRow = rows.first();
        const headerText = headerRow.text().toLowerCase();
        
        // Verifica che l'header contenga "Votazione" e "Voto" (ma non "Voto del gruppo" come unica colonna)
        if (headerText.includes('votazione') && headerText.includes('voto')) {
          // Verifica che ci siano almeno 2 colonne nell'header
          const headerCells = headerRow.find('th, td');
          if (headerCells.length >= 2) {
            table = $table;
            return false; // Esci dal loop
          }
        }
      }
    });
    
    if (table && table.length > 0) {
      // Prendi la prima riga di dati (saltando l'header)
      const rows = table.find('tr');
      if (rows.length > 1) {
        const firstDataRow = rows.eq(1); // Seconda riga (prima dopo header)
        
        // Estrai le celle
        const cells = firstDataRow.find('td');
        
        if (cells.length >= 2) {
          // Analizza l'header per capire quale colonna contiene cosa
          const headerRow = rows.first();
          const headerCells = headerRow.find('th, td');
          let votazioneCol = 0;
          let votoCol = 1;
          
          // Cerca le colonne nell'header
          headerCells.each((idx, cell) => {
            const text = $(cell).text().toLowerCase().trim();
            if (text.includes('votazione') || text.includes('mozione') || text.includes('disegno')) {
              votazioneCol = idx;
            }
            if (text.includes('voto') && !text.includes('gruppo')) {
              votoCol = idx;
            }
          });
          
          // Estrai dalla colonna corretta
          votazione = cells.eq(votazioneCol).text().trim();
          voto = cells.eq(votoCol).text().trim();
          
          // Se il voto è vuoto o troppo lungo, prova altre colonne
          if (!voto || voto.length > 50) {
            // Prova colonna successiva
            if (cells.length > votoCol + 1) {
              voto = cells.eq(votoCol + 1).text().trim();
            }
            // Se ancora vuoto, prova l'ultima colonna
            if (!voto || voto.length > 50) {
              voto = cells.last().text().trim();
            }
          }
          
          // Estrai la data dal testo della votazione (es: "Seduta n. 527 del 10/09/2025")
          if (votazione) {
            const dateMatch = votazione.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) {
              dataVotazione = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            }
            // Rimuovi la parte "Seduta n. X del Y" dal testo della votazione, lasciando solo il titolo
            votazione = votazione.replace(/^Seduta\s+n\.\s*\d+\s+del\s+\d{2}\/\d{2}\/\d{4}\s*/i, '').trim();
            // Se rimane vuoto, ripristina il testo originale
            if (!votazione || votazione.length < 3) {
              votazione = cells.eq(votazioneCol).text().trim();
            }
          }
        }
      }
    }
    
    // Se non trovato, prova selettori alternativi
    if (!votazione || votazione.length < 5) {
      const altSelectors = [
        '.votazione:first',
        '.vote-item:first',
        '[data-votazione]:first',
        'table tr:not(:first-child):first',
      ];
      
      for (const selector of altSelectors) {
        const firstRow = $(selector).first();
        if (firstRow.length > 0) {
          votazione = firstRow.find('td:first-child, .titolo, .title').first().text().trim();
          voto = firstRow.find('td:nth-child(2), .voto').first().text().trim();
          if (votazione && votazione.length > 5) break;
        }
      }
    }
    
    // Normalizza il voto
    if (voto) {
      voto = normalizzaVoto(voto);
    }
    
    return {
      votazione: votazione || null,
      voto: voto || null,
      data_votazione: dataVotazione || null
    };
    
  } catch (error) {
    console.error(`[ERR] Errore nel recupero votazione da ${urlOpenpolis}:`, error.message);
    return null;
  }
}

/**
 * Normalizza il voto in: In missione, Astenuto, Favorevole, Contrario
 */
function normalizzaVoto(voto) {
  if (!voto) return null;
  
  const votoLower = voto.toLowerCase().trim();
  
  if (votoLower.includes('missione') || votoLower.includes('mission')) {
    return 'In missione';
  }
  
  if (votoLower.includes('astenuto') || votoLower.includes('astensione') || votoLower.includes('abstain')) {
    return 'Astenuto';
  }
  
  if (votoLower.includes('favorevole') || votoLower.includes('sì') || votoLower === 'si' || 
      votoLower.includes('yes') || votoLower.includes('approvato') || votoLower.includes('favore')) {
    return 'Favorevole';
  }
  
  if (votoLower.includes('contrario') || votoLower.includes('no') || 
      votoLower.includes('respinto') || votoLower.includes('rejected') || votoLower.includes('contrar')) {
    return 'Contrario';
  }
  
  return null;
}

/**
 * Salva o aggiorna una votazione nel database
 */
/**
 * Crea notifiche per gli utenti che hanno scelto questo rappresentante
 */
async function creaNotificheParlamento(politicoNome, camera, votazione, voto, dataVotazione, politicoUserId) {
  try {
    if (!votazione || !voto) {
      return; // Non creare notifiche se non ci sono dati di votazione
    }
    
    // Crea hash univoco per evitare duplicati
    // Usa solo politicoNome e votazione (senza data) per evitare duplicati con date diverse
    const crypto = require('crypto');
    const hashInput = `${politicoNome}-${votazione}`.toLowerCase().trim();
    const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');
    
    // Verifica se la notifica esiste già
    const existingNotifica = await pool.query(
      'SELECT id FROM notifiche_voti_parlamento WHERE votazione_hash = $1',
      [votazioneHash]
    );
    
    if (existingNotifica.rows.length > 0) {
      return; // Notifica già esistente, evita duplicati
    }
    
    // Trova gli utenti che hanno scelto questo rappresentante
    const campoRappresentante = camera === 'Senato' ? 'rappresentante_senato' : 'rappresentante_camera';
    
    // Trova il politico nella tabella users per ottenere il suo ID
    let politicoId = politicoUserId;
    if (!politicoId) {
      const politicoResult = await pool.query(
        'SELECT id FROM users WHERE CONCAT(nome, \' \', cognome) = $1 AND ruolo = \'P\'',
        [politicoNome]
      );
      if (politicoResult.rows.length > 0) {
        politicoId = politicoResult.rows[0].id;
      }
    }
    
    if (!politicoId) {
      console.log(`[!] Politico ${politicoNome} non trovato nella tabella users, notifica non creata`);
      return;
    }
    
    // Trova gli utenti che hanno questo rappresentante
    const utentiResult = await pool.query(
      `SELECT id FROM users WHERE ${campoRappresentante} = $1 AND status = 'a'`,
      [politicoId]
    );
    
    if (utentiResult.rows.length === 0) {
      return; // Nessun utente ha scelto questo rappresentante
    }
    
    // Crea UNA notifica condivisa (come per i voti comunali)
    // La notifica è visibile a tutti gli utenti che hanno scelto questo rappresentante
    const titolo = votazione;
    const testo = `Il voto di ${politicoNome}: ${voto}`;
    
    try {
      await pool.query(
        `INSERT INTO notifiche_voti_parlamento (
          id_utente, politico, camera, titolo, testo, voto, data, votazione_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (votazione_hash) DO NOTHING`,
        [politicoId, politicoNome, camera, titolo, testo, voto, dataVotazione, votazioneHash]
      );
      
      console.log(`[OK] Notifica creata per ${utentiResult.rows.length} utenti che hanno scelto ${politicoNome}`);
    } catch (error) {
      // Ignora errori di duplicati (ON CONFLICT DO NOTHING)
      if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
        console.error(`[ERR] Errore creazione notifica per ${politicoNome}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`[ERR] Errore nella creazione notifiche per ${politicoNome}:`, error.message);
  }
}

async function saveVotazione(politicoNome, camera, urlOpenpolis, votazione, voto, dataVotazione, politicoUserId = null) {
  try {
    // Prima verifica se esiste già un record con un URL configurato
    const existingResult = await pool.query(
      'SELECT url_openpolis FROM voti_camera WHERE politico_nome = $1',
      [politicoNome]
    );
    
    // Se esiste già un URL (non vuoto), preservalo invece di sovrascriverlo
    const urlDaUsare = existingResult.rows.length > 0 && existingResult.rows[0].url_openpolis && existingResult.rows[0].url_openpolis.trim() !== ''
      ? existingResult.rows[0].url_openpolis  // Preserva URL esistente
      : urlOpenpolis;  // Usa nuovo URL solo se non ce n'è uno esistente
    
    const query = `
      INSERT INTO voti_camera (politico_nome, camera, url_openpolis, votazione, voto, data_votazione)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (politico_nome) 
      DO UPDATE SET 
        camera = EXCLUDED.camera,
        url_openpolis = COALESCE(NULLIF(voti_camera.url_openpolis, ''), EXCLUDED.url_openpolis),
        votazione = EXCLUDED.votazione,
        voto = EXCLUDED.voto,
        data_votazione = EXCLUDED.data_votazione,
        ultimo_aggiornamento = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [politicoNome, camera, urlDaUsare, votazione, voto, dataVotazione]);
    
    // Genera spiegazione AI se disponibile (in background, non blocca il processo)
    if (votazione && votazione.trim() !== '') {
      const { generaESalvaSpiegazione } = require('./services/aiExplanationService');
      generaESalvaSpiegazione(politicoNome, votazione, camera, voto).catch(error => {
        console.error(`[ERR] Errore generazione spiegazione per ${politicoNome}:`, error.message);
      });
    }
    
    // Crea notifiche per gli utenti che hanno scelto questo rappresentante
    await creaNotificheParlamento(politicoNome, camera, votazione, voto, dataVotazione, politicoUserId);
    
    return true;
    
  } catch (error) {
    console.error(`[ERR] Errore nel salvataggio per ${politicoNome}:`, error.message);
    return false;
  }
}

/**
 * Ottiene tutti i politici dal database (con URL già configurati)
 * oppure da una lista fornita
 */
async function getPolitici(deputatiFile = null) {
  try {
    // Se viene fornito un file, caricalo
    if (deputatiFile) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.resolve(deputatiFile);
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const deputati = JSON.parse(fileContent);
        console.log(`[OK] Caricati ${deputati.length} politici dal file`);
        return deputati;
      }
    }
    
    // Recupera i politici dalla tabella users con ruolo="P" e grado_elezione="C" o "S"
    try {
      console.log('[*] Recupero politici dalla tabella users...');
      const result = await pool.query(`
        SELECT 
          u.id as user_id,
          u.nome,
          u.cognome,
          u.data_nascita,
          CONCAT(u.nome, ' ', u.cognome) as politico_nome,
          CASE 
            WHEN u.grado_elezione = 'C' THEN 'Camera'
            WHEN u.grado_elezione = 'S' THEN 'Senato'
            ELSE 'Camera'
          END as camera,
          u.grado_elezione,
          COALESCE(vc.url_openpolis, '') as url_openpolis
        FROM users u
        LEFT JOIN voti_camera vc ON CONCAT(u.nome, ' ', u.cognome) = vc.politico_nome
        WHERE u.ruolo = 'P' 
          AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
          AND u.status = 'a'
        ORDER BY u.cognome, u.nome
      `);
      
      console.log(`[*] Query eseguita, trovati ${result.rows.length} politici`);
      
      if (result.rows.length > 0) {
        // Se un politico non ha URL configurato, prova a costruirlo dal nome
        const politiciConUrl = result.rows.map(row => {
          let urlOpenpolis = row.url_openpolis;
          
          // Se non ha URL, costruiscilo usando nome, cognome e data di nascita
          if (!urlOpenpolis || urlOpenpolis === '') {
            // Costruisci slug da nome e cognome (normalizza caratteri speciali)
            const nomeSlug = (row.nome || '').toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[àáâãäå]/g, 'a')
              .replace(/[èéêë]/g, 'e')
              .replace(/[ìíîï]/g, 'i')
              .replace(/[òóôõö]/g, 'o')
              .replace(/[ùúûü]/g, 'u')
              .replace(/[ç]/g, 'c')
              .replace(/[^a-z0-9-]/g, '');
            
            const cognomeSlug = (row.cognome || '').toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[àáâãäå]/g, 'a')
              .replace(/[èéêë]/g, 'e')
              .replace(/[ìíîï]/g, 'i')
              .replace(/[òóôõö]/g, 'o')
              .replace(/[ùúûü]/g, 'u')
              .replace(/[ç]/g, 'c')
              .replace(/[^a-z0-9-]/g, '');
            
            // Formatta la data di nascita come YYYY-MM-DD
            let dataFormattata = '';
            if (row.data_nascita) {
              const data = new Date(row.data_nascita);
              if (!isNaN(data.getTime())) {
                const anno = data.getFullYear();
                const mese = String(data.getMonth() + 1).padStart(2, '0');
                const giorno = String(data.getDate()).padStart(2, '0');
                dataFormattata = `${anno}-${mese}-${giorno}`;
              }
            }
            
            // Costruisci URL: https://parlamento19.openpolis.it/persone/nome-cognome-YYYY-MM-DD
            if (dataFormattata) {
              urlOpenpolis = `${OPENPOLIS_BASE_URL}/persone/${nomeSlug}-${cognomeSlug}-${dataFormattata}`;
            } else {
              // Se non c'è data, usa solo nome-cognome (fallback)
              urlOpenpolis = `${OPENPOLIS_BASE_URL}/persone/${nomeSlug}-${cognomeSlug}`;
            }
          }
          
          return {
            politico_nome: row.politico_nome,
            camera: row.camera,
            url_openpolis: urlOpenpolis,
            user_id: row.user_id,
            nome: row.nome,
            cognome: row.cognome,
            data_nascita: row.data_nascita
          };
        });
        
        console.log(`[OK] Trovati ${politiciConUrl.length} politici dalla tabella users`);
        return politiciConUrl;
      } else {
        console.log('[!] Nessun politico trovato nella tabella users con ruolo="P" e grado_elezione="C" o "S"');
      }
    } catch (error) {
      console.error('[ERR] Errore nel recupero dal database:', error.message);
      console.error('[ERR] Stack:', error.stack);
    }
    
    console.log('[!] Nessun politico trovato nel database. Fornisci un file JSON con la lista.');
    return [];
    
  } catch (error) {
    console.error('[ERR] Errore nel recupero politici:', error.message);
    return [];
  }
}

/**
 * Funzione principale
 */
async function syncVotiOpenpolis(deputatiFile = null) {
  try {
    console.log('='.repeat(60));
    console.log('SINCRONIZZAZIONE VOTI DA OPENPOLIS');
    console.log('='.repeat(60));
    
    // Ottieni la lista dei politici
    const politici = await getPolitici(deputatiFile);
    
    if (politici.length === 0) {
      console.log('[ERR] Nessun politico trovato. Fornisci un file JSON o configura gli URL nel database.');
      return;
    }
    
    console.log(`\n[*] Elaborazione di ${politici.length} politici...\n`);
    
    let successi = 0;
    let errori = 0;
    
    // Processa ogni politico
    for (let i = 0; i < politici.length; i++) {
      const politico = politici[i];
      const progress = `[${i + 1}/${politici.length}]`;
      
      const politicoNome = politico.politico_nome || `${politico.nome || ''} ${politico.cognome || ''}`.trim();
      const camera = politico.camera || (politico.grado_elezione === 'S' ? 'Senato' : 'Camera');
      let urlOpenpolis = politico.url_openpolis;
      
      // Se non ha URL, costruiscilo usando nome, cognome e data di nascita
      if (!urlOpenpolis || urlOpenpolis === '') {
        // Costruisci slug da nome e cognome
        const nomeSlug = (politico.nome || '').toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[àáâãäå]/g, 'a')
          .replace(/[èéêë]/g, 'e')
          .replace(/[ìíîï]/g, 'i')
          .replace(/[òóôõö]/g, 'o')
          .replace(/[ùúûü]/g, 'u')
          .replace(/[ç]/g, 'c')
          .replace(/[^a-z0-9-]/g, '');
        
        const cognomeSlug = (politico.cognome || '').toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[àáâãäå]/g, 'a')
          .replace(/[èéêë]/g, 'e')
          .replace(/[ìíîï]/g, 'i')
          .replace(/[òóôõö]/g, 'o')
          .replace(/[ùúûü]/g, 'u')
          .replace(/[ç]/g, 'c')
          .replace(/[^a-z0-9-]/g, '');
        
        // Formatta la data di nascita come YYYY-MM-DD
        let dataFormattata = '';
        if (politico.data_nascita) {
          const data = new Date(politico.data_nascita);
          if (!isNaN(data.getTime())) {
            const anno = data.getFullYear();
            const mese = String(data.getMonth() + 1).padStart(2, '0');
            const giorno = String(data.getDate()).padStart(2, '0');
            dataFormattata = `${anno}-${mese}-${giorno}`;
          }
        }
        
        // Costruisci URL: https://parlamento19.openpolis.it/persone/nome-cognome-YYYY-MM-DD
        if (dataFormattata) {
          urlOpenpolis = `${OPENPOLIS_BASE_URL}/persone/${nomeSlug}-${cognomeSlug}-${dataFormattata}`;
        } else {
          // Se non c'è data, usa solo nome-cognome (fallback)
          urlOpenpolis = `${OPENPOLIS_BASE_URL}/persone/${nomeSlug}-${cognomeSlug}`;
        }
      }
      
      try {
        console.log(`${progress} ${politicoNome}...`, { end: ' ' });
        
        const risultato = await getUltimaVotazione(urlOpenpolis);
        
        if (risultato && risultato.votazione) {
          const salvato = await saveVotazione(
            politicoNome,
            camera,
            urlOpenpolis,
            risultato.votazione,
            risultato.voto,
            risultato.data_votazione,
            politico.user_id || null
          );
          
          if (salvato) {
            console.log(`[OK] ${risultato.voto || 'N/A'}`);
            successi++;
          } else {
            console.log(`[ERR] Errore salvataggio`);
            errori++;
          }
        } else {
          console.log(`[!] Nessuna votazione trovata`);
          errori++;
        }
        
        // Piccola pausa per non sovraccaricare il server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`[ERR] ${error.message}`);
        errori++;
      }
    }
    
    // Riepilogo
    console.log('\n' + '='.repeat(60));
    console.log('RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`[OK] Successi: ${successi}`);
    console.log(`[ERR] Errori: ${errori}`);
    console.log(`[*] Totale: ${politici.length}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('[ERR] Errore durante la sincronizzazione:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  const deputatiFile = process.argv[2] || null;
  
  syncVotiOpenpolis(deputatiFile)
    .then(() => {
      console.log('\n[OK] Sincronizzazione completata');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n[ERR] Sincronizzazione fallita:', error);
      process.exit(1);
    });
}

module.exports = { syncVotiOpenpolis, getUltimaVotazione, normalizzaVoto };
