const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER EVENTI =====

// GET /api/eventi - Lista eventi
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/eventi - Richiesta eventi');
    
    // Prima controlliamo se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'eventi'
      );
    `);
    
    console.log('📋 Tabella eventi esiste:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        data: [],
        message: 'Tabella eventi non trovata'
      });
    }
    
    const result = await pool.query(
      'SELECT id, nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, organizzatore, created_at FROM eventi ORDER BY giorno_inizio ASC, created_at ASC'
    );
    
    console.log('📊 Eventi trovati:', result.rows.length);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero eventi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/eventi - Crea nuovo evento
router.post('/', async (req, res) => {
  try {
    console.log('📤 POST /api/eventi - Dati ricevuti:', JSON.stringify(req.body, null, 2));
    
    const { 
      nome_evento, 
      tipologia_evento, 
      paese_evento, 
      regione_evento, 
      provincia_evento, 
      comune_evento, 
      indirizzo_evento, 
      giorno_inizio,
      giorno_fine,
      orario_inizio,
      orario_fine,
      organizzatore 
    } = req.body;
    
    if (!nome_evento || !tipologia_evento) {
      console.log('❌ Validazione fallita: nome_evento o tipologia_evento mancanti');
      return res.status(400).json({
        success: false,
        error: 'Nome evento e tipologia sono obbligatori'
      });
    }
    
    // Converti stringhe vuote in null per i campi opzionali
    const giornoInizio = giorno_inizio && giorno_inizio.trim() !== '' ? giorno_inizio : null;
    const giornoFine = giorno_fine && giorno_fine.trim() !== '' ? giorno_fine : null;
    const orarioInizio = orario_inizio && orario_inizio.trim() !== '' ? orario_inizio : null;
    const orarioFine = orario_fine && orario_fine.trim() !== '' ? orario_fine : null;
    
    console.log('🔍 Parametri per la query (dopo conversione):', {
      nome_evento,
      tipologia_evento,
      paese_evento,
      regione_evento,
      provincia_evento,
      comune_evento,
      indirizzo_evento,
      giorno_inizio: giornoInizio,
      giorno_fine: giornoFine,
      orario_inizio: orarioInizio,
      orario_fine: orarioFine,
      organizzatore
    });
    
    const result = await pool.query(
      'INSERT INTO eventi (nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, organizzatore) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giornoInizio, giornoFine, orarioInizio, orarioFine, organizzatore]
    );
    
    console.log('✅ Evento creato con successo:', result.rows[0]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione evento:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// GET /api/eventi/:id - Ottieni singolo evento
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 GET /api/eventi/:id - Richiesta evento:', id);
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID evento richiesto'
      });
    }

    const result = await pool.query(
      'SELECT id, nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, organizzatore, created_at FROM eventi WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }

    console.log('✅ Evento trovato:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// PUT /api/eventi/:id - Aggiorna evento
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 PUT /api/eventi/:id - Aggiornamento evento:', id);
    console.log('📤 Dati ricevuti:', JSON.stringify(req.body, null, 2));
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID evento richiesto'
      });
    }
    
    const { 
      nome_evento, 
      tipologia_evento, 
      paese_evento, 
      regione_evento, 
      provincia_evento, 
      comune_evento, 
      indirizzo_evento, 
      giorno_inizio,
      giorno_fine,
      orario_inizio,
      orario_fine,
      organizzatore 
    } = req.body;
    
    if (!nome_evento || !tipologia_evento) {
      console.log('❌ Validazione fallita: nome_evento o tipologia_evento mancanti');
      return res.status(400).json({
        success: false,
        error: 'Nome evento e tipologia sono obbligatori'
      });
    }
    
    // Converti stringhe vuote in null per i campi opzionali
    const giornoInizio = giorno_inizio && giorno_inizio.trim() !== '' ? giorno_inizio : null;
    const giornoFine = giorno_fine && giorno_fine.trim() !== '' ? giorno_fine : null;
    const orarioInizio = orario_inizio && orario_inizio.trim() !== '' ? orario_inizio : null;
    const orarioFine = orario_fine && orario_fine.trim() !== '' ? orario_fine : null;
    
    console.log('🔍 Parametri per la query (dopo conversione):', {
      nome_evento,
      tipologia_evento,
      paese_evento,
      regione_evento,
      provincia_evento,
      comune_evento,
      indirizzo_evento,
      giorno_inizio: giornoInizio,
      giorno_fine: giornoFine,
      orario_inizio: orarioInizio,
      orario_fine: orarioFine,
      organizzatore
    });
    
    const result = await pool.query(
      'UPDATE eventi SET nome_evento = $1, tipologia_evento = $2, paese_evento = $3, regione_evento = $4, provincia_evento = $5, comune_evento = $6, indirizzo_evento = $7, giorno_inizio = $8, giorno_fine = $9, orario_inizio = $10, orario_fine = $11, organizzatore = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13 RETURNING *',
      [nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giornoInizio, giornoFine, orarioInizio, orarioFine, organizzatore, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }
    
    console.log('✅ Evento aggiornato con successo:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento evento:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// DELETE /api/eventi/:id - Elimina evento
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ DELETE /api/eventi - Eliminazione evento:', id);
    
    // Verifica che l'ID sia valido
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID evento richiesto'
      });
    }

    // Elimina l'evento
    const result = await pool.query(
      'DELETE FROM eventi WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }

    console.log('✅ Evento eliminato con successo:', id);
    
    res.json({
      success: true,
      message: 'Evento eliminato con successo'
    });

  } catch (error) {
    console.error('❌ Errore eliminazione evento:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;
