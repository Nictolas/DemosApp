// Verifica configurazione Groq
require('dotenv').config();

console.log('🔍 VERIFICA CONFIGURAZIONE GROQ');
console.log('='.repeat(60));

const groqKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (groqKey) {
  if (groqKey === 'gsk_...' || groqKey.includes('...')) {
    console.log('⚠️ GROQ_API_KEY presente ma non configurata (placeholder)');
    console.log('   Sostituisci "gsk_..." con la tua chiave API reale');
    console.log('   Ottieni la chiave su: https://console.groq.com/keys');
  } else if (groqKey.startsWith('gsk_')) {
    console.log('✅ GROQ_API_KEY configurata');
    console.log(`   Chiave: ${groqKey.substring(0, 10)}...${groqKey.substring(groqKey.length - 4)}`);
    console.log(`   Lunghezza: ${groqKey.length} caratteri`);
    console.log(`   Modello: ${groqModel}`);
    console.log('\n🧪 Test connessione Groq...');
    
    // Test connessione
    (async () => {
      try {
        const Groq = require('groq-sdk');
        const client = new Groq({ apiKey: groqKey });
        
        const response = await client.chat.completions.create({
          model: groqModel,
          messages: [{ role: 'user', content: 'Dimmi solo "OK"' }],
          max_tokens: 10
        });
        
        console.log('✅ Connessione Groq funziona!');
        console.log(`   Risposta: ${response.choices[0]?.message?.content}`);
        console.log('\n✅ Groq è configurato e funzionante!');
        console.log('   Puoi ora generare analisi delle leggi');
      } catch (error) {
        console.log('❌ Errore connessione Groq:');
        console.log(`   ${error.message}`);
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.log('   ⚠️ Chiave API non valida o scaduta');
          console.log('   Verifica la chiave su: https://console.groq.com/keys');
        }
      }
    })();
  } else {
    console.log('❌ GROQ_API_KEY presente ma formato non valido');
    console.log('   La chiave deve iniziare con "gsk_"');
  }
} else {
  console.log('❌ GROQ_API_KEY non configurata');
  console.log('   Esegui: node configura-groq.js');
}
