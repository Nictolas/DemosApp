const express = require('express');
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET /api/governo/ministro/:categoria/voti - Ottieni voti per un ministero specifico
router.get('/:categoria/voti', verifyToken, async (req, res) => {
  try {
    const { categoria } = req.params;
    const userId = req.userId;

    // Ottieni la classifica dei candidati per questo ministero
    const classificaQuery = `
      SELECT 
        nome_display as nome,
        COUNT(*) as voti
      FROM voti_ministri 
      WHERE categoria = $1
      GROUP BY nome_display
      ORDER BY voti DESC, nome_display ASC
    `;

    const classificaResult = await pool.query(classificaQuery, [categoria]);

    // Ottieni i voti dell'utente per questo ministero
    const mieiVotiQuery = `
      SELECT nome_display as nome
      FROM voti_ministri 
      WHERE utente_id = $1 AND categoria = $2
    `;

    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId, categoria]);
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    // Controlla se l'utente è bloccato (può votare solo una volta a settimana)
    const bloccoQuery = `
      SELECT 
        CASE 
          WHEN MAX(data_voto) > NOW() - INTERVAL '7 days' THEN true
          ELSE false
        END as is_blocked,
        MAX(data_voto) + INTERVAL '7 days' as unlock_date
      FROM voti_ministri 
      WHERE utente_id = $1 AND categoria = $2
    `;

    const bloccoResult = await pool.query(bloccoQuery, [userId, categoria]);
    const blocco = bloccoResult.rows[0] || { is_blocked: false, unlock_date: null };

    res.json({
      classifiche: classificaResult.rows,
      mieiVoti,
      blocco: {
        isBlocked: blocco.is_blocked,
        unlockDate: blocco.unlock_date
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare voti ministero:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare i voti del ministero'
    });
  }
});

// POST /api/governo/ministro/:categoria/vota - Salva voti per un ministero specifico
router.post('/:categoria/vota', verifyToken, async (req, res) => {
  try {
    const { categoria } = req.params;
    const { voti } = req.body;
    const userId = req.userId;

    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
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
      WHERE utente_id = $1 AND categoria = $2
    `;

    const bloccoResult = await pool.query(bloccoQuery, [userId, categoria]);
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

      // Elimina i voti esistenti per questo ministero
      await client.query(
        'DELETE FROM voti_ministri WHERE utente_id = $1 AND categoria = $2',
        [userId, categoria]
      );

      // Inserisci i nuovi voti
      for (const nome of voti) {
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
    console.error('❌ Errore nel salvare voti ministero:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare i voti del ministero'
    });
  }
});

module.exports = router;
