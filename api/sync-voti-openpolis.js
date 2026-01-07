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
async function saveVotazione(politicoNome, camera, urlOpenpolis, votazione, voto, dataVotazione) {
  try {
    const query = `
      INSERT INTO voti_camera (politico_nome, camera, url_openpolis, votazione, voto, data_votazione)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (politico_nome) 
      DO UPDATE SET 
        camera = EXCLUDED.camera,
        url_openpolis = EXCLUDED.url_openpolis,
        votazione = EXCLUDED.votazione,
        voto = EXCLUDED.voto,
        data_votazione = EXCLUDED.data_votazione,
        ultimo_aggiornamento = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [politicoNome, camera, urlOpenpolis, votazione, voto, dataVotazione]);
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
    
    // Altrimenti, recupera dal database quelli che hanno già un URL configurato
    try {
      console.log('[*] Recupero politici dal database...');
      const result = await pool.query(`
        SELECT politico_nome, camera, url_openpolis 
        FROM voti_camera 
        WHERE url_openpolis IS NOT NULL AND url_openpolis != ''
        ORDER BY politico_nome
      `);
      
      console.log(`[*] Query eseguita, trovati ${result.rows.length} risultati`);
      
      if (result.rows.length > 0) {
        console.log(`[OK] Trovati ${result.rows.length} politici nel database con URL configurato`);
        return result.rows;
      } else {
        console.log('[!] Nessun politico con URL configurato trovato nel database');
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
      
      const politicoNome = politico.politico_nome || `${politico.nome} ${politico.cognome}`;
      const camera = politico.camera || (politico.grado_elezione === 'S' ? 'Senato' : 'Camera');
      const urlOpenpolis = politico.url_openpolis || 
        `${OPENPOLIS_BASE_URL}/persone/${politico.nome?.toLowerCase()}-${politico.cognome?.toLowerCase()}-${politico.data_nascita || ''}`;
      
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
            risultato.data_votazione
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
