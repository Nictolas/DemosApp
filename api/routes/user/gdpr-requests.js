'use strict';
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../config/db');

const currentUserId = req => req.userId || req.user?.id;

// GET /api/user/gdpr-requests — return REAL saved rights requests only.
// Never return a fabricated empty history after a database failure.
router.get('/', verifyToken, async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
  }
  try {
    // Row security can apply a USING predicate which hides some or ALL
    // historical requests, even when a SELECT policy nominally exists.
    // Until a separately reviewed backend read-all role/view is available,
    // never advertise an incomplete list as the user's complete history.
    const scope = await pool.query(
      "SELECT NOT pg_catalog.row_security_active(" +
      "'public.user_rights_requests'::regclass) AS complete_visibility"
    );
    if (scope.rows?.[0]?.complete_visibility !== true) {
      throw Error('GDPR_RIGHTS_HISTORY_RLS_UNVERIFIABLE');
    }
    const result = await pool.query(
      'SELECT id, request_type, status, created_at, processed_at ' +
      'FROM public.user_rights_requests ' +
      'WHERE user_id = $1 ' +
      'ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 50',
      [userId]
    );
    return res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        tipo: row.request_type,
        stato: row.status,
        data_richiesta: row.created_at,
        data_elaborazione: row.processed_at
      }))
    });
  } catch (error) {
    console.error('Errore nel recupero richieste GDPR:', error?.code || 'QUERY_FAILED');
    return res.status(503).json({
      success: false,
      error: 'Impossibile recuperare lo storico delle richieste in questo momento'
    });
  }
});

// POST /api/user/gdpr-requests — acknowledge only after PostgreSQL INSERT.
// Uses the existing DPO-visible public.user_rights_requests relation;
// does not create new tables or bypass the authenticated user scope.
router.post('/', verifyToken, async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
  }
  const tipo = req.body?.tipo;
  const dettagli = req.body?.dettagli ?? '';
  if (typeof tipo !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(tipo)) {
    return res.status(400).json({
      success: false,
      error: 'Tipo di richiesta non valido'
    });
  }
  if (typeof dettagli !== 'string' || dettagli.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Dettagli non validi o troppo lunghi (massimo 2000 caratteri)'
    });
  }
  try {
    const result = await pool.query(
      'INSERT INTO public.user_rights_requests ' +
      '(user_id, request_type, request_data, status) ' +
      "VALUES ($1, $2, $3::jsonb, 'pending') " +
      'RETURNING id, request_type, status, created_at',
      [userId, tipo, JSON.stringify({ source: 'gdpr_requests_api', details: dettagli })]
    );
    const stored = result.rows?.[0];
    if (!stored?.id || stored.status !== 'pending') {
      throw Error('GDPR_RIGHTS_REQUEST_NOT_PERSISTED');
    }
    return res.status(201).json({
      success: true,
      message: 'Richiesta GDPR registrata con successo',
      data: {
        id: stored.id,
        tipo: stored.request_type,
        stato: stored.status,
        data_richiesta: stored.created_at
      }
    });
  } catch (error) {
    // Never expose the details of a rights request or database internals in
    // logs/responses and NEVER invent a receipt after a failed INSERT.
    console.error('Errore durante la registrazione richiesta GDPR:',
      error?.code || 'QUERY_FAILED');
    return res.status(503).json({
      success: false,
      error: 'Registrazione non confermata. Controlla lo storico delle richieste prima di riprovare, oppure contatta il DPO.'
    });
  }
});

module.exports = router;
