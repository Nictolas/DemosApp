/**
 * Script di test completo per il deploy
 * Testa tutte le funzionalità implementate
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const ADMIN_TOKEN = 'your-admin-token-here'; // Sostituisci con un token admin valido

const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function testEndpoint(method, endpoint, data = null, expectedStatus = 200) {
  try {
    console.log(`🧪 Testing ${method.toUpperCase()} ${endpoint}...`);
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      console.log(`✅ ${method.toUpperCase()} ${endpoint} - PASSED`);
      testResults.passed++;
      return response.data;
    } else {
      console.log(`❌ ${method.toUpperCase()} ${endpoint} - FAILED (Status: ${response.status})`);
      testResults.failed++;
      testResults.errors.push(`${method.toUpperCase()} ${endpoint}: Expected ${expectedStatus}, got ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ ${method.toUpperCase()} ${endpoint} - ERROR: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`${method.toUpperCase()} ${endpoint}: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Avvio test completo del deploy...\n');
  
  // Test 1: Health Check
  console.log('📋 1. TEST HEALTH CHECK');
  await testEndpoint('GET', '/candidati/health');
  
  // Test 2: Audit Logging
  console.log('\n📋 2. TEST AUDIT LOGGING');
  await testEndpoint('GET', '/admin/audit-dashboard/stats');
  await testEndpoint('GET', '/admin/audit-dashboard/logs');
  await testEndpoint('GET', '/admin/audit-dashboard/suspicious');
  
  // Test 3: Data Retention
  console.log('\n📋 3. TEST DATA RETENTION');
  await testEndpoint('GET', '/admin/data-retention/policies');
  await testEndpoint('GET', '/admin/data-retention/stats');
  await testEndpoint('GET', '/admin/data-retention/job/status');
  
  // Test 4: GDPR Rights
  console.log('\n📋 4. TEST GDPR RIGHTS');
  await testEndpoint('GET', '/user/rights-requests');
  
  // Test 5: Data Retention Job Management
  console.log('\n📋 5. TEST JOB MANAGEMENT');
  await testEndpoint('POST', '/admin/data-retention/job/start');
  await testEndpoint('GET', '/admin/data-retention/job/status');
  await testEndpoint('POST', '/admin/data-retention/job/stop');
  
  // Test 6: Data Cleanup
  console.log('\n📋 6. TEST DATA CLEANUP');
  await testEndpoint('POST', '/admin/data-retention/cleanup/immediate');
  
  // Test 7: Notifications
  console.log('\n📋 7. TEST NOTIFICATIONS');
  await testEndpoint('GET', '/admin/data-retention/notifications');
  
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
    console.log('\n🎉 TUTTI I TEST SONO PASSATI! Il deploy è pronto.');
  } else {
    console.log('\n⚠️ ALCUNI TEST SONO FALLITI. Controlla gli errori sopra.');
  }
}

// Esegui i test
runTests().catch(console.error);
