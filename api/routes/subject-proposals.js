const express = require('express');
const { getPool } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateEvidenceUrl } = require('../utils/recognitionEvidence');
const { isNominationWriteEnabled, rejectUnavailableNomination } = require('../utils/thirdPartyNominationGate');

const router = express.Router();
// Apply before authentication, validation and all other handlers: even 400,
// 401, 403, 409 and 503 responses must never be cached by a shared proxy.
// These routes include private submissions and Admin moderation metadata.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
});
const { readApprovedPage } = require('../services/publicApprovedSubjectPage');
const pool = getPool();
const CATEGORIES = new Set(['capo_stato', 'amnistia', 'attivisti', 'organizzazioni']);
const SELF_PROFILE_CATEGORIES = new Set(['attivisti', 'organizzazioni']);

function cleanProposal(body) {
  const category = typeof body?.category === 'string' ? body.category : '';
  const title = typeof body?.title === 'string' ? body.title.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
  const details = typeof body?.details === 'string' ? body.details.trim() : '';
  const sourceUrl = typeof body?.source_url === 'string' ? body.source_url.trim() : '';
  if (category === 'grazia') return { error: 'Per Grazia utilizzare la coda dedicata', code: 'GRAZIA_CODA_UNICA' };
  // Reject hidden Unicode controls in proposed public labels to prevent
  // an apparently identical subject from having a misleading stored title.
  // Keep ordinary accented and RTL script letters intact.
  const unsafeTitleControls = /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u180e\u200b\u200e-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u;
  if (!CATEGORIES.has(category) || title.length < 3 || title.length > 150 ||
      unsafeTitleControls.test(title) || details.length > 1000 || sourceUrl.length > 2048) {
    return { error: 'Campi della proposta non validi' };
  }
  // Require a public source for third-party nominations. Never accept
  // unstructured criminal/judicial details for Grazia.
  if (!sourceUrl) return { error: 'Fonte pubblica HTTPS obbligatoria' };
  // A public source must be a public HTTPS domain, not a local network URL.
  // Reuse the vetted evidence validator; no request is ever sent to the URL.
  if (!validateEvidenceUrl(sourceUrl)) return { error: 'URL fonte non valido' };
  return { category, title, details, sourceUrl: sourceUrl || null };
}

async function notify(client, userId, message) {
  // Published nominations outlive their original user account, but inbox
  // messages must not: never create orphan notifications for a deleted user.
  // FOR SHARE serializes this status check with both account deletion and
  // non-key status UPDATE (suspension); FOR KEY SHARE would not block that UPDATE.
  if (!userId) throw new Error('NO_ACTIVE_RECIPIENT');
  const inserted = await client.query(
    `INSERT INTO notifiche_demos (id_utente, titolo, testo)
     SELECT id, $2, $3 FROM users
     WHERE id::text=$1 AND lower(status)='a' FOR SHARE`,
    [String(userId), 'DEMOS — Aggiornamento proposta', message]
  );
  if (inserted.rowCount !== 1) throw new Error('NO_ACTIVE_RECIPIENT');
}

// Fetch only on click (no new personal GET while browsing a voting page).
router.get('/mine', verifyToken, async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  // Never coerce one-element arrays/objects (e.g. category[]=attivisti)
  // into a valid category: malformed shapes must fail before private SQL.
  if (category === 'grazia') return res.status(409).json({ success: false, error: 'GRAZIA_CODA_UNICA' });
  if (!CATEGORIES.has(category)) return res.status(400).json({ success: false, error: 'Categoria non valida' });
  try {
    // An access token or cached auth subject may outlive account suspension.
    // Recheck current DB status in the SAME private-read query: no extra SQL.
    // No active owner -> neutral empty result, without confirming a proposal.
    const result = await pool.query(
      "SELECT p.id, p.status, p.created_at, p.reviewed_at FROM subject_proposals p JOIN users u ON u.id=p.proposer_user_id AND u.status='a' WHERE p.proposer_user_id = $1 AND p.category = $2 ORDER BY p.created_at DESC, p.id DESC LIMIT 1",
      [req.user.id, category]
    );
    const latest = result.rows[0] || null;
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, pending: latest?.status === 'pending' ? latest : null, latest });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Proposte temporaneamente non disponibili' });
  }
});

