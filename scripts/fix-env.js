// Script per verificare e correggere il .env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

try {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('📋 Contenuto file .env:');
  console.log('='.repeat(50));
  
  let databaseUrlFound = false;
  let hasPlaceholder = false;
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('DATABASE_URL')) {
      databaseUrlFound = true;
      console.log(`Linea ${index + 1}: ${line.substring(0, 50)}...`);
      if (line.includes('username:password') || line.includes('your-')) {
        hasPlaceholder = true;
        console.log('   ⚠️  Questa riga contiene un placeholder!');
      }
    }
  });
  
  console.log('='.repeat(50));
  
  if (!databaseUrlFound) {
    console.log('❌ DATABASE_URL non trovato nel file .env');
  } else if (hasPlaceholder) {
    console.log('⚠️  DATABASE_URL contiene un placeholder');
    console.log('💡 Sostituisci con la connection string reale di Neon');
  } else {
    console.log('✅ DATABASE_URL sembra essere configurato correttamente');
  }
  
} catch (error) {
  console.error('❌ Errore lettura file .env:', error.message);
}

