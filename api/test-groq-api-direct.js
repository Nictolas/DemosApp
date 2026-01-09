require('dotenv').config();
const Groq = require('groq-sdk');

/**
 * Test diretto dell'API Groq per capire se funziona
 */
async function testGroqAPI() {
  console.log('='.repeat(60));
  console.log('TEST DIRETTO API GROQ');
  console.log('='.repeat(60));
  
  const apiKey = process.env.GROQ_API_KEY || '[REDACTED_GROQ_API_KEY]';
  
  console.log(`\n[1] Verifica chiave API`);
  console.log(`   Chiave presente: ${!!apiKey}`);
  console.log(`   Primi 10 caratteri: ${apiKey ? apiKey.substring(0, 10) : 'N/A'}...`);
  console.log(`   Ultimi 4 caratteri: ${apiKey ? '...' + apiKey.substring(apiKey.length - 4) : 'N/A'}`);
  console.log(`   Lunghezza: ${apiKey ? apiKey.length : 0} caratteri`);
  
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    console.error('\n❌ ERRORE: Chiave API non valida!');
    console.error('   La chiave deve iniziare con "gsk_"');
    process.exit(1);
  }
  
  console.log(`\n[2] Inizializzazione client Groq`);
  let client;
  try {
    client = new Groq({
      apiKey: apiKey
    });
    console.log('   ✅ Client Groq creato con successo');
  } catch (error) {
    console.error(`   ❌ Errore creazione client: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`\n[3] Test chiamata API Groq`);
  console.log('   Invio richiesta a Groq API...');
  
  try {
    const testPrompt = 'Dimmi solo "OK" se funziona';
    
    // Prova modelli disponibili (in ordine di preferenza)
    const modelsToTry = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'llama-3.1-70b-versatile' // fallback (deprecato ma proviamo)
    ];
    
    let response;
    let lastError;
    
    for (const model of modelsToTry) {
      try {
        console.log(`   Tentativo con modello: ${model}`);
        response = await client.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'user',
              content: testPrompt
            }
          ],
          max_tokens: 50,
          temperature: 0.7
        });
        console.log(`   ✅ Modello ${model} funziona!`);
        break;
      } catch (error) {
        console.log(`   ❌ Modello ${model} non disponibile: ${error.message.split('\n')[0]}`);
        lastError = error;
        continue;
      }
    }
    
    if (!response) {
      throw lastError || new Error('Nessun modello disponibile');
    }
    
    const result = response.choices[0]?.message?.content?.trim();
    console.log(`   ✅ Risposta ricevuta: "${result}"`);
    console.log(`   ✅ Token usati: ${response.usage?.total_tokens || 'N/A'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ API GROQ FUNZIONA CORRETTAMENTE!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error(`\n❌ ERRORE nella chiamata API:`);
    console.error(`   Tipo: ${error.constructor.name}`);
    console.error(`   Messaggio: ${error.message}`);
    
    if (error.status) {
      console.error(`   Status HTTP: ${error.status}`);
    }
    
    if (error.response) {
      console.error(`   Response:`, JSON.stringify(error.response, null, 2));
    }
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n⚠️  PROBLEMA: Chiave API non valida o scaduta');
      console.error('   Verifica la chiave su https://console.groq.com/keys');
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.error('\n⚠️  PROBLEMA: Rate limit raggiunto');
      console.error('   Aspetta qualche minuto e riprova');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  PROBLEMA: Impossibile connettersi a Groq API');
      console.error('   Verifica la connessione internet');
    } else {
      console.error('\n⚠️  PROBLEMA: Errore sconosciuto');
      console.error('   Stack:', error.stack);
    }
    
    process.exit(1);
  }
}

// Esegui il test
testGroqAPI().catch(console.error);
