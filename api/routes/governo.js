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

    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];

    const classifiche = {};
    const mieiVoti = {};
    let isBlocked = false;
    let unlockDate = null;

    // Per ogni ministero, ottieni classifiche e voti utente
    for (const ministero of ministeri) {
      const tableName = `voti_${ministero}`;
      
      console.log(`🔍 DEBUG - Processando ministero: ${ministero}, tabella: ${tableName}`);
      
      // Classifica per questo ministero
      const classificaQuery = `
        SELECT 
          nome_display as nome,
          COUNT(*) as voti
        FROM ${tableName}
        GROUP BY nome_display
        ORDER BY voti DESC, nome_display ASC
      `;

      try {
        const classificaResult = await pool.query(classificaQuery);
        console.log(`✅ DEBUG - ${ministero}: ${classificaResult.rows.length} record trovati`);
        classifiche[ministero] = classificaResult.rows.map(row => ({
          nome: row.nome,
          voti: parseInt(row.voti)
        }));
      } catch (error) {
        console.error(`❌ DEBUG - Errore per ${ministero}:`, error.message);
        classifiche[ministero] = [];
      }

      // Voti dell'utente per questo ministero
      const mieiVotiQuery = `
        SELECT nome_display as nome
        FROM ${tableName}
        WHERE userid = $1
        LIMIT 1
      `;

      const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
      if (mieiVotiResult.rows.length > 0) {
        mieiVoti[ministero] = mieiVotiResult.rows[0].nome;
      }

      // Controlla blocco settimanale per questo ministero (Admin può sempre votare)
      const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);
      const userRole = userResult.rows[0]?.ruolo;

      if (userRole !== 'Admin') {
        const bloccoQuery = `
          SELECT 
            CASE 
              WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
              ELSE false
            END as is_blocked,
            MAX(timestamp) + INTERVAL '7 days' as unlock_date
          FROM ${tableName}
          WHERE userid = $1
        `;

        const bloccoResult = await pool.query(bloccoQuery, [userId]);
        if (bloccoResult.rows.length > 0 && bloccoResult.rows[0].is_blocked) {
          isBlocked = true;
          unlockDate = bloccoResult.rows[0].unlock_date;
        }
      }
    }

    console.log('🔍 DEBUG - Risposta API governo/voti:');
    console.log('📊 Classifiche:', Object.keys(classifiche).length, 'ministeri');
    console.log('👤 Miei voti:', Object.keys(mieiVoti).length, 'voti utente');
    console.log('🔒 Blocco:', { isBlocked, unlockDate });

    res.json({
      classifiche,
      mieiVoti,
      blocco: {
        isBlocked,
        unlockDate
      }
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

    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;

    if (userRole !== 'Admin') {
      let isBlocked = false;
      for (const ministero of ministeri) {
        const tableName = `voti_${ministero}`;
        const bloccoQuery = `
          SELECT 
            CASE 
              WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
              ELSE false
            END as is_blocked
          FROM ${tableName}
          WHERE userid = $1
        `;

        const bloccoResult = await pool.query(bloccoQuery, [userId]);
        if (bloccoResult.rows.length > 0 && bloccoResult.rows[0].is_blocked) {
          isBlocked = true;
          break;
        }
      }

      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: 'Non puoi modificare i voti più di una volta a settimana'
        });
      }
    }

    // Inizia transazione
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Elimina tutti i voti esistenti dell'utente da tutte le tabelle
      for (const ministero of ministeri) {
        const tableName = `voti_${ministero}`;
        await client.query(
          `DELETE FROM ${tableName} WHERE userid = $1`,
          [userId]
        );
      }

      // Inserisci i nuovi voti nelle tabelle appropriate
      for (const [categoria, nome] of Object.entries(voti)) {
        if (nome && nome.trim() && ministeri.includes(categoria)) {
          const tableName = `voti_${categoria}`;
          const nomeKey = nome.trim().toLowerCase();
          const nomeDisplay = nome.trim().split(' ').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');

          await client.query(
            `INSERT INTO ${tableName} (id, userid, nome_ministro, nome_display, timestamp) 
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
            [userId, nomeKey, nomeDisplay]
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
router.get('/ideale', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/governo/ideale - Richiesta governo ideale');
    const userId = req.userId;
    
    const governoIdeale = {};
    
    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];
    
    // Per ogni ministero, ottieni il voto dell'utente
    for (const ministero of ministeri) {
      const tableName = `voti_${ministero}`;
      
      try {
        const votoQuery = `
          SELECT nome_display
          FROM ${tableName}
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        
        const votoResult = await pool.query(votoQuery, [userId]);
        if (votoResult.rows.length > 0) {
          governoIdeale[ministero] = votoResult.rows[0].nome_display;
        }
      } catch (error) {
        console.warn(`⚠️ Errore per ministero ${ministero}:`, error.message);
        // Continua con gli altri ministeri
      }
    }
    
    console.log('🔍 DEBUG - Governo ideale recuperato:', governoIdeale);
    
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
