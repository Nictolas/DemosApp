const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { Pool } = require('pg');
const router = express.Router();
router.use(verifyToken, requireAdmin);

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Endpoint per correggere i valori Sì/No nel database
router.post('/fix-si-no-values', async (req, res) => {
  console.log('🔧 Inizio correzione valori Sì/No nel database...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ottieni tutte le colonne della tabella opinioni_risposte (escludendo id, user_id, created_at, updated_at, fonti_opinioni)
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'opinioni_risposte'
        AND column_name NOT IN ('id', 'user_id', 'created_at', 'updated_at', 'fonti_opinioni')
    `);
    
    const opinionColumns = columnsResult.rows.map(row => row.column_name);
    
    if (opinionColumns.length === 0) {
      console.log('ℹ️ Nessuna colonna di opinione trovata nella tabella opinioni_risposte. Nessuna correzione necessaria.');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Nessuna colonna di opinione trovata. Nessuna correzione necessaria.',
        updatedCount: 0
      });
    }
    
    let updateCount = 0;
    
    for (const column of opinionColumns) {
      // Aggiorna 'Sì' a 'f'
      const updateSiQuery = `
        UPDATE opinioni_risposte
        SET ${column} = 'f'
        WHERE ${column} = 'Sì'
      `;
      const siResult = await client.query(updateSiQuery);
      updateCount += siResult.rowCount;
      
      // Aggiorna 'No' a 'c'
      const updateNoQuery = `
        UPDATE opinioni_risposte
        SET ${column} = 'c'
        WHERE ${column} = 'No'
      `;
      const noResult = await client.query(updateNoQuery);
      updateCount += noResult.rowCount;
    }
    
    await client.query('COMMIT');
    console.log(`✅ Correzione completata. Aggiornati ${updateCount} valori.`);
    
    res.json({
      success: true,
      message: `Correzione completata. Aggiornati ${updateCount} valori.`,
      updatedCount: updateCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore durante la correzione:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Errore durante la correzione dei valori Sì/No'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
