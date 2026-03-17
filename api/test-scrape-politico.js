require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://parlamento19.openpolis.it/persone/giorgia-meloni-1977-01-15';

async function testScrape() {
  try {
    console.log(`[*] Test scraping: ${url}\n`);
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Cerca tutte le tabelle
    console.log('[*] Trovate tabelle:');
    $('table').each((i, table) => {
      console.log(`\nTabella ${i + 1}:`);
      const rows = $(table).find('tr');
      console.log(`  Righe: ${rows.length}`);
      
      // Mostra header
      const header = rows.first();
      const headerCells = header.find('th, td');
      console.log('  Header:');
      headerCells.each((idx, cell) => {
        console.log(`    Col ${idx}: ${$(cell).text().trim()}`);
      });
      
      // Mostra prima riga dati
      if (rows.length > 1) {
        const firstDataRow = rows.eq(1);
        const cells = firstDataRow.find('td');
        console.log('  Prima riga dati:');
        cells.each((idx, cell) => {
          console.log(`    Col ${idx}: ${$(cell).text().trim().substring(0, 100)}`);
        });
      }
    });
    
    // Cerca sezioni con "Votazione" o "Voto"
    console.log('\n[*] Sezioni con "Votazione" o "Voto":');
    $('*').each((i, elem) => {
      const text = $(elem).text().toLowerCase();
      if ((text.includes('votazione') || text.includes('voto')) && $(elem).find('table').length > 0) {
        console.log(`  Trovato: ${elem.tagName} con classe/id: ${$(elem).attr('class') || $(elem).attr('id')}`);
      }
    });
    
  } catch (error) {
    console.error('[ERR]', error.message);
  }
}

testScrape();


