const MAX_SNAPSHOT_ROWS = 5000;
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

const assertSnapshotId = (value, label) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error('Invalid ' + label);
  return value;
};

const normalizeSnapshotRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_SNAPSHOT_ROWS) throw new Error('Invalid snapshot rows');
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid snapshot row');
    if (!['candidate','representative'].includes(row.kind)) throw new Error('Invalid political kind');
    if (typeof row.grade !== 'string' || !/^[A-Z]{1,2}$/.test(row.grade)) throw new Error('Invalid political grade');
    if (!row.candidateId || !row.displayName || !row.opinions || typeof row.opinions !== 'object' || Array.isArray(row.opinions)) throw new Error('Invalid political vector row');
    return {
      candidateId: String(row.candidateId), kind: row.kind, grade: row.grade,
      country: row.country ?? null, region: row.region ?? null, province: row.province ?? null,
      municipality: row.municipality ?? null, displayName: String(row.displayName),
      avatarConfig: row.avatarConfig ?? null, opinions: row.opinions
    };
  });
};

const createResearchPoliticalSnapshotWriter = ({ pool, now = () => new Date() }) => {
  if (!pool || typeof pool.connect !== 'function') throw new Error('Research pool required');
  return {
    async replace({ sourceSnapshotId, methodologyVersion, rows }) {
      assertSnapshotId(sourceSnapshotId, 'source snapshot id');
      assertSnapshotId(methodologyVersion, 'methodology version');
      const normalized = normalizeSnapshotRows(rows);
      const scope = normalized[0];
      if (normalized.some((row) =>
        row.kind !== scope.kind || row.grade !== scope.grade ||
        row.country !== scope.country || row.region !== scope.region ||
        row.province !== scope.province || row.municipality !== scope.municipality
      )) throw new Error('Snapshot rows must share one political scope');
      const generatedAt = now();
      const expiresAt = new Date(generatedAt.getTime() + SNAPSHOT_TTL_MS);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `DELETE FROM research_public_political_vectors
           WHERE kind = $1 AND grade = $2
             AND country IS NOT DISTINCT FROM $3
             AND region IS NOT DISTINCT FROM $4
             AND province IS NOT DISTINCT FROM $5
             AND municipality IS NOT DISTINCT FROM $6`,
          [scope.kind, scope.grade, scope.country, scope.region, scope.province, scope.municipality]
        );
        for (const row of normalized) {
          await client.query(
            `INSERT INTO research_public_political_vectors
             (candidate_id, kind, grade, country, region, province, municipality, display_name, avatar_config, opinions,
              source_snapshot_id, methodology_version, generated_at, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [row.candidateId,row.kind,row.grade,row.country,row.region,row.province,row.municipality,row.displayName,row.avatarConfig,row.opinions,sourceSnapshotId,methodologyVersion,generatedAt,expiresAt]
          );
        }
        await client.query('DELETE FROM research_public_political_vectors WHERE expires_at <= $1', [generatedAt]);
        await client.query('COMMIT');
        return { sourceSnapshotId, methodologyVersion, rowCount: normalized.length, generatedAt, expiresAt };
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally {
        client.release();
      }
    }
  };
};

module.exports = { MAX_SNAPSHOT_ROWS, SNAPSHOT_TTL_MS, normalizeSnapshotRows, createResearchPoliticalSnapshotWriter };
