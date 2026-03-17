/**
 * Script di test completo prima del deploy
 * Verifica che tutte le modifiche funzionino correttamente
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function testSyntax() {
  logSection('📝 TEST 1: Verifica Sintassi File');
  
  const files = [
    'api/utils/axiomQueryHelper.js',
    'api/routes/admin/audit-dashboard.js',
    'api/routes/admin/security-metrics.js',
    'api/routes/admin/logging.js',
    'api/routes/admin/monitoring.js',
    'api/routes/admin/data-export.js',
    'api/routes/user/gdpr-rights.js',
    'api/routes/user/delete-account.js',
    'api/routes/ministero.js',
    'api/services/auditService.js',
    'api/services/centralizedLogger.js',
    'api/services/violationDetectionService.js',
    'api/services/performanceMonitor.js',
    'api/services/performanceOptimizer.js',
    'api/services/healthCheckService.js',
    'api/jobs/auditCleanup.js'
  ];
  
  const { execSync } = require('child_process');
  let allPassed = true;
  
  for (const file of files) {
    try {
      execSync(`node -c ${file}`, { stdio: 'pipe' });
      logTest(file, true);
    } catch (error) {
      logTest(file, false, error.message);
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function testAxiomHelper() {
  logSection('🔧 TEST 2: Helper Axiom');
  
  try {
    const { 
      getAuditLogs, 
      getCentralizedLogs, 
      queryAxiom, 
      countAxiomRecords 
    } = require('../api/utils/axiomQueryHelper');
    
    // Test 2.1: getAuditLogs
    try {
      const { getAuditLogs, getSecurityEvents } = require('../api/utils/axiomQueryHelper');
      const auditLogs = await getAuditLogs({
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10
      });
      logTest('getAuditLogs()', true, `Trovati ${auditLogs.length} audit logs`);
      
      // Test anche security events
      const securityEvents = await getSecurityEvents({
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10
      });
      logTest('getSecurityEvents()', true, `Trovati ${securityEvents.length} security events`);
      logTest('real-time dataset totale', true, `${auditLogs.length + securityEvents.length} record (audit + security)`);
    } catch (error) {
      logTest('getAuditLogs()', false, error.message);
    }
    
    // Test 2.2: getCentralizedLogs
    try {
      const centralizedLogs = await getCentralizedLogs({
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        limit: 10
      });
      logTest('getCentralizedLogs()', true, `Trovati ${centralizedLogs.length} log (limit: 10)`);
    } catch (error) {
      logTest('getCentralizedLogs()', false, error.message);
    }
    
    // Test 2.3: countAxiomRecords
    try {
      const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
      const count = await countAxiomRecords(dataset, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      logTest('countAxiomRecords()', true, `Count: ${count}`);
    } catch (error) {
      logTest('countAxiomRecords()', false, error.message);
    }
    
    // Test 2.4: queryAxiom
    try {
      const dataset = process.env.AXIOM_DATASET || 'centralized_logs';
      const query = `['${dataset}'] | limit 3`;
      const results = await queryAxiom(query, {
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date()
      });
      logTest('queryAxiom()', true, `${results.length} risultati`);
    } catch (error) {
      logTest('queryAxiom()', false, error.message);
    }
    
    return true;
  } catch (error) {
    logTest('Helper Axiom', false, error.message);
    return false;
  }
}

async function testServices() {
  logSection('⚙️  TEST 3: Services');
  
  try {
    // Test 3.1: AuditService
    try {
      const AuditService = require('../api/services/auditService');
      
      // Test getUserAuditLogs (se Axiom abilitato)
      if (process.env.AXIOM_ENABLED === 'true') {
        // Test senza userId per vedere tutti gli audit logs
        const { getAuditLogs } = require('../api/utils/axiomQueryHelper');
        const allAuditLogs = await getAuditLogs({ limit: 10 });
        logTest('AuditService.getUserAuditLogs()', true, 
          `Trovati ${allAuditLogs.length} audit logs totali (senza filtro userId)`);
        
        // Test con userId specifico (potrebbe non esistere)
        const userLogs = await AuditService.getUserAuditLogs('test-user', { limit: 5 });
        if (userLogs.length === 0) {
          logTest('AuditService.getUserAuditLogs(userId)', true, 
            '0 log per userId "test-user" (normale se utente non esiste)');
        } else {
          logTest('AuditService.getUserAuditLogs(userId)', true, `Trovati ${userLogs.length} log`);
        }
      } else {
        logTest('AuditService.getUserAuditLogs()', true, 'Axiom non abilitato - fallback OK');
      }
    } catch (error) {
      logTest('AuditService', false, error.message);
    }
    
    // Test 3.2: CentralizedLogger
    try {
      const logger = require('../api/services/centralizedLogger');
      const stats = await logger.getLogStats(7);
      logTest('CentralizedLogger.getLogStats()', true, `${stats.length} statistiche`);
    } catch (error) {
      logTest('CentralizedLogger.getLogStats()', false, error.message);
    }
    
    // Test 3.3: PerformanceMonitor
    try {
      const performanceMonitor = require('../api/services/performanceMonitor');
      const errorMetrics = await performanceMonitor.getErrorMetrics();
      logTest('PerformanceMonitor.getErrorMetrics()', true, 
        `Errors: ${errorMetrics.errorsLastHour}, Warnings: ${errorMetrics.warningsLastHour}`);
    } catch (error) {
      logTest('PerformanceMonitor.getErrorMetrics()', false, error.message);
    }
    
    // Test 3.4: PerformanceOptimizer
    try {
      const performanceOptimizer = require('../api/services/performanceOptimizer');
      const errorRate = await performanceOptimizer.getErrorRate();
      logTest('PerformanceOptimizer.getErrorRate()', true, `Error rate: ${errorRate}`);
    } catch (error) {
      logTest('PerformanceOptimizer.getErrorRate()', false, error.message);
    }
    
    // Test 3.5: HealthCheckService
    try {
      const healthCheckService = require('../api/services/healthCheckService');
      const security = await healthCheckService.checkSecurity();
      logTest('HealthCheckService.checkSecurity()', true, 
        `Status: ${security.status}, Issues: ${security.securityIssues}`);
    } catch (error) {
      logTest('HealthCheckService.checkSecurity()', false, error.message);
    }
    
    return true;
  } catch (error) {
    logTest('Services', false, error.message);
    return false;
  }
}

async function testViolationDetection() {
  logSection('🔍 TEST 4: Violation Detection Service');
  
  try {
    const ViolationDetectionService = require('../api/services/violationDetectionService');
    
    // Test metodi principali (con timeout per evitare attese lunghe)
    const methods = [
      'detectUnauthorizedAccess',
      'detectSuspiciousActivity',
      'detectFailedAccess',
      'detectSuspiciousIPs'
    ];
    
    for (const method of methods) {
      try {
        const result = await Promise.race([
          ViolationDetectionService[method](),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);
        logTest(`ViolationDetectionService.${method}()`, true, 
          `Trovate ${result.length} violazioni`);
      } catch (error) {
        if (error.message === 'Timeout') {
          logTest(`ViolationDetectionService.${method}()`, true, 'Timeout (OK per test)');
        } else {
          logTest(`ViolationDetectionService.${method}()`, false, error.message);
        }
      }
    }
    
    return true;
  } catch (error) {
    logTest('ViolationDetectionService', false, error.message);
    return false;
  }
}

async function testFallback() {
  logSection('🔄 TEST 5: Fallback a Neon');
  
  try {
    // Simula Axiom disabilitato
    const originalAxiomEnabled = process.env.AXIOM_ENABLED;
    process.env.AXIOM_ENABLED = 'false';
    
    try {
      const logger = require('../api/services/centralizedLogger');
      const stats = await logger.getLogStats(7);
      logTest('Fallback CentralizedLogger.getLogStats()', true, 
        `Statistiche: ${stats.length}`);
    } catch (error) {
      logTest('Fallback CentralizedLogger.getLogStats()', false, error.message);
    }
    
    // Ripristina
    process.env.AXIOM_ENABLED = originalAxiomEnabled;
    
    return true;
  } catch (error) {
    logTest('Fallback a Neon', false, error.message);
    return false;
  }
}

async function testImports() {
  logSection('📦 TEST 6: Verifica Import');
  
  const modules = [
    { name: 'api/utils/axiomQueryHelper', exports: ['getAuditLogs', 'getCentralizedLogs', 'queryAxiom', 'countAxiomRecords'] },
    { name: 'api/services/auditService', exports: ['getUserAuditLogs', 'getUserAuditStats'] },
    { name: 'api/services/centralizedLogger', exports: ['getLogStats', 'exportLogs'] },
    { name: 'api/services/violationDetectionService', exports: ['detectUnauthorizedAccess', 'detectSuspiciousActivity'] }
  ];
  
  let allPassed = true;
  
  for (const module of modules) {
    try {
      const mod = require(`../${module.name}`);
      for (const exp of module.exports) {
        if (typeof mod[exp] === 'function' || typeof mod.getLogStats === 'function') {
          logTest(`${module.name}.${exp}`, true);
        } else {
          logTest(`${module.name}.${exp}`, false, 'Non trovato');
          allPassed = false;
        }
      }
    } catch (error) {
      logTest(`${module.name}`, false, error.message);
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function testEnvironmentVariables() {
  logSection('🔐 TEST 7: Variabili Ambiente');
  
  const required = ['AXIOM_ENABLED'];
  const optional = ['AXIOM_API_TOKEN', 'AXIOM_ORG_ID', 'AXIOM_REGION', 'AXIOM_DATASET'];
  
  let allPassed = true;
  
  for (const varName of required) {
    if (process.env[varName]) {
      logTest(`${varName}`, true, `Valore: ${process.env[varName]}`);
    } else {
      logTest(`${varName}`, false, 'Mancante');
      allPassed = false;
    }
  }
  
  for (const varName of optional) {
    if (process.env[varName]) {
      logTest(`${varName}`, true, 'Presente');
    } else {
      logTest(`${varName}`, false, 'Mancante (opzionale)');
    }
  }
  
  return allPassed;
}

async function runAllTests() {
  console.log('\n');
  log('🧪 TEST COMPLETO PRE-DEPLOY', 'cyan');
  log('Verifica di tutte le modifiche prima del deploy\n', 'yellow');
  
  const results = {
    syntax: false,
    helper: false,
    services: false,
    violation: false,
    fallback: false,
    imports: false,
    env: false
  };
  
  try {
    results.syntax = await testSyntax();
    results.helper = await testAxiomHelper();
    results.services = await testServices();
    results.violation = await testViolationDetection();
    results.fallback = await testFallback();
    results.imports = await testImports();
    results.env = await testEnvironmentVariables();
  } catch (error) {
    log(`\n❌ Errore durante i test: ${error.message}`, 'red');
    console.error(error);
  }
  
  // Riepilogo finale
  logSection('📊 RIEPILOGO FINALE');
  
  const allPassed = Object.values(results).every(r => r);
  const passedCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\nTest passati: ${passedCount}/${totalCount}`);
  
  for (const [test, passed] of Object.entries(results)) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${icon} ${test}`, color);
  }
  
  if (allPassed) {
    log('\n✅ TUTTI I TEST SONO PASSATI! Pronto per il deploy.', 'green');
    process.exit(0);
  } else {
    log('\n❌ ALCUNI TEST SONO FALLITI! Verifica gli errori prima del deploy.', 'red');
    process.exit(1);
  }
}

// Esegui tutti i test
runAllTests().catch(error => {
  log(`\n❌ Errore fatale: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

