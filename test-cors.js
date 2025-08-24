#!/usr/bin/env node

/**
 * TEST CONFIGURAZIONE CORS E NODEMAILER
 * Testa la configurazione CORS dell'API e verifica Nodemailer
 */

const API_BASE = process.env.API_BASE || 'https://demos-c7k0.onrender.com';

async function testCORSAndNodemailer() {
  console.log('🧪 TEST CONFIGURAZIONE CORS E NODEMAILER');
  console.log('==========================================');
  console.log(`API Base: ${API_BASE}`);
  
  try {
    // 1. Test endpoint GET
    console.log('\n📡 1. Test endpoint GET /api/test-cors...');
    const getResponse = await fetch(`${API_BASE}/api/test-cors`, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.demos.community',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', getResponse.status);
    console.log('CORS Headers:');
    console.log('  Access-Control-Allow-Origin:', getResponse.headers.get('Access-Control-Allow-Origin'));
    console.log('  Access-Control-Allow-Methods:', getResponse.headers.get('Access-Control-Allow-Methods'));
    console.log('  Access-Control-Allow-Headers:', getResponse.headers.get('Access-Control-Allow-Headers'));
    
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ GET test riuscito:', getData.message);
    } else {
      console.log('❌ GET test fallito');
    }
    
    // 2. Test endpoint POST
    console.log('\n📡 2. Test endpoint POST /api/test-cors...');
    const postResponse = await fetch(`${API_BASE}/api/test-cors`, {
      method: 'POST',
      headers: {
        'Origin': 'https://www.demos.community',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data', timestamp: new Date().toISOString() })
    });
    
    console.log('Status:', postResponse.status);
    console.log('CORS Headers:');
    console.log('  Access-Control-Allow-Origin:', postResponse.headers.get('Access-Control-Allow-Origin'));
    console.log('  Access-Control-Allow-Methods:', postResponse.headers.get('Access-Control-Allow-Methods'));
    console.log('  Access-Control-Allow-Headers:', postResponse.headers.get('Access-Control-Allow-Headers'));
    
    if (postResponse.ok) {
      const postData = await postResponse.json();
      console.log('✅ POST test riuscito:', postData.message);
    } else {
      console.log('❌ POST test fallito');
    }
    
    // 3. Test Nodemailer
    console.log('\n📡 3. Test Nodemailer /api/test-nodemailer...');
    const nodemailerResponse = await fetch(`${API_BASE}/api/test-nodemailer`, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.demos.community',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', nodemailerResponse.status);
    
    if (nodemailerResponse.ok) {
      const nodemailerData = await nodemailerResponse.json();
      console.log('✅ Nodemailer test riuscito:', nodemailerData.message);
      console.log('📧 Status Nodemailer:', nodemailerData.nodemailer);
      console.log('🌍 Environment:', nodemailerData.environment);
      
      if (!nodemailerData.nodemailer.available) {
        console.log('⚠️ ATTENZIONE: Nodemailer non è disponibile!');
      } else if (typeof nodemailerData.nodemailer.createTransporter !== 'function') {
        console.log('⚠️ ATTENZIONE: createTransporter non è una funzione!');
      } else {
        console.log('✅ Nodemailer è configurato correttamente');
      }
    } else {
      console.log('❌ Nodemailer test fallito');
    }
    
    // 4. Test endpoint forgot-password
    console.log('\n📡 4. Test endpoint POST /api/auth/forgot-password...');
    const forgotResponse = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Origin': 'https://www.demos.community',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    console.log('Status:', forgotResponse.status);
    console.log('CORS Headers:');
    console.log('  Access-Control-Allow-Origin:', forgotResponse.headers.get('Access-Control-Allow-Origin'));
    console.log('  Access-Control-Allow-Methods:', forgotResponse.headers.get('Access-Control-Allow-Methods'));
    
    if (forgotResponse.ok) {
      const forgotData = await forgotResponse.json();
      console.log('✅ Forgot password test riuscito:', forgotData.message);
      
      if (forgotData.resetToken) {
        console.log('🔑 Token ricevuto (modalità fallback):', forgotData.resetToken.substring(0, 20) + '...');
        console.log('🔗 Reset URL:', forgotData.resetUrl);
      }
    } else {
      const forgotData = await forgotResponse.json();
      console.log('❌ Forgot password test fallito:', forgotData.error);
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

testCORSAndNodemailer();
