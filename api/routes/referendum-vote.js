'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requirePoliticalConsent } = require('../middleware/politicalConsent');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { getPool } = require('../config/database');
const {
  getPreferenceCooldown,
  assertPreferenceChangeAllowed,
  recordPreferenceChange,
  sendCooldownError,
} = require('../services/preferenceCooldownService');
const {
  MIN_PUBLIC_RESPONSES,
  buildForecastStats,
  loadGeographicForecast,
  loadForecastTrend,
  loadRecentReferendumHistory,
} = require('../services/referendumForecastStatsService');

const pool = getPool();
const ALLOWED_CHOICES = new Set(['YES', 'NO', 'ABSTAIN']);

function isMissingBallotSchema(error) {
  return Boolean(error && error.code === '42P01' && /civic_ballot/i.test(String(error.message || '')));
}

function isMissingSnapshotSchema(error) {
  return Boolean(error && error.code === '42P01' && /civic_ballot_forecast_snapshots/i.test(String(error.message || '')));
}

async function loadActiveBallots(db, userId = null, isAdmin = false) {
  const result = await db.query(
    `SELECT
       cb.id,
       cb.civic_process_id,
       cb.ballot_kind,
       cb.question_text,
       cb.yes_meaning,
       cb.no_meaning,
       cb.opens_at,
       cb.closes_at,
       cb.timezone,
       cb.quorum_kind,
       cb.quorum_threshold,
       cb.status,
       cb.source_id,
       cb.source_url,
       cb.official_reference,
       cb.official_turnout_percent,
       cb.official_yes_percent,
       cb.official_no_percent,
       cb.official_result_updated_at,
       cp.canonical_title,
       cp.canonical_url,
       position.choice AS current_choice,
       position.updated_at AS choice_updated_at,
       COUNT(all_positions.user_id)::int AS total_responses,
       COUNT(all_positions.user_id) FILTER (WHERE all_positions.choice = 'YES')::int AS yes_count,
       COUNT(all_positions.user_id) FILTER (WHERE all_positions.choice = 'NO')::int AS no_count,
       COUNT(all_positions.user_id) FILTER (WHERE all_positions.choice = 'ABSTAIN')::int AS abstain_count
     FROM civic_ballots cb
     JOIN civic_processes cp ON cp.id = cb.civic_process_id
     LEFT JOIN civic_ballot_positions position
       ON position.civic_ballot_id = cb.id
      AND position.user_id::text = $1
     LEFT JOIN civic_ballot_positions all_positions ON all_positions.civic_ballot_id = cb.id
     WHERE cb.status = 'scheduled'
       AND cb.opens_at > NOW()
     GROUP BY cb.id, cp.id, position.choice, position.updated_at
     ORDER BY cb.opens_at ASC, cp.canonical_title ASC`,
    [userId ? String(userId) : ''],
  );

  const ballots = [];
  for (const row of result.rows) {
    let cooldown = { isBlocked: false, unlockDate: null };
    if (userId && row.current_choice && !isAdmin) {
      const status = await getPreferenceCooldown(db, {
        userId,
        scope: `referendum-vote:${row.id}`,
        fallbackChangedAt: row.choice_updated_at || null,
      });
      cooldown = { isBlocked: status.isBlocked, unlockDate: status.unlockDate };
    }

    ballots.push({
      id: String(row.id),
      civicProcessId: String(row.civic_process_id),
      title: row.canonical_title,
      ballotKind: row.ballot_kind,
      question: row.question_text,
      yesMeaning: row.yes_meaning,
      noMeaning: row.no_meaning,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      timezone: row.timezone,
      source: {
        id: row.source_id,
        url: row.source_url,
        officialReference: row.official_reference || null,
        canonicalUrl: row.canonical_url || null,
      },
      currentChoice: row.current_choice || null,
      cooldown,
      forecast: buildForecastStats(row),
      officialResult: row.official_result_updated_at
        ? {
            turnoutPercent: row.official_turnout_percent == null ? null : Number(row.official_turnout_percent),
            yesPercent: row.official_yes_percent == null ? null : Number(row.official_yes_percent),
            noPercent: row.official_no_percent == null ? null : Number(row.official_no_percent),
            updatedAt: row.official_result_updated_at,
          }
        : null,
    });
  }

  return ballots;
}

