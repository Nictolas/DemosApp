const express = require('express');
const router = express.Router();
const { pool, verifyToken } = require('../../middleware/auth');
const { requirePoliticalConsent } = require('../../middleware/politicalConsent');
const { loadGovernmentVoteAvatars, parseExistingAvatar } = require('../../services/governoVoteAvatars');
const { displayGraziaName, normalizeGraziaName } = require('../../services/graziaCatalog');
const { parseGraziaAvatarConfig } = require('../../services/graziaAvatarConfig');

// Only the authenticated owner's existing selections. No leaderboards,
// personal data of other supporters, or speculative "favourites".
router.get('/', verifyToken, requirePoliticalConsent, async (req, res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    const { rows } = await pool.query(`
      SELECT
        ARRAY(
          SELECT DISTINCT BTRIM(v.nome)
          FROM voti_capo_stato v
          WHERE v.userid = u.id AND NULLIF(BTRIM(v.nome), '') IS NOT NULL
          ORDER BY BTRIM(v.nome)
        ) AS capo_stato,
        ARRAY(
          SELECT DISTINCT BTRIM(v.nome)
          FROM voti_grazia v
          WHERE v.userid = u.id AND NULLIF(BTRIM(v.nome), '') IS NOT NULL
            AND ($2::boolean OR EXISTS (
              SELECT 1 FROM public.grazia_carcerati gc
              WHERE gc.attivo = TRUE AND gc.pubblicato = TRUE
                AND lower(btrim(gc.nome)) = lower(btrim(
                  CASE WHEN lower(btrim(v.nome)) = 'roggero' THEN 'Mario Roggero' ELSE v.nome END
                ))
            ))
          ORDER BY BTRIM(v.nome)
        ) AS grazia,
        ARRAY(
          SELECT DISTINCT BTRIM(v.legge)
          FROM voti_amnistia v
          WHERE v.userid = u.id AND NULLIF(BTRIM(v.legge), '') IS NOT NULL
          ORDER BY BTRIM(v.legge)
        ) AS amnistia,
        ARRAY(
          SELECT DISTINCT COALESCE(
            NULLIF(BTRIM(resolved.titolo), ''), 'Iniziativa non più disponibile'
          )
          FROM voti_iniziative_popolari v
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              (
                SELECT NULLIF(BTRIM(cp.canonical_title), '')
                FROM civic_processes cp
                WHERE cp.id::text = v.iniziativa_id
                LIMIT 1
              ),
              (
                SELECT COALESCE(NULLIF(BTRIM(p.titolo), ''), NULLIF(BTRIM(p.nome), ''))
                FROM iniziative_popolari p
                WHERE p.id::text = v.iniziativa_id
                LIMIT 1
              ),
              (
                SELECT NULLIF(BTRIM(m.titolo), '')
                FROM iniziative_ministero m
                WHERE m.id = v.iniziativa_id OR m.id_ministero = v.iniziativa_id
                ORDER BY m.id LIMIT 1
              )
            ) AS titolo
          ) resolved ON true
          WHERE v.userid = u.id
            AND NULLIF(BTRIM(v.iniziativa_id), '') IS NOT NULL
        ) AS iniziativa_popolare,
        CASE WHEN a.id IS NOT NULL
          THEN jsonb_build_object('id', a.id, 'nome',
            COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', a.nome, a.cognome)), ''), 'Attivista'))
          ELSE NULL END AS attivista,
        CASE WHEN o.id IS NOT NULL
          THEN jsonb_build_object('id', o.id, 'nome',
            COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', o.nome, o.cognome)), ''), 'Organizzazione'))
          ELSE NULL END AS organizzazione,
        -- Avatars for the two selected subject IDs come from the SAME private
        -- owner query. Never look up names here: IDs avoid homonym matches.
        CASE WHEN LOWER(COALESCE(a.status, '')) IN ('a', 'v')
          THEN to_jsonb(a)->'avatar_config' ELSE NULL END AS attivista_avatar_config,
        CASE WHEN LOWER(COALESCE(o.status, '')) IN ('a', 'v')
          THEN to_jsonb(o)->'avatar_config' ELSE NULL END AS organizzazione_avatar_config
      FROM users u
      LEFT JOIN users a ON a.id = u.attivisti
      LEFT JOIN users o ON o.id = u.organizzazioni
      WHERE u.id = $1
    `, [req.userId, req.user?.isAdmin === true]);

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const selection = rows[0];
    const isAdmin = req.user?.isAdmin === true;

    // At most one additional public-profile lookup for all Capo di Stato
    // choices; never one database query or HTTP request per row.
    let capoStatoAvatars = {};
    try {
      capoStatoAvatars = await loadGovernmentVoteAvatars(pool, selection.capo_stato || []);
    } catch (error) {
      console.warn('Avatar delle altre scelte non disponibili:', error.message);
    }

    // Grazia portraits remain restricted to Admin until image permissions
    // are cleared. The public profile must never return them.
    const graziaAvatars = {};
    if (isAdmin && selection.grazia?.length) {
      try {
        const keys = [...new Set(selection.grazia.map(name =>
          normalizeGraziaName(displayGraziaName(name))
        ))].filter(Boolean);
        const { rows: portraits } = await pool.query(
          'SELECT nome_key, avatar_config FROM public.grazia_avatar_configs WHERE nome_key = ANY($1::text[])',
          [keys]
        );
        const byKey = new Map(portraits.map(row => [
          row.nome_key, parseGraziaAvatarConfig(row.avatar_config)
        ]));
        for (const name of selection.grazia) {
          const portrait = byKey.get(normalizeGraziaName(displayGraziaName(name)));
          if (portrait) graziaAvatars[name.trim().replace(/\\s+/g, ' ').toLowerCase()] = portrait;
        }
      } catch (error) {
        console.warn('Avatar Grazia non disponibili:', error.message);
      }
    }

    return res.json({
      success: true,
      data: {
        version: 2,
        capoStato: selection.capo_stato || [],
        grazia: selection.grazia || [],
        amnistia: selection.amnistia || [],
        iniziativaPopolare: selection.iniziativa_popolare || [],
        attivista: selection.attivista || null,
        organizzazione: selection.organizzazione || null,
        capoStatoAvatars,
        graziaAvatars,
        attivistaAvatar: parseExistingAvatar(selection.attivista_avatar_config),
        organizzazioneAvatar: parseExistingAvatar(selection.organizzazione_avatar_config),
      },
    });
  } catch (error) {
    console.error('Impossibile leggere le scelte del profilo:', error);
    return res.status(500).json({ success: false, error: 'Impossibile caricare le scelte' });
  }
});

module.exports = router;
