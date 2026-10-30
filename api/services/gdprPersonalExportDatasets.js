'use strict';
// GDPR portability sources verified against production PostgreSQL 17 metadata.
// Nothing is queried unless a real authenticated user invokes the endpoint.
// A missing source MUST fail closed, not produce a fabricated empty export.
async function readGdprPersonalDatasets(pool, userId) {
  if (!pool || typeof pool.query !== 'function' || typeof userId !== 'string' || !userId) {
    throw Error('GDPR_EXPORT_INVALID_SUBJECT');
  }
  const opinionRows = await pool.query(
    "SELECT to_jsonb(o) - 'user_id' AS answers FROM public.opinioni_risposte o WHERE o.user_id::text = $1",
    [userId]
  );
  if (!Array.isArray(opinionRows.rows) || opinionRows.rows.length > 1) {
    throw Error('GDPR_EXPORT_OPINIONS_UNVERIFIABLE');
  }
  const votes = await pool.query(
    "SELECT 'capo_stato' AS vote_type, COUNT(*)::integer AS vote_count FROM public.voti_capo_stato WHERE userid::text = $1 " +
    "UNION ALL SELECT 'referendum', COUNT(*)::integer FROM public.voti_referendum_abrogativi WHERE userid::text = $1 " +
    "UNION ALL SELECT 'iniziative', COUNT(*)::integer FROM public.voti_iniziative_popolari WHERE userid::text = $1 " +
    "UNION ALL SELECT 'ice', COUNT(*)::integer FROM public.voti_ice WHERE utente_id = $1",
    [userId]
  );
  // No 'user_notifications' relation exists in the current production schema.
  // The union returns notifications from supported per-recipient sources;
  // never expose subject_user_id of OTHER people in the opinion event source.
  const notifications = await pool.query(
    "SELECT 'demos'::text AS source,id::text AS id,titolo::text AS title,testo::text AS message," +
    "jsonb_build_object('date',data) AS details,data_creazione::timestamptz AS created_at " +
    "FROM public.notifiche_demos WHERE id_utente::text = $1 " +
    "UNION ALL SELECT 'avvistamenti',id::text,tipo_avvistamento::text,NULL::text," +
    "jsonb_build_object('metadata',metadata,'comune_residenza',comune_residenza),data_creazione::timestamptz " +
    "FROM public.notifiche_avvistamenti WHERE id_utente::text = $1 " +
    "UNION ALL SELECT 'comunali',id::text,tipologia::text,dove::text," +
    "jsonb_build_object('dal_giorno',dal_giorno,'al_giorno',al_giorno,'zona',zona),data_creazione::timestamptz " +
    "FROM public.notifiche_comunali WHERE id_utente::text = $1 " +
    "UNION ALL SELECT 'voti_comuni',id::text,titolo::text,testo::text," +
    "jsonb_build_object('politico',politico,'voto',voto,'comune_residenza',comune_residenza),data_creazione::timestamptz " +
    "FROM public.notifiche_voti_comuni WHERE id_utente::text = $1 " +
    "UNION ALL SELECT 'voti_parlamento',id::text,titolo::text,testo::text," +
    "jsonb_build_object('politico',politico,'camera',camera,'voto',voto,'votazione_hash',votazione_hash),data_creazione::timestamptz " +
    "FROM public.notifiche_voti_parlamento WHERE id_utente::text = $1 " +
    "UNION ALL SELECT 'opinioni',id::text,opinion_id::text,opinion_text::text," +
    "jsonb_build_object('previous_value',previous_value,'new_value',new_value),created_at::timestamptz " +
    "FROM public.political_opinion_notifications WHERE recipient_user_id::text = $1 " +
    "ORDER BY created_at DESC NULLS LAST,source ASC,id ASC",
    [userId]
  );
  const prefs = await pool.query(
    "SELECT to_jsonb(p) - 'user_id' AS preferences FROM public.notifiche_preferenze p WHERE p.user_id::text = $1",
    [userId]
  );
  if (!Array.isArray(prefs.rows) || prefs.rows.length > 1 ||
      !Array.isArray(votes.rows) || votes.rows.length !== 4 ||
      !Array.isArray(notifications.rows)) {
    throw Error('GDPR_EXPORT_DATASETS_UNVERIFIABLE');
  }
  return {
    opinions: opinionRows.rows[0]?.answers ?? {},
    votes: votes.rows,
    notifications: notifications.rows,
    notificationPreferences: prefs.rows[0]?.preferences ?? null
  };
}
module.exports = {readGdprPersonalDatasets};
