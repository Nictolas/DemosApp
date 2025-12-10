// Script per aggiornare DATABASE_URL nel .env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

// DATABASE_URL reale fornito dall'utente
const realDatabaseUrl = 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

try {
  let content = fs.readFileSync(envPath, 'utf8');
  
  // Sostituisci qualsiasi riga DATABASE_URL con quella reale
  const lines = content.split('\n');
  const updatedLines = lines.map(line => {
    if (line.trim().startsWith('DATABASE_URL=')) {
      return `DATABASE_URL=${realDatabaseUrl}`;
    }
    return line;
  });
  
  // Se non c'è DATABASE_URL, aggiungilo all'inizio
  if (!content.includes('DATABASE_URL=')) {
    updatedLines.unshift(`DATABASE_URL=${realDatabaseUrl}`);
  }
  
  fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
  console.log('✅ DATABASE_URL aggiornato nel file .env');
  
} catch (error) {
  console.error('❌ Errore aggiornamento .env:', error.message);
  process.exit(1);
}

