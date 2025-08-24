// Test per la validazione del codice fiscale
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
    'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  },

  TAVOLA_RESTI: {
    0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K'
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
      somma += this.TAVOLA_DISPARI[char] || 0;
    }
    
    // Calcola somma per caratteri in posizione pari (2, 4, 6, 8, 10, 12, 14)
    for (let i = 1; i < 15; i += 2) {
      const char = codiceBase.charAt(i);
      somma += this.TAVOLA_PARI[char] || 0;
    }
    
    const resto = somma % 26;
    return this.TAVOLA_RESTI[resto];
  },

  // Valida il checksum del codice fiscale
  validateChecksum(codice) {
    if (!this.validateStructure(codice)) return false;
    
    const codiceBase = codice.substring(0, 15);
    const checksumCalcolato = this.calcolaChecksum(codiceBase);
    const checksumOriginale = codice.charAt(15);
    
    return checksumCalcolato === checksumOriginale;
  },

  // Valida completamente un codice fiscale
  validaCodiceFiscale(codice) {
    const errori = [];
    
    // 1. Validazione struttura
    if (!this.validateStructure(codice)) {
      errori.push('Il codice fiscale deve essere di 16 caratteri alfanumerici');
      return { valido: false, errori };
    }
    
    // 2. Validazione checksum
    if (!this.validateChecksum(codice)) {
      errori.push('Il checksum del codice fiscale non è valido');
      return { valido: false, errori };
    }
    
    return { valido: true, errori: [] };
  }
};

// Test con codici fiscali validi e non validi
console.log('🧪 Test validazione codice fiscale\n');

// Codici fiscali validi (esempi reali)
const codiciValidi = [
  'RSSMRA80A01H501U', // Mario Rossi, nato il 01/01/1980 a Roma
  'BNCMRA80A01H501U', // Mario Bianchi, nato il 01/01/1980 a Roma
  'VRDMRA80A01H501U'  // Mario Verdi, nato il 01/01/1980 a Roma
];

// Codici fiscali non validi
const codiciNonValidi = [
  'RSSMRA80A01H501',  // Troppo corto
  'RSSMRA80A01H501UX', // Troppo lungo
  'RSSMRA80A01H5011',  // Checksum sbagliato
  'RSSMRA80A01H501@',  // Carattere non valido
  '1234567890123456'   // Solo numeri
];

console.log('✅ Test codici fiscali VALIDI:');
codiciValidi.forEach(codice => {
  const validazione = CodiceFiscaleValidator.validaCodiceFiscale(codice);
  console.log(`  ${codice}: ${validazione.valido ? '✅ VALIDO' : '❌ NON VALIDO'}`);
  if (!validazione.valido) {
    console.log(`    Errori: ${validazione.errori.join(', ')}`);
  }
});

console.log('\n❌ Test codici fiscali NON VALIDI:');
codiciNonValidi.forEach(codice => {
  const validazione = CodiceFiscaleValidator.validaCodiceFiscale(codice);
  console.log(`  ${codice}: ${validazione.valido ? '✅ VALIDO' : '❌ NON VALIDO'}`);
  if (!validazione.valido) {
    console.log(`    Errori: ${validazione.errori.join(', ')}`);
  }
});

console.log('\n🔍 Test validazione struttura:');
console.log(`  RSSMRA80A01H501U: ${CodiceFiscaleValidator.validateStructure('RSSMRA80A01H501U') ? '✅' : '❌'}`);
console.log(`  RSSMRA80A01H501: ${CodiceFiscaleValidator.validateStructure('RSSMRA80A01H501') ? '✅' : '❌'}`);
console.log(`  RSSMRA80A01H501@: ${CodiceFiscaleValidator.validateStructure('RSSMRA80A01H501@') ? '✅' : '❌'}`);

console.log('\n🔍 Test validazione checksum:');
console.log(`  RSSMRA80A01H501U: ${CodiceFiscaleValidator.validateChecksum('RSSMRA80A01H501U') ? '✅' : '❌'}`);
console.log(`  RSSMRA80A01H5011: ${CodiceFiscaleValidator.validateChecksum('RSSMRA80A01H5011') ? '✅' : '❌'}`);

console.log('\n🎯 Test completato!');
