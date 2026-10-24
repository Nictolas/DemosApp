'use strict';
const express = require('express');
const { verifyToken, pool } = require('../../middleware/auth');
const { requirePrivacyOverviewAccess } = require('../../middleware/dpoAccess');
const router = express.Router();
router.use(verifyToken, requirePrivacyOverviewAccess);
router.get('/overview', async (req, res) => {
  try {
    // Non confondere il seed di migrazione con richieste esercitate dagli utenti.
    // Soli conteggi aggregati: nessun payload GDPR o identificatore individuale.
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed')::integer AS operational_total,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'pending')::integer AS pending,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'processing')::integer AS processing,
        COUNT(*) FILTER (WHERE request_data->>'source' IS DISTINCT FROM 'migration_seed' AND status = 'completed')::integer AS completed,
        COUNT(*) FILTER (WHERE request_data->>'source' = 'migration_seed')::integer AS baseline_excluded
      FROM public.user_rights_requests
    `);
    const counts = result.rows?.[0] || {};
    return res.json({
      success: true,
      data: {
        role: req.privacyOverviewRole,
        access: 'privacy_oversight_readonly',
        gdpr_requests_total: counts.operational_total ?? 0,
        gdpr_requests_pending: counts.pending ?? 0,
        gdpr_requests_processing: counts.processing ?? 0,
        gdpr_requests_completed: counts.completed ?? 0,
        gdpr_requests_migration_excluded: counts.baseline_excluded ?? 0,
        rights_counter_scope: 'user_rights_requests_excluding_migration_seed',
        retention_policy: 'pending_approval',
        log_policy: 'pending_legal_scope_review'
      }
    });
  } catch (_) {
    return res.status(503).json({ success:false, error:'Riepilogo privacy non disponibile' });
  }
});

/**
 * Five DPO oversight areas. Counts only: no user identifiers, opinions cast,
 * raw notifications, technical credentials or administrative mutations.
 * Reuses the fresh DB authorization gate above (also available to Admin).
 */
router.get('/areas', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::integer FROM public.users) AS users_total,
        (SELECT COUNT(*)::integer FROM public.users WHERE status = 'a') AS users_active,
        (SELECT COUNT(*)::integer FROM public.users WHERE created_at >= NOW() - INTERVAL '30 days') AS users_recent,
        (SELECT COUNT(*)::integer FROM public.riconoscimenti) AS recognitions_total,
        (SELECT COUNT(*)::integer FROM public.riconoscimenti WHERE created_at >= NOW() - INTERVAL '30 days') AS recognitions_recent,
        (SELECT COUNT(*)::integer FROM public.opinioni_domande) AS opinions_total,
        (SELECT COUNT(*)::integer FROM public.opinioni_domande WHERE approfondimento IS NOT NULL AND BTRIM(approfondimento) <> '') AS opinions_with_detail,
        (SELECT COUNT(*)::integer FROM public.opinioni_proposte) AS proposed_opinions_total,
        (SELECT COUNT(*)::integer FROM public.opinioni_proposte WHERE created_at >= NOW() - INTERVAL '30 days') AS proposed_opinions_recent,
        (SELECT COUNT(*)::integer FROM public.notifiche_demos) AS notifications_total,
        (SELECT COUNT(*)::integer FROM public.notifiche_demos WHERE data_creazione >= NOW() - INTERVAL '30 days') AS notifications_recent,
        (SELECT MAX(data_creazione) FROM public.notifiche_demos) AS notifications_latest_at,
        (SELECT COUNT(*)::integer FROM public.iniziative_ministero) AS ministry_initiatives_total,
        (SELECT COUNT(*)::integer FROM public.iniziative_ministero WHERE data_fine >= CURRENT_DATE) AS ministry_initiatives_not_ended,
        (SELECT MAX(data_ultimo_aggiornamento) FROM public.iniziative_ministero) AS ministry_last_updated_at,
        (SELECT COUNT(*)::integer FROM public.votazioni_parlamento) AS parliamentary_votes_total
    `);
    const counts = result.rows?.[0];
    if (!counts) return res.status(503).json({ success: false, error: 'Riepilogo non disponibile' });
    return res.json({
      success: true,
      data: {
        scope: 'aggregated_readonly',
        'utenti-verifiche': {
          users_total: counts.users_total,
          users_active: counts.users_active,
          users_recent: counts.users_recent,
          recognitions_total: counts.recognitions_total,
          recognitions_recent: counts.recognitions_recent
        },
        contenuti: {
          opinions_total: counts.opinions_total,
          opinions_with_detail: counts.opinions_with_detail,
          proposed_opinions_total: counts.proposed_opinions_total,
          proposed_opinions_recent: counts.proposed_opinions_recent
        },
        comunicazioni: {
          notifications_total: counts.notifications_total,
          notifications_recent: counts.notifications_recent,
          notifications_latest_at: counts.notifications_latest_at
        },
        'dati-istituzionali': {
          ministry_initiatives_total: counts.ministry_initiatives_total,
          ministry_initiatives_not_ended: counts.ministry_initiatives_not_ended,
          ministry_last_updated_at: counts.ministry_last_updated_at,
          parliamentary_votes_total: counts.parliamentary_votes_total
        },
        'ops-center': { access: 'privacy_oversight_only' }
      }
    });
  } catch (_) {
    return res.status(503).json({ success: false, error: 'Riepilogo non disponibile' });
  }
});

module.exports = router;
