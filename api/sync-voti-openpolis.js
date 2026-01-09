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
 * Gestisce anche suffissi numerici (es: -2, -3) se l'URL base non funziona
 */
async function getUltimaVotazione(urlOpenpolis) {
  let response = null;
  let finalUrl = urlOpenpolis;
  
  try {
    // Prova prima con l'URL originale
    try {
      response = await axios.get(urlOpenpolis, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000,
        validateStatus: function (status) {
          return status < 500; // Accetta anche 404 per gestirlo
        }
      });
      
      // Se 404, prova con suffissi numerici (-2, -3, ecc.)
      if (response.status === 404) {
        console.log(`[INFO] URL base non trovato, provo con suffissi numerici...`);
        
        // Estrai la base dell'URL (senza eventuali suffissi esistenti)
        const urlBase = urlOpenpolis.replace(/-\d+$/, '');
        
        // Prova con suffissi da -2 a -5
        for (let suffix = 2; suffix <= 5; suffix++) {
          const testUrl = `${urlBase}-${suffix}`;
          try {
            const testResponse = await axios.get(testUrl, {
              headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 10000,
              validateStatus: function (status) {
                return status < 500;
              }
            });
            
            if (testResponse.status === 200) {
              response = testResponse;
              finalUrl = testUrl;
              console.log(`[OK] Trovato con suffisso -${suffix}`);
              break;
            }
          } catch (e) {
            // Continua con il prossimo suffisso
            continue;
          }
        }
      }
    } catch (error) {
      // Se l'errore è 404, prova con suffissi
      if (error.response && error.response.status === 404) {
        const urlBase = urlOpenpolis.replace(/-\d+$/, '');
        for (let suffix = 2; suffix <= 5; suffix++) {
          try {
            const testUrl = `${urlBase}-${suffix}`;
            const testResponse = await axios.get(testUrl, {
              headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 10000
            });
            response = testResponse;
            finalUrl = testUrl;
            console.log(`[OK] Trovato con suffisso -${suffix}`);
            break;
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!response) {
        throw error;
      }
    }
    
    if (!response || response.status !== 200) {
      throw new Error(`HTTP ${response?.status || 'unknown'}: URL non valido`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Estrai URL dell'immagine del politico
    let fotoUrl = null;
    const imageSelectors = [
      'img[src*="opdm-service-data"]',
      'img[src*="persons"]',
      'img[src*="images/persons"]'
    ];
    
    for (const selector of imageSelectors) {
      const img = $(selector).first();
      if (img.length > 0) {
        let src = img.attr('src');
        if (src) {
          // Normalizza URL (gestisce URL relativi e protocollo)
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            src = 'https://parlamento19.openpolis.it' + src;
          }
          fotoUrl = src;
          break;
        }
      }
    }
    
    // Cerca la sezione "Votazione" o "Voti chiave"
    // La prima riga della tabella è l'ultima votazione
    let votazione = null;
    let descrizioneVotazione = null;
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
          
          // Estrai la descrizione completa: cerca link o tooltip nella cella della votazione
          const votazioneCell = cells.eq(votazioneCol);
          
          // Strategia 1: Cerca attributi data-* o title nella cella (più veloce)
          if (!descrizioneVotazione || descrizioneVotazione.length < 50) {
            descrizioneVotazione = votazioneCell.attr('title') || 
                                   votazioneCell.attr('data-tooltip') || 
                                   votazioneCell.attr('data-description') ||
                                   votazioneCell.attr('data-title');
          }
          
          // Strategia 2: Cerca link nella cella e segui il link per ottenere più dettagli
          let urlVotazione = null;
          const link = votazioneCell.find('a').first();
          if (link.length > 0) {
            const href = link.attr('href');
            // Se è un link relativo, costruisci l'URL completo usando finalUrl
            if (href && !href.startsWith('http')) {
              const baseUrl = finalUrl.split('/').slice(0, 3).join('/');
              urlVotazione = href.startsWith('/') ? baseUrl + href : `${finalUrl}/${href}`;
            } else if (href && href.startsWith('http')) {
              urlVotazione = href;
            }
            
            // Prova a recuperare la descrizione dal link (se è nella stessa pagina o pagina collegata)
            if (urlVotazione) {
              try {
                const descResponse = await axios.get(urlVotazione, {
                  headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  },
                  timeout: 10000
                });
                const $desc = cheerio.load(descResponse.data);
                
                // Selettori specifici per Openpolis
                const selectors = [
                  '.descrizione-votazione',
                  '.descrizione',
                  '.description',
                  '.testo-votazione',
                  '.testo',
                  '.content',
                  '[class*="desc"]',
                  '[class*="testo"]',
                  '[class*="votazione"]',
                  'article p',
                  '.main-content p',
                  'main p'
                ];
                
                for (const selector of selectors) {
                  const text = $desc(selector).first().text().trim();
                  if (text && text.length >= 50 && text.length < 5000) {
                    descrizioneVotazione = text;
                    break;
                  }
                }
                
                // Se non trovato, prova a prendere il primo paragrafo significativo
                if (!descrizioneVotazione || descrizioneVotazione.length < 50) {
                  $desc('p').each((i, elem) => {
                    const text = $desc(elem).text().trim();
                    if (text.length >= 50 && text.length < 5000 && !descrizioneVotazione) {
                      descrizioneVotazione = text;
                      return false; // break
                    }
                  });
                }
              } catch (err) {
                // Ignora errori nel recupero della descrizione
                console.log(`[INFO] Impossibile recuperare descrizione da ${fullUrl}: ${err.message}`);
              }
            }
          }
          
          // Strategia 3: Cerca nella pagina stessa sezioni descrittive vicine alla tabella
          if (!descrizioneVotazione || descrizioneVotazione.length < 50) {
            const tableParent = table.parent();
            const nearbySelectors = [
              'p',
              '.description',
              '.testo',
              '.descrizione',
              '[class*="desc"]',
              '.content',
              '.info',
              '.dettagli'
            ];
            
            for (const selector of nearbySelectors) {
              const text = tableParent.find(selector).first().text().trim();
              if (text && text.length >= 50 && text.length < 2000) {
                descrizioneVotazione = text;
                break;
              }
            }
          }
          
          // Strategia 4: Cerca nella pagina principale sezioni specifiche di Openpolis
          if (!descrizioneVotazione || descrizioneVotazione.length < 50) {
            const openpolisSelectors = [
              'section[class*="votazione"]',
              'div[class*="votazione"]',
              '.votazioni-dettaglio',
              '.atto-dettaglio',
              'article',
              'main section'
            ];
            
            for (const selector of openpolisSelectors) {
              const section = $(selector).first();
              if (section.length > 0) {
                const text = section.find('p').first().text().trim();
                if (text && text.length >= 50 && text.length < 2000) {
                  descrizioneVotazione = text;
                  break;
                }
              }
            }
          }
          
          // Strategia 5: Usa il testo completo della cella se contiene più informazioni
          if (!descrizioneVotazione || descrizioneVotazione.length < 50) {
            const cellText = votazioneCell.text().trim();
            if (cellText && cellText.length > votazione.length && cellText.length < 2000) {
              // Se il testo della cella è più lungo del titolo, potrebbe contenere la descrizione
              descrizioneVotazione = cellText;
            }
          }
          
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
      descrizione_votazione: descrizioneVotazione || null,
      voto: voto || null,
      data_votazione: dataVotazione || null,
      url_votazione: urlVotazione || null,
      numero_seduta: numeroSeduta || null,
      foto_url: fotoUrl || null
    };
    
  } catch (error) {
    console.error(`[ERR] Errore nel recupero votazione da ${urlOpenpolis}:`, error.message);
    return null;
  }
}

