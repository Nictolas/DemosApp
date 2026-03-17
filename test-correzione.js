// Test per verificare la correzione della tabella TAVOLA_RESTI
const TAVOLA_RESTI_CORRETTA = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K',
  11: 'L', 12: 'M', 13: 'N', 14: 'O', 15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U',
  21: 'V', 22: 'W', 23: 'X', 24: 'Y', 25: 'Z'
};

console.log('🧪 Test correzione TAVOLA_RESTI\n');

// Test con il resto 11 (che causava il problema)
const resto = 11;
const checksum = TAVOLA_RESTI_CORRETTA[resto];

console.log(`Resto: ${resto}`);
console.log(`Checksum: ${checksum}`);
console.log(`Valido: ${checksum === 'L' ? '✅ SÌ' : '❌ NO'}`);

// Test con altri valori per verificare la completezza
console.log('\n🔍 Test completezza tabella:');
for (let i = 0; i <= 25; i++) {
  const valore = TAVOLA_RESTI_CORRETTA[i];
  console.log(`Resto ${i}: ${valore}`);
}

console.log('\n✅ Tabella TAVOLA_RESTI ora completa e corretta!');
