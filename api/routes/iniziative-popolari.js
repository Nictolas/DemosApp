const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Lista iniziative popolari con classifica voti
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 DEBUG /api/iniziative-popolari - Utente autenticato:', userId);
    
    // Query per ottenere le iniziative
    const iniziativeResult = await pool.query(
      'SELECT id, nome, sito_web as "sitoWeb", quorum FROM iniziative_popolari ORDER BY created_at DESC'
    );
    
    // Query per ottenere la classifica dei voti
    const classificaQuery = `
      SELECT 
        i.nome,
        i.sito_web as "sitoWeb",
        COUNT(v.id) as voti
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id::text = v.iniziativa_id
      GROUP BY i.id, i.nome, i.sito_web
      ORDER BY voti DESC, i.nome ASC
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    
    // Query per ottenere i voti dell'utente corrente
    const mieiVotiQuery = `
      SELECT iniziativa_id 
      FROM voti_iniziative_popolari 
      WHERE userid = $1
    `;
    
    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    const mieiVoti = mieiVotiResult.rows.map(row => row.iniziativa_id);
    
    console.log('🔍 DEBUG /api/iniziative-popolari - Iniziative trovate:', iniziativeResult.rows.length);
    console.log('🔍 DEBUG /api/iniziative-popolari - Classifica trovata:', classificaResult.rows.length);
    console.log('🔍 DEBUG /api/iniziative-popolari - Voti utente trovati:', mieiVoti.length);
    console.log('🔍 DEBUG /api/iniziative-popolari - ID iniziative disponibili:', iniziativeResult.rows.map(i => i.id));
    
    // Debug per verificare la struttura delle tabelle
    const votiEsistentiQuery = 'SELECT DISTINCT iniziativa_id FROM voti_iniziative_popolari LIMIT 5';
    const votiEsistentiResult = await pool.query(votiEsistentiQuery);
    console.log('🔍 DEBUG /api/iniziative-popolari - ID voti esistenti nella tabella:', votiEsistentiResult.rows.map(v => v.iniziativa_id));
    
    // Processa la classifica per il frontend
    const classifica = classificaResult.rows.map(item => ({
      nome: item.nome,
      sitoWeb: item.sitoWeb,
      voti: parseInt(item.voti)
    }));
    
    // Per ora, restituiamo dati mock per blocco
    // TODO: Implementare la logica per il blocco
    const blocco = {
      isBlocked: false,
      unlockDate: null
    };
    
    const responseData = {
      iniziative: iniziativeResult.rows,
      classifica,
      mieiVoti,
      blocco
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari - Crea nuova iniziativa popolare
router.post('/', async (req, res) => {
  try {
    const { nome, userid, data_inizio, data_fine, sito_web, status, quorum } = req.body;
    
    if (!nome || !userid) {
      return res.status(400).json({
        success: false,
        error: 'Nome e userid sono obbligatori'
      });
    }
    
    // Genera un ID univoco per l'iniziativa
    const iniziativaId = `iniziativa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      'INSERT INTO iniziative_popolari (id, userid, nome, data_inizio, data_fine, sito_web, status, quorum, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
      [iniziativaId, userid, nome, data_inizio, data_fine, sito_web, status, quorum]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari/vota - Salva i voti dell'utente
router.post('/vota', verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    const { voti } = req.body;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Utente:', userId);
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Voti da salvare:', voti);
    
    // Verifica che gli ID delle iniziative esistano
    const iniziativeCheckQuery = 'SELECT id FROM iniziative_popolari WHERE id = ANY($1)';
    const iniziativeCheckResult = await client.query(iniziativeCheckQuery, [voti]);
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Iniziative trovate nel DB:', iniziativeCheckResult.rows.map(i => i.id));
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Iniziative richieste:', voti);
    
    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'Formato voti non valido'
      });
    }
    
    // Verifica che tutti gli ID delle iniziative esistano
    if (iniziativeCheckResult.rows.length !== voti.length) {
      const missingIds = voti.filter(id => !iniziativeCheckResult.rows.some(row => row.id === id));
      console.error('❌ DEBUG /api/iniziative-popolari/vota - ID iniziative non trovati:', missingIds);
      return res.status(400).json({
        success: false,
        error: `Alcune iniziative non esistono: ${missingIds.join(', ')}`
      });
    }
    
    await client.query('BEGIN');
    
    // Prima cancella tutti i voti esistenti dell'utente
    await client.query(
      'DELETE FROM voti_iniziative_popolari WHERE userid = $1',
      [userId]
    );
    
    // Poi inserisce i nuovi voti
    for (const iniziativaId of voti) {
      await client.query(
        'INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, timestamp, created_at, updated_at) VALUES ($1, $2, NOW(), NOW(), NOW())',
        [userId, iniziativaId]
      );
    }
    
    await client.query('COMMIT');
    
    console.log('✅ DEBUG /api/iniziative-popolari/vota - Voti salvati con successo');
    
    res.json({
      success: true,
      message: 'Voti salvati con successo'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore nel salvataggio voti iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  } finally {
    client.release();
  }
});

// GET /api/iniziative-popolari/debug - Debug per verificare la struttura delle tabelle
router.get('/debug', verifyToken, async (req, res) => {
  try {
    // Query per vedere la struttura delle iniziative
    const iniziativeQuery = 'SELECT id, nome FROM iniziative_popolari ORDER BY created_at DESC LIMIT 10';
    const iniziativeResult = await pool.query(iniziativeQuery);
    
    // Query per vedere i voti esistenti
    const votiQuery = 'SELECT DISTINCT iniziativa_id FROM voti_iniziative_popolari LIMIT 10';
    const votiResult = await pool.query(votiQuery);
    
    // Query per vedere se ci sono corrispondenze
    const corrispondenzeQuery = `
      SELECT 
        i.id as iniziativa_id,
        i.nome,
        COUNT(v.id) as voti_count
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id::text = v.iniziativa_id
      GROUP BY i.id, i.nome
      ORDER BY voti_count DESC
    `;
    const corrispondenzeResult = await pool.query(corrispondenzeQuery);
    
    res.json({
      success: true,
      debug: {
        iniziative: iniziativeResult.rows,
        voti_esistenti: votiResult.rows,
        corrispondenze: corrispondenzeResult.rows
      }
    });
  } catch (error) {
    console.error('❌ Errore nel debug iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
