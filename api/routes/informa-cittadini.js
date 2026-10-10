'use strict';

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  authorizeMunicipalInstitutionSender,
  normalizeMunicipalNoticePayload,
  isMunicipalCommunicationSchemaError,
} = require('../services/municipalInstitutionCommunicationService');

const pool = getPool();

function authorizationStatus(reason) {
  if (reason === 'CANONICAL_TERRITORY_REQUIRED') return 503;
  return 403;
}

// POST /api/informa-cittadini
// The authenticated actor is always the author. The target municipality is derived
// only from one OFFICIAL canonical municipal authority; free-form "dove" is descriptive.
router.post('/', verifyToken, async (req, res) => {
  let payload;
  try {
    payload = normalizeMunicipalNoticePayload(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Dati avviso non validi',
      code: error.code || 'INFORMA_CITTADINI_PAYLOAD_INVALID',
    });
  }

  try {
    const authority = await authorizeMunicipalInstitutionSender(pool, { user: req.user });
    if (!authority.authorized) {
      return res.status(authorizationStatus(authority.reason)).json({
        success: false,
        error: 'Competenza territoriale non autorizzata',
        code: authority.reason,
      });
    }

    const result = await pool.query(
      `INSERT INTO institutional_territorial_notices (
         author_user_id, tipologia, dove, dal_giorno, al_giorno,
         jurisdiction_id, territory_type, territory_code, territory_label,
         authority_source, authority_verification_level, metadata
       ) VALUES (
         $1, $2, $3, $4::date, $5::date,
         $6, $7, $8, $9, $10, $11, $12::jsonb
       )
       RETURNING id, author_user_id, tipologia, dove, dal_giorno, al_giorno,
                 jurisdiction_id, territory_type, territory_code, territory_label, created_at`,
      [
        req.user.id,
        payload.tipologia,
        payload.dove,
        payload.dalGiorno,
        payload.alGiorno,
        authority.jurisdictionId,
        authority.territoryType,
        authority.territoryCode,
        authority.territoryLabel,
        authority.authoritySource,
        authority.verificationLevel,
        JSON.stringify({ authorityDerivedServerSide: true }),
      ],
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Comunicazione ai cittadini creata con successo',
    });
  } catch (error) {
    if (isMunicipalCommunicationSchemaError(error)) {
      return res.status(503).json({
        success: false,
        error: 'Schema territoriale comunicazioni non disponibile',
        code: 'INFORMA_CITTADINI_SCHEMA_REQUIRED',
      });
    }
    console.error('Errore nella creazione di Informa Cittadini:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;
