// File: api/routes/test-performance.js
// Endpoint per testare le performance dell'app con molti utenti
const express = require('express');
const { getPool, testConnection, getPoolStats } = require('../config/database');
const performanceOptimizer = require('../services/performanceOptimizer');

const router = express.Router();

// GET /api/test-performance - Test generale delle performance
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test connessione database
    const dbTest = await testConnection();
    
    // Test query semplici
    const pool = getPool();
    const queryStart = Date.now();
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    const queryTime = Date.now() - queryStart;
    
    // Test query complesse
    const complexQueryStart = Date.now();
    const complexResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        COUNT(o.id) as opinioni_count
      FROM users u
      LEFT JOIN opinioni o ON u.id = o.user_id
      GROUP BY u.id, u.email, u.created_at
      ORDER BY u.created_at DESC
      LIMIT 10
    `);
    const complexQueryTime = Date.now() - complexQueryStart;
    
    // Statistiche pool
    const poolStats = getPoolStats();
    
    // Metriche ottimizzatore
    const optimizerMetrics = performanceOptimizer.getCurrentMetrics();
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        testResults: {
          totalTime: `${totalTime}ms`,
          databaseConnection: dbTest,
          simpleQueryTime: `${queryTime}ms`,
          complexQueryTime: `${complexQueryTime}ms`,
          usersCount: result.rows[0].user_count,
          complexQueryResults: complexResult.rows.length
        },
        poolStats,
        optimizerMetrics,
        recommendations: performanceOptimizer.getRecommendations(),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test performance:', error);
    res.status(500).json({
      success: false,
      error: 'Errore test performance',
      message: error.message
    });
  }
});

// GET /api/test-performance/load - Test di carico simulato
router.get('/load', async (req, res) => {
  try {
    const { concurrent = 10, queries = 5 } = req.query;
    const concurrentCount = parseInt(concurrent);
    const queriesCount = parseInt(queries);
    
    console.log(`🧪 Test carico: ${concurrentCount} connessioni concorrenti, ${queriesCount} query ciascuna`);
    
    const pool = getPool();
    const startTime = Date.now();
    
    // Simula connessioni concorrenti
    const promises = [];
    for (let i = 0; i < concurrentCount; i++) {
      promises.push(simulateUserLoad(pool, queriesCount));
    }
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Calcola statistiche
    const successfulQueries = results.reduce((sum, r) => sum + r.successful, 0);
    const failedQueries = results.reduce((sum, r) => sum + r.failed, 0);
    const avgQueryTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
    
    res.json({
      success: true,
      data: {
        loadTest: {
          concurrentConnections: concurrentCount,
          queriesPerConnection: queriesCount,
          totalQueries: concurrentCount * queriesCount,
          successfulQueries,
          failedQueries,
          successRate: `${Math.round((successfulQueries / (successfulQueries + failedQueries)) * 100)}%`,
          totalTime: `${totalTime}ms`,
          averageQueryTime: `${Math.round(avgQueryTime)}ms`,
          queriesPerSecond: Math.round((successfulQueries / totalTime) * 1000)
        },
        poolStats: getPoolStats(),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test carico:', error);
    res.status(500).json({
      success: false,
      error: 'Errore test carico',
      message: error.message
    });
  }
});

// Simula il carico di un utente
async function simulateUserLoad(pool, queryCount) {
  const results = {
    successful: 0,
    failed: 0,
    avgTime: 0,
    times: []
  };
  
  for (let i = 0; i < queryCount; i++) {
    try {
      const start = Date.now();
      await pool.query('SELECT NOW() as current_time, COUNT(*) as user_count FROM users');
      const time = Date.now() - start;
      
      results.successful++;
      results.times.push(time);
    } catch (error) {
      results.failed++;
      console.error('❌ Errore query simulata:', error);
    }
  }
  
  if (results.times.length > 0) {
    results.avgTime = results.times.reduce((sum, time) => sum + time, 0) / results.times.length;
  }
  
  return results;
}

// GET /api/test-performance/memory - Test utilizzo memoria
router.get('/memory', async (req, res) => {
  try {
    const beforeGC = process.memoryUsage();
    
    // Forza garbage collection se disponibile
    if (global.gc) {
      global.gc();
    }
    
    const afterGC = process.memoryUsage();
    
    res.json({
      success: true,
      data: {
        memoryUsage: {
          beforeGC: {
            heapUsed: Math.round(beforeGC.heapUsed / 1024 / 1024),
            heapTotal: Math.round(beforeGC.heapTotal / 1024 / 1024),
            external: Math.round(beforeGC.external / 1024 / 1024),
            rss: Math.round(beforeGC.rss / 1024 / 1024)
          },
          afterGC: {
            heapUsed: Math.round(afterGC.heapUsed / 1024 / 1024),
            heapTotal: Math.round(afterGC.heapTotal / 1024 / 1024),
            external: Math.round(afterGC.external / 1024 / 1024),
            rss: Math.round(afterGC.rss / 1024 / 1024)
          },
          freed: Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024)
        },
        poolStats: getPoolStats(),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test memoria:', error);
    res.status(500).json({
      success: false,
      error: 'Errore test memoria',
      message: error.message
    });
  }
});

module.exports = router;
