const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getPool } = require('../config/database');

const router = express.Router();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// GET /api/governo/ministro/:categoria/voti - Ottieni voti per un ministero specifico
router.get('/:categoria/voti', verifyToken, async (req, res) => {
  try {
    const { categoria } = req.params;
    const userId = req.userId;

    // Lista dei ministeri validi
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 'ambiente_sicurezza_energetica',
      'cultura', 'sport'
    ];

    if (!ministeri.includes(categoria)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria ministero non valida'
      });
    }

    // Query statiche per ciascuna categoria ammessa.
    const ministerQueries = {
      primo_ministro: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_primo_ministro WHERE userid = $1`,
        delete: 'DELETE FROM voti_primo_ministro WHERE userid = $1',
        insert: 'INSERT INTO voti_primo_ministro (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      difesa: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_difesa WHERE userid = $1`,
        delete: 'DELETE FROM voti_difesa WHERE userid = $1',
        insert: 'INSERT INTO voti_difesa (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      economia: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_economia WHERE userid = $1`,
        delete: 'DELETE FROM voti_economia WHERE userid = $1',
        insert: 'INSERT INTO voti_economia (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      esteri: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_esteri WHERE userid = $1`,
        delete: 'DELETE FROM voti_esteri WHERE userid = $1',
        insert: 'INSERT INTO voti_esteri (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      giustizia: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_giustizia WHERE userid = $1`,
        delete: 'DELETE FROM voti_giustizia WHERE userid = $1',
        insert: 'INSERT INTO voti_giustizia (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      interno: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_interno WHERE userid = $1`,
        delete: 'DELETE FROM voti_interno WHERE userid = $1',
        insert: 'INSERT INTO voti_interno (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      istruzione: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_istruzione WHERE userid = $1`,
        delete: 'DELETE FROM voti_istruzione WHERE userid = $1',
        insert: 'INSERT INTO voti_istruzione (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      lavoro: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_lavoro WHERE userid = $1`,
        delete: 'DELETE FROM voti_lavoro WHERE userid = $1',
        insert: 'INSERT INTO voti_lavoro (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      salute: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_salute WHERE userid = $1`,
        delete: 'DELETE FROM voti_salute WHERE userid = $1',
        insert: 'INSERT INTO voti_salute (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      trasporti: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_trasporti WHERE userid = $1`,
        delete: 'DELETE FROM voti_trasporti WHERE userid = $1',
        insert: 'INSERT INTO voti_trasporti (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      ambiente: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_ambiente WHERE userid = $1`,
        delete: 'DELETE FROM voti_ambiente WHERE userid = $1',
        insert: 'INSERT INTO voti_ambiente (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      ambiente_sicurezza_energetica: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_ambiente_sicurezza_energetica WHERE userid = $1`,
        delete: 'DELETE FROM voti_ambiente_sicurezza_energetica WHERE userid = $1',
        insert: 'INSERT INTO voti_ambiente_sicurezza_energetica (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      cultura: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_cultura WHERE userid = $1`,
        delete: 'DELETE FROM voti_cultura WHERE userid = $1',
        insert: 'INSERT INTO voti_cultura (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      },
      sport: {
        block: `SELECT CASE WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true ELSE false END as is_blocked FROM voti_sport WHERE userid = $1`,
        delete: 'DELETE FROM voti_sport WHERE userid = $1',
        insert: 'INSERT INTO voti_sport (id, userid, nome_ministro, nome_display, timestamp) VALUES (gen_random_uuid(), $1, $2, $3, NOW())'
      }
    };
    const selectedQueries = ministerQueries[categoria];

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

    // Verifica se l'utente è admin (A, AD, Admin)
    const isAdmin = userRole === 'Admin' || userRole === 'AD' || userRole === 'A';

    let blocco = { is_blocked: false, unlock_date: null };
    
    if (!isAdmin) {
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
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 'ambiente_sicurezza_energetica',
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
    
    // Verifica se l'utente è admin (A, AD, Admin)
    const isAdmin = userRole === 'Admin' || userRole === 'AD' || userRole === 'A';
    
    if (!isAdmin) {
      const bloccoQuery = selectedQueries.block;

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
        selectedQueries.delete,
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
            selectedQueries.insert,
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
