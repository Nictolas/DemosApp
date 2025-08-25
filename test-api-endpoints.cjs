const fetch = require('node-fetch');

async function testAPIEndpoints() {
  const baseURL = 'https://demos-c7k0.onrender.com';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZTUxZWM1Mi1jNjU2LTRmNGItYTk0MC00MjVhY2I4NzNiMGIiLCJlbWFpbCI6Im5pY29sYXNtaWNoZWxldHRpOTBAZ21haWwuY29tIiwicm9sZSI6IkFkbWluIiwiaWF0IjoxNzU2MTExNzIyLCJleHAiOjE3NTYxOTgxMjJ9.FP90MgXkMrlW-9TD88uhg8gpJkvE6R8Wr6_fESXImoA';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('🔍 Testando API endpoints...\n');

    // Test endpoint genere
    console.log('📊 Testando /api/opinioni/stats/caccia/genere');
    const genereResponse = await fetch(`${baseURL}/api/opinioni/stats/caccia/genere`, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('Status:', genereResponse.status);
    console.log('Headers:', Object.fromEntries(genereResponse.headers.entries()));
    
    if (genereResponse.ok) {
      const genereData = await genereResponse.json();
      console.log('Genere Data:', JSON.stringify(genereData, null, 2));
    } else {
      console.log('Errore genere:', await genereResponse.text());
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test endpoint età
    console.log('📊 Testando /api/opinioni/stats/caccia/eta');
    const etaResponse = await fetch(`${baseURL}/api/opinioni/stats/caccia/eta`, {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('Status:', etaResponse.status);
    console.log('Headers:', Object.fromEntries(etaResponse.headers.entries()));
    
    if (etaResponse.ok) {
      const etaData = await etaResponse.json();
      console.log('Età Data:', JSON.stringify(etaData, null, 2));
    } else {
      console.log('Errore età:', await etaResponse.text());
    }

  } catch (error) {
    console.error('❌ Errore nel test:', error);
  }
}

testAPIEndpoints();
