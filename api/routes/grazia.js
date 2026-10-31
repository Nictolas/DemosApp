const express = require('express');
const { randomUUID } = require('crypto');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const router = express.Router();

// POST /api/grazia - Registra una proposta privata, mai direttamente nel catalogo
router.post('/', verifyToken, async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const urlProva = typeof req.body?.urlProva === 'string' ? req.body.urlProva.trim() : '';
  if (nome.length < 3 || nome.length > 160) {
    return res.status(400).json({ success: false, error: 'Nome non valido (3-160 caratteri)' });
  }
  // Accettiamo solo link a fonti HTTPS pubbliche; mai copia di sentenze o allegati.
  try {
    const url = new URL(urlProva);
    if (url.protocol !== 'https:' || url.username || url.password || urlProva.length > 2000) throw new Error('URL non consentito');
  } catch {
    return res.status(400).json({ success: false, error: 'Inserisci un collegamento HTTPS pubblico valido' });
  }
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializza gli invii concorrenti dello stesso account: max una pendente.
    const owner = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!owner.rows.length) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, error: 'Utente non trovato' });
    }
    const pending = await client.query(
      "SELECT id FROM richieste_grazia WHERE utente_id = $1 AND status = 'pending' LIMIT 1",
      [userId]
    );
    if (pending.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Hai già una proposta di Grazia in attesa' });
    }
    const duplicate = await client.query(
      'SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER(BTRIM(nome)) = LOWER($1) LIMIT 1', [nome]
    );
    if (duplicate.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Questo soggetto è già presente' });
    }
    const id = randomUUID();
    await client.query(
      "INSERT INTO richieste_grazia (id, utente_id, nome, url_prova, status, data_creazione) VALUES ($1,$2,$3,$4,'pending',NOW())",
      [id, userId, nome, urlProva]
    );
    // Notifica in-app, senza dati penali o nominativi in anteprima.
    await client.query(
      "INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data_creazione, data) SELECT gen_random_uuid(), id, 'DEMOS — Nuova proposta', 'Una proposta Grazia è in attesa di revisione.', NOW(), CURRENT_DATE FROM users WHERE is_admin = true AND status = 'a'"
    );
    await client.query('COMMIT');
    return res.status(202).json({ success: true, richiesta: { id, status: 'pending' } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Errore salvataggio richiesta Grazia:', error.code || error.message);
    return res.status(500).json({ success: false, error: 'Impossibile registrare la proposta' });
  } finally {
    client.release();
  }
});

