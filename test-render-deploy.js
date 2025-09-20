/**
 * Script per testare il deploy su Render
 * Verifica che tutte le funzionalità siano accessibili in produzione
 */

const axios = require('axios');

// Configurazione per il test su Render
const RENDER_URL = 'https://demos-app.onrender.com'; // Sostituisci con il tuo URL Render
const API_BASE = `${RENDER_URL}/api`;

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function testRenderEndpoint(method, endpoint, data = null, expectedStatus = 200) {
  try {
    console.log(`🌐 Testing ${method.toUpperCase()} ${endpoint} on Render...`);
    
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DemosApp-Test-Script/1.0'
      },
      timeout: 10000 // 10 secondi timeout
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      console.log(`✅ ${method.toUpperCase()} ${endpoint} - PASSED (${response.status})`);
      testResults.passed++;
      return response.data;
    } else {
      console.log(`❌ ${method.toUpperCase()} ${endpoint} - FAILED (Status: ${response.status})`);
      testResults.failed++;
      testResults.errors.push(`${method.toUpperCase()} ${endpoint}: Expected ${expectedStatus}, got ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`❌ ${method.toUpperCase()} ${endpoint} - CONNECTION REFUSED`);
      testResults.errors.push(`${method.toUpperCase()} ${endpoint}: Connection refused - Server might be down`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`❌ ${method.toUpperCase()} ${endpoint} - TIMEOUT`);
      testResults.errors.push(`${method.toUpperCase()} ${endpoint}: Request timeout`);
    } else {
      console.log(`❌ ${method.toUpperCase()} ${endpoint} - ERROR: ${error.message}`);
      testResults.errors.push(`${method.toUpperCase()} ${endpoint}: ${error.message}`);
    }
    testResults.failed++;
  }
}

async function testRenderDeploy() {
  console.log('🚀 Test Deploy su Render...\n');
  console.log(`🌐 URL Base: ${RENDER_URL}`);
  console.log(`🔗 API Base: ${API_BASE}\n`);
  
  // Test 1: Health Check
  console.log('📋 1. TEST HEALTH CHECK');
  await testRenderEndpoint('GET', '/candidati/health');
  
  // Test 2: Frontend Pages
  console.log('\n📋 2. TEST FRONTEND PAGES');
  await testRenderEndpoint('GET', '/privacy-policy');
  await testRenderEndpoint('GET', '/terms-of-service');
  await testRenderEndpoint('GET', '/cookie-policy');
  await testRenderEndpoint('GET', '/security-measures');
  
  // Test 3: GDPR Rights (senza autenticazione)
  console.log('\n📋 3. TEST GDPR RIGHTS (Public)');
  await testRenderEndpoint('GET', '/gdpr-rights');
  
  // Test 4: Data Retention (senza autenticazione)
  console.log('\n📋 4. TEST DATA RETENTION (Public)');
  await testRenderEndpoint('GET', '/data-retention');
  
  // Test 5: API Endpoints (potrebbero richiedere autenticazione)
  console.log('\n📋 5. TEST API ENDPOINTS');
  await testRenderEndpoint('GET', '/admin/audit-dashboard/stats');
  await testRenderEndpoint('GET', '/admin/data-retention/policies');
  
  // Test 6: CORS Headers
  console.log('\n📋 6. TEST CORS HEADERS');
  try {
    const response = await axios.options(`${API_BASE}/candidati/health`, {
      headers: {
        'Origin': 'https://demos.community',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    if (response.headers['access-control-allow-origin']) {
      console.log('✅ CORS Headers - PASSED');
      testResults.passed++;
    } else {
      console.log('❌ CORS Headers - FAILED (No CORS headers)');
      testResults.failed++;
    }
  } catch (error) {
    console.log('❌ CORS Headers - ERROR:', error.message);
    testResults.failed++;
  }
  
  // Test 7: Response Time
  console.log('\n📋 7. TEST RESPONSE TIME');
  const startTime = Date.now();
  await testRenderEndpoint('GET', '/candidati/health');
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  if (responseTime < 2000) {
    console.log(`✅ Response Time - PASSED (${responseTime}ms)`);
    testResults.passed++;
  } else {
    console.log(`❌ Response Time - FAILED (${responseTime}ms - Too slow)`);
    testResults.failed++;
  }
  
  // Risultati finali
  console.log('\n📊 RISULTATI FINALI:');
  console.log(`✅ Test Passati: ${testResults.passed}`);
  console.log(`❌ Test Falliti: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORI DETTAGLIATI:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 TUTTI I TEST SONO PASSATI! Il deploy su Render è funzionante.');
  } else {
    console.log('\n⚠️ ALCUNI TEST SONO FALLITI. Controlla gli errori sopra.');
  }
  
  // Raccomandazioni
  console.log('\n💡 RACCOMANDAZIONI:');
  console.log('1. Verifica che il server sia in esecuzione su Render');
  console.log('2. Controlla i log di Render per errori');
  console.log('3. Verifica che le variabili d\'ambiente siano configurate');
  console.log('4. Testa manualmente le pagine nel browser');
  console.log('5. Verifica che il database sia accessibile');
}

// Esegui i test
testRenderDeploy().catch(console.error);
