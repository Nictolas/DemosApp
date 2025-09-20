#!/usr/bin/env node

/**
 * TEST CONFIGURAZIONE RESEND
 * Testa la configurazione Resend per l'invio email
 */

const API_BASE = process.env.API_BASE || 'https://demos-c7k0.onrender.com';

async function testResendSetup() {
  console.log('🧪 TEST CONFIGURAZIONE RESEND');
  console.log('==============================');
  console.log(`API Base: ${API_BASE}`);
  
  try {
    // 1. Test endpoint candidati-resend
    console.log('\n📡 1. Test endpoint /api/candidati-resend...');
    const resendResponse = await fetch(`${API_BASE}/api/candidati-resend`, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.demos.community'
      }
    });
    
    console.log('   Status:', resendResponse.status);
    console.log('   CORS Origin:', resendResponse.headers.get('Access-Control-Allow-Origin'));
    
    if (resendResponse.ok) {
      const resendData = await resendResponse.json();
      console.log('   ✅ Resend test riuscito:', resendData.message);
      console.log('   📧 Status Resend:', resendData.resend);
      console.log('   🌍 Environment:', resendData.environment);
      
      if (!resendData.resend.available) {
        console.log('   ⚠️ ATTENZIONE: Resend non è disponibile!');
      } else if (typeof resendData.resend.emails?.send !== 'function') {
        console.log('   ⚠️ ATTENZIONE: resend.emails.send non è una funzione!');
      } else {
        console.log('   ✅ Resend è configurato correttamente');
      }
    } else {
      console.log('   ❌ Resend test fallito');
    }
    
    // 2. Test endpoint forgot-password
    console.log('\n📡 2. Test endpoint POST /api/auth/forgot-password...');
    const forgotResponse = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Origin': 'https://www.demos.community',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    console.log('   Status:', forgotResponse.status);
    console.log('   CORS Origin:', forgotResponse.headers.get('Access-Control-Allow-Origin'));
    
    if (forgotResponse.ok) {
      const forgotData = await forgotResponse.json();
      console.log('   ✅ Forgot password test riuscito:', forgotData.message);
      
      if (forgotData.resetToken) {
        console.log('   🔑 Token ricevuto (modalità fallback):', forgotData.resetToken.substring(0, 20) + '...');
        console.log('   🔗 Reset URL:', forgotData.resetUrl);
      }
    } else {
      try {
        const forgotData = await forgotResponse.json();
        console.log('   ❌ Forgot password test fallito:', forgotData.error);
      } catch (parseError) {
        console.log('   ❌ Forgot password test fallito:', forgotResponse.statusText);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SUGGERIMENTO: Verifica che il server API sia in esecuzione');
    } else if (error.message.includes('CORS')) {
      console.log('\n💡 SUGGERIMENTO: Problema di configurazione CORS');
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

testResendSetup();