// Approved directory nominations expose only the reviewed title, never raw user-submitted
// narrative or source links. Admin moderation still retains the original evidence.
// Never impersonate an actual DEMOS account.
router.get('/approved', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  // Never coerce one-element arrays/objects (e.g. category[]=attivisti)
  // into a valid category: malformed shapes must fail before private SQL.
  if (category !== 'attivisti' && category !== 'organizzazioni') {
    return res.status(400).json({ success: false, error: 'Categoria non valida' });
  }
  try {
    const page = await readApprovedPage(pool, category, req.query.cursor);
    if (!page) return res.status(400).json({ success: false, error: 'Cursore non valido' });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, ...page });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Elenco temporaneamente non disponibile' });
  }
});

// One outstanding proposal *per category*, protected by a partial unique database index.
router.post('/', verifyToken, async (req, res) => {
  const proposal = cleanProposal(req.body);
  if (proposal.error) return res.status(proposal.code === 'GRAZIA_CODA_UNICA' ? 409 : 400).json({ success: false, error: proposal.code || proposal.error });
  if (!isNominationWriteEnabled()) return rejectUnavailableNomination(res);
  const userId = req.user.id;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // A cached access session may survive account suspension. Check active
    // status under a row lock inside this transaction, so concurrent account
    // deactivation/deletion cannot race a new private nomination into storage.
    // FOR SHARE conflicts with non-key status UPDATE and with DELETE.
    const owner = await client.query(
      "SELECT id FROM users WHERE id=$1 AND status='a' FOR SHARE", [userId]
    );
    if (!owner.rows.length) {
      await client.query('ROLLBACK');
      return res.status(401).json({success:false,error:'Account non attivo o non disponibile'});
    }
    // These are self-applications, not third-party nominations. A generic
    // access token or the transitional deferred-CIE middleware is not enough.
    // The applicant must already have a verified CIE record before storing a
    // profile application. Final ownership/name match is reviewed in videocall.
    if (SELF_PROFILE_CATEGORIES.has(proposal.category)) {
      const cie = await client.query(
        "SELECT 1 FROM identity_verifications WHERE user_id=$1 AND provider='CIE' AND status='verified' LIMIT 1",
        [userId]
      );
      if (cie.rows.length !== 1) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success:false, error:'VERIFICA_CIE_RICHIESTA',
          message:'La candidatura richiede un identificativo CIE verificato.'
        });
      }
    }
    const r = await client.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,details,source_url,status,submission_notification_sent) VALUES($1,$2,$3,$4,$5,'pending',FALSE) RETURNING id,category,title,created_at",
      [userId, proposal.category, proposal.title, proposal.details, proposal.sourceUrl]
    );
    await client.query('COMMIT');
    // Free the pool connection before the best-effort notice. Otherwise a pool
    // with max=1 (or saturated connections) could deadlock on pool.query.
    client.release();
    client = null;
    // The moderation queue is authoritative. An unavailable notifications table
    // must not roll back an already-valid proposal or cause a misleading retry.
    let notificationSent = false;
    let noticeClient;
    try {
      noticeClient = await pool.connect();
      await noticeClient.query('BEGIN');
      // FOR SHARE protects the Admin recipient list from concurrent suspension.
      // The nomination stays committed even if the private notice cannot be sent.
      const notice = await noticeClient.query(
        "INSERT INTO notifiche_demos(id_utente,titolo,testo) SELECT id, 'DEMOS — Nuova proposta', $1 FROM users WHERE (is_admin = TRUE OR ruolo IN ('AD','Admin')) AND lower(status) = 'a' FOR SHARE",
        ['Nuova proposta ricevuta in una categoria da moderare.']
      );
      // An absent active Admin is not a confirmed notification.
      if (notice.rowCount === 0) throw new Error('NO_ACTIVE_ADMIN');
      await noticeClient.query(
        "UPDATE subject_proposals SET submission_notification_sent=TRUE WHERE id=$1 AND submission_notification_sent=FALSE",
        [r.rows[0].id]
      );
      await noticeClient.query('COMMIT');
      notificationSent = true;
    } catch (_) {
      if (noticeClient) {
        try { await noticeClient.query('ROLLBACK'); } catch (_) { /* disconnected */ }
      }
    } finally {
      noticeClient?.release();
    }
    res.set('Cache-Control', 'private, no-store');
    return res.status(201).json({ success: true, status: 'pending', notification_sent: notificationSent, proposal: r.rows[0], message: 'Proposta inviata. Sarà visibile soltanto dopo approvazione.' });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* connection may be lost */ }
    }
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'PROPOSTA_PENDENTE_O_DUPLICATA', message: 'Hai già una proposta di questo tipo in attesa oppure è già stata proposta.' });
    return res.status(503).json({ success: false, error: 'Impossibile registrare la proposta' });
  } finally {
    client?.release();
  }
});

