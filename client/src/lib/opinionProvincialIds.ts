/** Official published provincial scope (C), an independent geography from CO.
 * These six C-level questions are also published for CO (some also for R).
 * The thematic UI can filter these already-loaded IDs with zero new API/SQL.
 * Catalog contract tests forbid an unreviewed C-only question.
 */
export const OPINION_PROVINCIAL_IDS: ReadonlySet<string> = new Set([
  "cassonetti_intelligenti_con_tessera",
  "concessione_spazi_pubblici_a_centri_sociali_autogestiti",
  "divieto_di_nuovi_fast_food_nel_centro_storico",
  "finanziamento_eventi_culturali_gratuiti",
  "sicurezza_strade_scolastiche",
  "sostegno_commercio_locale",
]);
