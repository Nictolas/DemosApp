const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { decompressUserLocation } = require('../utils/locationUtils');
const { getPool } = require('../config/database');
const { listPersonalizedEvents } = require('../services/eventFeedService');
const { retrieve: retrieveChronocol, mergeEvents: mergeChronocol } = require('../services/chronocolEventFeedService');
const { closeElectionLifecycle } = require('../services/electionLifecycleService');
const {
  EventApprovalSchemaRequiredError,
  isApprovalSchemaError,
  canRequestEvent,
  canCreateElectionEvent,
  initialApprovalState,
  hasSubstantialEventChange
} = require('../services/eventApprovalService');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER EVENTI =====

// Snapshot condiviso fra richieste: una SELECT sugli eventi approvati ogni 3 minuti
// per istanza Render, non una lettura per ogni utente o cambio scheda.
let publicEventsSnapshot = [];
let publicEventsExpiresAt = 0;
let publicEventsPending = null;

async function listPublicApprovedEvents() {
  if (Date.now() < publicEventsExpiresAt) return publicEventsSnapshot;
  if (publicEventsPending) return publicEventsPending;
  publicEventsPending = (async () => {
    try {
      const { rows } = await pool.query(
        `SELECT id, nome_evento, tipologia_evento, tipo_elezione,
                paese_evento, regione_evento, provincia_evento, comune_evento,
                indirizzo_evento, giorno_inizio, giorno_fine, orario_inizio, orario_fine,
                organizzatore
         FROM eventi
         WHERE approval_status = 'APPROVED'
           AND giorno_inizio IS NOT NULL
           AND COALESCE(giorno_fine, giorno_inizio) >= CURRENT_DATE
         ORDER BY giorno_inizio ASC, orario_inizio ASC NULLS LAST, id ASC
         LIMIT 2000`
      );
      publicEventsSnapshot = rows;
      publicEventsExpiresAt = Date.now() + 3 * 60 * 1000;
      return rows;
    } finally {
      publicEventsPending = null;
    }
  })();
  return publicEventsPending;
}

// GET /api/eventi/pubblici - Feed nazionale anonimo, solo eventi approvati.
// Risolve Globali/Regionali lato dispositivo con il catalogo geografico incluso nell'app.
// Non legge il profilo, le selezioni politiche né lo stato di autenticazione.
router.get('/pubblici', async (_req, res) => {
  try {
    const [approved, imported] = await Promise.all([
      listPublicApprovedEvents(), retrieveChronocol()
    ]);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    return res.json({
      success: true,
      data: mergeChronocol(approved, imported, { global: true })
    });
  } catch (error) {
    // Un errore di schema/approval non deve MAI degradare a "mostra tutto".
    console.error('[eventi] Catalogo pubblico non disponibile:', error?.message);
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ success: false, error: 'PUBLIC_EVENTS_UNAVAILABLE' });
  }
});

// GET /api/eventi/mobilitazioni - Solo dati pubblici, nessun token o SELECT utenti.
// Gli eventi importati non contengono preferenze individuali o dati identificativi.
router.get('/mobilitazioni', async (_req, res) => {
  try {
    const imported = await retrieveChronocol();
    // Cache breve: la rimozione temporale avviene a ogni risposta origin.
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=120');
    return res.json({
      success: true,
      data: mergeChronocol([], imported, { global: true }),
      source: 'Chrono Collective'
    });
  } catch (error) {
    console.error('[chronocol] Errore endpoint mobilitazioni:', error?.message);
    return res.status(503).json({ success: false, error: 'EVENT_SOURCE_UNAVAILABLE' });
  }
});

