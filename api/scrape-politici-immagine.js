require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

// Lista dei politici visibili nell'immagine
const politiciDaScrapare = [
  'Ignazio La Russa',
  'Matteo Salvini',
  'Adolfo Urso',
  'Chiara Tenerini',
  'Riccardo Zucconi',
  'Eugenio Zoffili',
  'Benedetto Della Vedova',
  'Francesco Lollobrigida',
  'Giorgia Meloni',
  'Nicola Fratoianni',
  'Fabrizio Rossi',
  'Edoardo Ziello',
  'Carlo Nordio',
  'Claudio Borghi',
  'Gilberto Pichetto Fratin',
  'Giuseppe Conte',
  'Matteo Orfini'
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

const OPENPOLIS_BASE_URL = 'https://parlamento19.openpolis.it';

// Funzione per estrarre l'URL dell'immagine
function extractFotoUrl($) {
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
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          src = OPENPOLIS_BASE_URL + src;
        }
        return src;
      }
    }
  }
  return null;
}

// Funzione per ottenere l'ultima votazione (semplificata)
async function getUltimaVotazione(urlOpenpolis) {
  let response = null;
  let finalUrl = urlOpenpolis;
  
  try {
    try {
      response = await axios.get(urlOpenpolis, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000,
        validateStatus: (status) => status < 500
      });
      
      if (response.status === 404) {
        const urlBase = urlOpenpolis.replace(/-\d+$/, '');
        for (let suffix = 2; suffix <= 5; suffix++) {
          try {
            const testUrl = `${urlBase}-${suffix}`;
            const testResponse = await axios.get(testUrl, {
              headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 10000,
              validateStatus: (status) => status < 500
            });
            
            if (testResponse.status === 200) {
              response = testResponse;
              finalUrl = testUrl;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
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
    
    // Estrai foto URL
    const fotoUrl = extractFotoUrl($);
    
    // Estrai votazione (semplificato)
    let votazione = null;
    let voto = null;
    let dataVotazione = null;
    
    $('table').each((i, elem) => {
      const $table = $(elem);
      const rows = $table.find('tr');
      
      if (rows.length > 1) {
        const headerRow = rows.first();
        const headerText = headerRow.text().toLowerCase();
        
        if (headerText.includes('votazione') && headerText.includes('voto')) {
          const headerCells = headerRow.find('th, td');
          if (headerCells.length >= 2) {
            const firstDataRow = rows.eq(1);
            const cells = firstDataRow.find('td');
            
            if (cells.length >= 2) {
              votazione = cells.eq(0).text().trim();
              voto = cells.eq(1).text().trim();
              
              // Estrai data
              if (votazione) {
                const dateMatch = votazione.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (dateMatch) {
                  dataVotazione = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                }
              }
            }
            return false;
          }
        }
      }
    });
    
    // Normalizza voto
    if (voto) {
      const votoLower = voto.toLowerCase();
      if (votoLower.includes('favorevole')) voto = 'Favorevole';
      else if (votoLower.includes('contrario')) voto = 'Contrario';
      else if (votoLower.includes('astenuto')) voto = 'Astenuto';
      else if (votoLower.includes('missione')) voto = 'In missione';
    }
    
    return {
      votazione: votazione || null,
      voto: voto || null,
      data_votazione: dataVotazione || null,
      foto_url: fotoUrl || null,
      final_url: finalUrl
    };
    
  } catch (error) {
    console.error(`[ERR] Errore nel recupero da ${urlOpenpolis}:`, error.message);
    return null;
  }
}

// Funzione principale
async function scrapePoliticiImmagine() {
  try {
    console.log('='.repeat(60));
    console.log('SCRAPING POLITICI DELL\'IMMAGINE');
    console.log('='.repeat(60));
    console.log(`\n[*] Elaborazione di ${politiciDaScrapare.length} politici...\n`);
    
    let successi = 0;
    let errori = 0;
    
    for (let i = 0; i < politiciDaScrapare.length; i++) {
      const politicoNome = politiciDaScrapare[i];
      const progress = `[${i + 1}/${politiciDaScrapare.length}]`;
      
      try {
        // Recupera URL e dati del politico dal database
        const result = await pool.query(`
          SELECT 
            vc.politico_nome,
            vc.camera,
            vc.url_openpolis,
            u.id as user_id
          FROM voti_camera vc
          LEFT JOIN users u ON CONCAT(u.nome, ' ', u.cognome) = vc.politico_nome
          WHERE vc.politico_nome = $1
          LIMIT 1
        `, [politicoNome]);
        
        if (result.rows.length === 0) {
          console.log(`${progress} ${politicoNome}... [SKIP] Non trovato nel database`);
          errori++;
          continue;
        }
        
        const politico = result.rows[0];
        const urlOpenpolis = politico.url_openpolis;
        
        if (!urlOpenpolis || urlOpenpolis.trim() === '') {
          console.log(`${progress} ${politicoNome}... [SKIP] Nessun URL configurato`);
          errori++;
          continue;
        }
        
        console.log(`${progress} ${politicoNome}...`, { end: ' ' });
        
        const risultato = await getUltimaVotazione(urlOpenpolis);
        
        if (risultato) {
          // Aggiorna solo la foto_url se trovata
          if (risultato.foto_url) {
            await pool.query(
              `UPDATE voti_camera 
               SET foto_url = $1, ultimo_aggiornamento = CURRENT_TIMESTAMP
               WHERE politico_nome = $2`,
              [risultato.foto_url, politicoNome]
            );
            console.log(`[OK] Foto aggiornata`);
            successi++;
          } else {
            console.log(`[!] Foto non trovata`);
            errori++;
          }
          
          // Se c'è anche una votazione, aggiorna anche quella
          if (risultato.votazione && risultato.voto) {
            // Qui potresti chiamare saveVotazione se necessario
            // Per ora aggiorniamo solo la foto
          }
        } else {
          console.log(`[ERR] Errore nello scraping`);
          errori++;
        }
        
        // Pausa per non sovraccaricare
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
    console.log(`[*] Totale: ${politiciDaScrapare.length}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('[ERR] Errore durante lo scraping:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Esegui
scrapePoliticiImmagine().catch(console.error);
