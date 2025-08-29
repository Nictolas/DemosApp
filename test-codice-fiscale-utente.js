// Test specifico per il codice fiscale dell'utente: SFFNTN83S14H264L
const CodiceFiscaleValidator = {
  // Tabelle di conversione per il calcolo del codice fiscale
  TAVOLA_DISPARI: {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  },

  TAVOLA_PARI: {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
    'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 23
  },

  TAVOLA_RESTI: {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K',
    11: 'L', 12: 'M', 13: 'N', 14: 'O', 15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U',
    21: 'V', 22: 'W', 23: 'X', 24: 'Y', 25: 'Z'
  },

  // Valida la struttura base del codice fiscale
  validateStructure(codice) {
    if (!codice || typeof codice !== 'string') return false;
    if (codice.length !== 16) return false;
    if (!/^[A-Z0-9]{16}$/.test(codice)) return false;
    return true;
  },

  // Calcola il checksum per un codice fiscale di 15 caratteri
  calcolaChecksum(codiceBase) {
    if (codiceBase.length !== 15) {
      throw new Error('Il codice base deve essere di 15 caratteri');
    }

    let somma = 0;
    
    // Calcola somma per caratteri in posizione dispari (1, 3, 5, 7, 9, 11, 13, 15)
    for (let i = 0; i < 15; i += 2) {
      const char = codiceBase.charAt(i);
      const valore = this.TAVOLA_DISPARI[char];
      console.log(`Posizione ${i + 1} (dispari): ${char} = ${valore}`);
      somma += valore || 0;
    }
    
    // Calcola somma per caratteri in posizione pari (2, 4, 6, 8, 10, 12, 14)
    for (let i = 1; i < 15; i += 2) {
      const char = codiceBase.charAt(i);
      const valore = this.TAVOLA_PARI[char];
      console.log(`Posizione ${i + 1} (pari): ${char} = ${valore}`);
      somma += valore || 0;
    }
    
    console.log(`Somma totale: ${somma}`);
    const resto = somma % 26;
    console.log(`Resto: ${somma} % 26 = ${resto}`);
    const checksum = this.TAVOLA_RESTI[resto];
    console.log(`Checksum calcolato: ${checksum}`);
    
    return checksum;
  },

  // Valida il checksum del codice fiscale
  validateChecksum(codice) {
    if (!this.validateStructure(codice)) return false;
    
    const codiceBase = codice.substring(0, 15);
    const checksumCalcolato = this.calcolaChecksum(codiceBase);
    const checksumOriginale = codice.charAt(15);
    
    console.log(`Checksum originale: ${checksumOriginale}`);
    console.log(`Checksum calcolato: ${checksumCalcolato}`);
    console.log(`Validazione: ${checksumCalcolato === checksumOriginale}`);
    
    return checksumCalcolato === checksumOriginale;
  },

  // Valida completamente un codice fiscale
  validaCodiceFiscale(codice) {
    const errori = [];
    
    console.log(`\n🧪 Validazione codice fiscale: ${codice}`);
    
    // 1. Validazione struttura
    if (!this.validateStructure(codice)) {
      errori.push('Il codice fiscale deve essere di 16 caratteri alfanumerici');
      console.log('❌ Struttura non valida');
      return { valido: false, errori };
    }
    console.log('✅ Struttura valida');
    
    // 2. Validazione checksum
    if (!this.validateChecksum(codice)) {
      errori.push('Il checksum del codice fiscale non è valido');
      console.log('❌ Checksum non valido');
      return { valido: false, errori };
    }
    console.log('✅ Checksum valido');
    
    return { valido: true, errori: [] };
  }
};

// Test con il codice fiscale dell'utente
console.log('🧪 Test validazione codice fiscale utente: SFFNTN83S14H264L\n');

const codiceUtente = 'SFFNTN83S14H264L';
const risultato = CodiceFiscaleValidator.validaCodiceFiscale(codiceUtente);

console.log('\n📊 RISULTATO FINALE:');
console.log(`Codice: ${codiceUtente}`);
console.log(`Valido: ${risultato.valido}`);
if (risultato.errori.length > 0) {
  console.log('❌ Errori:');
  risultato.errori.forEach(errore => console.log(`  - ${errore}`));
} else {
  console.log('✅ Nessun errore trovato');
}

// Test anche con altri codici fiscali per confronto
console.log('\n🔍 Test con altri codici fiscali per confronto:');

const codiciTest = [
  'RSSMRA80A01H501U', // Codice valido noto
  'SFFNTN83S14H264L', // Codice dell'utente
  'BNCMRA80A01H501U'  // Altro codice valido
];

codiciTest.forEach(codice => {
  console.log(`\n--- Test: ${codice} ---`);
  const test = CodiceFiscaleValidator.validaCodiceFiscale(codice);
  console.log(`Risultato: ${test.valido ? '✅ VALIDO' : '❌ NON VALIDO'}`);
});
