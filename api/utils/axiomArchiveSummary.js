function asFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function roundHours(milliseconds) {
  return Math.round((Math.max(0, asFiniteNumber(milliseconds)) / 3600000) * 100) / 100;
}

function buildAxiomArchiveSummary(results = []) {
  return results.map((result = {}) => {
    const startTime = asIso(result.startTime);
    const endTime = asIso(result.endTime);
    const targetEnd = asIso(result.targetEnd);
    const startMs = startTime ? new Date(startTime).getTime() : NaN;
    const endMs = endTime ? new Date(endTime).getTime() : NaN;
    const progressMs = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, endMs - startMs)
      : 0;
    const count = Math.max(0, asFiniteNumber(result.count));
    const remainingMs = Math.max(0, asFiniteNumber(result.remainingMs));

    return {
      dataset: result.dataset || null,
      skipped: result.skipped === true,
      reason: result.reason || null,
      caughtUp: result.caughtUp === true,
      chunks: Math.max(0, asFiniteNumber(result.chunks)),
      count,
      empty: result.skipped !== true && count === 0,
      categories: result.categories || {},
      windowStart: startTime,
      windowEnd: endTime,
      targetEnd,
      progressHours: roundHours(progressMs),
      remainingMs,
      remainingHours: roundHours(remainingMs)
    };
  });
}

module.exports = {
  buildAxiomArchiveSummary,
  roundHours
};
