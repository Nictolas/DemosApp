/**
 * Job per aggiornare le votazioni finali decisive da Openpolis.
 * Esegue scraping della lista /votazioni?main_vote_type=is_final, salva in openpolis_votazioni_finali_decisive.
 */

const cron = require('node-cron');
const { getPool } = require('../config/database');
const { fetchVotazioniFinaliPerCamera, saveToDb } = require('../services/openpolisVotazioniFinaliService');
const { refreshLatestParliamentVoteNotifications } = require('../services/parliamentLatestVoteNotificationsService');
const { preflightSelectedParliamentaryOffices } = require('../services/parliamentSelectedOfficePreflightService');

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS openpolis_votazioni_finali_decisive (
      id SERIAL PRIMARY KEY,
      openpolis_id VARCHAR(50) NOT NULL UNIQUE,
      camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
      titolo TEXT NOT NULL,
      url_dettaglio TEXT NOT NULL,
      esito VARCHAR(20) NOT NULL CHECK (esito IN ('Approvata', 'Respinta')),
      data_votazione DATE,
      data_scraping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_camera ON openpolis_votazioni_finali_decisive(camera)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_votazione ON openpolis_votazioni_finali_decisive(data_votazione DESC NULLS LAST)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_openpolis_vfd_data_scraping ON openpolis_votazioni_finali_decisive(data_scraping DESC)');
}

/**
 * Esegue un singolo ciclo: fetch lista Openpolis voti finali -> salva in DB.
 */
async function runOpenpolisVotazioniFinaliSync() {
  let pool;
  try {
    pool = getPool();
    await ensureTable(pool);
    console.log('[openpolisVotazioniFinali] Sync final votes started');
    const { rows: beforeRows } = await pool.query('SELECT COUNT(*)::int AS count FROM openpolis_votazioni_finali_decisive');
    // At most 50 final roll calls per parliamentary chamber, avoiding
    // loss of Senate ballots during a busy week in the Camera.
    const items = await fetchVotazioniFinaliPerCamera(50);
    if (items.length === 0) throw new Error('OPENPOLIS_FINAL_VOTES_PARSE_EMPTY');
    const saved = await saveToDb(items, pool);
    const { rows: afterRows } = await pool.query('SELECT COUNT(*)::int AS count FROM openpolis_votazioni_finali_decisive');
    const added = Math.max(0, afterRows[0].count - beforeRows[0].count);
    // Selected-MP identity/office screening is read-only, disabled by
    // default, independently rate-limited (max 12 profiles/cycle, 24h cache).
    // It never alters a mandate, a citizen selection or an identity link.
    if (process.env.PARLIAMENT_IDENTITY_PREFLIGHT_ENABLED === 'true') {
      try {
        const officeAudit = await preflightSelectedParliamentaryOffices(pool);
        // Aggregate-only operational signal; no names, voter IDs or DOB.
        console.log('[parliamentSelectedIdentityPreflight]', officeAudit);
      } catch {
        console.warn('[parliamentSelectedIdentityPreflight] Unavailable; no identity was approved');
      }
    }
    // Only an explicitly enabled, reviewed release may update latest vote notifications.
    // This feature never sends push messages; public ballot source checks fail closed.
    try {
      const latest = await refreshLatestParliamentVoteNotifications(pool);
      if (latest.enabled) console.log('[parliamentFinalNotifications] Result', latest);
    } catch {
      console.warn('[parliamentFinalNotifications] Refresh unavailable; vote list sync remains independent');
    }
    // EU current-only votes share this EXISTING 6-hour job; do not add
    // another cron or scan all 76 MEPs. The PR #635 module is loaded only
    // after an explicit, separately reviewed flag is enabled. The module is
    // not present on this stacked Draft branch until both PRs are composed.
    if (process.env.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED === 'true') {
      try {
        const { refreshSelectedEuropeanCurrentVote } =
          require('../services/europeanParliamentSelectedCurrentVoteRefresh');
        const epResult = await refreshSelectedEuropeanCurrentVote(pool);
        // Aggregates only; never print voter/follower identities or source IDs.
        console.log('[parliamentEuropeanCurrentVote] Result', {
          enabled: epResult.enabled, prepared: epResult.prepared,
          changed: epResult.changed, skipped: epResult.skipped
        });
      } catch {
        // Fail closed; importing votes never authorizes identity approval,
        // fallback to pe:<MepId>, nominal history or an older unverified vote.
        console.warn('[parliamentEuropeanCurrentVote] Unavailable; no fallback import');
      }
    }
    console.log('[openpolisVotazioniFinali] Sync completed', { fetched: items.length, saved, added });
    return { success: true, fetched: items.length, added, total: afterRows[0].count };
  } catch (error) {
    // Upstream/parser errors must never be presented as a successful sync.
    const reason = error?.message === 'OPENPOLIS_FINAL_VOTES_PARSE_EMPTY'
      ? 'UPSTREAM_PARSE_EMPTY' : 'UPSTREAM_OR_DATABASE_UNAVAILABLE';
    console.error('[openpolisVotazioniFinali] Sync failed', { reason, error: error?.message });
    return { success: false, reason, fetched: 0, added: 0 };
  }
}

const openpolisVotazioniFinaliCron = process.env.OPENPOLIS_VOTAZIONI_FINALI_CRON || '45 */6 * * *';
const openpolisVotazioniFinaliJob = cron.schedule(openpolisVotazioniFinaliCron, runOpenpolisVotazioniFinaliSync, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

function startOpenpolisVotazioniFinaliJob() {
  console.log('🚀 Avvio job Openpolis votazioni finali decisive...');
  openpolisVotazioniFinaliJob.start();
  console.log(`✅ Job Openpolis votazioni finali avviato (cron: ${openpolisVotazioniFinaliCron})`);
}

function stopOpenpolisVotazioniFinaliJob() {
  openpolisVotazioniFinaliJob.stop();
  console.log('✅ Job Openpolis votazioni finali fermato');
}

module.exports = {
  runOpenpolisVotazioniFinaliSync,
  startOpenpolisVotazioniFinaliJob,
  stopOpenpolisVotazioniFinaliJob,
  openpolisVotazioniFinaliJob
};