/**
 * Scraping approfondito della pagina della votazione su Openpolis
 * Estrae: descrizione completa, tipo atto, sigla atto, numero atto, metadati aggiuntivi
 */
async function scrapeVotazioneDettagliata(urlVotazione) {
  if (!urlVotazione || !urlVotazione.startsWith('http')) {
    return null;
  }

  try {
    console.log(`[INFO] Scraping approfondito votazione: ${urlVotazione}`);
    const response = await axios.get(urlVotazione, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    let descrizioneCompleta = null;
    let tipoAtto = null;
    let siglaAtto = null;
    let numeroAtto = null;
    let numeroSeduta = null;

    // Estrai descrizione completa con selettori specifici per Openpolis
    const descrizioneSelectors = [
      '.descrizione-votazione',
      '.descrizione-atto',
      '.descrizione',
      '.description',
      '.testo-votazione',
      '.testo-atto',
      '.testo',
      '.content',
      'article .content',
      'main article',
      '[class*="desc"]',
      '[class*="testo"]',
      '[class*="votazione"]',
      '[class*="atto"]'
    ];

    for (const selector of descrizioneSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text && text.length >= 100 && text.length < 10000) {
          descrizioneCompleta = text;
          break;
        }
      }
    }

    // Se non trovato, prova a prendere tutti i paragrafi significativi
    if (!descrizioneCompleta || descrizioneCompleta.length < 100) {
      const paragraphs = [];
      $('article p, main p, .content p').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length >= 50) {
          paragraphs.push(text);
        }
      });
      if (paragraphs.length > 0) {
        descrizioneCompleta = paragraphs.join(' ').substring(0, 5000);
      }
    }

    // Estrai tipo atto (DDL, Mozione, Decreto, ecc.)
    const tipoAttoMatch = $('body').text().match(/(DDL|Mozione|Decreto|Disegno di legge|Proposta di legge|Ordine del giorno|ODG|Emendamento|EM)\s*(?:n\.?\s*)?(\d+)?/i);
    if (tipoAttoMatch) {
      tipoAtto = tipoAttoMatch[1].trim();
      if (tipoAttoMatch[2]) {
        numeroAtto = parseInt(tipoAttoMatch[2]);
      }
    }

    // Estrai sigla atto (es: "DDL 1718", "Mozione 123")
    const siglaMatch = $('body').text().match(/(DDL|Mozione|Decreto|ODG|EM)\s*(?:n\.?\s*)?(\d+)/i);
    if (siglaMatch) {
      siglaAtto = `${siglaMatch[1]} ${siglaMatch[2]}`;
    }

    // Estrai numero seduta
    const sedutaMatch = $('body').text().match(/Seduta\s+(?:n\.?\s*)?(\d+)/i);
    if (sedutaMatch) {
      numeroSeduta = parseInt(sedutaMatch[1]);
    }

    return {
      descrizione_votazione: descrizioneCompleta,
      tipo_atto: tipoAtto,
      sigla_atto: siglaAtto,
      numero_atto: numeroAtto,
      numero_seduta: numeroSeduta
    };

  } catch (error) {
    console.error(`[ERR] Errore nello scraping approfondito di ${urlVotazione}:`, error.message);
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

async function saveVotazione(politicoNome, camera, urlOpenpolis, votazione, descrizioneVotazione, voto, dataVotazione, politicoUserId = null, urlVotazione = null, numeroSeduta = null, fotoUrl = null) {
  try {
    if (!votazione || votazione.trim() === '') {
      console.log(`[!] Votazione vuota per ${politicoNome}, skip`);
      return false;
    }

    // Step 0: Se abbiamo l'URL della votazione, fai scraping approfondito
    let dettagliVotazione = null;
    if (urlVotazione) {
      dettagliVotazione = await scrapeVotazioneDettagliata(urlVotazione);
      if (dettagliVotazione) {
        // Usa la descrizione approfondita se disponibile, altrimenti quella base
        if (dettagliVotazione.descrizione_votazione && dettagliVotazione.descrizione_votazione.length > (descrizioneVotazione?.length || 0)) {
          descrizioneVotazione = dettagliVotazione.descrizione_votazione;
        }
        // Usa numero_seduta dallo scraping approfondito se disponibile
        if (dettagliVotazione.numero_seduta) {
          numeroSeduta = dettagliVotazione.numero_seduta;
        }
      }
    }

    // Step 1: Crea o recupera la votazione in votazioni_parlamento
    // Genera hash univoco per identificare la votazione
    const crypto = require('crypto');
    const hashInput = `${votazione}|${camera}|${dataVotazione || ''}`;
    const votazioneHash = crypto.createHash('md5').update(hashInput).digest('hex');

    // Crea o recupera la votazione (una sola per tutte le occorrenze)
    const votazioneResult = await pool.query(
      `INSERT INTO votazioni_parlamento (
        titolo_votazione, descrizione_votazione, camera, data_votazione, votazione_hash,
        url_votazione, numero_seduta, tipo_atto, sigla_atto, numero_atto
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (votazione_hash) 
       DO UPDATE SET 
         descrizione_votazione = COALESCE(NULLIF(EXCLUDED.descrizione_votazione, ''), votazioni_parlamento.descrizione_votazione),
         url_votazione = COALESCE(NULLIF(EXCLUDED.url_votazione, ''), votazioni_parlamento.url_votazione),
         numero_seduta = COALESCE(EXCLUDED.numero_seduta, votazioni_parlamento.numero_seduta),
         tipo_atto = COALESCE(EXCLUDED.tipo_atto, votazioni_parlamento.tipo_atto),
         sigla_atto = COALESCE(EXCLUDED.sigla_atto, votazioni_parlamento.sigla_atto),
         numero_atto = COALESCE(EXCLUDED.numero_atto, votazioni_parlamento.numero_atto),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        votazione, 
        descrizioneVotazione || null, 
        camera, 
        dataVotazione, 
        votazioneHash,
        urlVotazione || null,
        numeroSeduta || dettagliVotazione?.numero_seduta || null,
        dettagliVotazione?.tipo_atto || null,
        dettagliVotazione?.sigla_atto || null,
        dettagliVotazione?.numero_atto || null
      ]
    );

    const votazioneId = votazioneResult.rows[0].id;

    // Step 2: Genera spiegazione AI per la votazione (solo se non esiste già, in background)
    if (votazioneId) {
      const { generaSpiegazioneVotazione } = require('./services/aiExplanationService');
      generaSpiegazioneVotazione(votazioneId, votazione, descrizioneVotazione || null, camera).catch(error => {
        console.error(`[ERR] Errore generazione spiegazione per votazione ${votazioneId}:`, error.message);
      });
    }

    // Step 3: Salva il voto del politico in voti_camera con riferimento alla votazione
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
      INSERT INTO voti_camera (politico_nome, camera, url_openpolis, votazione_id, voto, data_votazione, foto_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (politico_nome) 
      DO UPDATE SET 
        camera = EXCLUDED.camera,
        url_openpolis = COALESCE(NULLIF(voti_camera.url_openpolis, ''), EXCLUDED.url_openpolis),
        votazione_id = EXCLUDED.votazione_id,
        voto = EXCLUDED.voto,
        data_votazione = EXCLUDED.data_votazione,
        foto_url = COALESCE(EXCLUDED.foto_url, voti_camera.foto_url),
        ultimo_aggiornamento = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [politicoNome, camera, urlDaUsare, votazioneId, voto, dataVotazione, fotoUrl]);
    
    // Step 4: Crea notifiche per gli utenti che hanno scelto questo rappresentante
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
        // Filtra solo i politici che hanno un URL configurato (non vuoto)
        // Non costruiamo URL automaticamente per evitare errori
        const politiciConUrl = result.rows
          .filter(row => {
            const url = row.url_openpolis;
            return url && url.trim() !== '' && url.startsWith('https://parlamento19.openpolis.it');
          })
          .map(row => {
            return {
              politico_nome: row.politico_nome,
              camera: row.camera,
              url_openpolis: row.url_openpolis.trim(),
              user_id: row.user_id,
              nome: row.nome,
              cognome: row.cognome,
              data_nascita: row.data_nascita
            };
          });
        
        console.log(`[OK] Trovati ${politiciConUrl.length} politici con URL configurato (su ${result.rows.length} totali)`);
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
    
    // Limita a 10 politici per test (rimuovi questa riga per processare tutti)
    const limit = process.env.SCRAPING_LIMIT ? parseInt(process.env.SCRAPING_LIMIT) : null;
    const politiciDaProcessare = limit ? politici.slice(0, limit) : politici;
    
    console.log(`\n[*] Elaborazione di ${politiciDaProcessare.length} politici${limit ? ` (limitato a ${limit} per test)` : ''}...\n`);
    
    let successi = 0;
    let errori = 0;
    
    // Processa ogni politico
    for (let i = 0; i < politiciDaProcessare.length; i++) {
      const politico = politiciDaProcessare[i];
      const progress = `[${i + 1}/${politici.length}]`;
      
      const politicoNome = politico.politico_nome || `${politico.nome || ''} ${politico.cognome || ''}`.trim();
      const camera = politico.camera || (politico.grado_elezione === 'S' ? 'Senato' : 'Camera');
      const urlOpenpolis = politico.url_openpolis;
      
      // Salta se non ha URL configurato
      if (!urlOpenpolis || urlOpenpolis.trim() === '' || !urlOpenpolis.startsWith('https://parlamento19.openpolis.it')) {
        console.log(`${progress} ${politicoNome}... [SKIP] Nessun URL valido`);
        continue;
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
            risultato.descrizione_votazione || null,
            risultato.voto,
            risultato.data_votazione,
            politico.user_id || null,
            risultato.url_votazione || null,
            risultato.numero_seduta || null,
            risultato.foto_url || null
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
