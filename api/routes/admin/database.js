const express = require('express');
const { pool, verifyToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// POST /api/admin/database/add-opinioni-columns - Aggiungi colonne mancanti alla tabella opinioni
// Mutazione di schema: accesso esclusivamente Admin autenticato.
// Legacy schema mutation is available only in non-production; never re-enable
// with ALLOW_DEV_API_SURFACE or a valid admin token. Use approved SQL migration
// tooling for production changes outside the HTTP request path.
if (process.env.NODE_ENV !== 'production') {
router.post('/add-opinioni-columns', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 POST /api/admin/database/add-opinioni-columns - Aggiunta colonne opinioni');
    
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
    
    console.log('✅ Tabella opinioni esiste');
    
    // Controlla le colonne esistenti
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'opinioni'
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    console.log('📋 Colonne esistenti:', columnsResult.rows.map(r => r.column_name));
    
    const addedColumns = [];
    
    // Aggiungi colonna approfondimento se non esiste
    const hasApprofondimento = columnsResult.rows.some(row => row.column_name === 'approfondimento');
    
    if (!hasApprofondimento) {
      console.log('➕ Aggiungo colonna approfondimento...');
      await pool.query('ALTER TABLE opinioni ADD COLUMN approfondimento TEXT');
      addedColumns.push('approfondimento');
      console.log('✅ Colonna approfondimento aggiunta');
    } else {
      console.log('✅ Colonna approfondimento già esiste');
    }
    
    // Verifica che gradi_opinione esista (dovrebbe già esserci)
    const hasGradiOpinione = columnsResult.rows.some(row => row.column_name === 'gradi_opinione');
    
    if (!hasGradiOpinione) {
      console.log('⚠️ Colonna gradi_opinione mancante, la aggiungo...');
      await pool.query('ALTER TABLE opinioni ADD COLUMN gradi_opinione TEXT[]');
      addedColumns.push('gradi_opinione');
      console.log('✅ Colonna gradi_opinione aggiunta');
    } else {
      console.log('✅ Colonna gradi_opinione già esiste');
    }
    
    // Verifica la struttura finale
    const finalColumnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'opinioni'
      ORDER BY ordinal_position
    `;
    
    const finalResult = await pool.query(finalColumnsQuery);
    
    res.json({
      success: true,
      message: 'Colonne aggiunte con successo',
      addedColumns: addedColumns,
      finalStructure: finalResult.rows.map(row => ({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable,
        column_default: row.column_default
      }))
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta colonne opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiunta delle colonne',
      details: error.message
    });
  }
});

}

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
