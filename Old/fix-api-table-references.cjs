const fs = require('fs');
const path = require('path');

async function fixApiTableReferences() {
  try {
    console.log('🔧 Aggiornando riferimenti tabella da "utenti" a "users"...');
    
    const filePath = path.join(__dirname, 'api', 'index.js');
    
    // Leggi il file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Sostituisci tutti i FROM utenti con FROM users
    const oldContent = content;
    content = content.replace(/FROM utenti/g, 'FROM users');
    
    // Sostituisci anche i riferimenti singoli
    content = content.replace(/SELECT id FROM utenti/g, 'SELECT id FROM users');
    content = content.replace(/DELETE FROM utenti/g, 'DELETE FROM users');
    
    // Scrivi il file aggiornato
    fs.writeFileSync(filePath, content, 'utf8');
    
    // Verifica le modifiche
    const changes = (content.match(/FROM users/g) || []).length;
    const oldChanges = (oldContent.match(/FROM utenti/g) || []).length;
    
    console.log(`✅ Aggiornamento completato!`);
    console.log(`📊 Riferimenti "FROM utenti" sostituiti: ${oldChanges}`);
    console.log(`📊 Nuovi riferimenti "FROM users": ${changes}`);
    
    // Mostra alcune righe aggiornate per verifica
    const lines = content.split('\n');
    const updatedLines = lines.filter(line => line.includes('FROM users')).slice(0, 5);
    
    console.log('📋 Esempi di righe aggiornate:');
    updatedLines.forEach((line, index) => {
      console.log(`   ${index + 1}. ${line.trim()}`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento:', error);
  }
}

fixApiTableReferences();
