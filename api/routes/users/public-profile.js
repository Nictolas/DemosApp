const express = require('express');
const { getPool } = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const { decompressUserLocation } = require('../../utils/locationUtils');
const { getAccountSubject } = require('../../services/accountCapabilitiesService');
const { getPoliticalConsentState } = require('../../services/politicalConsentService');

const router = express.Router();
const pool = getPool();
const SCHEMA_FALLBACK_CODES = new Set(['42P01', '42703']);
const PUBLIC_STATUSES = new Set(['a', 'v']);

const REPRESENTATIVE_FIELDS = [
  ['rappresentante_europeo', 'europeo'],
  ['rappresentante_camera', 'camera'],
  ['rappresentante_senato', 'senato'],
  ['rappresentante_regionale', 'regione'],
  ['rappresentante_comune', 'comune'],
];
const CANDIDATE_FIELDS = [
  ['candidato_europeo', 'europeo'],
  ['candidato_camera', 'camera'],
  ['candidato_senato', 'senato'],
  ['candidato_regionale', 'regione'],
  ['candidato_comune', 'comune'],
];
const MINISTRIES = [
  'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno',
  'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente',
  'ambiente_sicurezza_energetica', 'cultura', 'sport',
];

function normalizeAvatar(value) {
  if (!value) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value !== 'string') return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
}

async function loadPublicUser(userId) {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.nome, u.cognome,
         COALESCE(up.grado_elezione, u.grado_elezione) AS grado_elezione,
         COALESCE(up.paese_elezione, u.paese_elezione) AS paese_elezione,
         COALESCE(up.regione_elezione, u.regione_elezione) AS regione_elezione,
         COALESCE(up.provincia_elezione, u.provincia_elezione) AS provincia_elezione,
         COALESCE(up.comune_elezione, u.comune_elezione) AS comune_elezione,
         COALESCE(up.grado_candidatura, u.grado_candidatura) AS grado_candidatura,
         COALESCE(up.paese_candidatura, u.paese_candidatura) AS paese_candidatura,
         COALESCE(up.regione_candidatura, u.regione_candidatura) AS regione_candidatura,
         COALESCE(up.provincia_candidatura, u.provincia_candidatura) AS provincia_candidatura,
         COALESCE(up.comune_candidatura, u.comune_candidatura) AS comune_candidatura,
         COALESCE(up.avatar_config::text, u.avatar_config::text) AS avatar_config,
         COALESCE(up.facebook_url, u.facebook_url) AS facebook_url,
         COALESCE(up.twitter_url, u.twitter_url) AS twitter_url,
         COALESCE(up.instagram_url, u.instagram_url) AS instagram_url,
         COALESCE(up.linkedin_url, u.linkedin_url) AS linkedin_url,
         COALESCE(up.telegram_url, u.telegram_url) AS telegram_url,
         COALESCE(up.website_url, u.website_url) AS website_url,
         COALESCE(up.twitch_url, u.twitch_url) AS twitch_url,
         COALESCE(up.youtube_url, u.youtube_url) AS youtube_url,
         COALESCE(ur.rappresentante_europeo, u.rappresentante_europeo) AS rappresentante_europeo,
         COALESCE(ur.rappresentante_camera, u.rappresentante_camera) AS rappresentante_camera,
         COALESCE(ur.rappresentante_senato, u.rappresentante_senato) AS rappresentante_senato,
         COALESCE(ur.rappresentante_regionale, u.rappresentante_regionale) AS rappresentante_regionale,
         COALESCE(ur.rappresentante_comune, u.rappresentante_comune) AS rappresentante_comune,
         COALESCE(ur.candidato_europeo, u.candidato_europeo) AS candidato_europeo,
         COALESCE(ur.candidato_camera, u.candidato_camera) AS candidato_camera,
         COALESCE(ur.candidato_senato, u.candidato_senato) AS candidato_senato,
         COALESCE(ur.candidato_regionale, u.candidato_regionale) AS candidato_regionale,
         COALESCE(ur.candidato_comune, u.candidato_comune) AS candidato_comune
       FROM users u
       LEFT JOIN user_profile up ON up.user_id = u.id
       LEFT JOIN user_representatives ur ON ur.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return result.rows[0] || null;
  } catch (error) {
    if (!SCHEMA_FALLBACK_CODES.has(error?.code)) throw error;
    const result = await pool.query(
      `SELECT
         id, nome, cognome,
         grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
         grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
         avatar_config, facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url,
         website_url, twitch_url, youtube_url,
         rappresentante_europeo, rappresentante_camera, rappresentante_senato,
         rappresentante_regionale, rappresentante_comune,
         candidato_europeo, candidato_camera, candidato_senato, candidato_regionale, candidato_comune
       FROM users
       WHERE id = $1`,
      [userId],
    );
    return result.rows[0] || null;
  }
}

