require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

async function testMariaBoschi() {
  const urlBase = 'https://parlamento19.openpolis.it/persone/maria-elena-boschi-1981-01-24';
  const urlWithSuffix = 'https://parlamento19.openpolis.it/persone/maria-elena-boschi-1981-01-24-2';
  
  console.log('Test URL base:', urlBase);
  try {
    const response1 = await axios.get(urlBase, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    console.log('Status base:', response1.status);
  } catch (e) {
    console.log('Errore base:', e.response?.status || e.message);
  }
  
  console.log('\nTest URL con suffisso -2:', urlWithSuffix);
  try {
    const response2 = await axios.get(urlWithSuffix, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    console.log('Status con suffisso:', response2.status);
    
    const $ = cheerio.load(response2.data);
    const title = $('h1').first().text().trim();
    console.log('Titolo pagina:', title);
    
    // Cerca tabelle con votazioni
    const tables = $('table');
    console.log('Tabelle trovate:', tables.length);
    
    tables.each((i, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      console.log(`\nTabella ${i + 1}: ${rows.length} righe`);
      
      if (rows.length > 1) {
        const header = rows.first().text().toLowerCase();
        console.log('Header:', header.substring(0, 100));
        
        if (header.includes('votazione') && header.includes('voto')) {
          const firstDataRow = rows.eq(1);
          const cells = firstDataRow.find('td');
          console.log('Prima riga dati - celle:', cells.length);
          cells.each((j, cell) => {
            console.log(`  Cella ${j + 1}:`, $(cell).text().trim().substring(0, 60));
          });
        }
      }
    });
    
  } catch (e) {
    console.log('Errore con suffisso:', e.response?.status || e.message);
  }
}

testMariaBoschi().catch(console.error);