// GET /api/eventi - Feed personalizzato: soggetti selezionati > territorio > elezioni rilevanti.
router.get('/', verifyToken, async (req, res) => {
  try {
    const viewType = req.query.view || 'personal';

    // Catalogo pubblico delle mobilitazioni: nessuna query PostgreSQL per richiesta.
    if (viewType === 'mobilitazioni') {
      const imported = await retrieveChronocol();
      return res.json({
        success: true,
        data: mergeChronocol([], imported, { global: true }),
        source: 'Chrono Collective'
      });
    }

    if (req.user?.isAdmin && viewType === 'global') {
      let result;
      try {
        result = await pool.query(
          `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento,
                  regione_evento, provincia_evento, comune_evento, indirizzo_evento,
                  giorno_inizio, giorno_fine, orario_inizio, orario_fine,
                  orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at,
                  creator_user_id, approval_status, approval_requested_at, approved_at,
                  approved_by_user_id, rejection_reason,
                  election_lifecycle_closed_at, election_lifecycle_closed_by_user_id
           FROM eventi
           ORDER BY giorno_inizio ASC NULLS LAST, orario_inizio ASC NULLS LAST, created_at ASC`
        );
      } catch (error) {
        if (!isApprovalSchemaError(error)) throw error;
        result = await pool.query(
          `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento,
                  regione_evento, provincia_evento, comune_evento, indirizzo_evento,
                  giorno_inizio, giorno_fine, orario_inizio, orario_fine,
                  orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at
           FROM eventi
           ORDER BY giorno_inizio ASC NULLS LAST, orario_inizio ASC NULLS LAST, created_at ASC`
        );
      }
      const imported = await retrieveChronocol();
      return res.json({ success: true, data: mergeChronocol(result.rows, imported, { global: true }) });
    }

    const feed = await listPersonalizedEvents(pool, req.userId);
    if (!feed.user) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    return res.json({
      success: true,
      data: feed.events,
      // La stessa SELECT utente del feed personale fornisce la localizzazione:
      // nessuna query aggiuntiva per filtrare provincia/regione nel client.
      territory: {
        provincia: feed.user.provincia_residenza || null,
        regione: feed.user.regione_residenza || null
      },
      ranking: ['SELECTED_SUBJECT', 'TERRITORY', 'RELEVANT_ELECTION']
    });
  } catch (error) {
    console.error('❌ Errore nel recupero eventi:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

// POST /api/eventi - Crea una richiesta evento; la pubblicazione richiede approvazione staff.
router.post('/', verifyToken, async (req, res) => {
  try {
    if (!canRequestEvent(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'EVENT_CREATION_NOT_ALLOWED',
        message: 'La creazione di eventi è riservata a profili riconosciuti e amministratori.'
      });
    }

    const {
      nome_evento, tipologia_evento, tipo_elezione,
      paese_evento, regione_evento, provincia_evento, comune_evento, indirizzo_evento,
      giorno_inizio, giorno_fine, orario_inizio, orario_fine,
      orario_inizio_giorno2, orario_fine_giorno2
    } = req.body || {};

    if (!nome_evento || !tipologia_evento) {
      return res.status(400).json({ success: false, error: 'Nome evento e tipologia sono obbligatori' });
    }
    if (String(tipologia_evento).trim().toLowerCase() === 'elezioni' && !canCreateElectionEvent(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'ELECTION_EVENT_ADMIN_ONLY',
        message: 'Gli eventi elettorali canonici possono essere creati solo dallo staff DEMOS.'
      });
    }

    const userResult = await pool.query('SELECT nome, cognome FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const user = userResult.rows[0];
    const finalOrganizer = `${user.nome || ''} ${user.cognome || ''}`.trim();
    const clean = (value) => value != null && String(value).trim() !== '' ? String(value).trim() : null;
    const approval = initialApprovalState(req.user);

    const values = [
      nome_evento, tipologia_evento, clean(tipo_elezione), clean(paese_evento), clean(regione_evento),
      clean(provincia_evento), clean(comune_evento), clean(indirizzo_evento), clean(giorno_inizio), clean(giorno_fine),
      clean(orario_inizio), clean(orario_fine), clean(orario_inizio_giorno2), clean(orario_fine_giorno2), finalOrganizer
    ];

    let result;
    let usedApprovalModel = true;
    try {
      result = await pool.query(
        `INSERT INTO eventi (
           nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento,
           provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine,
           orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore,
           creator_user_id, approval_status, approval_requested_at, approved_at, approved_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           $16::uuid,$17,NOW(),CASE WHEN $18 THEN NOW() ELSE NULL END,CASE WHEN $18 THEN $16::uuid ELSE NULL END
         ) RETURNING *`,
        [...values, req.userId, approval.status, approval.approvedNow]
      );
    } catch (error) {
      if (!isApprovalSchemaError(error)) throw error;
      usedApprovalModel = false;
      if (!req.user?.isAdmin) throw new EventApprovalSchemaRequiredError();
      result = await pool.query(
        `INSERT INTO eventi (
           nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento,
           provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine,
           orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2, organizzatore
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        values
      );
    }

    return res.status(approval.approvedNow ? 201 : 202).json({
      success: true,
      data: result.rows[0],
      approval: {
        status: usedApprovalModel ? approval.status : 'APPROVED',
        pending_staff_review: usedApprovalModel && !approval.approvedNow
      }
    });
  } catch (error) {
    if (error?.code === 'EVENT_APPROVAL_SCHEMA_REQUIRED') {
      return res.status(error.statusCode || 503).json({ success: false, error: error.code, message: error.message });
    }
    console.error('❌ Errore nella creazione evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

// GET /api/eventi/prossimo - Primo evento secondo lo stesso ranking del feed.
router.get('/prossimo', verifyToken, async (req, res) => {
  try {
    if (req.user?.isAdmin && req.query.view === 'global') {
      const result = await pool.query(
        `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento,
                regione_evento, provincia_evento, comune_evento, indirizzo_evento,
                giorno_inizio, giorno_fine, orario_inizio, orario_fine,
                orario_inizio_giorno2, orario_fine_giorno2, organizzatore, created_at
         FROM eventi
         WHERE giorno_inizio IS NOT NULL AND COALESCE(giorno_fine, giorno_inizio) >= CURRENT_DATE
         ORDER BY giorno_inizio ASC, orario_inizio ASC NULLS LAST, created_at ASC
         LIMIT 1`
      );
      const imported = await retrieveChronocol();
      const merged = mergeChronocol(result.rows, imported, { global: true });
      return res.json({ success: true, data: merged[0] || null });
    }

    const feed = await listPersonalizedEvents(pool, req.userId, { futureOnly: true });
    if (!feed.user) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    return res.json({
      success: true,
      data: mergeChronocol(feed.events, await retrieveChronocol(), { user: feed.user })[0] || null,
      ranking: ['SELECTED_SUBJECT', 'TERRITORY', 'RELEVANT_ELECTION']
    });
  } catch (error) {
    console.error('❌ Errore nel recupero prossimo evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

// GET /api/eventi/admin/pending - Coda di moderazione staff.
router.get('/admin/pending', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento,
              regione_evento, provincia_evento, comune_evento, indirizzo_evento,
              giorno_inizio, giorno_fine, orario_inizio, orario_fine,
              organizzatore, creator_user_id, approval_status, approval_requested_at, created_at
       FROM eventi
       WHERE approval_status = 'PENDING'
       ORDER BY approval_requested_at ASC NULLS LAST, created_at ASC`
    );
    return res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    if (isApprovalSchemaError(error)) {
      return res.status(503).json({ success: false, error: 'EVENT_APPROVAL_SCHEMA_REQUIRED' });
    }
    console.error('❌ Errore coda approvazione eventi:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/eventi/:id/approve - Approva una richiesta evento (solo staff/Admin).
router.post('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE eventi
       SET approval_status = 'APPROVED', approved_at = NOW(), approved_by_user_id = $2,
           rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Evento non trovato' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (isApprovalSchemaError(error)) {
      return res.status(503).json({ success: false, error: 'EVENT_APPROVAL_SCHEMA_REQUIRED' });
    }
    console.error('❌ Errore approvazione evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/eventi/:id/reject - Rifiuta una richiesta evento (solo staff/Admin).
router.post('/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const reason = req.body?.reason ? String(req.body.reason).trim() : null;
    const result = await pool.query(
      `UPDATE eventi
       SET approval_status = 'REJECTED', rejection_reason = $2,
           approved_at = NULL, approved_by_user_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id, reason]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Evento non trovato' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (isApprovalSchemaError(error)) {
      return res.status(503).json({ success: false, error: 'EVENT_APPROVAL_SCHEMA_REQUIRED' });
    }
    console.error('❌ Errore rifiuto evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// POST /api/eventi/:id/close-election - Chiude il lifecycle politico di un'elezione terminata.
// I vincitori non arrivano dal client: sono i candidati con un mandato attivo già legato allo stesso evento.
router.post('/:id/close-election', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await closeElectionLifecycle(client, {
      eventId: req.params.id,
      closedByUserId: req.userId,
      closedAt: new Date()
    });
    await client.query('COMMIT');
    return res.json({ success: true, data: result });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code && String(error.code).startsWith('ELECTION_')) {
      return res.status(error.statusCode || 409).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
    if (['42P01', '42703', '42883'].includes(error?.code)) {
      return res.status(503).json({
        success: false,
        error: 'ELECTION_LIFECYCLE_SCHEMA_REQUIRED',
        message: 'Le migrazioni capability/programmi/lifecycle devono essere applicate prima della chiusura.'
      });
    }
    console.error('❌ Errore chiusura lifecycle elezione:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  } finally {
    client.release();
  }
});

// GET /api/eventi/:id - Espone pubblicamente solo eventi approvati.
router.get('/:id', async (req, res) => {
  try {
    let result;
    try {
      result = await pool.query(
        `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento,
                provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine,
                orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2,
                organizzatore, created_at, approval_status
         FROM eventi
         WHERE id = $1 AND approval_status = 'APPROVED'`,
        [req.params.id]
      );
    } catch (error) {
      if (!isApprovalSchemaError(error)) throw error;
      result = await pool.query(
        `SELECT id, nome_evento, tipologia_evento, tipo_elezione, paese_evento, regione_evento,
                provincia_evento, comune_evento, indirizzo_evento, giorno_inizio, giorno_fine,
                orario_inizio, orario_fine, orario_inizio_giorno2, orario_fine_giorno2,
                organizzatore, created_at
         FROM eventi WHERE id = $1`,
        [req.params.id]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Evento non trovato' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Errore nel recupero evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

// PUT /api/eventi/:id - Modifica autenticata; le modifiche sostanziali del creatore tornano PENDING.
router.put('/:id', verifyToken, async (req, res) => {
  try {
    let existingResult;
    let approvalSchemaAvailable = true;
    try {
      existingResult = await pool.query('SELECT * FROM eventi WHERE id = $1', [req.params.id]);
      if (existingResult.rows[0] && !Object.prototype.hasOwnProperty.call(existingResult.rows[0], 'approval_status')) {
        approvalSchemaAvailable = false;
      }
    } catch (error) {
      if (!isApprovalSchemaError(error)) throw error;
      approvalSchemaAvailable = false;
      existingResult = await pool.query('SELECT * FROM eventi WHERE id = $1', [req.params.id]);
    }
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ success: false, error: 'Evento non trovato' });

    if (!req.user?.isAdmin) {
      if (!approvalSchemaAvailable) throw new EventApprovalSchemaRequiredError();
      if (!canRequestEvent(req.user) || String(existing.creator_user_id || '') !== String(req.userId)) {
        return res.status(403).json({ success: false, error: 'EVENT_EDIT_NOT_ALLOWED' });
      }
    }

    const clean = (value) => value != null && String(value).trim() !== '' ? String(value).trim() : null;
    const value = (field) => req.body?.[field] === undefined ? existing[field] : clean(req.body[field]);
    const next = {
      nome_evento: value('nome_evento'),
      tipologia_evento: value('tipologia_evento'),
      tipo_elezione: value('tipo_elezione'),
      paese_evento: value('paese_evento'),
      regione_evento: value('regione_evento'),
      provincia_evento: value('provincia_evento'),
      comune_evento: value('comune_evento'),
      indirizzo_evento: value('indirizzo_evento'),
      giorno_inizio: value('giorno_inizio'),
      giorno_fine: value('giorno_fine'),
      orario_inizio: value('orario_inizio'),
      orario_fine: value('orario_fine'),
      orario_inizio_giorno2: value('orario_inizio_giorno2'),
      orario_fine_giorno2: value('orario_fine_giorno2')
    };
    if (!next.nome_evento || !next.tipologia_evento) {
      return res.status(400).json({ success: false, error: 'Nome evento e tipologia sono obbligatori' });
    }
    if (String(next.tipologia_evento).toLowerCase() === 'elezioni' && !canCreateElectionEvent(req.user)) {
      return res.status(403).json({ success: false, error: 'ELECTION_EVENT_ADMIN_ONLY' });
    }

    const needsReview = approvalSchemaAvailable && !req.user?.isAdmin && hasSubstantialEventChange(existing, next);
    const nextStatus = needsReview ? 'PENDING' : existing.approval_status;
    const values = [
      next.nome_evento, next.tipologia_evento, next.tipo_elezione, next.paese_evento, next.regione_evento,
      next.provincia_evento, next.comune_evento, next.indirizzo_evento, next.giorno_inizio, next.giorno_fine,
      next.orario_inizio, next.orario_fine, next.orario_inizio_giorno2, next.orario_fine_giorno2,
      existing.organizzatore
    ];

    let result;
    if (approvalSchemaAvailable) {
      result = await pool.query(
        `UPDATE eventi SET
           nome_evento=$1, tipologia_evento=$2, tipo_elezione=$3, paese_evento=$4, regione_evento=$5,
           provincia_evento=$6, comune_evento=$7, indirizzo_evento=$8, giorno_inizio=$9, giorno_fine=$10,
           orario_inizio=$11, orario_fine=$12, orario_inizio_giorno2=$13, orario_fine_giorno2=$14,
           organizzatore=$15, approval_status=$16,
           approval_requested_at=CASE WHEN $17 THEN NOW() ELSE approval_requested_at END,
           approved_at=CASE WHEN $17 THEN NULL ELSE approved_at END,
           approved_by_user_id=CASE WHEN $17 THEN NULL ELSE approved_by_user_id END,
           rejection_reason=CASE WHEN $17 THEN NULL ELSE rejection_reason END,
           updated_at=CURRENT_TIMESTAMP
         WHERE id=$18 RETURNING *`,
        [...values, nextStatus, needsReview, req.params.id]
      );
    } else {
      if (!req.user?.isAdmin) throw new EventApprovalSchemaRequiredError();
      result = await pool.query(
        `UPDATE eventi SET
           nome_evento=$1, tipologia_evento=$2, tipo_elezione=$3, paese_evento=$4, regione_evento=$5,
           provincia_evento=$6, comune_evento=$7, indirizzo_evento=$8, giorno_inizio=$9, giorno_fine=$10,
           orario_inizio=$11, orario_fine=$12, orario_inizio_giorno2=$13, orario_fine_giorno2=$14,
           organizzatore=$15, updated_at=CURRENT_TIMESTAMP
         WHERE id=$16 RETURNING *`,
        [...values, req.params.id]
      );
    }

    return res.json({
      success: true,
      data: result.rows[0],
      approval: approvalSchemaAvailable ? { status: nextStatus, pending_staff_review: needsReview } : { status: 'APPROVED', legacy: true }
    });
  } catch (error) {
    if (error?.code === 'EVENT_APPROVAL_SCHEMA_REQUIRED') {
      return res.status(error.statusCode || 503).json({ success: false, error: error.code, message: error.message });
    }
    console.error('❌ Errore nell\'aggiornamento evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

// DELETE /api/eventi/:id - Admin o creatore della richiesta può ritirarla/eliminarla.
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    let existingResult;
    let approvalSchemaAvailable = true;
    try {
      existingResult = await pool.query('SELECT id, creator_user_id, approval_status FROM eventi WHERE id = $1', [req.params.id]);
    } catch (error) {
      if (!isApprovalSchemaError(error)) throw error;
      approvalSchemaAvailable = false;
      existingResult = await pool.query('SELECT id FROM eventi WHERE id = $1', [req.params.id]);
    }
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ success: false, error: 'Evento non trovato' });

    if (!req.user?.isAdmin) {
      if (!approvalSchemaAvailable || !canRequestEvent(req.user) || String(existing.creator_user_id || '') !== String(req.userId)) {
        return res.status(403).json({ success: false, error: 'EVENT_DELETE_NOT_ALLOWED' });
      }
    }

    await pool.query('DELETE FROM eventi WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Evento eliminato con successo' });
  } catch (error) {
    console.error('❌ Errore eliminazione evento:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server', details: error.message });
  }
});

module.exports = router;
