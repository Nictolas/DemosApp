const express = require('express');
const { getPool } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const pool = getPool();
const CATEGORIES = new Set(['capo_stato', 'amnistia', 'attivisti', 'organizzazioni']);

function cleanProposal(body) {
  const category = typeof body?.category === 'string' ? body.category : '';
  const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const details = typeof body?.details === 'string' ? body.details.trim() : '';
  const sourceUrl = typeof body?.source_url === 'string' ? body.source_url.trim() : '';
  if (category === 'grazia') return { error: 'Per Grazia utilizzare la coda dedicata', code: 'GRAZIA_CODA_UNICA' };
  if (!CATEGORIES.has(category) || title.length < 3 || title.length > 150 ||
      details.length > 1000 || sourceUrl.length > 2048) {
    return { error: 'Campi della proposta non validi' };
  }
  // Require a public source for third-party nominations. Never accept
  // unstructured criminal/judicial details for Grazia.
  if (!sourceUrl) return { error: 'Fonte pubblica HTTPS obbligatoria' };
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return { error: 'URL fonte non valido' };
    }
  } catch (_) {
    return { error: 'URL fonte non valido' };
  }
  return { category, title, details, sourceUrl: sourceUrl || null };
}

async function notify(client, userId, message) {
  // "DEMOS —" is treated as a per-user message by /api/notifiche.
  await client.query(
    'INSERT INTO notifiche_demos (id_utente, titolo, testo) VALUES ($1, $2, $3)',
    [userId, 'DEMOS — Aggiornamento proposta', message]
  );
}

// Fetch only on click (no new personal GET while browsing a voting page).
router.get('/mine', verifyToken, async (req, res) => {
  const category = String(req.query.category || '');
  if (category === 'grazia') return res.status(409).json({ success: false, error: 'GRAZIA_CODA_UNICA' });
  if (!CATEGORIES.has(category)) return res.status(400).json({ success: false, error: 'Categoria non valida' });
  try {
    const result = await pool.query(
      "SELECT id, title, created_at FROM subject_proposals WHERE proposer_user_id = $1 AND category = $2 AND status = 'pending' LIMIT 1",
      [req.user.id, category]
    );
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, pending: result.rows[0] || null });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Proposte temporaneamente non disponibili' });
  }
});

// Approved directory nominations are read-only. Never impersonate an actual DEMOS account.
router.get('/approved', async (req, res) => {
  const category = String(req.query.category || '');
  if (category !== 'attivisti' && category !== 'organizzazioni') {
    return res.status(400).json({ success: false, error: 'Categoria non valida' });
  }
  try {
    const result = await pool.query(
      "SELECT id, title, details, source_url FROM subject_proposals WHERE category=$1 AND status='approved' ORDER BY reviewed_at DESC LIMIT 100",
      [category]
    );
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, data: result.rows });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Elenco temporaneamente non disponibile' });
  }
});

// One outstanding proposal *per category*, protected by a partial unique database index.
router.post('/', verifyToken, async (req, res) => {
  const proposal = cleanProposal(req.body);
  if (proposal.error) return res.status(proposal.code === 'GRAZIA_CODA_UNICA' ? 409 : 400).json({ success: false, error: proposal.code || proposal.error });
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,details,source_url,status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING id,category,title,created_at",
      [userId, proposal.category, proposal.title, proposal.details, proposal.sourceUrl]
    );
    // Private admin inbox notification; no proposer identity in the message.
    await client.query(
      "INSERT INTO notifiche_demos(id_utente,titolo,testo) SELECT id, 'DEMOS — Nuova proposta', $1 FROM users WHERE (is_admin = TRUE OR ruolo IN ('AD','Admin')) AND lower(status) = 'a'",
      ['Nuova proposta ricevuta in una categoria da moderare.']
    );
    await client.query('COMMIT');
    res.set('Cache-Control', 'private, no-store');
    return res.status(201).json({ success: true, status: 'pending', proposal: r.rows[0], message: 'Proposta inviata. Sarà visibile soltanto dopo approvazione.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'PROPOSTA_PENDENTE_O_DUPLICATA', message: 'Hai già una proposta di questo tipo in attesa oppure è già stata proposta.' });
    return res.status(503).json({ success: false, error: 'Impossibile registrare la proposta' });
  } finally {
    client.release();
  }
});

router.get('/admin', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, category, title, details, source_url, created_at FROM subject_proposals WHERE status='pending' AND category <> 'grazia' ORDER BY created_at ASC LIMIT 100"
    );
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, proposals: r.rows });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Coda moderazione non disponibile' });
  }
});

// Atomic review: the canonical public list changes only inside an authorized approval transaction.
router.post('/admin/:id/decision', verifyToken, requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  const decision = String(req.body?.decision || '');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['approve','reject'].includes(decision) || note.length > 500) {
    return res.status(400).json({ success: false, error: 'Decisione non valida' });
  }
  const client = await pool.connect();
  try {
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
      'UPDATE subject_proposals SET status=$2,reviewed_by=$3,reviewed_at=now(),published_ref=$4,review_note=$5 WHERE id=$1',
      [id, status, req.user.id, publishedRef, note || null]
    );
    await notify(client, p.proposer_user_id,
      decision === 'approve' ? 'La tua proposta in ' + p.category + ' è stata approvata.' : 'La tua proposta in ' + p.category + ' non è stata approvata.'
    );
    await client.query('COMMIT');
    return res.json({ success: true, status, published_ref: publishedRef });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Elemento già presente nel catalogo' });
    return res.status(503).json({ success: false, error: 'Impossibile completare la revisione' });
  } finally {
    client.release();
  }
});

module.exports = router;
