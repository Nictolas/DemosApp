const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;
const TABLE = 'preference_change_cooldowns';

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...values) {
  return values
    .map(normalizeDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

async function getRecordedChange(db, userId, scope) {
  try {
    const result = await db.query(
      `SELECT last_changed_at
       FROM ${TABLE}
       WHERE user_id = $1 AND scope = $2`,
      [String(userId), String(scope)],
    );
    return normalizeDate(result.rows[0]?.last_changed_at);
  } catch (error) {
    if (error?.code === '42P01') {
      const schemaError = new Error('Migrazione cooldown preferenze non applicata');
      schemaError.code = 'PREFERENCE_COOLDOWN_SCHEMA_MISSING';
      schemaError.status = 503;
      throw schemaError;
    }
    throw error;
  }
}

async function getPreferenceCooldown(db, { userId, scope, fallbackChangedAt = null, now = new Date() }) {
  if (!userId || !scope) {
    throw new Error('userId e scope sono obbligatori per il cooldown preferenze');
  }

  const recorded = await getRecordedChange(db, userId, scope);
  const lastChangedAt = latestDate(recorded, fallbackChangedAt);
  if (!lastChangedAt) {
    return { isBlocked: false, unlockDate: null, lastChangedAt: null };
  }

  const unlockDate = new Date(lastChangedAt.getTime() + COOLDOWN_MS);
  const isBlocked = unlockDate.getTime() > normalizeDate(now).getTime();
  return {
    isBlocked,
    unlockDate: isBlocked ? unlockDate.toISOString() : null,
    lastChangedAt: lastChangedAt.toISOString(),
  };
}

async function assertPreferenceChangeAllowed(db, options) {
  if (options?.isAdmin) {
    return { isBlocked: false, unlockDate: null, lastChangedAt: null };
  }

  const cooldown = await getPreferenceCooldown(db, options);
  if (!cooldown.isBlocked) return cooldown;

  const error = new Error('Puoi modificare questa preferenza al massimo una volta ogni 24 ore');
  error.code = 'PREFERENCE_COOLDOWN';
  error.status = 409;
  error.unlockDate = cooldown.unlockDate;
  throw error;
}

async function recordPreferenceChange(db, { userId, scope, changedAt = null }) {
  const timestamp = normalizeDate(changedAt) || new Date();
  await db.query(
    `INSERT INTO ${TABLE} (user_id, scope, last_changed_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, scope)
     DO UPDATE SET last_changed_at = EXCLUDED.last_changed_at`,
    [String(userId), String(scope), timestamp.toISOString()],
  );
  return timestamp.toISOString();
}

function sendCooldownError(res, error) {
  if (error?.code !== 'PREFERENCE_COOLDOWN' && error?.code !== 'PREFERENCE_COOLDOWN_SCHEMA_MISSING') {
    return false;
  }

  const status = Number(error.status) || 409;
  res.status(status).json({
    success: false,
    error: error.code,
    message: error.message,
    unlockDate: error.unlockDate || null,
  });
  return true;
}

module.exports = {
  COOLDOWN_HOURS,
  COOLDOWN_MS,
  TABLE,
  getPreferenceCooldown,
  assertPreferenceChangeAllowed,
  recordPreferenceChange,
  sendCooldownError,
};
