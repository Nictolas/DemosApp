const express = require('express');
const { pool, verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// No schema-changing HTTP handlers in any production/admin surface.
// The authenticated read-only structure inspector below remains supported.
router.post('/add-opinioni-columns',verifyToken,requireAdmin,(_req,res)=>{
  res.set('Cache-Control','no-store');
  return res.status(410).json({
    success:false,code:'LEGACY_HTTP_SCHEMA_MIGRATION_RETIRED',
    message:'Schema migration requires an approved offline maintenance operation.'
  });
});

// GET /api/admin/database/opinioni-structure - Verifica struttura tabella opinioni
router.get('/opinioni-structure', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/admin/database/opinioni-structure - Verifica struttura tabella opinioni');
    
    // Controlla se la tabella opinioni esiste
    const checkTableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'opinioni'
    `;
    
    const tableResult = await pool.query(checkTableQuery);
    
    if (tableResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tabella opinioni non esiste'
      });
    }
    
    // Ottieni la struttura della tabella
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'opinioni'
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    
    res.json({
      success: true,
      tableExists: true,
      columns: columnsResult.rows.map(row => ({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable,
        column_default: row.column_default
      }))
    });
    
  } catch (error) {
    console.error('❌ Errore nella verifica struttura tabella opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella verifica della struttura',
      details: error.message
    });
  }
});

module.exports = router;
