require('dotenv').config();

console.log('='.repeat(60));
console.log('TEST CONFIGURAZIONE GROQ');
console.log('='.repeat(60));

console.log('\n[1] Verifica variabili d\'ambiente:');
console.log(`   GROQ_API_KEY presente: ${!!process.env.GROQ_API_KEY}`);
console.log(`   GROQ_API_KEY valore: ${process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 10) + '...' : 'NON TROVATA'}`);
console.log(`   OPENAI_API_KEY presente: ${!!process.env.OPENAI_API_KEY}`);

if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
  console.log('\n❌ ERRORE: Nessuna API key configurata!');
  console.log('   Verifica che la variabile sia presente nel file .env o nelle variabili d\'ambiente');
  process.exit(1);
}

console.log('\n[2] Test inizializzazione Groq SDK:');
try {
  const Groq = require('groq-sdk');
  
  if (process.env.GROQ_API_KEY) {
    const groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log('   ✅ Groq client creato con successo');
    
    // Test chiamata API (semplice)
    console.log('\n[3] Test chiamata API Groq:');
    groqClient.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'user',
          content: 'Dimmi solo "OK" se funziona'
        }
      ],
      max_tokens: 10
    }).then(response => {
      const result = response.choices[0]?.message?.content?.trim();
      console.log(`   ✅ Risposta API: "${result}"`);
      console.log('\n' + '='.repeat(60));
      console.log('✅ GROQ CONFIGURATO CORRETTAMENTE!');
      console.log('='.repeat(60));
      process.exit(0);
    }).catch(error => {
      console.error(`   ❌ Errore chiamata API: ${error.message}`);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error('   ⚠️  La chiave API non è valida o è scaduta');
      } else if (error.message.includes('429')) {
        console.error('   ⚠️  Rate limit raggiunto, aspetta qualche minuto');
      } else {
        console.error('   ⚠️  Errore sconosciuto:', error);
      }
      process.exit(1);
    });
  } else {
    console.log('   ⚠️  GROQ_API_KEY non configurata, test saltato');
    process.exit(1);
  }
} catch (error) {
  console.error('   ❌ Errore inizializzazione:', error.message);
  console.error('   Verifica che groq-sdk sia installato: npm install groq-sdk');
  process.exit(1);
}
