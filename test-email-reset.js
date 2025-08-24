#!/usr/bin/env node

/**
 * TEST ENDPOINT RESET PASSWORD
 * Testa l'endpoint /api/auth/forgot-password per verificare l'invio email
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function testEmailReset() {
  console.log('🧪 TEST ENDPOINT RESET PASSWORD');
  console.log('================================');
  console.log(`API Base: ${API_BASE}`);
  
  const testEmail = 'nicolasmicheletti90@gmail.com';
  
  try {
    // 1. Test richiesta reset password
    console.log('\n📧 1. Test richiesta reset password...');
    console.log(`Endpoint: ${API_BASE}/api/auth/forgot-password`);
    console.log(`Email: ${testEmail}`);
    
    const resetResponse = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    
    console.log('Status:', resetResponse.status);
    console.log('Headers:', Object.fromEntries(resetResponse.headers.entries()));
    
    const resetData = await resetResponse.json();
    console.log('Response:', JSON.stringify(resetData, null, 2));
    
    if (resetResponse.ok) {
      console.log('✅ Richiesta reset password riuscita!');
      console.log('📧 Messaggio:', resetData.message);
      
      if (resetData.resetToken) {
        console.log('🔑 Token ricevuto (modalità sviluppo):', resetData.resetToken.substring(0, 20) + '...');
      }
    } else {
      console.log('❌ Richiesta reset password fallita:', resetData.error);
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SUGGERIMENTO: Verifica che il server API sia in esecuzione');
      console.log('   Esegui: cd api && npm run dev');
    }
  }
}

// Gestione errori non catturati
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

testEmailReset();
