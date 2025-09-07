const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER GOVERNO =====

// GET /api/governo/voti - Ottieni dati per la pagina principale del governo
router.get('/voti', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Ottieni le classifiche per tutti i ministeri
    const classificaQuery = `
      SELECT 
        categoria,
        nome_display as nome,
        COUNT(*) as voti
      FROM voti_ministri 
      GROUP BY categoria, nome_display
      ORDER BY categoria, voti DESC, nome_display ASC
    `;

    const classificaResult = await pool.query(classificaQuery);
    
    // Raggruppa per categoria
    const classifiche = {};
    classificaResult.rows.forEach(row => {
      if (!classifiche[row.categoria]) {
        classifiche[row.categoria] = [];
      }
      classifiche[row.categoria].push({
        nome: row.nome,
        voti: parseInt(row.voti)
      });
    });

    // Ottieni i voti dell'utente per tutti i ministeri
    const mieiVotiQuery = `
      SELECT categoria, nome_display as nome
      FROM voti_ministri 
      WHERE utente_id = $1
    `;

    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    const mieiVoti = {};
    mieiVotiResult.rows.forEach(row => {
      mieiVoti[row.categoria] = row.nome;
    });

    // Controlla se l'utente è bloccato (può votare solo una volta a settimana)
    const bloccoQuery = `
      SELECT 
        categoria,
        CASE 
          WHEN MAX(data_voto) > NOW() - INTERVAL '7 days' THEN true
          ELSE false
        END as is_blocked,
        MAX(data_voto) + INTERVAL '7 days' as unlock_date
      FROM voti_ministri 
      WHERE utente_id = $1
      GROUP BY categoria
    `;

    const bloccoResult = await pool.query(bloccoQuery, [userId]);
    const blocco = {
      isBlocked: bloccoResult.rows.some(row => row.is_blocked),
      unlockDate: bloccoResult.rows.find(row => row.is_blocked)?.unlock_date
    };

    res.json({
      classifiche,
      mieiVoti,
      blocco
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare i voti del governo'
    });
  }
});

// POST /api/governo/vota - Salva voti per tutti i ministeri
router.post('/vota', verifyToken, async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId;

    if (!voti || typeof voti !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un oggetto'
      });
    }

    // Controlla se l'utente è bloccato
    const bloccoQuery = `
      SELECT 
        CASE 
          WHEN MAX(data_voto) > NOW() - INTERVAL '7 days' THEN true
          ELSE false
        END as is_blocked
      FROM voti_ministri 
      WHERE utente_id = $1
    `;

    const bloccoResult = await pool.query(bloccoQuery, [userId]);
    const isBlocked = bloccoResult.rows[0]?.is_blocked || false;

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Non puoi modificare i voti più di una volta a settimana'
      });
    }

    // Inizia transazione
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Elimina tutti i voti esistenti dell'utente
      await client.query(
        'DELETE FROM voti_ministri WHERE utente_id = $1',
        [userId]
      );

      // Inserisci i nuovi voti
      for (const [categoria, nome] of Object.entries(voti)) {
        if (nome && nome.trim()) {
          const nomeKey = nome.trim().toLowerCase();
          const nomeDisplay = nome.trim().split(' ').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');

          await client.query(
            `INSERT INTO voti_ministri (id, utente_id, categoria, nome_ministro, nome_display, data_voto) 
             VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
            [userId, categoria, nomeKey, nomeDisplay]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Voti salvati con successo' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Errore nel salvare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare i voti del governo'
    });
  }
});

// GET /api/governo - Lista membri del governo
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM governo ORDER BY ruolo, cognome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/governo/ideale - Governo ideale dell'utente
router.get('/ideale', async (req, res) => {
  try {
    console.log('🔍 GET /api/governo/ideale - Richiesta governo ideale');
    
    // Per ora restituiamo un governo ideale di esempio
    // In futuro potremmo recuperarlo dal database per utente specifico
    const governoIdeale = {
      presidente_consiglio: "Mario Rossi",
      ministro_interni: "Giulia Bianchi",
      ministro_esteri: "Luca Verdi",
      ministro_economia: "Anna Neri",
      ministro_giustizia: "Paolo Blu"
    };
    
    res.json({
      success: true,
      data: governoIdeale
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo ideale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/governo - Aggiungi membro governo
router.post('/', async (req, res) => {
  try {
    const { nome, cognome, ruolo, partito, data_nominazione } = req.body;
    
    if (!nome || !cognome || !ruolo) {
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome e ruolo sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO governo (nome, cognome, ruolo, partito, data_nominazione) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cognome, ruolo, partito, data_nominazione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta membro governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
