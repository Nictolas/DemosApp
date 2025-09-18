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

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Lista candidati capo di stato con classifica voti
router.get('/', async (req, res) => {
  try {
    // Query per ottenere la classifica dei candidati basata sui voti ricevuti
    const classificaQuery = `
      SELECT 
        nome,
        COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC, nome ASC
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    
    console.log('🔍 DEBUG /api/capo-stato - Candidati trovati:', classificaResult.rows.length);
    
    // Processa la classifica per il frontend
    const classifica = classificaResult.rows.map(candidato => ({
      nome: candidato.nome,
      voti: parseInt(candidato.voti)
    }));
    
    // Ottieni i voti dell'utente corrente se autenticato
    let mieiVoti = [];
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };
    
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Controlla il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        const userRole = userResult.rows[0]?.ruolo;

        // Solo per utenti non-Admin, controlla il limite settimanale
        if (userRole !== 'Admin') {
          const bloccoQuery = `
            SELECT 
              CASE 
                WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
                ELSE false
              END as is_blocked,
              MAX(timestamp) + INTERVAL '7 days' as unlock_date
            FROM voti_capo_stato
            WHERE userid = $1
          `;
          const bloccoResult = await pool.query(bloccoQuery, [userId]);
          const isBlocked = bloccoResult.rows[0]?.is_blocked || false;
          const unlockDate = bloccoResult.rows[0]?.unlock_date;
          
          blocco = {
            isBlocked,
            unlockDate: unlockDate ? new Date(unlockDate).toISOString() : null
          };
        }

        const userVotiQuery = `
          SELECT nome
          FROM voti_capo_stato
          WHERE userid = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.nome);
      } catch (authError) {
        console.log('⚠️ Token non valido per capo di stato:', authError.message);
      }
    }
    
    const responseData = {
      classifica,
      mieiVoti,
      blocco
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato/vota - Salva i voti multipli per capo di stato
router.post('/vota', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/vota - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);
    
    const { voti } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 DEBUG - Voti ricevuti:', voti);
    console.log('🔍 DEBUG - User ID:', userId);
    
    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    await pool.query('BEGIN');
    
    try {
      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteResult = await pool.query(
        'DELETE FROM voti_capo_stato WHERE userid = $1',
        [userId]
      );
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);
        const insertPromises = voti.map(async (nome, index) => {
          const votoId = `voto_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome);
          return pool.query(
            `INSERT INTO voti_capo_stato (
              id, userid, nome, timestamp, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
            [votoId, userId, nome]
          );
        });
        
        await Promise.all(insertPromises);
        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await pool.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.log('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio voti capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato/test-vota - Endpoint di test per voti (senza autenticazione)
router.post('/test-vota', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/test-vota - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    
    const { voti, userid } = req.body;
    
    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }
    
    if (!userid) {
      return res.status(400).json({
        success: false,
        error: 'UserID è obbligatorio'
      });
    }
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    await pool.query('BEGIN');
    
    try {
      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userid);
      const deleteResult = await pool.query(
        'DELETE FROM voti_capo_stato WHERE userid = $1',
        [userid]
      );
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);
        const insertPromises = voti.map(async (nome, index) => {
          const votoId = `voto_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome);
          return pool.query(
            `INSERT INTO voti_capo_stato (
              id, userid, nome, timestamp, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
            [votoId, userid, nome]
          );
        });
        
        await Promise.all(insertPromises);
        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await pool.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.log('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio voti capo di stato (test):', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/capo-stato/vota - Endpoint principale per voti (con autenticazione)
router.post('/vota', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/vota - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);
    
    const { voti } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 DEBUG - Voti ricevuti:', voti);
    console.log('🔍 DEBUG - User ID:', userId);
    
    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    // Controlla il limite di 3 voti massimi
    if (voti.length > 3) {
      console.log('❌ DEBUG - Troppi voti:', voti.length);
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 3 candidati'
      });
    }

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    console.log('🔍 DEBUG - Controllo ruolo utente per userId:', userId);
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    console.log('🔍 DEBUG - Esecuzione query:', userQuery, 'con parametro:', userId);
    
    const userResult = await pool.query(userQuery, [userId]);
    console.log('🔍 DEBUG - Risultato query utente:', userResult.rows);
    
    const userRole = userResult.rows[0]?.ruolo;
    console.log('🔍 DEBUG - Ruolo utente:', userRole);

    if (userRole !== 'Admin') {
      const bloccoQuery = `
        SELECT 
          CASE 
            WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
            ELSE false
          END as is_blocked
        FROM voti_capo_stato
        WHERE userid = $1
      `;

      const bloccoResult = await pool.query(bloccoQuery, [userId]);
      const isBlocked = bloccoResult.rows[0]?.is_blocked || false;

      if (isBlocked) {
        console.log('❌ DEBUG - Utente bloccato per limite settimanale');
        return res.status(403).json({
          success: false,
          error: 'Non puoi modificare i voti più di una volta a settimana'
        });
      }
    }
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    await pool.query('BEGIN');
    
    try {
      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteResult = await pool.query(
        'DELETE FROM voti_capo_stato WHERE userid = $1',
        [userId]
      );
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);
        const insertPromises = voti.map(async (nome, index) => {
          const votoId = `voto_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome);
          return pool.query(
            `INSERT INTO voti_capo_stato (
              id, userid, nome, timestamp, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
            [votoId, userId, nome]
          );
        });
        
        await Promise.all(insertPromises);
        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await pool.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.log('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio voti capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/capo-stato - Vota per un candidato capo di stato (legacy)
router.post('/', async (req, res) => {
  try {
    const { nome, userid } = req.body;
    
    if (!nome || !userid) {
      return res.status(400).json({
        success: false,
        error: 'Nome del candidato e userid sono obbligatori'
      });
    }
    
    // Genera un ID univoco per il voto
    const votoId = `voto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inserisce il voto nella tabella voti_capo_stato
    const result = await pool.query(
      `INSERT INTO voti_capo_stato (
        id, userid, nome, timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW(), NOW()) 
      RETURNING id, userid, nome, timestamp`,
      [votoId, userid, nome]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel voto per candidato capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
