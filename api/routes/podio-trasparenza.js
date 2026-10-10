const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  TERRITORY_SCOPES,
  getPodiumLevels,
  getPodiumLevelByScope,
  buildOfficePodiumCaseSql,
} = require('../services/politicalJurisdictionRegistryService');

const pool = getPool();
const LEVELS = Object.freeze(getPodiumLevels());
const REGIONAL_LEVEL = getPodiumLevelByScope(TERRITORY_SCOPES.REGION);
const MUNICIPAL_LEVEL = getPodiumLevelByScope(TERRITORY_SCOPES.MUNICIPALITY);
const WINDOW_DAYS = 90;
const MAX_PER_LEVEL = 50;

const mandateLevelSql = (alias) => buildOfficePodiumCaseSql(`COALESCE(${alias}.jurisdiction->>'level', ${alias}.office_code, '')`);
const legacyLevelSql = (alias) => buildOfficePodiumCaseSql(`COALESCE(${alias}.grado_elezione, '')`);

router.get('/', verifyToken, async (req, res) => {
  try {
    const viewerResult = await pool.query(
      `SELECT regione_residenza, comune_residenza,
              to_regclass('public.political_mandates') IS NOT NULL AS has_mandates
       FROM users
       WHERE id = $1`,
      [req.userId]
    );

    if (viewerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    const viewer = viewerResult.rows[0];
    const region = viewer.regione_residenza || null;
    const municipality = viewer.comune_residenza || null;
    const hasMandates = viewer.has_mandates === true;

    const activePoliticianPredicate = hasMandates
      ? `EXISTS (
          SELECT 1
          FROM political_mandates pm
          WHERE pm.user_id::text = u.id::text
            AND pm.status = 'ACTIVE'
            AND pm.starts_at <= NOW()
            AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
            AND ${mandateLevelSql('pm')} = c.institutional_level
            AND (
              c.institutional_level <> '${REGIONAL_LEVEL}'
              OR LOWER(TRIM(COALESCE(pm.jurisdiction->>'region', u.regione_elezione, ''))) = LOWER(TRIM(COALESCE($1, '')))
            )
            AND (
              c.institutional_level <> '${MUNICIPAL_LEVEL}'
              OR LOWER(TRIM(COALESCE(pm.jurisdiction->>'municipality', u.comune_elezione, ''))) = LOWER(TRIM(COALESCE($2, '')))
            )
        )`
      : `u.ruolo IN ('P', 'CP', 'Politico', 'Candidato Politico')
         AND ${legacyLevelSql('u')} = c.institutional_level
         AND (
           c.institutional_level <> '${REGIONAL_LEVEL}'
           OR LOWER(TRIM(COALESCE(u.regione_elezione, ''))) = LOWER(TRIM(COALESCE($1, '')))
         )
         AND (
           c.institutional_level <> '${MUNICIPAL_LEVEL}'
           OR LOWER(TRIM(COALESCE(u.comune_elezione, ''))) = LOWER(TRIM(COALESCE($2, '')))
         )`;

    const rankingResult = await pool.query(
      `WITH aggregated AS (
         SELECT
           c.id_utente,
           u.nome,
           u.cognome,
           c.institutional_level,
           COUNT(DISTINCT c.institutional_vote_key)::int AS numero_voti,
           MAX(c.vote_date) AS ultimo_voto
         FROM comunicazioni c
         JOIN users u ON u.id::text = c.id_utente::text
         WHERE c.tipo = 'votazione'
           AND c.institutional_vote_key IS NOT NULL
           AND c.institutional_level = ANY($3::text[])
           AND c.vote_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
           AND c.vote_date <= CURRENT_DATE
           AND ${activePoliticianPredicate}
         GROUP BY c.id_utente, u.nome, u.cognome, c.institutional_level
       ), ranked AS (
         SELECT
           *,
           ROW_NUMBER() OVER (
             PARTITION BY institutional_level
             ORDER BY numero_voti DESC, ultimo_voto DESC, cognome ASC, nome ASC, id_utente ASC
           )::int AS posizione
         FROM aggregated
       )
       SELECT id_utente, nome, cognome, institutional_level, numero_voti, ultimo_voto, posizione
       FROM ranked
       WHERE posizione <= $5
       ORDER BY institutional_level, posizione`,
      [region, municipality, LEVELS, WINDOW_DAYS, MAX_PER_LEVEL]
    );

    const levels = Object.fromEntries(LEVELS.map((level) => [level, []]));
    for (const row of rankingResult.rows) {
      levels[row.institutional_level].push({
        id_utente: row.id_utente,
        nome: row.nome,
        cognome: row.cognome,
        numero_voti: Number(row.numero_voti) || 0,
        ultimo_voto: row.ultimo_voto,
        posizione: Number(row.posizione) || 0
      });
    }

    return res.json({
      success: true,
      window_days: WINDOW_DAYS,
      max_per_level: MAX_PER_LEVEL,
      levels
    });
  } catch (error) {
    if (['42703', '42P01'].includes(error?.code)) {
      return res.status(503).json({
        success: false,
        error: 'Podio non ancora disponibile: migrazione comunicazioni istituzionali non applicata'
      });
    }
    console.error('Errore nel Podio di Trasparenza:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;
