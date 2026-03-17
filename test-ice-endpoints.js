const API_BASE = 'http://localhost:3001';

async function testICEEndpoints() {
  try {
    console.log('🧪 TEST ENDPOINTS ICE');
    console.log('========================');
    
    // 1. Test endpoint GET /api/ice (pubblico)
    console.log('\n📋 1. Test endpoint pubblico ICE...');
    const iceResponse = await fetch(`${API_BASE}/api/ice`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const iceData = await iceResponse.json();
    console.log('Status:', iceResponse.status);
    console.log('Success:', iceData.success);
    console.log('Numero richieste:', iceData.richieste?.length || 0);
    
    if (iceResponse.ok && iceData.success) {
      console.log('✅ Endpoint ICE pubblico funziona correttamente');
      
      // Mostra la prima richiesta ICE
      if (iceData.richieste && iceData.richieste.length > 0) {
        const firstICE = iceData.richieste[0];
        console.log('📋 Prima richiesta ICE:', {
          id: firstICE.id,
          nome: firstICE.nome,
          descrizione: firstICE.descrizione?.substring(0, 50) + '...',
          status: firstICE.status,
          sitoweb: firstICE.sitoweb
        });
      }
    } else {
      console.log('❌ Endpoint ICE pubblico fallito:', iceData.error);
    }
    
    // 2. Test endpoint per gestione (richiede autenticazione)
    console.log('\n🔐 2. Test endpoint gestione ICE (richiede auth)...');
    const richiesteResponse = await fetch(`${API_BASE}/api/ice/richieste`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      }
    });
    
    console.log('Status:', richiesteResponse.status);
    if (richiesteResponse.status === 401) {
      console.log('✅ Endpoint gestione ICE correttamente protetto (richiede autenticazione)');
    } else {
      console.log('⚠️ Endpoint gestione ICE non protetto come previsto');
    }
    
    // 3. Test endpoint creazione (richiede autenticazione)
    console.log('\n📝 3. Test endpoint creazione ICE (richiede auth)...');
    const createResponse = await fetch(`${API_BASE}/api/ice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
      body: JSON.stringify({
        titolo: 'Test ICE',
        descrizione: 'Descrizione test',
        tipo: 'test'
      })
    });
    
    console.log('Status:', createResponse.status);
    if (createResponse.status === 401) {
      console.log('✅ Endpoint creazione ICE correttamente protetto (richiede autenticazione)');
    } else {
      console.log('⚠️ Endpoint creazione ICE non protetto come previsto');
    }
    
    console.log('\n✅ Test completati!');
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

testICEEndpoints();
