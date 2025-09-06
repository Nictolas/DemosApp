const fetch = require('node-fetch');

async function testIniziativePopolari() {
  try {
    console.log('🔍 Test endpoint /api/iniziative-popolari...');
    
    const response = await fetch('https://demos-c7k0.onrender.com/api/iniziative-popolari');
    console.log('📊 Status:', response.status);
    console.log('📊 Headers:', response.headers.raw());
    
    const data = await response.text();
    console.log('📊 Response:', data);
    
    if (response.ok) {
      const jsonData = JSON.parse(data);
      console.log('✅ Successo! Dati ricevuti:', jsonData);
    } else {
      console.log('❌ Errore nella risposta');
    }
  } catch (error) {
    console.error('❌ Errore nella chiamata:', error.message);
  }
}

testIniziativePopolari();