// Endpoint leggero usato per mostrare/nascondere il pulsante Referendum.
// Se la migrazione non è ancora applicata, il client resta fail-closed e non mostra il pulsante.
router.get('/availability', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM civic_ballots
         WHERE status = 'scheduled' AND opens_at > NOW()
       ) AS available`,
    );
    return res.json({ success: true, available: result.rows[0]?.available === true });
  } catch (error) {
    if (isMissingBallotSchema(error)) {
      return res.json({ success: true, available: false, reason: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED' });
    }
    console.error('Errore disponibilità referendum reali:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const ballots = await loadActiveBallots(pool, req.userId, Boolean(req.user?.isAdmin));
    return res.json({
      success: true,
      ballots,
      minimumPublicResponses: MIN_PUBLIC_RESPONSES,
      semantics: {
        YES: 'Sì',
        NO: 'No',
        ABSTAIN: 'Non voterei',
      },
    });
  } catch (error) {
    if (isMissingBallotSchema(error)) {
      return res.json({
        success: true,
        ballots: [],
        minimumPublicResponses: MIN_PUBLIC_RESPONSES,
        reason: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED',
      });
    }
    console.error('Errore recupero referendum reali:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Consultazioni già congelate: mantiene accessibile la previsione DEMOS finale
// e la confronta con il risultato istituzionale quando Eligendo lo ha completato.
router.get('/history', verifyToken, async (req, res) => {
  try {
    const ballots = await loadRecentReferendumHistory(pool, {
      limit: req.query.limit,
      lookbackDays: req.query.lookbackDays,
    });
    return res.json({
      success: true,
      ballots,
      minimumPublicResponses: MIN_PUBLIC_RESPONSES,
    });
  } catch (error) {
    if (isMissingSnapshotSchema(error)) {
      return res.json({
        success: true,
        ballots: [],
        minimumPublicResponses: MIN_PUBLIC_RESPONSES,
        reason: 'REFERENDUM_FORECAST_SNAPSHOT_MIGRATION_REQUIRED',
      });
    }
    if (isMissingBallotSchema(error)) {
      return res.json({ success: true, ballots: [], reason: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED' });
    }
    console.error('Errore storico referendum reali:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Aggregati DEMOS per residenza. I gruppi con meno di 10 risposte non vengono
// restituiti, quindi il client non riceve mai micro-segmenti territoriali.
router.get('/:ballotId/geography', verifyToken, async (req, res) => {
  const ballotId = String(req.params.ballotId || '').trim();
  if (!ballotId) return res.status(400).json({ success: false, error: 'REFERENDUM_BALLOT_ID_REQUIRED' });

  try {
    const geography = await loadGeographicForecast(pool, ballotId);
    if (!geography) {
      return res.status(404).json({ success: false, error: 'REFERENDUM_BALLOT_NOT_FOUND' });
    }
    return res.json({ success: true, ...geography });
  } catch (error) {
    if (isMissingBallotSchema(error)) {
      return res.json({
        success: true,
        minimumResponses: MIN_PUBLIC_RESPONSES,
        regions: [],
        provinces: [],
        municipalities: [],
        reason: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED',
      });
    }
    console.error('Errore statistiche geografiche referendum:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// Serie temporale solo aggregata: la tabella snapshot non contiene user_id.
router.get('/:ballotId/trend', verifyToken, async (req, res) => {
  const ballotId = String(req.params.ballotId || '').trim();
  if (!ballotId) return res.status(400).json({ success: false, error: 'REFERENDUM_BALLOT_ID_REQUIRED' });

  try {
    const trend = await loadForecastTrend(pool, ballotId);
    return res.json({
      success: true,
      trend,
      minimumPublicResponses: MIN_PUBLIC_RESPONSES,
    });
  } catch (error) {
    if (isMissingSnapshotSchema(error)) {
      return res.json({
        success: true,
        trend: [],
        minimumPublicResponses: MIN_PUBLIC_RESPONSES,
        reason: 'REFERENDUM_FORECAST_SNAPSHOT_MIGRATION_REQUIRED',
      });
    }
    console.error('Errore trend referendum:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

router.post(
  '/:ballotId/choice',
  verifyToken,
  requireVerifiedCivicIdentity,
  requirePoliticalConsent,
  async (req, res) => {
    const ballotId = String(req.params.ballotId || '').trim();
    const choice = String(req.body?.choice || '').trim().toUpperCase();
    let client = null;
    let transactionStarted = false;

    if (!ballotId || !ALLOWED_CHOICES.has(choice)) {
      return res.status(400).json({
        success: false,
        error: 'REFERENDUM_CHOICE_INVALID',
        message: 'Scegli Sì, No oppure Non voterei.',
      });
    }

    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;

      const ballotResult = await client.query(
        `SELECT id, status, opens_at, closes_at
         FROM civic_ballots
         WHERE id::text = $1
         FOR UPDATE`,
        [ballotId],
      );
      const ballot = ballotResult.rows[0];
      if (!ballot) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ success: false, error: 'REFERENDUM_BALLOT_NOT_FOUND' });
      }

      const now = Date.now();
      const opensAt = new Date(ballot.opens_at).getTime();
      if (ballot.status !== 'scheduled' || !Number.isFinite(opensAt) || now >= opensAt) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          error: 'REFERENDUM_VOTE_FROZEN',
          message: 'La previsione DEMOS è stata congelata all’apertura dei seggi.',
        });
      }

      const existingResult = await client.query(
        `SELECT choice, updated_at
         FROM civic_ballot_positions
         WHERE civic_ballot_id = $1::uuid AND user_id = $2::uuid
         FOR UPDATE`,
        [ballotId, String(req.userId)],
      );
      const existing = existingResult.rows[0] || null;

      if (existing?.choice === choice) {
        await client.query('COMMIT');
        transactionStarted = false;
        return res.json({ success: true, unchanged: true, ballotId, choice });
      }

      await assertPreferenceChangeAllowed(client, {
        userId: req.userId,
        scope: `referendum-vote:${ballotId}`,
        fallbackChangedAt: existing?.updated_at || null,
        isAdmin: Boolean(req.user?.isAdmin),
      });

      await client.query(
        `INSERT INTO civic_ballot_positions (civic_ballot_id, user_id, choice, created_at, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, NOW(), NOW())
         ON CONFLICT (civic_ballot_id, user_id)
         DO UPDATE SET choice = EXCLUDED.choice, updated_at = NOW()`,
        [ballotId, String(req.userId), choice],
      );
      await recordPreferenceChange(client, {
        userId: req.userId,
        scope: `referendum-vote:${ballotId}`,
      });

      await client.query('COMMIT');
      transactionStarted = false;
      return res.json({ success: true, unchanged: false, ballotId, choice });
    } catch (error) {
      if (transactionStarted && client) {
        await client.query('ROLLBACK').catch(() => {});
      }
      if (sendCooldownError(res, error)) return;
      if (isMissingBallotSchema(error)) {
        return res.status(503).json({
          success: false,
          error: 'REFERENDUM_BALLOT_MIGRATION_REQUIRED',
          message: 'La scheda referendum non è ancora disponibile.',
        });
      }
      console.error('Errore salvataggio scelta referendum reale:', error);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: 'Errore interno del server' });
      }
    } finally {
      if (client) client.release();
    }
  },
);

module.exports = router;
