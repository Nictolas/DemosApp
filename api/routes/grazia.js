const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const { getGraziaCatalogRevision, mergeGraziaRanking, canonicalizeGraziaVotes, displayGraziaName, isHiddenGraziaName, normalizeGraziaName } = require('../services/graziaCatalog');
const { parseGraziaAvatarConfig } = require('../services/graziaAvatarConfig');

const router = express.Router();

// POST /api/grazia - Crea richiesta di grazia
router.post('/', verifyToken, requireAdmin, validateInput(['nome_carcerato', 'motivo']), async (req, res) => {
  try {
    const { nome_carcerato, motivo } = req.body;
    const userId = req.userId;

    const query = `
      INSERT INTO richieste_grazia (utente_id, nome_carcerato, motivo, stato, created_at)
      VALUES ($1, $2, $3, 'in_attesa', NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [userId, nome_carcerato, motivo]);

    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta grazia'
    });
  }
});

// GET /api/grazia - Ottieni richieste di grazia
router.get('/', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/grazia');

    // Tutti gli utenti autenticati possono aprire Grazia, ma il catalogo
    // privato e i relativi avatar sono visibili soltanto all'Admin.
    const userId = req.userId;
    const isAdmin = req.user?.isAdmin === true;

    // Il feed pubblico espone soltanto risultati aggregati. I voti personali
    // (userid, timestamp e preferenze) non devono essere restituiti a terzi.

    // Metadati della selezione pubblicata nel JSON versionato; approvazioni,
    // disattivazioni e voti rimangono nel DB. Anche i nomi da vecchi voti
    // continuano a comparire per non perdere le richieste già registrate,
    // ma NON vengono promossi automaticamente nel codice.
    const votiCountQuery = `
      SELECT BTRIM(nome) AS nome, COUNT(*)::bigint AS richieste
      FROM voti_grazia
      WHERE nome IS NOT NULL AND LENGTH(BTRIM(nome)) > 0
      GROUP BY BTRIM(nome)
    `;
    const [votesResult, approvedResult] = await Promise.all([
      pool.query(votiCountQuery),
      pool.query('SELECT id, nome, attivo, pubblicato FROM grazia_carcerati')
    ]);
    const allClassifica = mergeGraziaRanking(votesResult.rows, approvedResult.rows);
    // Default PRIVATO, anche per nomi nel codice o presenti in voti storici.
    const publicNames = new Set(approvedResult.rows
      .filter(item => item.attivo === true && item.pubblicato === true)
      .map(item => normalizeGraziaName(displayGraziaName(item.nome))));
    const classifica = isAdmin
      ? allClassifica
      : allClassifica.filter(item => publicNames.has(normalizeGraziaName(item.nome)));
    const avatarNames = isAdmin ? classifica.map(item => normalizeGraziaName(item.nome)) : [];
    const avatarRows = avatarNames.length
      ? await pool.query(
        'SELECT nome_key, avatar_config FROM public.grazia_avatar_configs WHERE nome_key = ANY($1::text[])',
        [avatarNames]
      )
      : { rows: [] };
    const avatarsByName = new Map(avatarRows.rows.map(row => [row.nome_key, row.avatar_config]));
    const classificaConAvatar = classifica.map(item => ({
      ...item,
      ...(isAdmin ? { pubblicato: publicNames.has(normalizeGraziaName(item.nome)) } : {}),
      // Fino a verifica distinta del diritto all'immagine, nessun avatar al pubblico.
      avatar_config: isAdmin ? (avatarsByName.get(normalizeGraziaName(item.nome)) || null) : null
    }));

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
      classifica: classificaConAvatar,
      catalogRevision: getGraziaCatalogRevision(),
      richieste: [], // Compatibilità legacy, senza esporre voti personali
      mieiVoti: canonicalizeGraziaVotes(
        isAdmin ? mieiVoti : mieiVoti.filter(nome =>
          publicNames.has(normalizeGraziaName(displayGraziaName(nome)))),
        classifica
      ),
      blocco
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// PUT /api/grazia/pubblicazione — Rende visibile soltanto il nominativo autorizzato.
// La verifica di autorizzazioni e base giuridica resta un atto dell'Admin: mai
// pubblicare automaticamente da votazioni, cataloghi statici o proposte utenti.
router.put('/pubblicazione', verifyToken, requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  const rawName = req.body?.nome;
  const pubblicato = req.body?.pubblicato;
  if (typeof rawName !== 'string' || !rawName.trim() || rawName.length > 150 ||
      typeof pubblicato !== 'boolean' ||
      (pubblicato && req.body?.verifiche_confermate !== true)) {
    return res.status(400).json({ success: false, error: 'Dati o conferma delle verifiche mancanti' });
  }
  const name = displayGraziaName(rawName.normalize('NFKC').trim().replace(/\\s+/g, ' '));
  if (isHiddenGraziaName(name)) {
    return res.status(404).json({ success: false, error: 'Soggetto non disponibile' });
  }
  try {
    const [votesResult, approvedResult] = await Promise.all([
      pool.query(`SELECT BTRIM(nome) AS nome, COUNT(*)::bigint AS richieste
        FROM public.voti_grazia WHERE NULLIF(BTRIM(nome), '') IS NOT NULL GROUP BY BTRIM(nome)`),
      pool.query('SELECT id, nome, attivo FROM public.grazia_carcerati')
    ]);
    const ranking = mergeGraziaRanking(votesResult.rows, approvedResult.rows);
    if (!ranking.some(item => normalizeGraziaName(item.nome) === normalizeGraziaName(name))) {
      return res.status(404).json({ success: false, error: 'Soggetto non disponibile' });
    }
    const result = await pool.query(
      `INSERT INTO public.grazia_carcerati (nome, attivo, pubblicato)
       VALUES ($1, TRUE, $2)
       ON CONFLICT (lower(btrim(nome))) DO UPDATE
       SET pubblicato = EXCLUDED.pubblicato
       RETURNING pubblicato`,
      [name, pubblicato]
    );
    return res.json({ success: true, pubblicato: result.rows[0]?.pubblicato === true });
  } catch (error) {
    console.error('Aggiornamento visibilità Grazia non disponibile (dettagli omessi)');
    return res.status(503).json({ success: false, error: 'Aggiornamento visibilità non disponibile' });
  }
});

// PUT /api/grazia/avatar — Configurazione editor grafico, solo Admin verificato.
// Il nome viene associato a una voce già presente nella classifica pubblica;
// mai creare un profilo utente fittizio o serializzare una preferenza individuale.
router.put('/avatar', verifyToken, requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const rawName = req.body?.nome;
  const avatarConfig = parseGraziaAvatarConfig(req.body?.avatar_config);
  if (typeof rawName !== 'string' || rawName.length > 150 || !rawName.trim() || !avatarConfig) {
    return res.status(400).json({ success: false, error: 'Configurazione avatar non valida' });
  }
  const name = displayGraziaName(rawName.normalize('NFKC').trim().replace(/\s+/g, ' '));
  if (isHiddenGraziaName(name)) {
    return res.status(404).json({ success: false, error: 'Soggetto non disponibile' });
  }
  try {
    const [votesResult, approvedResult] = await Promise.all([
      pool.query(`SELECT BTRIM(nome) AS nome, COUNT(*)::bigint AS richieste
        FROM public.voti_grazia
        WHERE NULLIF(BTRIM(nome), '') IS NOT NULL
        GROUP BY BTRIM(nome)`),
      pool.query('SELECT id, nome, attivo FROM public.grazia_carcerati')
    ]);
    const published = mergeGraziaRanking(votesResult.rows, approvedResult.rows);
    if (!published.some(item => normalizeGraziaName(item.nome) === normalizeGraziaName(name))) {
      return res.status(404).json({ success: false, error: 'Soggetto non disponibile' });
    }
    await pool.query(
      `INSERT INTO public.grazia_avatar_configs (nome_key, avatar_config, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (nome_key) DO UPDATE
       SET avatar_config = EXCLUDED.avatar_config, updated_at = now()`,
      [normalizeGraziaName(name), JSON.stringify(avatarConfig)]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Errore salvataggio avatar Grazia (dettagli omessi)');
    return res.status(503).json({ success: false, error: 'Salvataggio avatar non disponibile' });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
router.get('/richieste', verifyToken, requireAdmin, async (req, res) => {
  try {
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
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

    const requestedVotes = voti.slice(0, 1).map((nome) => displayGraziaName(String(nome).trim())).filter(Boolean);
    // Le votazioni degli utenti ordinari possono riguardare SOLO nomi già
    // pubblicati singolarmente. Nessuna proposta privata va resa nota via API.
    if (requestedVotes.some(isHiddenGraziaName)) {
      return res.status(400).json({ success: false, error: 'Nome non disponibile nella classifica Grazia' });
    }
    if (!req.user?.isAdmin && requestedVotes.length > 0) {
      const publicVote = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM public.grazia_carcerati
           WHERE attivo = TRUE AND pubblicato = TRUE
             AND lower(btrim(nome)) = lower(btrim($1))
         ) AS allowed`,
        [requestedVotes[0]]
      );
      if (publicVote.rows[0]?.allowed !== true) {
        return res.status(403).json({ success: false, error: 'Puoi votare solo persone pubblicate' });
      }
    }
    const existingResult = await pool.query(
      `SELECT nome, ${timestampColumn} AS changed_at
       FROM voti_grazia
       WHERE ${userIdColumn} = $1
       ORDER BY ${timestampColumn} DESC`,
      [userId]
    );
    const currentVotes = existingResult.rows.map((row) => displayGraziaName(String(row.nome || '').trim())).filter(Boolean).slice(0, 1);
    const requestedVote = requestedVotes[0] || null;
    const currentVote = currentVotes[0] || null;

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

// POST /api/grazia/richiesta/:id/:action - Gestisci richiesta grazia
router.post('/richiesta/:id/:action', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;

    if (action === 'approve') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }

    res.json({ success: true, message: `Richiesta ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta grazia'
    });
  }
});

module.exports = router;
