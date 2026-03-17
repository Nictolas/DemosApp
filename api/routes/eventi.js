const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { decompressUserLocation } = require('../utils/locationUtils');
const { getPool } = require('../config/database');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

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
    
    // Ottieni i dati dell'utente (incluso il comune di residenza)
    const userQuery = `
      SELECT 
        rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
        candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
        ruolo, regione_residenza, comune_residenza
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
        'SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at FROM eventi ORDER BY giorno_inizio ASC, created_at ASC'
      );
      
      console.log('📊 Eventi trovati (admin globale):', result.rows.length);
      
      return res.json({
        success: true,
        data: result.rows
      });
    }
    
    // Per utenti non-admin o admin in vista "personale", filtra gli eventi:
    // - tutti gli eventi del proprio comune_residenza
    // - più tutti gli eventi di tipologia "Elezioni" di tipo "europee" o "nazionali"
    let query = `
      SELECT 
        e.id, e.nome_evento, e.tipologia_evento, e.tipo_elezione, e.paese_evento, e.regione_evento, 
        e.provincia_evento, e.comune_evento, e.indirizzo_evento, e.giorno_inizio, 
        e.giorno_fine, e.orario_inizio, e.orario_fine, e.orario_inizio_giorno2, e.orario_fine_giorno2, e.organizzatore, e.created_at
      FROM eventi e
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;

    // Se l'utente ha un comune di residenza, applica il filtro combinato
    if (user.comune_residenza) {
      paramCount++;
      query += ` AND (e.comune_evento = $${paramCount} OR (e.tipologia_evento = 'Elezioni' AND e.tipo_elezione IN ('europee', 'nazionali')))`;
      queryParams.push(user.comune_residenza);
    } else {
      // Se non è presente il comune, mostra solo le elezioni europee/nazionali
      query += ` AND (e.tipologia_evento = 'Elezioni' AND e.tipo_elezione IN ('europee', 'nazionali'))`;
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
      tipo_elezione,
      paese_evento, 
      regione_evento, 
      provincia_evento, 
      comune_evento, 
      indirizzo_evento, 
      giorno_inizio,
      giorno_fine,
      orario_inizio,
      orario_fine,
      orario_inizio_giorno2,
      orario_fine_giorno2,
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
    const orarioInizioGiorno2 = orario_inizio_giorno2 && orario_inizio_giorno2.trim() !== '' ? orario_inizio_giorno2 : null;
    const orarioFineGiorno2 = orario_fine_giorno2 && orario_fine_giorno2.trim() !== '' ? orario_fine_giorno2 : null;
    
    // Usa il nome dell'utente autenticato come organizzatore
    const finalOrganizer = organizerName;
    
    console.log('🔍 Parametri per la query (dopo conversione):', {
      nome_evento,
      tipologia_evento,
      tipo_elezione,
      paese_evento,
      regione_evento,
      provincia_evento,
      comune_evento,
      indirizzo_evento,
      giorno_inizio: giornoInizio,
      giorno_fine: giornoFine,
      orario_inizio: orarioInizio,
      orario_fine: orarioFine,
      orario_inizio_giorno2: orarioInizioGiorno2,
      orario_fine_giorno2: orarioFineGiorno2,
      organizzatore: finalOrganizer
    });
    
    const result = await pool.query(
      'INSERT INTO eventi (nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
      [nome_evento, tipologia_evento, tipo_elezione || null, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giornoInizio, giornoFine, orarioInizio, orarioFine, orarioInizioGiorno2, orarioFineGiorno2, finalOrganizer]
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

// GET /api/eventi/prossimo - Ottieni il prossimo evento (quello più vicino nel futuro)
router.get('/prossimo', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/eventi/prossimo - Richiesta prossimo evento');
    
    const userId = req.userId;
    const oggi = new Date().toISOString().split('T')[0]; // Data di oggi in formato YYYY-MM-DD
    
    console.log('📅 Data di oggi:', oggi);
    
    // Prima controlliamo se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'eventi'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        data: null,
        message: 'Tabella eventi non trovata'
      });
    }
    
    // Ottieni le selezioni dell'utente per filtrare gli eventi
    const userQuery = `
      SELECT 
        rappresentante_europeo, rappresentante_camera, rappresentante_senato, rappresentante_regionale, rappresentante_comune,
        candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune,
        ruolo
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
    
    let query;
    const queryParams = [];
    
    // Se è admin, mostra tutti gli eventi futuri
    if (isAdmin) {
      query = `
        SELECT 
          id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento, 
          provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, 
          giorno_fine, orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at
        FROM eventi
        WHERE giorno_inizio >= $1
        ORDER BY giorno_inizio ASC, orario_inizio ASC NULLS LAST
        LIMIT 1
      `;
      queryParams.push(oggi);
    } else {
      // Per utenti non-admin, filtra come nella lista eventi
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
      ].filter(id => id);
      
      if (selectedIds.length > 0) {
        query = `
          SELECT 
            e.id, e.nome_evento, e.tipologia_evento, e.tipo_elezione, e.paese_evento, e.regione_evento, 
            e.provincia_evento, e.comune_evento, e.indirizzo_evento, e.giorno_inizio, 
            e.giorno_fine, e.orario_inizio, e.orario_fine, e.orario_inizio_giorno2, e.orario_fine_giorno2, e.organizzatore, e.created_at
          FROM eventi e
          WHERE e.giorno_inizio >= $1
            AND (e.tipologia_evento = 'Elezioni' OR e.organizzatore IN (SELECT CONCAT(nome, ' ', cognome) FROM users WHERE id = ANY($2)))
          ORDER BY e.giorno_inizio ASC, e.orario_inizio ASC NULLS LAST
          LIMIT 1
        `;
        queryParams.push(oggi, selectedIds);
      } else {
        // Se non ha selezioni, mostra solo eventi "Elezioni"
        query = `
          SELECT 
            id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento, 
            provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, 
            giorno_fine, orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at
          FROM eventi
          WHERE giorno_inizio >= $1 AND tipologia_evento = 'Elezioni'
          ORDER BY giorno_inizio ASC, orario_inizio ASC NULLS LAST
          LIMIT 1
        `;
        queryParams.push(oggi);
      }
    }
    
    console.log('🔍 Query prossimo evento:', query);
    console.log('📋 Parametri:', queryParams);
    
    const result = await pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      console.log('📭 Nessun evento futuro trovato');
      return res.json({
        success: true,
        data: null,
        message: 'Nessun evento futuro trovato'
      });
    }
    
    console.log('✅ Prossimo evento trovato:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recupero prossimo evento:', error);
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
      'SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at FROM eventi WHERE id = $1',
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
      tipo_elezione,
      paese_evento, 
      regione_evento, 
      provincia_evento, 
      comune_evento, 
      indirizzo_evento, 
      giorno_inizio,
      giorno_fine,
      orario_inizio,
      orario_fine,
      orario_inizio_giorno2,
      orario_fine_giorno2,
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
    const orarioInizioGiorno2 = orario_inizio_giorno2 && orario_inizio_giorno2.trim() !== '' ? orario_inizio_giorno2 : null;
    const orarioFineGiorno2 = orario_fine_giorno2 && orario_fine_giorno2.trim() !== '' ? orario_fine_giorno2 : null;
    
    console.log('🔍 Parametri per la query (dopo conversione):', {
      nome_evento,
      tipologia_evento,
      tipo_elezione,
      paese_evento,
      regione_evento,
      provincia_evento,
      comune_evento,
      indirizzo_evento,
      giorno_inizio: giornoInizio,
      giorno_fine: giornoFine,
      orario_inizio: orarioInizio,
      orario_fine: orarioFine,
      orario_inizio_giorno2: orarioInizioGiorno2,
      orario_fine_giorno2: orarioFineGiorno2,
      organizzatore
    });
    
    const result = await pool.query(
      'UPDATE eventi SET nome_evento = $1, tipologia_evento = $2, tipo_elezione = $3, paese_evento = $4, regione_evento = $5, provincia_evento = $6, comune_evento = $7, indirizzo_evento = $8, giorno_inizio = $9, giorno_fine = $10, orario_inizio = $11, orario_fine = $12, orario_inizio_giorno2 = $13, orario_fine_giorno2 = $14, organizzatore = $15, updated_at = CURRENT_TIMESTAMP WHERE id = $16 RETURNING *',
      [nome_evento, tipologia_evento, tipo_elezione || null, paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento, giornoInizio, giornoFine, orarioInizio, orarioFine, orarioInizioGiorno2, orarioFineGiorno2, organizzatore, id]
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
