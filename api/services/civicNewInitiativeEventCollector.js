'use strict';

/**
 * Rileva solo nuove raccolte firme presenti nella fonte ufficiale Ministero.
 * Non invia push: crea una riga per evento in una outbox a ID univoco.
 * Attivazione esplicita DOPO applicazione e baseline della migrazione.
 */
function isCivicEventCollectionEnabled(env = process.env) {
  return env.CIVIC_NEW_INITIATIVE_EVENTS_ENABLED === 'true';
}

async function collectMinisteroNewInitiatives(pool, { enabled = isCivicEventCollectionEnabled() } = {}) {
  if (!enabled) return { enabled: false, recorded: 0 };
  if (!pool || typeof pool.query !== 'function') throw new TypeError('DATABASE_POOL_REQUIRED');

  // Gli ID ministeriali sono la chiave: titolo, firme e scadenza possono cambiare.
  // La baseline della migrazione contiene gia' tutti i record preesistenti.
  const result = await pool.query(`
    INSERT INTO civic_new_initiative_notifications
      (category, official_id, title, target_path, status)
    SELECT DISTINCT ON (category, official_id)
      category, official_id, title, target_path, 'pending'
    FROM (
      SELECT
        CASE WHEN lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) = 'referendum abrogativo'
          THEN 'referendum_abrogativi'
          ELSE 'iniziative_popolari' END AS category,
        btrim(m.id_ministero::text) AS official_id,
        m.titolo AS title,
        CASE WHEN lower(m.tipo) LIKE '%referendum%'
          THEN '/referendum-abrogativi'
          ELSE '/iniziative-popolari' END AS target_path
      FROM iniziative_ministero AS m
      WHERE m.id_ministero IS NOT NULL
        AND btrim(m.id_ministero::text) <> ''
        AND m.titolo IS NOT NULL AND btrim(m.titolo) <> ''
        AND lower(m.stato) = 'in_corso'
        AND (m.data_fine IS NULL OR m.data_fine >= CURRENT_DATE)
        AND lower(regexp_replace(btrim(m.tipo), '[[:space:]]+', ' ', 'g')) IN (
          'referendum abrogativo',
          'legge di iniziativa popolare',
          'iniziativa popolare'
        )
    ) AS valid_items
    ORDER BY category, official_id, title
    ON CONFLICT (category, official_id) DO NOTHING
    RETURNING id
  `);
  return { enabled: true, recorded: result.rowCount ?? result.rows.length };
}

module.exports = { isCivicEventCollectionEnabled, collectMinisteroNewInitiatives };
