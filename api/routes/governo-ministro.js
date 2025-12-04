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

    // Lista dei ministeri validi
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];

    if (!ministeri.includes(categoria)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria ministero non valida'
      });
    }

    const tableName = `voti_${categoria}`;

    // Ottieni la classifica dei candidati per questo ministero
    const classificaQuery = `
      SELECT 
        nome_display as nome,
        COUNT(*) as voti
      FROM ${tableName}
      GROUP BY nome_display
      ORDER BY voti DESC, nome_display ASC
    `;

    console.log(`🔍 DEBUG - Eseguendo query: ${classificaQuery}`);
    const classificaResult = await pool.query(classificaQuery);
    console.log(`🔍 DEBUG - Risultato query raw:`, classificaResult.rows);

    // Ottieni i voti dell'utente per questo ministero
    const mieiVotiQuery = `
      SELECT nome_display as nome
      FROM ${tableName}
      WHERE userid = $1
    `;

    const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
    const mieiVoti = mieiVotiResult.rows.map(row => row.nome);

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;

    let blocco = { is_blocked: false, unlock_date: null };
    
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
      blocco = bloccoResult.rows[0] || { is_blocked: false, unlock_date: null };
    }

    console.log(`🔍 DEBUG - Risposta API ministero/${categoria}/voti:`);
    console.log(`📊 Classifiche: ${classificaResult.rows.length} candidati`);
    console.log(`👤 Miei voti: ${mieiVoti.length} voti utente`);
    console.log(`🔒 Blocco:`, { isBlocked: blocco.is_blocked, unlockDate: blocco.unlock_date });
    console.log(`🔍 DEBUG - Dati classifiche:`, JSON.stringify(classificaResult.rows, null, 2));

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

    // Lista dei ministeri validi
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 
      'cultura', 'sport'
    ];

    if (!ministeri.includes(categoria)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria ministero non valida'
      });
    }

    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    const tableName = `voti_${categoria}`;

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;

    if (userRole !== 'Admin') {
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
      const isBlocked = bloccoResult.rows[0]?.is_blocked || false;

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

      // Elimina i voti esistenti per questo ministero
      await client.query(
        `DELETE FROM ${tableName} WHERE userid = $1`,
        [userId]
      );

      // Inserisci i nuovi voti
      for (const nome of voti) {
        if (nome && nome.trim()) {
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
      
      // Log per debug
      console.log(`✅ DEBUG - Voti salvati per categoria ${categoria}, userId: ${userId}`);
      console.log(`✅ DEBUG - Voti inseriti:`, voti);
      
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
