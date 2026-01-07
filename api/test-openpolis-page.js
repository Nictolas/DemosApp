const axios = require('axios');
const cheerio = require('cheerio');

async function testOpenpolis() {
  try {
    // Prova la pagina principale
    console.log('[*] Test pagina principale...');
    const response = await axios.get('https://parlamento19.openpolis.it', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Cerca link ai politici
    console.log('[*] Cercando link ai politici...');
    const links = [];
    $('a[href*="politico"]').each((i, elem) => {
      const href = $(elem).attr('href');
      links.push(href);
    });
    
    console.log(`[OK] Trovati ${links.length} link ai politici`);
    if (links.length > 0) {
      console.log('Primi 5 link:', links.slice(0, 5));
    }
    
    // Prova un politico noto (esempio)
    console.log('\n[*] Test pagina politico esempio...');
    const testUrl = 'https://parlamento19.openpolis.it/politico/giorgia-meloni/12345';
    try {
      const politicoResponse = await axios.get(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $politico = cheerio.load(politicoResponse.data);
      console.log('[OK] Pagina politico caricata');
      console.log('Titolo pagina:', $politico('title').text());
      
      // Cerca votazioni
      const votazioni = $politico('.votazione, .vote, [data-votazione]');
      console.log(`Trovate ${votazioni.length} votazioni`);
      
    } catch (e) {
      console.log('[!] Errore:', e.message);
    }
    
  } catch (error) {
    console.error('[ERR]', error.message);
  }
}

testOpenpolis();

