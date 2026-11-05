const express = require('express');
const { randomUUID } = require('crypto');
const { validateEvidenceUrl } = require('../utils/recognitionEvidence');
const { isNominationWriteEnabled, rejectUnavailableNomination } = require('../utils/thirdPartyNominationGate');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');

const router = express.Router();

// Cache only a validated pair of schema column names, never user data.
// One metadata lookup per worker/schema version instead of once per viewer.
// A rejected lookup is not cached; an undefined-column query triggers re-probe.
let voteColumnsPromise = null;
function getGraziaVoteColumns() {
  if (!voteColumnsPromise) {
    voteColumnsPromise = pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='voti_grazia'"
    ).then(result => {
      const columns = new Map(result.rows.map(row => [row.column_name, row.data_type]));
      const user = columns.has('userid') ? 'userid' : columns.has('user_id') ? 'user_id' : null;
      const date = ['timestamp', 'data_voto', 'created_at'].find(name => columns.has(name));
      // In production, a missing ID column or unrecognized type must not
      // cause a personal vote to be written using a guessed schema.
      const idType = columns.get('id');
      // Reading existing preferences does not need an ID column at all.
      // Validate its type only when a personal vote will be written.
      if (!user || !date) throw new Error('GRAZIA_VOTE_SCHEMA_UNRECOGNIZED');
      return { user, date, idType };
    }).catch(error => {
      voteColumnsPromise = null;
      throw error;
    });
  }
  return voteColumnsPromise;
}

// Prevent browser/CDN caching of political selections and third-party proposals.
const personalNoStore = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
};

