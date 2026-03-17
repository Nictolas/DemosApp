// Script per configurare Groq API nel file .env
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function configuraGroq() {
  console.log('🔧 CONFIGURAZIONE GROQ API');
  console.log('='.repeat(60));
  
  // Verifica se .env esiste
  if (!fs.existsSync(envPath)) {
    console.log('❌ File .env non trovato');
    console.log('   Creo il file .env da env.example...');
    
    // Copia da env.example se esiste
    const envExamplePath = path.join(__dirname, 'env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ File .env creato da env.example');
    } else {
      // Crea file .env base
      fs.writeFileSync(envPath, '# Configurazione DemosApp API\n\n');
      console.log('✅ File .env creato');
    }
  }
  
  // Leggi il file .env
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verifica se GROQ_API_KEY è già presente
  if (envContent.includes('GROQ_API_KEY=')) {
    const lines = envContent.split('\n');
    const groqLine = lines.find(line => line.trim().startsWith('GROQ_API_KEY='));
    
    if (groqLine && !groqLine.includes('gsk_...') && !groqLine.includes('#') && groqLine.split('=')[1]?.trim()) {
      const currentKey = groqLine.split('=')[1].trim();
      console.log('✅ GROQ_API_KEY già configurata');
      console.log(`   Chiave: ${currentKey.substring(0, 10)}...${currentKey.substring(currentKey.length - 4)}`);
      console.log(`   Lunghezza: ${currentKey.length} caratteri`);
      
      if (currentKey.startsWith('gsk_')) {
        console.log('   ✅ Formato chiave valido (inizia con gsk_)');
        return true;
      } else {
        console.log('   ⚠️ Formato chiave non valido (dovrebbe iniziare con gsk_)');
        return false;
      }
    } else {
      console.log('⚠️ GROQ_API_KEY presente ma non configurata (placeholder)');
    }
  }
  
  // Aggiungi o aggiorna GROQ_API_KEY
  console.log('\n📝 Configurazione GROQ_API_KEY...');
  
  // Rimuovi vecchie righe GROQ_API_KEY se presenti
  envContent = envContent.split('\n').filter(line => {
    return !line.trim().startsWith('GROQ_API_KEY=') && 
           !line.trim().startsWith('# Opzione 1: Groq API');
  }).join('\n');
  
  // Aggiungi configurazione Groq
  const groqConfig = `
# API AI per spiegazioni delle votazioni - Groq (GRATUITO - CONSIGLIATO) ⭐
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile  # Opzionale, default: llama-3.3-70b-versatile
`;
  
  // Aggiungi alla fine del file
  envContent += groqConfig;
  
  // Salva il file
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Configurazione aggiunta al file .env');
  console.log('   GROQ_API_KEY=gsk_... (placeholder)');
  console.log('   GROQ_MODEL=llama-3.3-70b-versatile');
  
  console.log('\n📋 PROSSIMI PASSI:');
  console.log('='.repeat(60));
  console.log('1. Ottieni la tua chiave API Groq:');
  console.log('   → Vai su https://console.groq.com');
  console.log('   → Clicca su "Sign Up" o "Sign In"');
  console.log('   → Vai su https://console.groq.com/keys');
  console.log('   → Clicca "Create API Key"');
  console.log('   → Copia la chiave (inizia con gsk_...)');
  console.log('');
  console.log('2. Aggiungi la chiave al file .env:');
  console.log(`   → Apri il file: ${envPath}`);
  console.log('   → Sostituisci "gsk_..." con la tua chiave API');
  console.log('   → Salva il file');
  console.log('');
  console.log('3. Riavvia il server:');
  console.log('   → npm start');
  console.log('   → oppure: node server.js');
  console.log('');
  console.log('✅ Dopo il riavvio, vedrai:');
  console.log('   "✅ Groq AI configurato per analisi leggi (gratuito)"');
  
  return false; // Non ancora configurata completamente
}

// Esegui configurazione
if (require.main === module) {
  try {
    const configurata = configuraGroq();
    
    if (configurata) {
      console.log('\n✅ Groq è già configurato correttamente!');
      console.log('   Puoi testare con: node test-servizio-analisi-diretta.js');
    } else {
      console.log('\n⚠️ Completa la configurazione seguendo i passi sopra');
    }
  } catch (error) {
    console.error('\n❌ Errore durante la configurazione:', error.message);
    console.error(error.stack);
  }
}

module.exports = { configuraGroq };
