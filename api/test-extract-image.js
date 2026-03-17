require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

async function testExtractImage() {
  const url = 'https://parlamento19.openpolis.it/persone/maria-elena-boschi-1981-01-24-2';
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Cerca immagini nella pagina
    console.log('Cercando immagini...\n');
    
    // Prova vari selettori per l'immagine del politico
    const imageSelectors = [
      'img[src*="opdm-service-data"]',
      'img[src*="persons"]',
      'img[src*="images"]',
      '.avatar img',
      '.photo img',
      '.foto img',
      'header img',
      'main img',
      'article img',
      'img[alt*="Boschi"]',
      'img[alt*="Maria"]'
    ];
    
    let foundImage = null;
    
    for (const selector of imageSelectors) {
      const images = $(selector);
      if (images.length > 0) {
        console.log(`✅ Trovato con selettore: ${selector}`);
        images.each((i, img) => {
          const src = $(img).attr('src');
          const alt = $(img).attr('alt');
          console.log(`  Immagine ${i + 1}:`);
          console.log(`    src: ${src}`);
          console.log(`    alt: ${alt || 'N/A'}`);
          
          // Se contiene "opdm-service-data" o "persons", è probabilmente quella giusta
          if (src && (src.includes('opdm-service-data') || src.includes('persons'))) {
            foundImage = src;
          }
        });
      }
    }
    
    // Se non trovato, cerca tutti gli img
    if (!foundImage) {
      console.log('\nCercando tutte le immagini nella pagina...');
      $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && src.includes('http')) {
          console.log(`  img[${i}]: ${src}`);
          if (src.includes('opdm-service-data') || src.includes('persons')) {
            foundImage = src;
          }
        }
      });
    }
    
    // Cerca anche in background-image CSS
    console.log('\nCercando background-image...');
    $('[style*="background-image"]').each((i, elem) => {
      const style = $(elem).attr('style');
      const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (match && match[1]) {
        const bgUrl = match[1];
        console.log(`  background-image[${i}]: ${bgUrl}`);
        if (bgUrl.includes('opdm-service-data') || bgUrl.includes('persons')) {
          foundImage = bgUrl;
        }
      }
    });
    
    console.log('\n' + '='.repeat(60));
    if (foundImage) {
      // Se è un URL relativo, costruisci quello completo
      if (foundImage.startsWith('//')) {
        foundImage = 'https:' + foundImage;
      } else if (foundImage.startsWith('/')) {
        foundImage = 'https://parlamento19.openpolis.it' + foundImage;
      }
      console.log('✅ URL immagine trovato:', foundImage);
    } else {
      console.log('❌ Nessuna immagine trovata');
    }
    
  } catch (error) {
    console.error('Errore:', error.message);
  }
}

testExtractImage().catch(console.error);
