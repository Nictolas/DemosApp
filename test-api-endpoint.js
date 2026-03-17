const fetch = require('node-fetch');

async function testApiEndpoint() {
  try {
    console.log('🔍 Test endpoint API programma...');
    
    const utenteId = 'c4c4e79c-6b4f-49f4-b3b8-4bc555b275d7';
    const apiUrl = `https://www.demos.community/api/programma/${utenteId}`;
    
    console.log(`📡 Chiamata API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📊 OK: ${response.ok}`);
    console.log(`📊 Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Risposta API:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Errore API:');
      console.log(errorText);
    }
    
  } catch (error) {
    console.error('❌ Errore nella chiamata API:', error);
  }
}

testApiEndpoint();
