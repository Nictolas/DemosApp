const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER REFERENDUM ABROGATIVI =====

// GET /api/referendum-abrogativi - Lista referendum abrogativi (come ICE)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/referendum-abrogativi');
    // Disabilita caching per evitare dati stantii lato client/proxy
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Ottieni il ruolo dell'utente se autenticato
    let userRole = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Ottieni il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        if (userResult.rows.length > 0) {
          userRole = userResult.rows[0].ruolo;
          console.log(`🔍 Ruolo utente: ${userRole}`);
        }
      } catch (authError) {
        console.log('⚠️ Errore nel recupero ruolo utente:', authError.message);
      }
    }
    
    // Query con filtro basato sul ruolo
    let query;
    if (userRole === "AD" || userRole === 'Moderatore') {
      // Admin e Moderatori vedono tutti i referendum
      query = `
        SELECT *
        FROM referendum_abrogativi
        ORDER BY datainizio DESC NULLS LAST, data_creazione DESC
      `;
    } else {
      // Altri utenti vedono solo i referendum ufficiali (quorum != 'proposta') e con esito 'In Attesa'
      query = `
        SELECT *
        FROM referendum_abrogativi
        WHERE quorum != 'proposta' AND (esito = 'In Attesa' OR esito IS NULL)
        ORDER BY datainizio DESC NULLS LAST, data_creazione DESC
      `;
    }
    
    const result = await pool.query(query);
    console.log(`✅ Recuperati ${result.rows.length} record da referendum_abrogativi`);
    
    // Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        const userVotiQuery = `
          SELECT referendum_id FROM voti_referendum_abrogativi 
          WHERE userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.referendum_id);
        console.log(`✅ Recuperati ${mieiVoti.length} voti utente`);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per referendum abrogativi, continuando senza autenticazione');
      }
    }
    
    // Normalizza i dati per il frontend
    const normalizedData = result.rows.map(row => ({
      ...row,
      dataInizio: row.datainizio || row.data_inizio,
      dataFine: row.datafine || row.data_fine,
      sitoWeb: row.sitoweb || row.sito_web,
      data_creazione: row.data_creazione || row.created_at
    }));

    // Genera la classifica basata sui voti
    let classifica = [];
    if (result.rows.length > 0) {
      try {
        const classificaQuery = `
          SELECT 
            ra.nome,
            ra.sitoweb as sitoWeb,
            COUNT(vra.referendum_id) as voti
          FROM referendum_abrogativi ra
          LEFT JOIN voti_referendum_abrogativi vra ON ra.id::text = vra.referendum_id
          WHERE ra.quorum != 'proposta' AND (ra.esito = 'In Attesa' OR ra.esito IS NULL)
          GROUP BY ra.id, ra.nome, ra.sitoweb
          ORDER BY voti DESC, ra.nome ASC
        `;
        
        const classificaResult = await pool.query(classificaQuery);
        classifica = classificaResult.rows.map(row => ({
          nome: row.nome,
          sitoWeb: row.sitoweb,
          voti: parseInt(row.voti) || 0
        }));
        console.log(`✅ Generata classifica con ${classifica.length} referendum`);
      } catch (classificaError) {
        console.log('⚠️ Errore nella generazione classifica, continuando senza:', classificaError.message);
        // Se la classifica fallisce, continua senza di essa
        classifica = [];
      }
    }

    res.json({
      success: true,
      richieste: normalizedData,
      referendum: normalizedData,
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare referendum abrogativi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare referendum abrogativi',
      details: error.message
    });
  }
});

// POST /api/referendum-abrogativi - Crea richiesta referendum abrogativo (come ICE)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    console.log('🔍 DEBUG: Dati ricevuti:', { nome, descrizione, dataInizio, dataFine, sitoWeb });
    
    // Validazione campi obbligatori
    if (!nome || !descrizione) {
      return res.status(400).json({
        success: false,
        error: 'Nome e descrizione sono obbligatori'
      });
    }
    
    // Genera un ID univoco per la richiesta referendum
    const referendumId = `referendum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔍 DEBUG: Referendum ID generato:', referendumId);
    
    // Usa la colonna quorum per distinguere i referendum proposti
    const query = `
      INSERT INTO referendum_abrogativi (id, nome, descrizione, datainizio, datafine, sitoweb, quorum, data_creazione)
      VALUES ($1, $2, $3, $4, $5, $6, 'proposta', NOW())
      RETURNING *
    `;
    
    const params = [referendumId, nome, descrizione, dataInizio, dataFine, sitoWeb];
    console.log('🔍 DEBUG: Parametri query:', params);
    
    const result = await pool.query(query, params);
    console.log('🔍 DEBUG: Risultato inserimento:', result.rows[0]);
    
    console.log(`✅ Referendum proposta creata: ${referendumId}`);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione referendum abrogativo',
      details: error.message
    });
  }
});

// PUT /api/referendum-abrogativi/:id - Aggiorna referendum abrogativo (per admin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descrizione, dataInizio, dataFine, sitoWeb, quorum } = req.body;
    
    // Verifica che l'utente sia admin o moderatore
    const userId = req.userId;
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0 || !["AD", 'Moderatore'].includes(userResult.rows[0].ruolo)) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin e Moderatori possono modificare i referendum abrogativi.'
      });
    }
    
    const updateQuery = `
      UPDATE referendum_abrogativi
      SET nome = $1, descrizione = $2, datainizio = $3, datafine = $4, sitoweb = $5, quorum = $6
      WHERE id = $7
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, [nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum abrogativo non trovato'
      });
    }
    
    console.log(`✅ Referendum abrogativo aggiornato: ${id}, nuovo quorum: ${quorum}`);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento referendum abrogativo'
    });
  }
});

// DELETE /api/referendum-abrogativi/:id - Elimina referendum abrogativo (per admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica che l'utente sia admin o moderatore
    const userId = req.userId;
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0 || !["AD", 'Moderatore'].includes(userResult.rows[0].ruolo)) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin e Moderatori possono eliminare i referendum abrogativi.'
      });
    }
    
    const deleteQuery = `DELETE FROM referendum_abrogativi WHERE id = $1 RETURNING *`;
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum abrogativo non trovato'
      });
    }
    
    console.log(`✅ Referendum abrogativo eliminato: ${id}`);
    
    res.json({
      success: true,
      message: 'Referendum abrogativo eliminato con successo'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione referendum abrogativo'
    });
  }
});

module.exports = router;