router.get('/admin', verifyToken, requireAdmin, async (req, res) => {
  const cursor = parseAdminPageCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({ success: false, error: 'Cursore non valido' });
  try {
    const r = await pool.query(
      `SELECT id, category, title, details, source_url, created_at,
              EXTRACT(EPOCH FROM created_at)::text AS cursor_epoch
       FROM subject_proposals
       WHERE status='pending' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni')
         AND ($1::numeric IS NULL OR (created_at, id) > (to_timestamp($1::numeric), $2::uuid))
       ORDER BY created_at ASC, id ASC LIMIT 101`,
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    const page = r.rows.slice(0, 100);
    const next_cursor = r.rows.length > 100
      ? Buffer.from(JSON.stringify([page[page.length - 1].cursor_epoch, page[page.length - 1].id])).toString('base64url')
      : null;
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      proposals: page.map(({ cursor_epoch, ...proposal }) => proposal),
      next_cursor
    });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Coda moderazione non disponibile' });
  }
});

// Approved nominations are fetched only on demand in the Admin panel.
// Never expose proposer UUID, private notes or the original source URL in this listing.
// Keyset pagination: Admin must be able to find an older published entry to
// unpublish it, even when there are more than 100 approved nominations.
// Preserve full microsecond timestamps in the cursor so equal-millisecond
// reviews cannot be skipped by JS Date truncation.
function parseAdminPageCursor(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string' || raw.length > 240 || !/^[A-Za-z0-9_-]+$/.test(raw)) return false;
  try {
    const bytes = Buffer.from(raw, 'base64url');
    // Cursors have one canonical representation; reject tolerated trailing bits.
    if (bytes.toString('base64url') !== raw) return false;
    const decoded = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(decoded) || decoded.length !== 2) return false;
    const [epoch, id] = decoded;
    if (typeof epoch !== 'string' || !/^\d{1,11}(?:\.\d{1,6})?$/.test(epoch) ||
        Number(epoch) > 4102444800 || typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return false;
    return [epoch, id];
  } catch (_) { return false; }
}

router.get('/admin/approved', verifyToken, requireAdmin, async (req, res) => {
  const cursor = parseAdminPageCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({ success: false, error: 'Cursore non valido' });
  try {
    const r = await pool.query(
      `SELECT id, category, title, reviewed_at,
              EXTRACT(EPOCH FROM COALESCE(reviewed_at, created_at))::text AS cursor_epoch
       FROM subject_proposals
       WHERE status='approved' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni')
         AND ($1::numeric IS NULL OR (COALESCE(reviewed_at, created_at), id) < (to_timestamp($1::numeric), $2::uuid))
       ORDER BY COALESCE(reviewed_at, created_at) DESC, id DESC LIMIT 101`,
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    const page = r.rows.slice(0, 100);
    const next_cursor = r.rows.length > 100
      ? Buffer.from(JSON.stringify([page[page.length - 1].cursor_epoch, page[page.length - 1].id])).toString('base64url')
      : null;
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      proposals: page.map(({ cursor_epoch, ...proposal }) => proposal),
      next_cursor
    });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Elenco approvati temporaneamente non disponibile' });
  }
});