// GET /api/grazia - Ottieni richieste di grazia
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/grazia');

    // Recupera userId se autenticato (opzionale)
    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log(`🔍 DEBUG: Utente autenticato: ${userId}`);
      } catch (authError) {
        console.log('⚠️ Token non valido o assente, continuando senza autenticazione');
      }
    }

    // Il feed pubblico espone soltanto risultati aggregati. I voti personali
    // (userid, timestamp e preferenze) non devono essere restituiti a terzi.

    // La classifica include anche i carcerati inseriti dagli amministratori,
    // senza attribuire loro voti fittizi. Il catalogo è separato dalle preferenze.
    // Solo i soggetti esplicitamente approvati sono visibili; i voti legacy
    // restano conservati per riconciliazione, ma non pubblicano nuove persone.
    const classificaQuery =
      'SELECT c.nome, COUNT(v.id)::integer AS richieste FROM grazia_carcerati c ' +
      'LEFT JOIN voti_grazia v ON LOWER(BTRIM(v.nome)) = LOWER(BTRIM(c.nome)) ' +
      'WHERE c.attivo = true GROUP BY c.id, c.nome ORDER BY richieste DESC, c.nome ASC';
    const classificaResult = await pool.query(classificaQuery);
    console.log(`✅ Classifica creata con ${classificaResult.rows.length} carcerati`);

    // Recupera i voti dell'utente se autenticato
    let mieiVoti = [];
    let blocco = { isBlocked: false, unlockDate: null };
    if (userId) {
      try {
        // Rileva la struttura della tabella per capire quale colonna usare
        let userIdColumn = 'user_id';
        let timestampColumn = 'timestamp';

        try {
          const tableInfoQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE LOWER(table_name) = 'voti_grazia'
            ORDER BY ordinal_position
          `;
          const tableInfo = await pool.query(tableInfoQuery);

          const columns = tableInfo.rows.map(r => r.column_name);
          const hasUserId = columns.includes('user_id');
          const hasUserid = columns.includes('userid');
          userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'user_id' : 'user_id');

          // Rileva quale colonna timestamp usare
          if (columns.includes('timestamp')) {
            timestampColumn = 'timestamp';
          } else if (columns.includes('data_voto')) {
            timestampColumn = 'data_voto';
          } else if (columns.includes('created_at')) {
            timestampColumn = 'created_at';
          }

          console.log(`🔍 DEBUG GET - Colonna userId usata: ${userIdColumn}, timestamp: ${timestampColumn}`);
        } catch (tableInfoError) {
          console.log('⚠️ DEBUG GET - Impossibile rilevare struttura tabella, uso default:', tableInfoError.message);
        }

        const mieiVotiQuery = `
          SELECT nome
          FROM voti_grazia
          WHERE ${userIdColumn} = $1
          ORDER BY ${timestampColumn} DESC
        `;
        const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
        mieiVoti = mieiVotiResult.rows.map(row => row.nome);
        console.log(`✅ Recuperati ${mieiVoti.length} voti per utente ${userId} usando colonna ${userIdColumn}`);

        const lastChangeResult = await pool.query(
          `SELECT MAX(${timestampColumn}) AS last_changed_at FROM voti_grazia WHERE ${userIdColumn} = $1`,
          [userId]
        );
        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'grazia:preferenza',
          fallbackChangedAt: lastChangeResult.rows[0]?.last_changed_at || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
      } catch (error) {
        console.error('⚠️ Errore nel recuperare voti utente:', error);
        console.error('⚠️ Stack trace:', error.stack);
        // Continua senza voti utente
      }
    }

    res.json({
      success: true,
      classifica: classificaResult.rows,
      richieste: [], // Compatibilità legacy, senza esporre voti personali
      mieiVoti: mieiVoti,
      blocco
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia',
      details: error.message
    });
  }
});

// GET /api/grazia/richieste - Solo Admin: coda privata reale
router.get('/richieste', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nome, url_prova AS \"urlProva\", utente_id AS \"userId\", data_creazione AS \"createdAt\" FROM richieste_grazia WHERE status = 'pending' ORDER BY data_creazione ASC LIMIT 100"
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Errore coda Grazia:', error.code || error.message);
    return res.status(500).json({ success: false, error: 'Coda richieste non disponibile' });
  }
});

// GET /api/grazia/mia-proposta - Stato della propria proposta, mai dati di altri
router.get('/mia-proposta', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, status, data_creazione FROM richieste_grazia WHERE utente_id = $1 ORDER BY data_creazione DESC LIMIT 1',
      [req.user.id]
    );
    return res.json({ success: true, richiesta: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Stato proposta non disponibile' });
  }
});

// POST /api/grazia/vota - Salva voti grazia
router.post('/vota', verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {
  console.log('🚨🚨🚨 POST /api/grazia/vota - RICHIESTA RICEVUTA 🚨🚨🚨');

  try {
    const { voti } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;

    if (!userId) {
      console.log('❌ DEBUG - User ID non trovato');
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }

    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    // Limita a massimo 1 voto come da limite configurato
    if (voti.length > 1) {
      console.log('❌ DEBUG - Troppi voti:', voti.length);
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 carcerato per Grazia'
      });
    }

    // Rileva la struttura della tabella per capire quale colonna usare
    let userIdColumn = 'user_id';
    let idType = 'uuid'; // Default a UUID
    let timestampColumn = 'timestamp'; // Default a timestamp

    try {
      const tableInfoQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE LOWER(table_name) = 'voti_grazia'
        ORDER BY ordinal_position
      `;
      const tableInfo = await pool.query(tableInfoQuery);
      console.log('🔍 DEBUG - Colonne tabella:', tableInfo.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

      const columns = tableInfo.rows.map(r => r.column_name);
      const hasUserId = columns.includes('user_id');
      const hasUserid = columns.includes('userid');
      userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'user_id' : 'user_id');

      // Rileva il tipo della colonna id
      const idColumn = tableInfo.rows.find(r => r.column_name === 'id');
      if (idColumn) {
        idType = idColumn.data_type;
        console.log('🔍 DEBUG - Tipo id rilevato:', idType);
      }

      // Rileva quale colonna timestamp usare
      if (columns.includes('timestamp')) {
        timestampColumn = 'timestamp';
      } else if (columns.includes('data_voto')) {
        timestampColumn = 'data_voto';
      } else if (columns.includes('created_at')) {
        timestampColumn = 'created_at';
      }
    } catch (tableInfoError) {
      console.log('⚠️ DEBUG - Impossibile rilevare struttura tabella, uso default:', tableInfoError.message);
    }

    console.log('🔍 DEBUG - Colonna userId usata:', userIdColumn);
    console.log('🔍 DEBUG - Tipo id usato:', idType);
    console.log('🔍 DEBUG - Colonna timestamp usata:', timestampColumn);

    const requestedVotes = voti.slice(0, 1).map((nome) => String(nome).trim()).filter(Boolean);
    const existingResult = await pool.query(
      `SELECT nome, ${timestampColumn} AS changed_at
       FROM voti_grazia
       WHERE ${userIdColumn} = $1
       ORDER BY ${timestampColumn} DESC`,
      [userId]
    );
    const currentVotes = existingResult.rows.map((row) => String(row.nome || '').trim()).filter(Boolean).slice(0, 1);
    const requestedVote = requestedVotes[0] || null;
    const currentVote = currentVotes[0] || null;

    if (requestedVote) {
      const allowed = await pool.query(
        'SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER(BTRIM(nome)) = LOWER($1) LIMIT 1',
        [requestedVote]
      );
      if (!allowed.rows.length) {
        return res.status(422).json({ success: false, error: 'Soggetto non approvato per la votazione' });
      }
    }

    if (requestedVote === currentVote) {
      return res.json({ success: true, message: 'Preferenza Grazia già aggiornata' });
    }

    await assertPreferenceChangeAllowed(pool, {
      userId,
      scope: 'grazia:preferenza',
      fallbackChangedAt: existingResult.rows[0]?.changed_at || null,
      isAdmin: Boolean(req.user?.isAdmin)
    });

    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Elimina i voti esistenti
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteQuery = `DELETE FROM voti_grazia WHERE ${userIdColumn} = $1`;
      const deleteResult = await client.query(deleteQuery, [userId]);
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);

      // Inserisci i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);

        for (const nome of requestedVotes) {
          // Genera ID in base al tipo della colonna
          let votoId;
          if (idType === 'uuid') {
            // Se la colonna è UUID, genera un UUID
            const uuidResult = await client.query('SELECT gen_random_uuid() as id');
            votoId = uuidResult.rows[0].id;
          } else {
            // Se è VARCHAR o TEXT, usa una stringa
            votoId = `voto_grazia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }


          // Inserisci il voto
          const insertQuery = `
            INSERT INTO voti_grazia (id, ${userIdColumn}, nome, ${timestampColumn})
            VALUES ($1, $2, $3, NOW())
          `;
          const insertParams = [votoId, userId, nome];

          await client.query(insertQuery, insertParams);
          console.log('✅ DEBUG - Voto inserito con successo');
        }
      }

      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await recordPreferenceChange(client, { userId, scope: 'grazia:preferenza' });

      await client.query('COMMIT');

      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({ success: true, message: 'Voti grazia salvati' });
    } catch (error) {
      // Rollback in caso di errore
      console.error('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      console.error('❌ DEBUG - Stack trace:', error.stack);
      console.error('❌ DEBUG - Error code:', error.code);
      console.error('❌ DEBUG - Error detail:', error.detail);
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ DEBUG - Errore durante rollback:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
      console.log('🔍 DEBUG - Client rilasciato');
    }
  } catch (error) {
    if (sendCooldownError(res, error)) return;
    console.error('❌❌❌ ERRORE CRITICO nel salvataggio voti grazia ❌❌❌');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error stack:', error.stack);

    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia',
      details: error.message,
      code: error.code
    });
  }
});

// POST /api/grazia/richiesta/:id/:action - Decisione moderazione solo Admin
router.post('/richiesta/:id/:action', verifyToken, requireAdmin, async (req, res) => {
  const action = req.params.action;
  const approved = action === 'accetta' || action === 'approve';
  if (!approved && action !== 'rifiuta' && action !== 'reject') {
    return res.status(400).json({ success: false, error: 'Azione non valida' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      "SELECT id, nome, utente_id FROM richieste_grazia WHERE id = $1 AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Richiesta assente o già elaborata' });
    }
    const richiesta = result.rows[0];
    if (approved) {
      await client.query('INSERT INTO grazia_carcerati (nome, attivo) VALUES ($1,true) ON CONFLICT DO NOTHING', [richiesta.nome]);
      await client.query('UPDATE grazia_carcerati SET attivo = true WHERE LOWER(BTRIM(nome)) = LOWER(BTRIM($1))', [richiesta.nome]);
    }
    const status = approved ? 'approved' : 'rejected';
    await client.query("UPDATE richieste_grazia SET status = $1 WHERE id = $2 AND status = 'pending'", [status, richiesta.id]);
    await client.query(
      "INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data_creazione, data) SELECT gen_random_uuid(), id, 'DEMOS — Esito proposta', $2, NOW(), CURRENT_DATE FROM users WHERE id::text = $1",
      [richiesta.utente_id, approved ? 'La tua proposta Grazia è stata approvata.' : 'La tua proposta Grazia non è stata approvata.']
    );
    await client.query('COMMIT');
    return res.json({ success: true, status });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Errore revisione richiesta Grazia:', error.code || error.message);
    return res.status(500).json({ success: false, error: 'Decisione non applicata' });
  } finally {
    client.release();
  }
});

module.exports = router;
