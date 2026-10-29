const express = require('express');
const router = express.Router();
const { pool, verifyToken } = require('../../middleware/auth');
const { requirePoliticalConsent } = require('../../middleware/politicalConsent');

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
            (
              -- Priority votes now reference the canonical civic process UUID.
              SELECT NULLIF(REGEXP_REPLACE(BTRIM(cp.canonical_title), '[[:space:]]+', ' ', 'g'), '')
              FROM civic_processes cp
              WHERE cp.id::text = v.iniziativa_id
              LIMIT 1
            ),
            (
              -- Older votes may use the official source's external ID.
              SELECT NULLIF(REGEXP_REPLACE(BTRIM(cp.canonical_title), '[[:space:]]+', ' ', 'g'), '')
              FROM civic_process_source_records csr
              JOIN civic_processes cp ON cp.id = csr.civic_process_id
              WHERE csr.external_id = v.iniziativa_id
              ORDER BY cp.id LIMIT 1
            ),
            (
              -- Preserve compatibility with the pre-registry ministero records.
              SELECT NULLIF(BTRIM(m.titolo), '')
              FROM iniziative_ministero m
              WHERE m.id = v.iniziativa_id OR m.id_ministero = v.iniziativa_id
              ORDER BY m.id LIMIT 1
            ),
            v.iniziativa_id
          )
          FROM voti_iniziative_popolari v
          WHERE v.userid = u.id AND NULLIF(BTRIM(v.iniziativa_id), '') IS NOT NULL
        ) AS iniziativa_popolare,
        CASE WHEN a.id IS NOT NULL
          THEN jsonb_build_object('id', a.id, 'nome',
            COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', a.nome, a.cognome)), ''), 'Attivista'))
          ELSE NULL END AS attivista,
        CASE WHEN o.id IS NOT NULL
          THEN jsonb_build_object('id', o.id, 'nome',
            COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', o.nome, o.cognome)), ''), 'Organizzazione'))
          ELSE NULL END AS organizzazione
      FROM users u
      LEFT JOIN users a ON a.id = u.attivisti
      LEFT JOIN users o ON o.id = u.organizzazioni
      WHERE u.id = $1
    `, [req.userId]);

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }
    const selection = rows[0];
    return res.json({
      success: true,
      data: {
        capoStato: selection.capo_stato || [],
        grazia: selection.grazia || [],
        amnistia: selection.amnistia || [],
        iniziativaPopolare: selection.iniziativa_popolare || [],
        attivista: selection.attivista || null,
        organizzazione: selection.organizzazione || null,
      },
    });
  } catch (error) {
    console.error('Impossibile leggere le scelte del profilo:', error);
    return res.status(500).json({ success: false, error: 'Impossibile caricare le scelte' });
  }
});

module.exports = router;