// Audit-only review of notifications that were not confirmed during a withdrawal.
// Explicit Admin click only: no extra GET on opening Gestisci. Do not expose a
// proposer UUID, title, source, note, or any other third-party personal content.
// Legacy NULL after withdrawal is "unknown" and needs manual checking too.
router.get('/admin/withdraw-notifications', verifyToken, requireAdmin, async (req, res) => {
  const cursor = parseAdminPageCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({ success: false, error: 'Cursore non valido' });
  try {
    const r = await pool.query(
      "SELECT p.id, p.category, p.withdrawn_at, (p.proposer_user_id IS NULL OR u.id IS NULL OR lower(COALESCE(u.status,'')) <> 'a') AS recipient_unavailable, EXTRACT(EPOCH FROM COALESCE(p.withdrawn_at,p.created_at))::text AS cursor_epoch FROM subject_proposals p LEFT JOIN users u ON u.id=p.proposer_user_id WHERE p.status='withdrawn' AND p.category IN ('capo_stato','amnistia','attivisti','organizzazioni') AND p.withdraw_notification_sent IS DISTINCT FROM TRUE AND ($1::numeric IS NULL OR (COALESCE(p.withdrawn_at,p.created_at),p.id) < (to_timestamp($1::numeric),$2::uuid)) ORDER BY COALESCE(p.withdrawn_at,p.created_at) DESC,p.id DESC LIMIT 101",
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    const page = r.rows.slice(0, 100);
    const next_cursor = r.rows.length > 100
      ? Buffer.from(JSON.stringify([page[page.length - 1].cursor_epoch, page[page.length - 1].id])).toString('base64url')
      : null;
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, withdrawals: page.map(({ cursor_epoch, ...item }) => item), next_cursor });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Stato notifiche di ritiro temporaneamente non disponibile' });
  }
});

// Audit-only and on explicit Admin click: a notification flag is not a delivery receipt.
// NULL means legacy outcome unknown, FALSE means not confirmed. No names, sources,
// proposer IDs or private review notes. Never retry automatically.
router.get('/admin/notification-audit', verifyToken, requireAdmin, async (req, res) => {
  const cursor = parseAdminPageCursor(req.query.cursor);
  if (cursor === false) return res.status(400).json({ success: false, error: 'Cursore non valido' });
  try {
    const r = await pool.query(
      "SELECT p.id,p.category,p.status,p.created_at,p.reviewed_at,p.submission_notification_sent,p.review_notification_sent,(p.proposer_user_id IS NULL OR u.id IS NULL OR lower(COALESCE(u.status,'')) <> 'a') AS recipient_unavailable, EXTRACT(EPOCH FROM p.created_at)::text AS cursor_epoch FROM subject_proposals p LEFT JOIN users u ON u.id=p.proposer_user_id WHERE (p.submission_notification_sent IS DISTINCT FROM TRUE OR (p.status IN ('approved','rejected','withdrawn') AND p.review_notification_sent IS DISTINCT FROM TRUE)) AND ($1::numeric IS NULL OR (p.created_at,p.id) < (to_timestamp($1::numeric),$2::uuid)) ORDER BY p.created_at DESC,p.id DESC LIMIT 101",
      [cursor?.[0] ?? null, cursor?.[1] ?? null]
    );
    const page = r.rows.slice(0, 100);
    const next_cursor = r.rows.length > 100
      ? Buffer.from(JSON.stringify([page[page.length - 1].cursor_epoch, page[page.length - 1].id])).toString('base64url')
      : null;
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, proposals: page.map(({ cursor_epoch, ...item }) => item), next_cursor });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Verifica notifiche non disponibile' });
  }
});

