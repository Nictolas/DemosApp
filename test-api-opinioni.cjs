const fetch = require('node-fetch');

async function testApiOpinioni() {
  console.log('🧪 Test diretto endpoint API opinioni...');
  
  try {
    // Test senza autenticazione prima
    console.log('\n1️⃣ Test endpoint senza autenticazione:');
    const testUrl = 'https://demos-c7k0.onrender.com/api/opinioni/candidati';
    
    try {
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.text();
      console.log(`✅ Status: ${testResponse.status}`);
      console.log(`📋 Response: ${testData}`);
    } catch (error) {
      console.error('❌ Errore test endpoint:', error.message);
    }
    
    // Test endpoint opinioni-list con grado Nazionale
    console.log('\n2️⃣ Test endpoint opinioni-list con grado Nazionale:');
    const opinioniUrl = 'https://demos-c7k0.onrender.com/api/opinioni-list?grado=Nazionale';
    
    try {
      const opinioniResponse = await fetch(opinioniUrl);
      const opinioniData = await opinioniResponse.text();
      console.log(`✅ Status: ${opinioniResponse.status}`);
      console.log(`📋 Response: ${opinioniData}`);
      
      if (opinioniResponse.status === 500) {
        console.log('❌ Errore 500 - Il problema è nel backend');
      }
    } catch (error) {
      console.error('❌ Errore opinioni-list:', error.message);
    }
    
    // Test endpoint opinioni-list con grado Comunale
    console.log('\n3️⃣ Test endpoint opinioni-list con grado Comunale:');
    const comunaliUrl = 'https://demos-c7k0.onrender.com/api/opinioni-list?grado=Comunale';
    
    try {
      const comunaliResponse = await fetch(comunaliUrl);
      const comunaliData = await comunaliResponse.text();
      console.log(`✅ Status: ${comunaliResponse.status}`);
      console.log(`📋 Response: ${comunaliData}`);
      
      if (comunaliResponse.status === 500) {
        console.log('❌ Errore 500 - Il problema è nel backend');
      }
    } catch (error) {
      console.error('❌ Errore opinioni comunali:', error.message);
    }
    
    // Test endpoint opinioni-list con grado Regionale
    console.log('\n4️⃣ Test endpoint opinioni-list con grado Regionale:');
    const regionaliUrl = 'https://demos-c7k0.onrender.com/api/opinioni-list?grado=Regionale';
    
    try {
      const regionaliResponse = await fetch(regionaliUrl);
      const regionaliData = await regionaliResponse.text();
      console.log(`✅ Status: ${regionaliResponse.status}`);
      console.log(`📋 Response: ${regionaliData}`);
      
      if (regionaliResponse.status === 500) {
        console.log('❌ Errore 500 - Il problema è nel backend');
      }
    } catch (error) {
      console.error('❌ Errore opinioni regionali:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

testApiOpinioni();
