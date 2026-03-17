/**
 * Script di test per verificare l'estrazione dei dettagli numerici
 * e degli articoli dalla ricerca web
 */

require('dotenv').config();
const { cercaInformazioniLeggeWeb } = require('./services/leggeAnalysisService');

async function testEstrazioneDettagli() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST ESTRAZIONE DETTAGLI NUMERICI E ARTICOLI');
  console.log('='.repeat(80) + '\n');

  // Test con legge 1718
  console.log('📋 Test 1: Legge n. 1718 (DL 175/2025)\n');
  
  try {
    const infoWeb = await cercaInformazioniLeggeWeb('1718', 'disegno di legge', 'Disegno di legge n. 1718. Votazione questione fiducia', 'Senato');
    
    if (infoWeb) {
      console.log('✅ Informazioni trovate!\n');
      console.log('📏 Lunghezza totale:', (infoWeb.length / 1000).toFixed(1), 'KB\n');
      
      // Analizza il contenuto
      const haArticoli = infoWeb.includes('ARTICOLI');
      const haDettagliNumerici = infoWeb.includes('DETTAGLI NUMERICI');
      const haPercentuali = /\d+[\.,]?\d*\s*%/i.test(infoWeb);
      const haImporti = /€\s*\d+|\d+\s*(euro|€|miliardi|milioni)/i.test(infoWeb);
      const haDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(infoWeb);
      const haPotenze = /\d+[\.,]?\d*\s*(kW|MW|GW|kWh|MWh)/i.test(infoWeb);
      
      console.log('📊 Analisi contenuto:');
      console.log('   - Articoli:', haArticoli ? '✅ Trovati' : '❌ Non trovati');
      console.log('   - Dettagli numerici estratti:', haDettagliNumerici ? '✅ Presenti' : '❌ Assenti');
      console.log('   - Percentuali:', haPercentuali ? '✅ Trovate' : '❌ Non trovate');
      console.log('   - Importi:', haImporti ? '✅ Trovati' : '❌ Non trovati');
      console.log('   - Date:', haDate ? '✅ Trovate' : '❌ Non trovate');
      console.log('   - Potenze:', haPotenze ? '✅ Trovate' : '❌ Non trovate');
      
      // Mostra un estratto
      console.log('\n📄 Estratto (primi 2000 caratteri):');
      console.log('-'.repeat(80));
      console.log(infoWeb.substring(0, 2000));
      console.log('-'.repeat(80));
      
      // Cerca dettagli numerici specifici
      if (haDettagliNumerici) {
        const matchDettagli = infoWeb.match(/DETTAGLI NUMERICI[^\n]*(?:\n[^\n]*)*/i);
        if (matchDettagli) {
          console.log('\n🔢 Dettagli numerici estratti:');
          console.log(matchDettagli[0].substring(0, 500));
        }
      }
      
      // Cerca articoli
      if (haArticoli) {
        const matchArticoli = infoWeb.match(/ARTICOLI[^\n]*(?:\n[^\n]*)*/i);
        if (matchArticoli) {
          console.log('\n📜 Primo articolo trovato (primi 500 caratteri):');
          console.log(matchArticoli[0].substring(0, 500));
        }
      }
      
    } else {
      console.log('❌ Nessuna informazione trovata');
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test completato');
  console.log('='.repeat(80) + '\n');
}

// Esegui il test
testEstrazioneDettagli().catch(console.error);
