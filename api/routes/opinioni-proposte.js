const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/opinioni-proposte - Ottieni tutte le opinioni proposte
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Caricamento opinioni proposte');
    
    // Dati mock per test (dalla tabella Neon che hai mostrato)
    const mockData = [
      {
        id: '5LXAHC94Uu9C9jmAlksR',
        testo: 'Allevamenti Intensivi',
        utente_id: null,
        titolo: null,
        descrizione: null,
        categoria: null,
        fonte: 'unknown',
        data_creazione: '2025-07-08T10:30:00Z',
        data_aggiornamento: '2025-07-08T10:30:00Z',
        nome: null,
        cognome: null,
        email: null,
        voti: 0
      },
      {
        id: '80vikZzToLOLMEmfTFSB',
        testo: 'Sanzioni per Israele',
        utente_id: null,
        titolo: null,
        descrizione: null,
        categoria: null,
        fonte: 'unknown',
        data_creazione: '2025-07-08T11:15:00Z',
        data_aggiornamento: '2025-07-08T11:15:00Z',
        nome: null,
        cognome: null,
        email: null,
        voti: 0
      },
      {
        id: 'qRGx0laCQAgLmHOV5gT3',
        testo: 'Finanziamenti ai Giornali',
        utente_id: null,
        titolo: null,
        descrizione: null,
        categoria: null,
        fonte: 'unknown',
        data_creazione: '2025-07-08T12:00:00Z',
        data_aggiornamento: '2025-07-08T12:00:00Z',
        nome: null,
        cognome: null,
        email: null,
        voti: 0
      }
    ];
    
    console.log(`✅ Trovate ${mockData.length} opinioni proposte (dati mock)`);
    
    res.json({
      success: true,
      data: mockData
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
router.post('/', async (req, res) => {
  try {
    const { testo, titolo, descrizione, categoria } = req.body;
    const userId = 'test-user-id'; // Temporaneo per test
    
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
router.post('/:id/vota', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'test-user-id'; // Temporaneo per test
    
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
router.delete('/:id/vota', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = 'test-user-id'; // Temporaneo per test
    
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
