const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Configurazione database ottimizzata
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  statement_timeout: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

/**
 * 🧪 TEST PERFORMANCE DATABASE
 * GET /api/test/performance
 */
router.get('/performance', async (req, res) => {
  const startTime = Date.now();
  console.log(`🧪 TEST PERFORMANCE START: ${new Date().toISOString()}`);
  
  try {
    // Test 1: Connessione database
    console.log('1. Test connessione database...');
    const connectionStart = Date.now();
    const client = await pool.connect();
    const connectionTime = Date.now() - connectionStart;
    console.log(`✅ Connessione database: ${connectionTime}ms`);
    
    // Test 2: Query semplice
    console.log('2. Test query semplice...');
    const queryStart = Date.now();
    const result = await client.query('SELECT NOW() as current_time');
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query semplice: ${queryTime}ms`);
    
    // Test 3: Query utenti
    console.log('3. Test query utenti...');
    const usersStart = Date.now();
    const usersResult = await client.query('SELECT COUNT(*) as total FROM users');
    const usersTime = Date.now() - usersStart;
    console.log(`✅ Query utenti: ${usersTime}ms`);
    
    // Test 4: Query con WHERE
    console.log('4. Test query con WHERE...');
    const whereStart = Date.now();
    const whereResult = await client.query('SELECT id, email FROM users WHERE status = $1 LIMIT 5', ['active']);
    const whereTime = Date.now() - whereStart;
    console.log(`✅ Query con WHERE: ${whereTime}ms`);
    
    client.release();
    
    const totalTime = Date.now() - startTime;
    
    console.log(`🎉 TEST PERFORMANCE COMPLETATO: ${totalTime}ms`);
    
    res.json({
      success: true,
      message: 'Test performance completato',
      results: {
        totalTime: `${totalTime}ms`,
        connectionTime: `${connectionTime}ms`,
        simpleQueryTime: `${queryTime}ms`,
        usersQueryTime: `${usersTime}ms`,
        whereQueryTime: `${whereTime}ms`,
        databaseTime: `${connectionTime + queryTime + usersTime + whereTime}ms`,
        overheadTime: `${totalTime - (connectionTime + queryTime + usersTime + whereTime)}ms`
      },
      recommendations: {
        connection: connectionTime > 1000 ? 'LENTA' : 'OK',
        queries: (queryTime + usersTime + whereTime) > 2000 ? 'LENTE' : 'OK',
        overall: totalTime > 5000 ? 'MOLTO LENTA' : totalTime > 2000 ? 'LENTA' : 'OK'
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

/**
 * 🧪 TEST LOGIN PERFORMANCE
 * POST /api/test/login-performance
 */
router.post('/login-performance', async (req, res) => {
  const startTime = Date.now();
  console.log(`🧪 TEST LOGIN PERFORMANCE START: ${new Date().toISOString()}`);
  
  try {
    const { email = 'test@example.com' } = req.body;
    
    // Simula il processo di login
    console.log('1. Test query utente...');
    const queryStart = Date.now();
    const userQuery = `
      SELECT id, email, password, ruolo, nome, cognome, 
             email_verified, created_at, last_login
      FROM users 
      WHERE email = $1 AND status = 'active'
    `;
    
    const userResult = await pool.query(userQuery, [email.toLowerCase()]);
    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query utente: ${queryTime}ms`);
    
    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Utente non trovato (normale per test)',
        results: {
          totalTime: `${Date.now() - startTime}ms`,
          queryTime: `${queryTime}ms`,
          userFound: false
        }
      });
    }
    
    const user = userResult.rows[0];
    
    // Test bcrypt (simula verifica password)
    console.log('2. Test bcrypt...');
    const bcryptStart = Date.now();
    const bcrypt = require('bcryptjs');
    const testPassword = 'test123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const isValidPassword = await bcrypt.compare(testPassword, hashedPassword);
    const bcryptTime = Date.now() - bcryptStart;
    console.log(`✅ Bcrypt: ${bcryptTime}ms`);
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Test login performance completato',
      results: {
        totalTime: `${totalTime}ms`,
        queryTime: `${queryTime}ms`,
        bcryptTime: `${bcryptTime}ms`,
        userFound: true,
        userEmail: user.email
      },
      recommendations: {
        query: queryTime > 1000 ? 'LENTA' : 'OK',
        bcrypt: bcryptTime > 500 ? 'LENTA' : 'OK',
        overall: totalTime > 2000 ? 'LENTA' : 'OK'
      }
    });
    
  } catch (error) {
    console.error('❌ Errore test login performance:', error);
    res.status(500).json({
      success: false,
      error: 'Errore test login performance',
      message: error.message
    });
  }
});

module.exports = router;