async function loadSelectionDetails(user, fields) {
  const ids = [...new Set(fields.map(([field]) => user[field]).filter(Boolean).map(String))];
  if (ids.length === 0) return {};

  const result = await pool.query(
    `SELECT id, nome, cognome, ruolo, avatar_config
     FROM users
     WHERE id::text = ANY($1::text[])
       AND status IN ('a', 'v')`,
    [ids],
  );
  const byId = new Map(result.rows.map((row) => [String(row.id), row]));
  const output = {};
  for (const [field, category] of fields) {
    const selectedId = user[field];
    const selected = selectedId ? byId.get(String(selectedId)) : null;
    if (selected) output[category] = [{ ...selected, avatar_config: normalizeAvatar(selected.avatar_config) }];
  }
  return output;
}

async function loadIdealGovernment(userId) {
  // These selections are personal political preferences, even for public
  // politicians/candidates. Public-profile status does not override Article 9.
  const consent = await getPoliticalConsentState(pool, userId);
  if (!consent.granted) return {};

  const output = {};
  for (const ministry of MINISTRIES) {
    try {
      // Fixed ministry allowlist; each SELECT checks consent in the same
      // statement as the vote to exclude rows surviving a concurrent revoke.
      const result = await pool.query(
        `SELECT v.nome_display
         FROM voti_${ministry} v
         JOIN users u ON u.id::text = v.userid::text
         LEFT JOIN user_consents uc ON uc.user_id = u.id
         WHERE v.userid::text = $1::text
           AND COALESCE(
             uc.political_opinions_consent, u.political_opinions_consent, false
           ) IS TRUE
         ORDER BY v.timestamp DESC
         LIMIT 1`,
        [userId],
      );
      if (result.rows[0]?.nome_display) output[ministry] = result.rows[0].nome_display;
    } catch (error) {
      // Some supported legacy installations do not have every ministry table.
      if (error?.code !== '42P01') throw error;
    }
  }
  return output;
}

// Proiezione pubblica minima per Politici/Candidati.
// Non deve mai diventare un alias dell'endpoint Admin /api/users/:userId.
router.get('/:userId/public-profile', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
}, verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const subject = await getAccountSubject(pool, userId);
    if (
      !subject ||
      !PUBLIC_STATUSES.has(String(subject.status || '').toLowerCase()) ||
      (!subject.capabilities?.isPolitician && !subject.capabilities?.isCandidate)
    ) {
      return res.status(404).json({ success: false, error: 'Profilo pubblico non disponibile' });
    }

    const rawUser = await loadPublicUser(userId);
    if (!rawUser) {
      return res.status(404).json({ success: false, error: 'Profilo pubblico non disponibile' });
    }

    const decompressed = decompressUserLocation(rawUser);
    const user = {
      id: decompressed.id,
      nome: decompressed.nome,
      cognome: decompressed.cognome,
      ruolo: subject.legacyRole,
      capabilities: subject.capabilities,
      grado_elezione: decompressed.grado_elezione,
      paese_elezione: decompressed.paese_elezione,
      regione_elezione: decompressed.regione_elezione,
      provincia_elezione: decompressed.provincia_elezione,
      comune_elezione: decompressed.comune_elezione,
      grado_candidatura: decompressed.grado_candidatura,
      paese_candidatura: decompressed.paese_candidatura,
      regione_candidatura: decompressed.regione_candidatura,
      provincia_candidatura: decompressed.provincia_candidatura,
      comune_candidatura: decompressed.comune_candidatura,
      avatar_config: normalizeAvatar(rawUser.avatar_config),
      facebook_url: rawUser.facebook_url || null,
      twitter_url: rawUser.twitter_url || null,
      instagram_url: rawUser.instagram_url || null,
      linkedin_url: rawUser.linkedin_url || null,
      telegram_url: rawUser.telegram_url || null,
      website_url: rawUser.website_url || null,
      twitch_url: rawUser.twitch_url || null,
      youtube_url: rawUser.youtube_url || null,
      rappresentante_europeo: rawUser.rappresentante_europeo || null,
      rappresentante_camera: rawUser.rappresentante_camera || null,
      rappresentante_senato: rawUser.rappresentante_senato || null,
      rappresentante_regionale: rawUser.rappresentante_regionale || null,
      rappresentante_comune: rawUser.rappresentante_comune || null,
      candidato_europeo: rawUser.candidato_europeo || null,
      candidato_camera: rawUser.candidato_camera || null,
      candidato_senato: rawUser.candidato_senato || null,
      candidato_regionale: rawUser.candidato_regionale || null,
      candidato_comune: rawUser.candidato_comune || null,
    };

    const [rappresentanti, candidati, governoIdeale] = await Promise.all([
      loadSelectionDetails(rawUser, REPRESENTATIVE_FIELDS),
      loadSelectionDetails(rawUser, CANDIDATE_FIELDS),
      loadIdealGovernment(userId),
    ]);

    // If consent was revoked while the public projection was being built,
    // suppress any earlier personal political snapshot before serialization.
    const finalConsent = await getPoliticalConsentState(pool, userId);

    return res.json({
      success: true,
      user,
      public: {
        rappresentanti,
        candidati,
        governoIdeale: finalConsent.granted ? governoIdeale : {},
      },
    });
  } catch (error) {
    // SQL stacks and params can reveal sensitive profile data. Log only a fixed label.
    console.error('Errore interno nella proiezione pubblica P/C');
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

module.exports = router;
