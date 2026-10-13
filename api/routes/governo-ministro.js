const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getPool } = require('../config/database');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

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

    // Il privilegio Admin deriva dalle capability risolte da verifyToken.
    const isAdmin = Boolean(req.user?.isAdmin);

    let blocco = { is_blocked: false, unlock_date: null };

    if (!isAdmin) {
      const lastChangeResult = await pool.query(
        `SELECT MAX(timestamp) AS last_changed_at FROM ${tableName} WHERE userid = $1`,
        [userId]
      );
      const cooldown = await getPreferenceCooldown(pool, {
        userId,
        scope: `governo:${categoria}`,
        fallbackChangedAt: lastChangeResult.rows[0]?.last_changed_at || null
      });
      blocco = { is_blocked: cooldown.isBlocked, unlock_date: cooldown.unlockDate };
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

    // Il privilegio Admin deriva dalle capability risolte da verifyToken.
    const isAdmin = Boolean(req.user?.isAdmin);
    const requestedVotes = [...new Set(voti.filter(Boolean).map((nome) => String(nome).trim()).filter(Boolean))];
    const existingResult = await pool.query(
      `SELECT nome_display AS nome, timestamp
       FROM ${tableName}
       WHERE userid = $1
       ORDER BY timestamp DESC`,
      [userId]
    );
    const currentVotes = [...new Set(existingResult.rows.map((row) => String(row.nome || '').trim()).filter(Boolean))];
    const samePreference =
      currentVotes.length === requestedVotes.length &&
      [...currentVotes].sort().every((value, index) => value === [...requestedVotes].sort()[index]);

    if (samePreference) {
      return res.json({ success: true, message: 'Preferenza già aggiornata' });
    }

    const lastChangedAt = existingResult.rows
      .map((row) => row.timestamp)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: `governo:${categoria}`,
      fallbackChangedAt: lastChangedAt,
      isAdmin
    });

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
      for (const nome of requestedVotes) {
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

      await recordPreferenceChange(client, { userId, scope: `governo:${categoria}` });

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
    if (sendCooldownError(res, error)) return;
    console.error('❌ Errore nel salvare voti ministero:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare i voti del ministero'
    });
  }
});

module.exports = router;
