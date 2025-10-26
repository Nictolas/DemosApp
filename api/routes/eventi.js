const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const { decompressUserLocation } = require('../utils/locationUtils');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER EVENTI =====

// GET /api/eventi - Lista eventi (con filtraggio basato su selezioni utente)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/eventi - Richiesta eventi con filtraggio utente');
    
    const userId = req.userId;
    const viewType = req.query.view || 'personal'; // 'personal' o 'global'
    console.log('👤 ID utente autenticato:', userId);
    console.log('👁️ Tipo visualizzazione:', viewType);
    
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
    
    // Ottieni le selezioni dell'utente
    const userQuery = `
      SELECT 
        rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
        candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
        ruolo, regione_residenza
      FROM users 
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    const isAdmin = user.ruolo === 'AD';
    
    console.log('👤 Dati utente:', {
      ruolo: user.ruolo,
      regione: user.regione_residenza,
      isAdmin,
      viewType
    });
    
    // Se è admin e richiede vista globale, mostra tutti gli eventi
    if (isAdmin && viewType === 'global') {
      console.log('🔑 Utente admin - mostrando tutti gli eventi (vista globale)');
      const result = await pool.query(
        'SELECT id, nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, organizzatore, created_at FROM eventi ORDER BY giorno_inizio ASC, created_at ASC'
      );
      
      console.log('📊 Eventi trovati (admin globale):', result.rows.length);
      
      return res.json({
        success: true,
        data: result.rows
      });
    }
    
    // Per utenti non-admin o admin in vista "personale", filtra gli eventi
    const selectedIds = [
      user.rappresentante_europeo,
      user.rappresentante_camera,
      user.rappresentante_senato,
      user.rappresentante_regionale,
      user.rappresentante_comune,
      user.candidato_europeo,
      user.candidato_camera,
      user.candidato_senato,
      user.candidato_regionale,
      user.candidato_comune
    ].filter(id => id); // Rimuovi valori null/undefined
    
    console.log('🎯 ID selezionati dall\'utente:', selectedIds);
    
    let query = `
      SELECT 
        e.id, e.nome_evento, e.tipologia_evento, e.paese_evento, e.regione_evento, 
        e.provincia_evento, e.comune_evento, e.indirizzo_evento, e.giorno_inizio, 
        e.giorno_fine, e.orario_inizio, e.orario_fine, e.organizzatore, e.created_at
      FROM eventi e
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;
    
    // Filtra per eventi creati da rappresentanti/candidati selezionati
    if (selectedIds.length > 0) {
      paramCount++;
      query += ` AND e.organizzatore IN (SELECT CONCAT(nome, ' ', cognome) FROM users WHERE id = ANY($${paramCount}))`;
      queryParams.push(selectedIds);
    }
    
    // Filtra eventi "Elezioni" per regione (mantenendo la logica esistente)
    if (user.regione_residenza) {
      paramCount++;
      query += ` AND (e.tipologia_evento != 'Elezioni' OR e.regione_evento = $${paramCount})`;
      queryParams.push(user.regione_residenza);
    }
    
    query += ` ORDER BY e.giorno_inizio ASC, e.created_at ASC`;
    
    console.log('🔍 Query finale:', query);
    console.log('📋 Parametri query:', queryParams);
    
    const result = await pool.query(query, queryParams);
    
    console.log('📊 Eventi trovati (filtrati):', result.rows.length);
    
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
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('📤 POST /api/eventi - Dati ricevuti:', JSON.stringify(req.body, null, 2));
    
    const userId = req.userId;
    console.log('👤 ID utente che crea l\'evento:', userId);
    
    // Ottieni i dati dell'utente che crea l'evento
    const userQuery = `
      SELECT nome, cognome, ruolo 
      FROM users 
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = userResult.rows[0];
    const organizerName = `${user.nome} ${user.cognome}`;
    
    console.log('👤 Organizzatore automatico:', organizerName);
    
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
    
    // Usa il nome dell'utente autenticato come organizzatore
    const finalOrganizer = organizerName;
    
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
      organizzatore: finalOrganizer
    });
    
    const result = await pool.query(
      'INSERT INTO eventi (nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, organizzatore) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [nome_evento, tipologia_evento, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giornoInizio, giornoFine, orarioInizio, orarioFine, finalOrganizer]
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
