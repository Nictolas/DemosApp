const express = require('express');
const { randomUUID } = require('crypto');
const { validateEvidenceUrl } = require('../utils/recognitionEvidence');
const { decrypt: decryptEmail } = require('../utils/emailCrypto');
const { peekPublicNameProof, consumePublicNameProof } = require('../services/ciePublicIdentityProofStore');
const { getIdentityVerificationStatus } = require('../services/identityVerificationStore');
const { pool, verifyToken, requireAdmin } = require('../middleware/auth');
const { mirrorApprovedPoliticalRecognition } = require('../services/politicalLifecycleService');
const { invalidateAuthUserCache } = require('../services/redisCache');

const router = express.Router();


const isVerifiedCie = (identity) =>
  identity?.verified === true && String(identity.provider || '').toUpperCase() === 'CIE';

// Current citizen can view only their own short-lived, account-bound CIE
// public-name proof. No fiscal number or internal person_key is returned.
router.get('/cie-identity', verifyToken, async (req, res) => {
  try {
    const identity = await getIdentityVerificationStatus(req.userId);
    if (!isVerifiedCie(identity)) {
      return res.json({ success: true, ready: false });
    }
    const proof = await peekPublicNameProof(req.userId);
    return res.json({
      success: true,
      ready: Boolean(proof),
      ...(proof ? { nome: proof.givenName, cognome: proof.familyName } : {})
    });
  } catch (error) {
    console.error('Errore verifica certificazione ruolo pubblico:', error?.message);
    return res.status(503).json({ success: false, error: 'Certificazione CIE temporaneamente non disponibile' });
  }
});

// Request status is persisted so that users can see the outcome after review.
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tipo_ruolo, status, created_at, updated_at, decision_at,
              fonte_elezione_url, fonte_candidatura_url
       FROM riconoscimenti WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('Errore lettura stato riconoscimento:', error?.message);
    return res.status(500).json({ success: false, error: 'Stato richiesta non disponibile' });
  }
});

