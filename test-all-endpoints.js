#!/usr/bin/env node

/**
 * TEST COMPLETO ENDPOINT API
 * Testa tutti gli endpoint per verificare che l'API funzioni
 */

const API_BASE = process.env.API_BASE || 'https://demos-c7k0.onrender.com';

async function testAllEndpoints() {
  console.log('🧪 TEST COMPLETO ENDPOINT API');
  console.log('================================');
  console.log(`API Base: ${API_BASE}`);
  
  const endpoints = [
    { path: '/', method: 'GET', description: 'Root endpoint' },
    { path: '/api/health', method: 'GET', description: 'Health check' },
    { path: '/api/test-cors', method: 'GET', description: 'Test CORS GET' },
    { path: '/api/test-cors', method: 'POST', description: 'Test CORS POST', body: { test: 'data' } },
    { path: '/api/candidati-resend', method: 'GET', description: 'Test Resend' },
    { path: '/api/auth/forgot-password', method: 'POST', description: 'Forgot password', body: { email: 'test@example.com' } }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n📡 Test: ${endpoint.description}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Origin': 'https://www.demos.community',
          'Content-Type': 'application/json'
        }
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await fetch(`${API_BASE}${endpoint.path}`, options);
      
      console.log(`   Status: ${response.status}`);
      console.log(`   CORS Origin: ${response.headers.get('Access-Control-Allow-Origin')}`);
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log(`   ✅ Success: ${data.message || data.success}`);
          
                     if (endpoint.path === '/api/auth/forgot-password' && data.resetToken) {
             console.log(`   🔑 Token ricevuto: ${data.resetToken.substring(0, 20)}...`);
             console.log(`   🔗 Reset URL: ${data.resetUrl}`);
           }
           
           if (endpoint.path === '/api/candidati-resend') {
             console.log(`   📧 Resend configurato: ${data.resend?.available ? 'Sì' : 'No'}`);
           }
        } catch (parseError) {
          console.log(`   ⚠️ Response non JSON: ${response.statusText}`);
        }
      } else {
        try {
          const errorData = await response.json();
          console.log(`   ❌ Error: ${errorData.error || errorData.message}`);
        } catch (parseError) {
          console.log(`   ❌ Error: ${response.statusText}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Test completato!');
}

// Gestione errori non catturati
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

testAllEndpoints();
