const API_BASE = 'http://localhost:3001';

async function testSimpleReset() {
  try {
    console.log('🧪 Test semplice reset password');
    
    // 1. Richiesta reset password
    console.log('\n📧 1. Richiesta reset password...');
    const resetResponse = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    
    const resetData = await resetResponse.json();
    console.log('Status:', resetResponse.status);
    console.log('Response:', resetData);
    
    if (!resetResponse.ok) {
      console.log('❌ Richiesta reset fallita');
      return;
    }
    
    // 2. Reset password con token
    if (resetData.resetToken) {
      console.log('\n🔐 2. Reset password con token...');
      const newPassword = 'nuovaPassword123';
      
      const confirmResponse = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: resetData.resetToken,
          newPassword 
        }),
      });
      
      const confirmData = await confirmResponse.json();
      console.log('Status:', confirmResponse.status);
      console.log('Response:', confirmData);
      
      if (confirmResponse.ok) {
        console.log('✅ Password reimpostata con successo!');
      } else {
        console.log('❌ Reset password fallito:', confirmData.error);
      }
    } else {
      console.log('⚠️ Nessun token ricevuto (modalità produzione)');
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

testSimpleReset();
