const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni - Ottieni tutte le opinioni (per gestione)
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT o.id, o.text, o.gradi_opinione, o.approfondimento
      FROM opinioni_domande o
      ORDER BY o.text
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// POST /api/opinioni - Crea una nuova opinione
router.post('/', verifyToken, async (req, res) => {
  try {
    const { id, text, gradi_opinione } = req.body;
    
    console.log('📝 POST /api/opinioni - Creazione nuova opinione');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 Testo:', text);
    console.log('🔍 Gradi:', gradi_opinione);
    
    if (!id || !text || !gradi_opinione || !Array.isArray(gradi_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti o non validi',
        message: 'ID, testo e gradi_opinione sono obbligatori e gradi_opinione deve essere un array'
      });
    }
    
    const insertQuery = `
      INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        gradi_opinione = EXCLUDED.gradi_opinione,
        approfondimento = EXCLUDED.approfondimento
    `;
    
    const approfondimento = `## Proposta ${gradi_opinione.join(', ')}\n\n${text}`;
    const result = await pool.query(insertQuery, [id, text, gradi_opinione, approfondimento]);
    
    console.log('✅ Opinione creata/aggiornata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione creata/aggiornata con successo',
      data: { id, text, gradi_opinione }
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile creare l\'opinione'
    });
  }
});

// PUT /api/opinioni/:id - Aggiorna un'opinione esistente
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, gradi_opinione } = req.body;
    
    console.log('✏️ PUT /api/opinioni/:id - Aggiornamento opinione');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 Nuovo testo:', text);
    console.log('🔍 Nuovi gradi:', gradi_opinione);
    
    if (!text || !gradi_opinione || !Array.isArray(gradi_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti o non validi',
        message: 'Testo e gradi_opinione sono obbligatori e gradi_opinione deve essere un array'
      });
    }
    
    const updateQuery = `
      UPDATE opinioni
      SET text = $1, gradi_opinione = $2, approfondimento = $3
      WHERE id = $4
    `;
    
    const approfondimento = `## Proposta ${gradi_opinione.join(', ')}\n\n${text}`;
    const result = await pool.query(updateQuery, [text, gradi_opinione, approfondimento, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: 'Impossibile aggiornare l\'opinione'
      });
    }
    
    console.log('✅ Opinione aggiornata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione aggiornata con successo',
      data: { id, text, gradi_opinione }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornare opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile aggiornare l\'opinione'
    });
  }
});

// DELETE /api/opinioni/:id - Elimina un'opinione
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE /api/opinioni/:id - Eliminazione opinione');
    console.log('🔍 ID opinione:', id);
    
    const deleteQuery = 'DELETE FROM opinioni_domande WHERE id = $1';
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: 'Impossibile eliminare l\'opinione'
      });
    }
    
    console.log('✅ Opinione eliminata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione eliminata con successo',
      data: { id }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'eliminare opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile eliminare l\'opinione'
    });
  }
});

module.exports = router;