// POST /api/grazia - Registra una proposta privata, mai direttamente nel catalogo
router.post('/', personalNoStore, verifyToken, async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const urlProva = typeof req.body?.urlProva === 'string' ? req.body.urlProva.trim() : '';
  if (nome.length < 3 || nome.length > 160) {
    return res.status(400).json({ success: false, error: 'Nome non valido (3-160 caratteri)' });
  }
  // Accettiamo solo link a fonti HTTPS pubbliche; mai copia di sentenze o allegati.
  // No fetch is performed. Reject private/loopback URLs before persistence
  // so moderators only receive plausible publicly accessible sources.
  if (urlProva.length > 2000 || !validateEvidenceUrl(urlProva)) {
    return res.status(400).json({ success: false, error: 'Inserisci un collegamento HTTPS pubblico valido' });
  }
  if (!isNominationWriteEnabled()) return rejectUnavailableNomination(res);
  const userId = req.user.id;
  let client;
  try {
    client = await pool.connect();
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
    // Requests from distinct users need the same per-name transaction lock.
    // The per-user row lock above protects only that user's pending slot.
    // A stable, canonical name key serializes parallel submissions without
    // exposing a third-party name in logs or adding a second queue.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended(lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))), 12004))",
      [nome]
    );
    const alreadyProposed = await client.query(
      "SELECT id FROM richieste_grazia WHERE status IN ('pending','approved') AND withdrawn_at IS NULL AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) LIMIT 1",
      [nome]
    );
    if (alreadyProposed.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({success:false,error:'Questo soggetto è già stato proposto'});
    }
    // A withdrawn person cannot be re-proposed automatically by another user.
    // Keep the original Grazia request as the only audit record.
    const retired = await client.query(
      "SELECT 1 FROM richieste_grazia WHERE withdrawn_at IS NOT NULL AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) LIMIT 1",
      [nome]
    );
    if (retired.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({success:false,error:'Soggetto non riproponibile'});
    }
    const duplicate = await client.query(
      "SELECT id FROM grazia_carcerati WHERE lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) LIMIT 1", [nome]
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
    // Commit the proposal before any best-effort notification. A push/inbox
    // outage must not erase an already validated and accepted request.
    await client.query('COMMIT');
    // Release before acquiring another pool connection for the best-effort
    // notice. In a pool with max=1, retaining it could block the HTTP reply.
    client.release();
    client = null;
    let notificationSent = false;
    try {
      const notice = await pool.query(
        "INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data_creazione, data) SELECT gen_random_uuid(), id, 'DEMOS — Nuova proposta', 'Una proposta Grazia è in attesa di revisione.', NOW(), CURRENT_DATE FROM users WHERE is_admin = true AND status = 'a'"
      );
      // INSERT ... SELECT can succeed with zero rows when no Admin is active.
      // Do not report a notification that was never inserted.
      notificationSent = (notice.rowCount || 0) > 0;
    } catch {
      console.error('Grazia admin notification unavailable after commit');
    }
    return res.status(202).json({
      success: true, richiesta: { id, status: 'pending' }, notification_sent: notificationSent
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, error: 'Impossibile registrare la proposta' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/grazia - Ottieni richieste di grazia
router.get('/', personalNoStore, async (req, res) => {
  try {

    // Recupera userId se autenticato (opzionale)
    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (authError) {
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

    // Recupera i voti dell'utente se autenticato
    let mieiVoti = [];
    let blocco = { isBlocked: false, unlockDate: null };
    if (userId) {
      try {
        const { user: userIdColumn, date: timestampColumn } = await getGraziaVoteColumns();
        // MAX OVER gives the same cooldown fallback as the old second query,
        // without an additional database round trip. Empty votes => null.
        const mieiVotiQuery = `
          SELECT nome, MAX(${timestampColumn}) OVER () AS last_changed_at
          FROM voti_grazia
          WHERE ${userIdColumn} = $1
          ORDER BY ${timestampColumn} DESC
        `;
        const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
        mieiVoti = mieiVotiResult.rows.map(row => row.nome);
        const cooldown = await getPreferenceCooldown(pool, {
          userId,
          scope: 'grazia:preferenza',
          fallbackChangedAt: mieiVotiResult.rows[0]?.last_changed_at || null
        });
        blocco = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
      } catch (error) {
        // A schema migration may have renamed a previously cached column.
        // Do not cache a failed mapping or log tokens, user IDs or votes.
        if (error?.code === '42703') voteColumnsPromise = null;
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
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// GET /api/grazia/richieste - Solo Admin: coda privata reale
router.get('/richieste', personalNoStore, verifyToken, requireAdmin, async (req, res) => {
  // Keep the existing array response for older clients. The new Admin panel
  // requests ?paged=1 and uses opaque cursors to reach all pending proposals.
  const paged = req.query.paged === '1';
  const cursor = paged ? parseGraziaAdminCursor(req.query.cursor) : null;
  if (cursor === false) return res.status(400).json({success:false,error:'Cursore non valido'});
  try {
    if (!paged) {
      const result = await pool.query(
        "SELECT id, nome, url_prova AS \"urlProva\", data_creazione AS \"createdAt\" FROM richieste_grazia WHERE status = 'pending' ORDER BY data_creazione ASC LIMIT 100"
      );
      return res.json(result.rows);
    }
    const result = await pool.query(
      `SELECT id, nome, url_prova AS "urlProva", data_creazione AS "createdAt",
              EXTRACT(EPOCH FROM data_creazione)::text AS cursor_epoch
       FROM richieste_grazia
       WHERE status='pending'
         AND ($1::numeric IS NULL OR (data_creazione,id::text) > (to_timestamp($1::numeric),$2::text))
       ORDER BY data_creazione ASC, id ASC LIMIT 101`,
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    return res.json({success:true,...graziaAdminPage(result.rows,'richieste')});
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Coda richieste non disponibile' });
  }
});

// GET /api/grazia/mia-proposta - Stato della propria proposta, mai dati di altri
router.get('/mia-proposta', personalNoStore, verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, CASE WHEN withdrawn_at IS NOT NULL THEN 'withdrawn' ELSE status END AS status, data_creazione FROM richieste_grazia WHERE utente_id = $1 ORDER BY data_creazione DESC LIMIT 1",
      [req.user.id]
    );
    return res.json({ success: true, richiesta: result.rows[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Stato proposta non disponibile' });
  }
});

// POST /api/grazia/vota - Salva voti grazia
router.post('/vota', personalNoStore, verifyToken, requireVerifiedCivicIdentity, requirePoliticalConsent, async (req, res) => {

  try {
    const { voti } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }

    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    // Limita a massimo 1 voto come da limite configurato
    if (voti.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 carcerato per Grazia'
      });
    }

    // Shared, cached metadata: one information_schema lookup per worker,
    // rather than one per private POST. Unknown schemas fail closed.
    const {user:userIdColumn, date:timestampColumn, idType} = await getGraziaVoteColumns();
    if (!['uuid','character varying','text'].includes(idType))
      throw new Error('GRAZIA_VOTE_SCHEMA_UNRECOGNIZED');

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
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Serialize a new vote with any concurrent Admin withdrawal. The
      // preliminary active check above can become stale before BEGIN.
      // FOR SHARE blocks the withdrawal's UPDATE until this vote commits;
      // if withdrawal committed first, the candidate is no longer allowed.
      if (requestedVote) {
        const stillActive = await client.query(
          'SELECT id FROM grazia_carcerati WHERE attivo = true AND LOWER(BTRIM(nome)) = LOWER($1) FOR SHARE',
          [requestedVote]
        );
        if (!stillActive.rows.length) {
          await client.query('ROLLBACK');
          return res.status(422).json({ success: false, error: 'Soggetto non approvato per la votazione' });
        }
      }

      // Elimina i voti esistenti
      const deleteQuery = `DELETE FROM voti_grazia WHERE ${userIdColumn} = $1`;
      const deleteResult = await client.query(deleteQuery, [userId]);

      // Inserisci i nuovi voti
      if (voti.length > 0) {

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
        }
      }

      // Conferma la transazione
      await recordPreferenceChange(client, { userId, scope: 'grazia:preferenza' });

      await client.query('COMMIT');

      res.json({ success: true, message: 'Voti grazia salvati' });
    } catch (error) {
      // Rollback in caso di errore
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // A live migration can rename a cached column. Do not keep stale SQL
    // identifiers across later personal vote requests.
    if (error?.code === '42703') voteColumnsPromise = null;
    if (sendCooldownError(res, error)) return;

    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia'
    });
  }
});

// Grazia keeps one canonical queue: richieste_grazia. The two Admin GETs
// are on-demand and never expose the proposer UUID or proof URL.
// Bounded, opaque keyset cursor. Keep the database's microsecond precision;
// using JavaScript Date would skip proposals reviewed in the same millisecond.
function parseGraziaAdminCursor(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string' || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(decoded) || decoded.length !== 2) return false;
    const [epoch, id] = decoded;
    if (typeof epoch !== 'string' || !/^\d{1,11}(?:\.\d{1,6})?$/.test(epoch) ||
        Number(epoch) > 4102444800 || typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/.test(id)) return false;
    return [epoch, id];
  } catch (_) { return false; }
}

function graziaAdminPage(rows, field) {
  const page = rows.slice(0, 100);
  return {
    [field]: page.map(({ cursor_epoch, ...entry }) => entry),
    next_cursor: rows.length > 100
      ? Buffer.from(JSON.stringify([page[page.length - 1].cursor_epoch, page[page.length - 1].id])).toString('base64url')
      : null
  };
}

// Admin-only, on-demand pagination. Do not select the proposer ID, proof URL,
// review notes, or personal votes from approved publication and audit listings.
router.get('/approvate', personalNoStore, verifyToken, requireAdmin, async (req,res) => {
  const cursor = parseGraziaAdminCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({success:false,error:'Cursore non valido'});
  try {
    const result=await pool.query(
      `SELECT id, nome, data_creazione AS "createdAt",
              EXTRACT(EPOCH FROM data_creazione)::text AS cursor_epoch
       FROM richieste_grazia
       WHERE status='approved' AND withdrawn_at IS NULL
         AND ($1::numeric IS NULL OR (data_creazione,id::text) < (to_timestamp($1::numeric),$2::text))
       ORDER BY data_creazione DESC, id DESC LIMIT 101`,
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    return res.json({success:true,...graziaAdminPage(result.rows,'richieste')});
  } catch (_) {
    return res.status(503).json({success:false,error:'Pubblicazioni Grazia non disponibili'});
  }
});

router.get('/ritiri-avvisi', personalNoStore, verifyToken, requireAdmin, async (req,res) => {
  const cursor = parseGraziaAdminCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({success:false,error:'Cursore non valido'});
  try {
    const result=await pool.query(
      `SELECT id, withdrawn_at, EXTRACT(EPOCH FROM withdrawn_at)::text AS cursor_epoch
       FROM richieste_grazia
       WHERE withdrawn_at IS NOT NULL AND withdraw_notification_sent IS DISTINCT FROM TRUE
         AND ($1::numeric IS NULL OR (withdrawn_at,id::text) < (to_timestamp($1::numeric),$2::text))
       ORDER BY withdrawn_at DESC, id DESC LIMIT 101`,
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    return res.json({success:true,...graziaAdminPage(result.rows,'ritiri')});
  } catch (_) {
    return res.status(503).json({success:false,error:'Verifica avvisi Grazia non disponibile'});
  }
});

// A previously approved request is the withdrawal authority. No new queue.
// Soft-deactivation and audit commit together; historic votes remain unchanged.
router.post('/richiesta/:id/ritira', personalNoStore, verifyToken, requireAdmin, async (req,res) => {
  const id=String(req.params.id||'');
  const note=typeof req.body?.note==='string'?req.body.note.trim():'';
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/.test(id) || note.length<3 || note.length>500) {
    return res.status(400).json({success:false,error:'Riferimento o motivazione non valida'});
  }
  let client;
  let retired;
  try {
    client=await pool.connect();
    await client.query('BEGIN');
    const found=await client.query(
      "SELECT id,nome,utente_id FROM richieste_grazia WHERE id=$1 AND status='approved' AND withdrawn_at IS NULL FOR UPDATE",
      [id]
    );
    if(!found.rows[0]){
      await client.query('ROLLBACK');
      return res.status(409).json({success:false,error:'Richiesta Grazia assente o già ritirata'});
    }
    retired=found.rows[0];
    const off=await client.query(
      "UPDATE grazia_carcerati SET attivo=FALSE WHERE attivo=TRUE AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) RETURNING id",
      [retired.nome]
    );
    if(off.rowCount!==1){
      await client.query('ROLLBACK');
      return res.status(409).json({success:false,error:'Catalogo Grazia non riconciliato'});
    }
    const audit=await client.query(
      "UPDATE richieste_grazia SET withdrawn_at=now(),withdrawn_by=$2,withdraw_note=$3,withdraw_notification_sent=FALSE WHERE id=$1 AND status='approved' AND withdrawn_at IS NULL",
      [id,req.user.id,note]
    );
    if(audit.rowCount!==1)throw new Error('CONFLICT');
    await client.query('COMMIT');
  }catch(_){
    if(client){try{await client.query('ROLLBACK');}catch(_){/* disconnected */}}
    return res.status(503).json({success:false,error:'Ritiro Grazia temporaneamente non disponibile'});
  }finally{client?.release();}
  let noticeClient;
  let notificationSent=false;
  try{
    noticeClient=await pool.connect();
    await noticeClient.query('BEGIN');
    const recipient=await noticeClient.query(
      "INSERT INTO notifiche_demos (id,id_utente,titolo,testo,data_creazione,data) SELECT gen_random_uuid(),id,'DEMOS — Ritiro proposta Grazia','Una proposta Grazia approvata è stata ritirata.',NOW(),CURRENT_DATE FROM users WHERE id::text=$1 AND status='a'",
      [retired.utente_id]
    );
    if(recipient.rowCount!==1)throw new Error('NO_ACTIVE_RECIPIENT');
    await noticeClient.query(
      'UPDATE richieste_grazia SET withdraw_notification_sent=TRUE WHERE id=$1 AND withdrawn_at IS NOT NULL AND withdraw_notification_sent=FALSE',
      [id]
    );
    await noticeClient.query('COMMIT');
    notificationSent=true;
  }catch(_){
    if(noticeClient){try{await noticeClient.query('ROLLBACK');}catch(_){/* disconnected */}}
  }finally{noticeClient?.release();}
  return res.json({success:true,status:'withdrawn',notification_sent:notificationSent});
});

// POST /api/grazia/richiesta/:id/:action - Decisione moderazione solo Admin
router.post('/richiesta/:id/:action', personalNoStore, verifyToken, requireAdmin, async (req, res) => {
  const action = req.params.action;
  const approved = action === 'accetta' || action === 'approve';
  if (!approved && action !== 'rifiuta' && action !== 'reject') {
    return res.status(400).json({ success: false, error: 'Azione non valida' });
  }
  if (approved && !isNominationWriteEnabled()) return rejectUnavailableNomination(res);
  let client;
  try {
    client = await pool.connect();
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
      // Legacy requests may predate the cross-account submission lock.
      // Serialize approval for the same canonical subject as well, so two
      // historical pending rows cannot both become approved.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))), 12004))",
        [richiesta.nome]
      );
      const priorApproval=await client.query(
        "SELECT id FROM richieste_grazia WHERE id<>$1 AND status='approved' AND withdrawn_at IS NULL AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($2::text, NFC), '[[:space:]]+', ' ', 'g'))) LIMIT 1",
        [richiesta.id,richiesta.nome]
      );
      // A withdrawn catalogue subject must not be republished through an
      // older pending request, nor through a previously inactive legacy row.
      const retired=await client.query(
        "SELECT 1 FROM richieste_grazia WHERE withdrawn_at IS NOT NULL AND lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) LIMIT 1",
        [richiesta.nome]
      );
      // Serialize approvals with withdrawal against the canonical catalogue
      // row. If withdrawal won the race, its inactive state is now visible.
      const catalogue=await client.query(
        "SELECT id,attivo FROM grazia_carcerati WHERE lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))) = lower(btrim(regexp_replace(normalize($1::text, NFC), '[[:space:]]+', ' ', 'g'))) FOR UPDATE",
        [richiesta.nome]
      );
      if (priorApproval.rows.length || retired.rows.length || catalogue.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({success:false,error:'Catalogo Grazia non ripubblicabile'});
      }
      // Require a NEW catalogue row. Never revive an inactive legacy entry or
      // silently approve a second request when a unique insert loses a race.
      const inserted=await client.query(
        'INSERT INTO grazia_carcerati (nome, attivo) VALUES ($1,true) ON CONFLICT DO NOTHING RETURNING id',
        [richiesta.nome]
      );
      if (inserted.rowCount !== 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({success:false,error:'Catalogo Grazia già presente'});
      }
    }
    const status = approved ? 'approved' : 'rejected';
    await client.query("UPDATE richieste_grazia SET status = $1 WHERE id = $2 AND status = 'pending'", [status, richiesta.id]);
    await client.query('COMMIT');
    client.release();
    client = null;
    let notificationSent = false;
    try {
      const notice = await pool.query(
        "INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data_creazione, data) SELECT gen_random_uuid(), id, 'DEMOS — Esito proposta', $2, NOW(), CURRENT_DATE FROM users WHERE id::text = $1 AND status = 'a'",
        [richiesta.utente_id, approved ? 'La tua proposta Grazia è stata approvata.' : 'La tua proposta Grazia non è stata approvata.']
      );
      notificationSent = (notice.rowCount || 0) > 0;
    } catch {
      console.error('Grazia moderation notification unavailable after commit');
    }
    return res.json({ success: true, status, notification_sent: notificationSent });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ success: false, error: 'Decisione non applicata' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
