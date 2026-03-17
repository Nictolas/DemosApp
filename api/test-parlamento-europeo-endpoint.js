const axios = require('axios');

// Test dell'endpoint del Parlamento Europeo
async function testEndpoint() {
  try {
    console.log('🧪 Test endpoint Parlamento Europeo\n');
    
    // Simula una richiesta con token (in produzione serve un token valido)
    const token = process.env.TEST_TOKEN || 'test-token';
    
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    const url = `${baseUrl}/api/voti-parlamento-europeo/ultime?limit=5`;
    
    console.log(`📡 Chiamata a: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Dati ricevuti:`, JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testEndpoint();
