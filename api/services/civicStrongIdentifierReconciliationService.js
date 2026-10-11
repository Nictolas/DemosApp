'use strict';

const { getStageRank } = require('./civicProcessRegistryService');

function cleanText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function identifierKey(identifier) {
  const namespace = cleanText(identifier?.namespace);
  const value = cleanText(identifier?.value);
  return namespace && value ? `${namespace}\u0000${value}` : null;
}

async function loadIdentifierOwnersForUpdate(client, record) {
  const owners = new Map();
  const seen = new Set();
  for (const identifier of Array.isArray(record?.officialIdentifiers) ? record.officialIdentifiers : []) {
    const key = identifierKey(identifier);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const namespace = cleanText(identifier.namespace);
    const value = cleanText(identifier.value);
    const result = await client.query(
      `SELECT cp.id, cp.jurisdiction_id, cp.process_type_id, cp.canonical_stage,
              cp.canonical_url, cp.official_reference, cp.first_official_date,
              cp.latest_official_date, cp.realized
         FROM civic_process_identifiers cpi
         JOIN civic_processes cp ON cp.id = cpi.civic_process_id
        WHERE cpi.namespace = $1 AND cpi.value = $2
        FOR UPDATE OF cp`,
      [namespace, value]
    );
    const row = result.rows[0];
    if (row?.id) owners.set(String(row.id), row);
  }
  return [...owners.values()];
}

function selectStrongReferenceTarget(owners, record) {
  const officialReference = cleanText(record?.officialReference);
  if (!officialReference || owners.length < 2) return null;
  const matches = owners.filter((row) => cleanText(row.official_reference) === officialReference);
  return matches.length === 1 ? matches[0] : null;
}

function canMergeOwners(owners, target, record) {
  if (!target) return false;
  const jurisdictionId = cleanText(record?.jurisdictionId);
  const processTypeId = cleanText(record?.processTypeId);
  const officialReference = cleanText(record?.officialReference);

  for (const owner of owners) {
    if (cleanText(owner.jurisdiction_id) !== jurisdictionId || cleanText(owner.process_type_id) !== processTypeId) {
      return false;
    }
    // A manual realization decision must never be collapsed by a background sync.
    if (owner.realized === true) return false;
    const ownerReference = cleanText(owner.official_reference);
    if (ownerReference && ownerReference !== officialReference) return false;
  }
  return true;
}

function earlierDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a) <= new Date(b) ? a : b;
}

function laterDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a) >= new Date(b) ? a : b;
}

async function recomputeTargetMetadata(client, target, mergedOwners) {
  const stages = await client.query(
    `SELECT DISTINCT source_stage
       FROM civic_process_source_records
      WHERE civic_process_id = $1 AND source_stage IS NOT NULL`,
    [target.id]
  );

  let canonicalStage = target.canonical_stage || null;
  let canonicalRank = canonicalStage ? getStageRank(target.process_type_id, canonicalStage) : null;
  for (const row of stages.rows) {
    const rank = getStageRank(target.process_type_id, row.source_stage);
    if (rank !== null && (canonicalRank === null || rank > canonicalRank)) {
      canonicalStage = row.source_stage;
      canonicalRank = rank;
    }
  }

  let canonicalUrl = target.canonical_url || null;
  let firstOfficialDate = target.first_official_date || null;
  let latestOfficialDate = target.latest_official_date || null;
  for (const owner of mergedOwners) {
    canonicalUrl = canonicalUrl || owner.canonical_url || null;
    firstOfficialDate = earlierDate(firstOfficialDate, owner.first_official_date);
    latestOfficialDate = laterDate(latestOfficialDate, owner.latest_official_date);
  }

  await client.query(
    `UPDATE civic_processes
        SET canonical_stage = $2,
            canonical_url = COALESCE(canonical_url, $3),
            first_official_date = $4,
            latest_official_date = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [target.id, canonicalStage, canonicalUrl, firstOfficialDate, latestOfficialDate]
  );
}

async function mergeOwnerIntoTarget(client, ownerId, targetId) {
  // Elimina candidati che diventerebbero auto-riferimenti dopo il merge.
  await client.query(
    `DELETE FROM civic_process_reconciliation_candidates crc
      USING civic_process_source_records csr
      WHERE crc.source_record_id = csr.id
        AND csr.civic_process_id = $1
        AND crc.candidate_process_id = $2`,
    [ownerId, targetId]
  );

  // I candidati che puntano al contenitore duplicato non servono più: la prova forte
  // istituzionale ha già risolto l'identità del processo.
  await client.query(
    `DELETE FROM civic_process_reconciliation_candidates
      WHERE candidate_process_id = $1`,
    [ownerId]
  );

  await client.query(
    `UPDATE civic_process_identifiers
        SET civic_process_id = $2
      WHERE civic_process_id = $1`,
    [ownerId, targetId]
  );

  await client.query(
    `UPDATE civic_process_source_records
        SET civic_process_id = $2,
            reconciliation_method = 'official_reference',
            updated_at = NOW()
      WHERE civic_process_id = $1`,
    [ownerId, targetId]
  );

  await client.query('DELETE FROM civic_processes WHERE id = $1', [ownerId]);
}

async function reconcileStrongIdentifierBridge(pool, record) {
  if (!pool?.connect) throw new Error('DATABASE_POOL_REQUIRED');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owners = await loadIdentifierOwnersForUpdate(client, record);
    const target = selectStrongReferenceTarget(owners, record);
    if (!canMergeOwners(owners, target, record)) {
      await client.query('ROLLBACK');
      return { merged: false, reason: 'STRONG_REFERENCE_MERGE_NOT_SAFE' };
    }

    const duplicates = owners.filter((row) => String(row.id) !== String(target.id));
    if (!duplicates.length) {
      await client.query('ROLLBACK');
      return { merged: false, reason: 'NO_DUPLICATE_PROCESS' };
    }

    for (const duplicate of duplicates) {
      await mergeOwnerIntoTarget(client, duplicate.id, target.id);
    }
    await recomputeTargetMetadata(client, target, duplicates);
    await client.query('COMMIT');

    return {
      merged: true,
      targetProcessId: String(target.id),
      mergedProcessIds: duplicates.map((row) => String(row.id)),
      officialReference: cleanText(record.officialReference),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  loadIdentifierOwnersForUpdate,
  selectStrongReferenceTarget,
  canMergeOwners,
  reconcileStrongIdentifierBridge,
};
