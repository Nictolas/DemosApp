const express = require('express');
const { getPool } = require('../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// GET /api/test-opinioni-proposte - Test endpoint
router.get('/', async (req, res) => {
  try {
    console.log('🧪 TEST - Endpoint opinioni-proposte test');
    
    // Verifica se la tabella esiste
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opinioni_proposte'
      );
    `);
    
    const tableExists = checkTable.rows[0].exists;
    
    if (!tableExists) {
      console.log('🔧 Creo la tabella opinioni_proposte...');
      
      // Crea la tabella
      await pool.query(`
        CREATE TABLE opinioni_proposte (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          user_id UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'pending'
        );
      `);
      
      // Aggiungi dati di esempio
      await pool.query(`
        INSERT INTO opinioni_proposte (text, user_id, status) VALUES
        ('Proposta di test 1', (SELECT id FROM users LIMIT 1), 'pending'),
        ('Proposta di test 2', (SELECT id FROM users LIMIT 1), 'approved')
        ON CONFLICT DO NOTHING;
      `);
      
      console.log('✅ Tabella creata e dati inseriti!');
    }
    
    // Test query
    const result = await pool.query(`
      SELECT id, text, user_id, created_at, status
      FROM opinioni_domande
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      message: 'Test opinioni-proposte completato',
      tableExists: tableExists,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Errore test opinioni-proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test',
      message: error.message
    });
  }
});

module.exports = router;
