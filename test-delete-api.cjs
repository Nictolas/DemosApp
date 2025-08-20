const fetch = require('node-fetch');

async function testDeleteAPI() {
  try {
    console.log('🧪 Test endpoint DELETE /api/utenti/:id...');
    
    // 1. Login per ottenere token
    console.log('🔐 Login...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admino@admin.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login fallito:', loginResponse.status);
      return;
    }
    
    const { token } = await loginResponse.json();
    console.log('✅ Login riuscito');
    
    // 2. Ottieni lista utenti
    console.log('📋 Ottengo lista utenti...');
    const usersResponse = await fetch('http://localhost:3001/api/utenti', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!usersResponse.ok) {
      console.error('❌ Errore lista utenti:', usersResponse.status);
      return;
    }
    
    const users = await usersResponse.json();
    const userToDelete = users.data?.find(u => u.ruolo !== 'Admin') || users.find(u => u.ruolo !== 'Admin');
    
    if (!userToDelete) {
      console.error('❌ Nessun utente non-admin trovato');
      return;
    }
    
    console.log(`🎯 Utente da eliminare: ${userToDelete.email} (ID: ${userToDelete.id})`);
    
    // 3. Testa DELETE
    console.log('🗑️ Test DELETE...');
    const deleteResponse = await fetch(`http://localhost:3001/api/utenti/${userToDelete.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`📊 Risposta DELETE: ${deleteResponse.status}`);
    
    if (deleteResponse.ok) {
      const result = await deleteResponse.json();
      console.log('✅ Eliminazione riuscita:', result);
    } else {
      const error = await deleteResponse.text();
      console.error('❌ Errore eliminazione:', error);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

// Aspetta che il server si avvii
setTimeout(testDeleteAPI, 3000);
