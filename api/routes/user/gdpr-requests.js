'use strict';
const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../config/db');
const {parseRightsHistoryQuery, readRightsHistory} = require('../../services/gdprRightsHistoryService');

const currentUserId = req => req.userId || req.user?.id;

// GET /api/user/gdpr-requests — return REAL saved rights requests only.
// Never return a fabricated empty history after a database failure.
router.get('/', verifyToken, async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    return res.status(401).json({success:false,error:'Autenticazione richiesta'});
  }
  const options = parseRightsHistoryQuery(req.query || {});
  if (!options) {
    return res.status(400).json({
      success:false,error:'Parametri di paginazione non validi'
    });
  }
  try {
    const history = await readRightsHistory(pool, userId, options);
    return res.json({
      success:true,
      data:history.data.map(row=>({
        id:row.id,
        tipo:row.request_type,
        stato:row.status,
        data_richiesta:row.created_at,
        data_elaborazione:row.processed_at
      })),
      pagination:history.pagination
    });
  } catch(error) {
    console.error('Errore nel recupero richieste GDPR:',error?.code||'QUERY_FAILED');
    return res.status(503).json({
      success:false,error:'Impossibile verificare lo storico delle richieste in questo momento'
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
  // Optional client-generated UUIDv4: the client MUST reuse exactly the
  // same value when retrying an uncertain HTTP request. No additional
  // database column or uniqueness migration is needed: id is already a PK.
  // Legacy callers without a key retain the old behavior (new request).
  const header = req.headers?.['idempotency-key'];
  if (header !== undefined && (
    typeof header !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(header)
  )) {
    return res.status(400).json({
      success: false, error: 'Idempotency-Key non valida: serve un UUID v4'
    });
  }
  const requestId = header === undefined ? crypto.randomUUID() : header.toLowerCase();
  const data = JSON.stringify({source: 'gdpr_requests_api', details: dettagli});
  try {
    // Conflict handling is race-safe at the UNIQUE/PRIMARY KEY constraint:
    // ON CONFLICT DO NOTHING waits for a concurrent insert to settle.
    // The follow-up SELECT is a NEW READ COMMITTED snapshot, which can see
    // the winner after an in-flight insert commits.
    const result = await pool.query(
      'INSERT INTO public.user_rights_requests ' +
      '(id, user_id, request_type, request_data, status) ' +
      "VALUES ($1::uuid, $2, $3, $4::jsonb, 'pending') " +
      'ON CONFLICT (id) DO NOTHING ' +
      'RETURNING id, request_type, status, created_at',
      [requestId, userId, tipo, data]
    );
    let stored = result.rows?.[0];
    if (stored && (!stored.id || stored.status !== 'pending')) {
      throw Error('GDPR_RIGHTS_REQUEST_NOT_PERSISTED');
    }
    const replay = !stored;
    if (replay) {
      const previous = await pool.query(
        'SELECT id, request_type, status, created_at ' +
        'FROM public.user_rights_requests ' +
        'WHERE id=$1::uuid AND user_id=$2 AND request_type=$3 ' +
        'AND request_data=$4::jsonb LIMIT 1',
        [requestId, userId, tipo, data]
      );
      stored = previous.rows?.[0];
      // A key for someone else's request or with different details may
      // never leak that user's metadata or mutate their request.
      if (!stored?.id) {
        return res.status(409).json({
          success: false,
          error: 'Chiave di richiesta già utilizzata o richiesta non verificabile'
        });
      }
    }
    if (!stored?.id || (!replay && stored.status !== 'pending')) {
      throw Error('GDPR_RIGHTS_REQUEST_NOT_PERSISTED');
    }
    return res.status(replay ? 200 : 201).json({
      success: true,
      message: replay ? 'Richiesta GDPR già registrata' : 'Richiesta GDPR registrata con successo',
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
