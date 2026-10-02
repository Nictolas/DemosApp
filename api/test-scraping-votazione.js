require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

const OPENPOLIS_BASE_URL = 'https://parlamento19.openpolis.it';

/**
 * Test: Estrazione URL votazione e scraping approfondito
 */
async function testScrapingVotazione() {
  console.log('='.repeat(60));
  console.log('TEST SCRAPING VOTAZIONE');
  console.log('='.repeat(60));
  
  // Test con un politico noto (esempio: Giorgia Meloni)
  const testUrl = 'https://parlamento19.openpolis.it/persone/giorgia-meloni-1977-01-15';
  
  try {
    console.log(`\n[1] Test estrazione votazione da: ${testUrl}`);
    const response = await axios.get(testUrl, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    let votazione = null;
    let urlVotazione = null;
    let numeroSeduta = null;
    
    // Cerca la tabella delle votazioni
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
              const headerCells = rows.first().find('th, td');
              let votazioneCol = 0;
              
              headerCells.each((idx, cell) => {
                const text = $(cell).text().toLowerCase().trim();
                if (text.includes('votazione') || text.includes('mozione') || text.includes('disegno')) {
                  votazioneCol = idx;
                }
              });
              
              votazione = cells.eq(votazioneCol).text().trim();
              
              // Estrai URL votazione
              const votazioneCell = cells.eq(votazioneCol);
              const link = votazioneCell.find('a').first();
              if (link.length > 0) {
                const href = link.attr('href');
                if (href && !href.startsWith('http')) {
                  const baseUrl = testUrl.split('/').slice(0, 3).join('/');
                  urlVotazione = href.startsWith('/') ? baseUrl + href : `${testUrl}/${href}`;
                } else if (href && href.startsWith('http')) {
                  urlVotazione = href;
                }
              }
              
              // Estrai numero seduta
              if (votazione) {
                const sedutaMatch = votazione.match(/Seduta\s+n\.\s*(\d+)/i);
                if (sedutaMatch) {
                  numeroSeduta = parseInt(sedutaMatch[1]);
                }
              }
              
              return false; // break
            }
          }
        }
      }
    });
    
    console.log(`✅ Votazione trovata: ${votazione ? votazione.substring(0, 80) + '...' : 'NON TROVATA'}`);
    console.log(`✅ URL votazione: ${urlVotazione || 'NON TROVATO'}`);
    console.log(`✅ Numero seduta: ${numeroSeduta || 'NON TROVATO'}`);
    
    if (!urlVotazione) {
      console.log('\n⚠️  URL votazione non trovato, test completato');
      return;
    }
    
    // Test scraping approfondito
    console.log(`\n[2] Test scraping approfondito: ${urlVotazione}`);
    
    const detailResponse = await axios.get(urlVotazione, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $detail = cheerio.load(detailResponse.data);
    
    let descrizioneCompleta = null;
    let tipoAtto = null;
    let siglaAtto = null;
    let numeroAtto = null;
    
    // Estrai descrizione
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
      'main article'
    ];
    
    for (const selector of descrizioneSelectors) {
      const element = $detail(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text && text.length >= 100) {
          descrizioneCompleta = text.substring(0, 500);
          break;
        }
      }
    }
    
    // Estrai tipo atto
    const tipoAttoMatch = $detail('body').text().match(/(DDL|Mozione|Decreto|Disegno di legge|Proposta di legge|Ordine del giorno|ODG|Emendamento|EM)\s*(?:n\.?\s*)?(\d+)?/i);
    if (tipoAttoMatch) {
      tipoAtto = tipoAttoMatch[1].trim();
      if (tipoAttoMatch[2]) {
        numeroAtto = parseInt(tipoAttoMatch[2]);
      }
    }
    
    // Estrai sigla atto
    const siglaMatch = $detail('body').text().match(/(DDL|Mozione|Decreto|ODG|EM)\s*(?:n\.?\s*)?(\d+)/i);
    if (siglaMatch) {
      siglaAtto = `${siglaMatch[1]} ${siglaMatch[2]}`;
    }
    
    console.log(`✅ Descrizione completa: ${descrizioneCompleta ? descrizioneCompleta.substring(0, 100) + '...' : 'NON TROVATA'}`);
    console.log(`✅ Tipo atto: ${tipoAtto || 'NON TROVATO'}`);
    console.log(`✅ Sigla atto: ${siglaAtto || 'NON TROVATA'}`);
    console.log(`✅ Numero atto: ${numeroAtto || 'NON TROVATO'}`);
    
    // Test salvataggio nel database
    console.log(`\n[3] Test salvataggio nel database`);
    
    const testResult = await pool.query(
      `SELECT COUNT(*) as count FROM votazioni_parlamento WHERE url_votazione IS NOT NULL`
    );
    
    console.log(`✅ Votazioni con URL salvate nel database: ${testResult.rows[0].count}`);
    
    // Test query per verificare struttura
    const structureTest = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'votazioni_parlamento' 
       AND column_name IN ('url_votazione', 'numero_seduta', 'tipo_atto', 'sigla_atto', 'numero_atto')
       ORDER BY column_name`
    );
    
    console.log(`\n✅ Colonne metadati presenti:`);
    structureTest.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETATO CON SUCCESSO');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRORE NEL TEST:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Esegui il test
testScrapingVotazione().catch(console.error);