// POST /api/riconoscimenti - Crea o aggiorna una richiesta di riconoscimento per l'utente autenticato
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const identity = await getIdentityVerificationStatus(userId);
    if (!isVerifiedCie(identity)) {
      return res.status(403).json({
        success: false, code: 'CIE_REQUIRED',
        message: 'Devi verificare la tua identita con CIE prima di richiedere il riconoscimento.'
      });
    }

    const {
      tipo_ruolo,
      paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_elezione,
      paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, grado_candidatura
    } = req.body || {};

    if (!['P', 'C', 'CP'].includes(tipo_ruolo)) {
      return res.status(400).json({ success: false, message: 'Ruolo richiesto non valido.' });
    }

    if ((tipo_ruolo === 'P' || tipo_ruolo === 'CP') && !grado_elezione) {
      return res.status(400).json({ success: false, message: 'Indica il tipo di elezione in cui sei stato eletto.' });
    }
    if ((tipo_ruolo === 'C' || tipo_ruolo === 'CP') && !grado_candidatura) {
      return res.status(400).json({ success: false, message: 'Indica il tipo di elezione a cui sei candidato.' });
    }

    const fonteElezioneUrl = (tipo_ruolo === 'P' || tipo_ruolo === 'CP')
      ? validateEvidenceUrl(req.body?.fonte_elezione_url) : null;
    const fonteCandidaturaUrl = (tipo_ruolo === 'C' || tipo_ruolo === 'CP')
      ? validateEvidenceUrl(req.body?.fonte_candidatura_url) : null;
    if (((tipo_ruolo === 'P' || tipo_ruolo === 'CP') && !fonteElezioneUrl) ||
        ((tipo_ruolo === 'C' || tipo_ruolo === 'CP') && !fonteCandidaturaUrl)) {
      return res.status(400).json({
        success: false, code: 'OFFICIAL_SOURCE_REQUIRED',
        message: 'Inserisci un URL HTTPS valido per ogni ruolo richiesto.'
      });
    }

    // A new, purpose-specific CIE login is required, even if the account
    // was previously verified with CIE. Never read editable profile names.
    const publicIdentity = await consumePublicNameProof(userId);
    if (!publicIdentity) {
      return res.status(409).json({
        success: false, code: 'CIE_PUBLIC_NAMES_REQUIRED',
        message: 'Autenticati nuovamente con CIE per verificare nome e cognome prima di inviare la richiesta.'
      });
    }

    const query = `
      INSERT INTO riconoscimenti (
        id, user_id, tipo_ruolo, nome, cognome, email,
        paese_elezione, regione_elezione, provincia_elezione, comune_elezione, grado_elezione,
        paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura, grado_candidatura,
        fonte_elezione_url, fonte_candidatura_url, cie_names_verified_at, status, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),'pending',NOW(),NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        tipo_ruolo = EXCLUDED.tipo_ruolo,
        nome = EXCLUDED.nome, cognome = EXCLUDED.cognome, email = EXCLUDED.email,
        paese_elezione = EXCLUDED.paese_elezione,
        regione_elezione = EXCLUDED.regione_elezione,
        provincia_elezione = EXCLUDED.provincia_elezione,
        comune_elezione = EXCLUDED.comune_elezione,
        grado_elezione = EXCLUDED.grado_elezione,
        paese_candidatura = EXCLUDED.paese_candidatura,
        regione_candidatura = EXCLUDED.regione_candidatura,
        provincia_candidatura = EXCLUDED.provincia_candidatura,
        comune_candidatura = EXCLUDED.comune_candidatura,
        grado_candidatura = EXCLUDED.grado_candidatura,
        fonte_elezione_url = EXCLUDED.fonte_elezione_url,
        fonte_candidatura_url = EXCLUDED.fonte_candidatura_url,
        cie_names_verified_at = NOW(),
        status = 'pending', decision_at = NULL,
        created_at = NOW(), updated_at = NOW()
      RETURNING id, tipo_ruolo, status, created_at
    `;
    const values = [
      randomUUID(), userId, tipo_ruolo,
      publicIdentity.givenName, publicIdentity.familyName, '',
      paese_elezione || null, regione_elezione || null, provincia_elezione || null,
      comune_elezione || null, grado_elezione || null,
      paese_candidatura || null, regione_candidatura || null, provincia_candidatura || null,
      comune_candidatura || null, grado_candidatura || null,
      fonteElezioneUrl, fonteCandidaturaUrl
    ];
    const result = await pool.query(query, values);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Errore creazione richiesta riconoscimento:', error?.message);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// GET /api/riconoscimenti - Lista tutte le richieste pendenti (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        r.*,
        u.ruolo AS ruolo_corrente,
        iv.status AS identity_status,
        iv.provider AS identity_provider
      FROM riconoscimenti r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN identity_verifications iv ON iv.user_id = r.user_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      `
    );

    return res.json({
      success: true,
      data: result.rows.map(row => ({ ...row, email: decryptEmail(row.email) }))
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare le richieste di riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/riconoscimenti/:id/approve - Approva una richiesta (solo admin)
router.post('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const riconoscimentoResult = await client.query(
      'SELECT * FROM riconoscimenti WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (riconoscimentoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Richiesta non trovata'
      });
    }

    const r = riconoscimentoResult.rows[0];
    const identity = await getIdentityVerificationStatus(r.user_id, client);
    if (r.status !== 'pending' || !isVerifiedCie(identity) || !r.cie_names_verified_at ||
        ((r.tipo_ruolo === 'P' || r.tipo_ruolo === 'CP') && !validateEvidenceUrl(r.fonte_elezione_url)) ||
        ((r.tipo_ruolo === 'C' || r.tipo_ruolo === 'CP') && !validateEvidenceUrl(r.fonte_candidatura_url))) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'La richiesta non e approvabile: stato, CIE o fonte ufficiale mancante.'
      });
    }
    const nuovoRuolo = r.tipo_ruolo;

    // Prepara i campi da aggiornare sull'utente
    const updateFields = ['ruolo'];
    const updateValues = [nuovoRuolo];

    // Dati di elezione solo se il ruolo include componente Politico
    if (nuovoRuolo === 'P' || nuovoRuolo === 'CP') {
      updateFields.push(
        'paese_elezione',
        'regione_elezione',
        'provincia_elezione',
        'comune_elezione',
        'grado_elezione'
      );
      updateValues.push(
        r.paese_elezione || null,
        r.regione_elezione || null,
        r.provincia_elezione || null,
        r.comune_elezione || null,
        r.grado_elezione || null
      );
    }

    // Dati di candidatura solo se il ruolo include componente Candidato
    if (nuovoRuolo === 'C' || nuovoRuolo === 'CP') {
      updateFields.push(
        'paese_candidatura',
        'regione_candidatura',
        'provincia_candidatura',
        'comune_candidatura',
        'grado_candidatura'
      );
      updateValues.push(
        r.paese_candidatura || null,
        r.regione_candidatura || null,
        r.provincia_candidatura || null,
        r.comune_candidatura || null,
        r.grado_candidatura || null
      );
    }

    const setClause = updateFields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(', ');

    updateValues.push(r.user_id);

    const updateQuery = `
      UPDATE users
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${updateValues.length}
      RETURNING id, ruolo
    `;

    const updateResult = await client.query(updateQuery, updateValues);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Public identity is taken from the fresh signed CIE response stored
    // in this request, never from an editable legacy user profile.
    await client.query(
      'UPDATE users SET nome = $1, cognome = $2 WHERE id = $3',
      [r.nome, r.cognome, r.user_id]
    );

    // Se il nuovo modello capability è presente, alimenta anche candidature/mandati.
    // In assenza della migrazione il servizio fa rollback al savepoint e mantiene il flusso legacy.
    const capabilitySync = await mirrorApprovedPoliticalRecognition(client, r);

    const finalRoleResult = await client.query(
      'SELECT ruolo FROM users WHERE id = $1',
      [r.user_id]
    );
    const finalLegacyRole = finalRoleResult.rows[0]?.ruolo || updateResult.rows[0].ruolo;

    // Keep a minimal outcome record so the user can see the decision.
    await client.query(
      "UPDATE riconoscimenti SET status = 'approved', decision_at = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    await invalidateAuthUserCache(r.user_id);

    return res.json({
      success: true,
      message: 'Richiesta approvata e ruolo aggiornato',
      data: {
        user_id: updateResult.rows[0].id,
        nuovo_ruolo: finalLegacyRole,
        capability_model_sync: capabilitySync.usedCapabilityModel
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Errore nell\'approvare richiesta di riconoscimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  } finally {
    client.release();
  }
});

// POST /api/riconoscimenti/:id/reject - Rifiuta una richiesta (solo admin)
router.post('/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE riconoscimenti SET status = 'rejected', nome = '', cognome = '', email = '', cie_names_verified_at = NULL, decision_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Richiesta pendente non trovata' });
    return res.json({ success: true, message: 'Richiesta respinta' });
  } catch (error) {
    console.error('Errore rifiuto riconoscimento:', error?.message);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;

