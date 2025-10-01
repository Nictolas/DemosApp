const express = require('express');
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/opinioni-proposte - Ottieni tutte le opinioni proposte
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Caricamento opinioni proposte');
    
    const query = `
      SELECT 
        op.id,
        op.testo,
        op.utente_id,
        op.titolo,
        op.descrizione,
        op.categoria,
        op.fonte,
        op.data_creazione,
        op.data_aggiornamento,
        u.nome,
        u.cognome,
        u.email,
        COALESCE(voti_count.voti, 0) as voti
      FROM opinioni_proposte op
      LEFT JOIN users u ON op.utente_id = u.id
      LEFT JOIN (
        SELECT 
          opinione_id,
          COUNT(*) as voti
        FROM voti_opinioni_proposte
        GROUP BY opinione_id
      ) voti_count ON op.id = voti_count.opinione_id
      ORDER BY op.data_creazione DESC
    `;
    
    const result = await pool.query(query);
    
    console.log(`✅ Trovate ${result.rows.length} opinioni proposte`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Errore nel caricare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricare opinioni proposte',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte - Crea una nuova opinione proposta
router.post('/', verifyToken, async (req, res) => {
  try {
    const { testo, titolo, descrizione, categoria } = req.body;
    const userId = req.user.id;
    
    console.log('📝 POST /api/opinioni-proposte - Creazione nuova opinione proposta');
    console.log('🔍 Testo:', testo);
    console.log('🔍 User ID:', userId);
    
    if (!testo || !testo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Testo dell\'opinione obbligatorio'
      });
    }
    
    // Genera ID univoco
    const id = require('crypto').randomUUID();
    
    const insertQuery = `
      INSERT INTO opinioni_proposte (
        id, utente_id, testo, titolo, descrizione, categoria, fonte, data_creazione, data_aggiornamento
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    const now = new Date();
    await pool.query(insertQuery, [
      id,
      userId,
      testo.trim(),
      titolo || null,
      descrizione || null,
      categoria || null,
      'user_proposal',
      now,
      now
    ]);
    
    console.log('✅ Opinione proposta creata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione proposta creata con successo',
      data: { id, testo: testo.trim() }
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione opinione proposta:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione opinione proposta',
      message: error.message
    });
  }
});

// POST /api/opinioni-proposte/:id/vota - Vota un'opinione proposta
router.post('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('👍 POST /api/opinioni-proposte/:id/vota - Voto opinione proposta');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    // Verifica se l'opinione esiste
    const checkOpinione = await pool.query(
      'SELECT id FROM opinioni_proposte WHERE id = $1',
      [id]
    );
    
    if (checkOpinione.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata'
      });
    }
    
    // Verifica se l'utente ha già votato
    const checkVoto = await pool.query(
      'SELECT id FROM voti_opinioni_proposte WHERE opinione_id = $1 AND utente_id = $2',
      [id, userId]
    );
    
    if (checkVoto.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Hai già votato questa opinione'
      });
    }
    
    // Aggiungi il voto
    const insertVoto = `
      INSERT INTO voti_opinioni_proposte (opinione_id, utente_id, data_voto)
      VALUES ($1, $2, $3)
    `;
    
    await pool.query(insertVoto, [id, userId, new Date()]);
    
    console.log('✅ Voto registrato con successo');
    
    res.json({
      success: true,
      message: 'Voto registrato con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nel voto:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel voto',
      message: error.message
    });
  }
});

// DELETE /api/opinioni-proposte/:id/vota - Rimuovi voto da un'opinione proposta
router.delete('/:id/vota', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('👎 DELETE /api/opinioni-proposte/:id/vota - Rimozione voto');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 User ID:', userId);
    
    const deleteQuery = `
      DELETE FROM voti_opinioni_proposte 
      WHERE opinione_id = $1 AND utente_id = $2
    `;
    
    const result = await pool.query(deleteQuery, [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voto non trovato'
      });
    }
    
    console.log('✅ Voto rimosso con successo');
    
    res.json({
      success: true,
      message: 'Voto rimosso con successo'
    });
    
  } catch (error) {
    console.error('❌ Errore nella rimozione voto:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione voto',
      message: error.message
    });
  }
});

module.exports = router;
