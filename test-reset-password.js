#!/usr/bin/env node

/**
 * TEST SISTEMA RESET PASSWORD
 * Testa gli endpoint di reset password
 */

const API_BASE = 'http://localhost:3001';

async function testResetPassword() {
  console.log('🧪 TEST SISTEMA RESET PASSWORD');
  console.log('================================');
  
  const testEmail = 'nicolasmicheletti90@gmail.com';
  
  try {
    // 1. Test richiesta reset password
    console.log('\n📧 1. Test richiesta reset password...');
    const resetResponse = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });
    
    const resetData = await resetResponse.json();
    console.log('Status:', resetResponse.status);
    console.log('Response:', resetData);
    
    if (resetResponse.ok && (resetData.token || resetData.resetToken)) {
      const token = resetData.token || resetData.resetToken;
      console.log('✅ Reset token generato:', token);
      
      // 2. Test reset password con token
      console.log('\n🔐 2. Test reset password con token...');
      const newPassword = 'nuovaPassword123';
      
      const confirmResponse = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: token,
          newPassword 
        }),
      });
      
      const confirmData = await confirmResponse.json();
      console.log('Status:', confirmResponse.status);
      console.log('Response:', confirmData);
      
      if (confirmResponse.ok) {
        console.log('✅ Password reimpostata con successo!');
        
        // 3. Test login con nuova password
        console.log('\n🔑 3. Test login con nuova password...');
        const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: testEmail,
            password: newPassword 
          }),
        });
        
        const loginData = await loginResponse.json();
        console.log('Status:', loginResponse.status);
        console.log('Login success:', loginResponse.ok);
        
        if (loginResponse.ok) {
          console.log('✅ Login con nuova password riuscito!');
        } else {
          console.log('❌ Login con nuova password fallito:', loginData.error);
        }
      } else {
        console.log('❌ Reset password fallito:', confirmData.error);
      }
    } else {
      console.log('❌ Richiesta reset fallita:', resetData.error);
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

// Esegui test
testResetPassword();