// Emergency unpublish for all four generic approved categories. The two voting
// catalogues require atomic soft-deactivation, keeping historical votes intact.
// This is not
// an erasure or a general-purpose DSAR endpoint: identity/grounds remain under DPO review.
// Preserve the original approval reviewer/time/note and record a separate withdrawal audit.
router.post('/admin/:id/withdraw', verifyToken, requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || note.length < 3 || note.length > 500) {
    return res.status(400).json({ success: false, error: 'ID o motivazione del ritiro non valida (3–500 caratteri)' });
  }
  // An unavailable notifications table must never prevent urgent unpublishing.
  // Commit and release the protected withdrawal before attempting a notification.
  let client;
  let withdrawn;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const found = await client.query(
      "SELECT id, category, title, published_ref, proposer_user_id FROM subject_proposals WHERE id=$1 AND status='approved' AND category IN ('capo_stato','amnistia','attivisti','organizzazioni') FOR UPDATE",
      [id]
    );
    if (!found.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Voce assente, non ritirabile o già ritirata' });
    }
    withdrawn = found.rows[0];
    // Never delete voting records: take the approved catalogue entry offline
    // in the same transaction as the withdrawal audit. A missing/mismatched
    // catalogue row is a conflict, not proof that unpublishing succeeded.
    if (withdrawn.category === 'capo_stato') {
      const deactivated = await client.query(
        "UPDATE capo_stato_soggetti_approvati SET active=FALSE WHERE source_proposal_id=$1 AND id::text=$2 AND active=TRUE AND nome=$3 RETURNING id",
        [withdrawn.id, withdrawn.published_ref, withdrawn.title]
      );
      if (deactivated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success:false, error:'Catalogo Capo di Stato non riconciliato' });
      }
    } else if (withdrawn.category === 'amnistia') {
      const deactivated = await client.query(
        "UPDATE amnistia SET attiva=FALSE WHERE id::text=$1 AND legge=$2 AND attiva=TRUE RETURNING id",
        [withdrawn.published_ref, withdrawn.title]
      );
      if (deactivated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success:false, error:'Catalogo Amnistia non riconciliato' });
      }
    }
    await client.query(
      "UPDATE subject_proposals SET status='withdrawn', withdrawn_at=now(), withdrawn_by=$2, withdraw_note=$3, withdraw_notification_sent=FALSE WHERE id=$1 AND status='approved'",
      [withdrawn.id, req.user.id, note]
    );
    await client.query('COMMIT');
  } catch (_) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* connection may be lost */ }
    }
    return res.status(503).json({ success: false, error: 'Ritiro temporaneamente non disponibile' });
  } finally {
    client?.release();
  }

  // Independent notification transaction. Either the private notification AND
  // its durable delivery flag commit, or neither does; a crash before this
  // transaction leaves FALSE for later authorized review. Never auto-resend:
  // old/unknown delivery must be checked to avoid duplicate notifications.
  let notificationSent = false;
  let noticeClient;
  try {
    noticeClient = await pool.connect();
    await noticeClient.query('BEGIN');
    await notify(noticeClient, withdrawn.proposer_user_id,
      'La pubblicazione della tua proposta in ' + withdrawn.category + ' è stata ritirata.');
    await noticeClient.query(
      "UPDATE subject_proposals SET withdraw_notification_sent=TRUE WHERE id=$1 AND status='withdrawn' AND withdraw_notification_sent=FALSE",
      [withdrawn.id]
    );
    await noticeClient.query('COMMIT');
    notificationSent = true;
  } catch (_) {
    if (noticeClient) {
      try { await noticeClient.query('ROLLBACK'); } catch (_) { /* disconnected */ }
    }
    // Do not log a third-party name or change the already-committed withdrawal.
  } finally {
    noticeClient?.release();
  }
  res.set('Cache-Control', 'private, no-store');
  return res.json({ success: true, status: 'withdrawn', notification_sent: notificationSent });
});

