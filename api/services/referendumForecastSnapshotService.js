'use strict';

const { isPrivacyRecoveryMaintenanceActive } = require('../middleware/privacyRecoveryMaintenance');

function blockedSnapshot({ fetched=0,captured=0,suppressed=0 }={}) {
  return {
    schemaReady:false, fetched, captured, suppressed,
    errors:[], maintenanceBlocked:true, reason:'GDPR_RECOVERY_MAINTENANCE'
  };
}

const DEFAULT_BUCKET_HOURS = 6;
const DEFAULT_RETENTION_DAYS = 730;
const MIN_PUBLIC_RESPONSES = 10;

function bucketStart(date = new Date(), bucketHours = DEFAULT_BUCKET_HOURS) {
  const hours = Math.max(1, Math.min(24, Number.parseInt(String(bucketHours), 10) || DEFAULT_BUCKET_HOURS));
  const value = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (Number.isNaN(value.getTime())) throw new Error('INVALID_SNAPSHOT_TIME');
  value.setUTCMinutes(0, 0, 0);
  value.setUTCHours(Math.floor(value.getUTCHours() / hours) * hours);
  return value;
}

async function captureReferendumForecastSnapshots({
  pool,
  now = new Date(),
  bucketHours = Number(process.env.REFERENDUM_FORECAST_SNAPSHOT_HOURS || DEFAULT_BUCKET_HOURS),
  retentionDays = Number(process.env.REFERENDUM_FORECAST_SNAPSHOT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS),
} = {}) {
  // This service may be invoked independently of its scheduler.
  if (isPrivacyRecoveryMaintenanceActive()) return blockedSnapshot();
  if (!pool?.query) throw new Error('DATABASE_POOL_REQUIRED');

  const currentBucket = bucketStart(now, bucketHours);
  const days = Math.max(30, Math.min(3650, Number.parseInt(String(retentionDays), 10) || DEFAULT_RETENTION_DAYS));

  const aggregates = await pool.query(
    `SELECT
       cb.id AS civic_ballot_id,
       cb.opens_at,
       COUNT(p.user_id)::int AS total_responses,
       COUNT(p.user_id) FILTER (WHERE p.choice = 'YES')::int AS yes_count,
       COUNT(p.user_id) FILTER (WHERE p.choice = 'NO')::int AS no_count,
       COUNT(p.user_id) FILTER (WHERE p.choice = 'ABSTAIN')::int AS abstain_count
     FROM civic_ballots cb
     LEFT JOIN civic_ballot_positions p ON p.civic_ballot_id = cb.id
     WHERE cb.status IN ('scheduled', 'closed')
       AND cb.opens_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY cb.id
     ORDER BY cb.opens_at DESC`,
    [days],
  );

  let captured = 0;
  let suppressed = 0;
  if (isPrivacyRecoveryMaintenanceActive()) {
    return blockedSnapshot({fetched:aggregates.rows.length});
  }
  const errors = [];

  for (const row of aggregates.rows) {
    if (isPrivacyRecoveryMaintenanceActive()) {
      return blockedSnapshot({fetched:aggregates.rows.length,captured,suppressed});
    }
    const total = Number(row.total_responses || 0);
    const yes = Number(row.yes_count || 0);
    const no = Number(row.no_count || 0);
    const abstain = Number(row.abstain_count || 0);
    if (total < MIN_PUBLIC_RESPONSES) {
      suppressed += 1;
      continue;
    }
    if (yes + no + abstain !== total) {
      errors.push({ ballotId: row.civic_ballot_id, error: 'SNAPSHOT_COUNT_MISMATCH' });
      continue;
    }

    const opensAt = new Date(row.opens_at);
    const isFrozen = Number.isFinite(opensAt.getTime()) && now >= opensAt;
    const snapshotTime = isFrozen ? opensAt : currentBucket;

    try {
      if (isPrivacyRecoveryMaintenanceActive()) {
        return blockedSnapshot({fetched:aggregates.rows.length,captured,suppressed});
      }
      const result = await pool.query(
        isFrozen
          ? `INSERT INTO civic_ballot_forecast_snapshots (
               civic_ballot_id, bucket_start, total_responses,
               yes_count, no_count, abstain_count, is_frozen, updated_at
             ) VALUES ($1::uuid, $2, $3, $4, $5, $6, TRUE, NOW())
             ON CONFLICT (civic_ballot_id, bucket_start) DO NOTHING`
          : `INSERT INTO civic_ballot_forecast_snapshots (
               civic_ballot_id, bucket_start, total_responses,
               yes_count, no_count, abstain_count, is_frozen, updated_at
             ) VALUES ($1::uuid, $2, $3, $4, $5, $6, FALSE, NOW())
             ON CONFLICT (civic_ballot_id, bucket_start)
             DO UPDATE SET
               total_responses = EXCLUDED.total_responses,
               yes_count = EXCLUDED.yes_count,
               no_count = EXCLUDED.no_count,
               abstain_count = EXCLUDED.abstain_count,
               updated_at = NOW()
             WHERE civic_ballot_forecast_snapshots.is_frozen = FALSE`,
        [
          String(row.civic_ballot_id),
          snapshotTime.toISOString(),
          total,
          yes,
          no,
          abstain,
        ],
      );
      captured += Number(result.rowCount || 0);
      // In-flight SQL may already have committed: only provider isolation
      // can guarantee that no write overlaps a real recovery.
      if (isPrivacyRecoveryMaintenanceActive()) {
        return blockedSnapshot({fetched:aggregates.rows.length,captured,suppressed});
      }
    } catch (error) {
      if (isPrivacyRecoveryMaintenanceActive()) {
        return blockedSnapshot({fetched:aggregates.rows.length,captured,suppressed});
      }
      errors.push({ ballotId: row.civic_ballot_id, error: error.message });
    }
  }

  return {
    schemaReady: true,
    fetched: aggregates.rows.length,
    captured,
    suppressed,
    bucketStart: currentBucket.toISOString(),
    bucketHours: Number(bucketHours) || DEFAULT_BUCKET_HOURS,
    errors,
  };
}

module.exports = {
  DEFAULT_BUCKET_HOURS,
  DEFAULT_RETENTION_DAYS,
  MIN_PUBLIC_RESPONSES,
  bucketStart,
  captureReferendumForecastSnapshots,
};