// Atomic review: the canonical public list changes only inside an authorized approval transaction.
router.post('/admin/:id/decision', verifyToken, requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  const decision = String(req.body?.decision || '');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || !['approve','reject'].includes(decision) || note.length > 500) {
    return res.status(400).json({ success: false, error: 'Decisione non valida' });
  }
  // Rejection and emergency withdrawal remain available even while new
  // third-party nomination publication is not legally authorized.
  if (decision === 'approve' && !isNominationWriteEnabled()) return rejectUnavailableNomination(res);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const pending = await client.query(
      "SELECT * FROM subject_proposals WHERE id=$1 AND status='pending' FOR UPDATE",
      [id]
    );
    if (!pending.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Proposta già valutata o inesistente' });
    }
    const p = pending.rows[0];
    // Legacy/accidental Grazia rows must never be approved through the wrong queue.
    if (p.category === 'grazia') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'GRAZIA_CODA_UNICA' });
    }
    // Publishing a self-profile is forbidden without evidence linked to THIS
    // locked proposal and proposer: verified CIE, first-approval videocall,
    // Admin's identity/title match, and (organizations) legal role checks.
    // An un-migrated database or missing verification ledger fails closed.
    // Only the backend may read the ledger; no meeting URL or video is stored.
    if (decision === 'approve' && SELF_PROFILE_CATEGORIES.has(p.category)) {
      const evidence = await client.query(
        `SELECT v.proposal_id
         FROM subject_self_profile_verifications v
         JOIN identity_verifications cie ON cie.user_id=v.proposer_user_id
           AND cie.provider='CIE' AND cie.status='verified'
         JOIN users reviewer ON reviewer.id=v.call_verified_by
           AND reviewer.status='a' AND (reviewer.is_admin=TRUE OR reviewer.ruolo IN ('AD','Admin'))
         WHERE v.proposal_id=$1 AND v.proposer_user_id=$2 AND v.category=$3
           AND v.identity_match_confirmed=TRUE
           AND cie.verified_at IS NOT NULL AND v.call_verified_at >= cie.verified_at
           AND (v.category='attivisti' OR (
             v.representative_role IN ('presidente','rappresentante_legale')
             AND v.role_verified_at IS NOT NULL AND v.role_verified_by IS NOT NULL
             AND v.role_evidence_kind IN ('official_registry','official_document')
           ))
         FOR SHARE OF v`,
        [p.id, p.proposer_user_id, p.category]
      );
      if (evidence.rows.length !== 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success:false, error:'VERIFICA_IDENTITA_VIDEO_MANCANTE' });
      }
    }
    let publishedRef = null;
    if (decision === 'approve') {
      if (p.category === 'amnistia') {
        const exists = await client.query('SELECT id FROM amnistia WHERE lower(btrim(legge))=lower(btrim($1)) LIMIT 1', [p.title]);
        if (exists.rows.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, error: 'Reato già presente in Amnistia' });
        }
        const r = await client.query(
          "INSERT INTO amnistia(legge,articolo,descrizione,fonte_url,attiva) VALUES($1,'',$2,$3,true) RETURNING id",
          [p.title, p.details, p.source_url]
        );
        publishedRef = String(r.rows[0].id);
      } else if (p.category === 'capo_stato') {
        const r = await client.query(
          'INSERT INTO capo_stato_soggetti_approvati(nome,source_proposal_id,active) VALUES($1,$2,true) RETURNING id',
          [p.title, p.id]
        );
        publishedRef = String(r.rows[0].id);
      } else {
        // Public, read-only nomination. This does not invent a user account,
        // grant an organizational role, or allow supporting an unverified profile.
        publishedRef = p.id;
      }
    }
    const status = decision === 'approve' ? 'approved' : 'rejected';
    await client.query(
      'UPDATE subject_proposals SET status=$2,reviewed_by=$3,reviewed_at=now(),published_ref=$4,review_note=$5,review_notification_sent=FALSE WHERE id=$1',
      [id, status, req.user.id, publishedRef, note || null]
    );
    await client.query('COMMIT');
    client.release();
    client = null;
    // The decision and catalogue publication must not be undone by a notification outage.
    // No automatic retries until an idempotent notification outbox is approved.
    let notificationSent = false;
    let noticeClient;
    try {
      noticeClient = await pool.connect();
      await noticeClient.query('BEGIN');
      await notify(noticeClient, p.proposer_user_id,
        decision === 'approve' ? 'La tua proposta in ' + p.category + ' è stata approvata.' : 'La tua proposta in ' + p.category + ' non è stata approvata.'
      );
      await noticeClient.query(
        "UPDATE subject_proposals SET review_notification_sent=TRUE WHERE id=$1 AND review_notification_sent=FALSE",
        [id]
      );
      await noticeClient.query('COMMIT');
      notificationSent = true;
    } catch (_) {
      if (noticeClient) {
        try { await noticeClient.query('ROLLBACK'); } catch (_) { /* disconnected */ }
      }
    } finally {
      noticeClient?.release();
    }
    return res.json({ success: true, status, published_ref: publishedRef, notification_sent: notificationSent });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* connection may be lost */ }
    }
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Elemento già presente nel catalogo' });
    return res.status(503).json({ success: false, error: 'Impossibile completare la revisione' });
  } finally {
    client?.release();
  }
});

module.exports = router;
