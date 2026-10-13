'use strict';

const { getLegacyQueryProfile, describeSourceRecord } = require('../civicProcessRegistryService');
const { resolveFirmaUrl } = require('../../utils/iniziativeMinisteroMapper');

const SOURCE_ID = 'it.justice.signature_portal';
const PROCESS_TYPE_ID = 'it.popular_law_initiative';
const JURISDICTION_ID = 'it';

function normalizeMinisteroPopularInitiativeRow(row) {
  const externalId = row?.id_ministero != null ? String(row.id_ministero) : null;
  const title = String(row?.titolo || '').trim();
  if (!externalId || !title) return null;

  const metadata = describeSourceRecord({
    jurisdictionId: JURISDICTION_ID,
    sourceId: SOURCE_ID,
    rawType: row.tipo,
    sourceState: row.stato,
  });
  if (metadata.civicProcessTypeId !== PROCESS_TYPE_ID) return null;

  return {
    jurisdictionId: JURISDICTION_ID,
    processTypeId: PROCESS_TYPE_ID,
    sourceId: SOURCE_ID,
    externalId,
    sourceUri: null,
    sourceUrl: resolveFirmaUrl(row.sito_web, row.id_ministero),
    title,
    stageId: metadata.stageId,
    sourceStatus: row.stato || null,
    officialReference: null,
    officialIdentifiers: [
      { namespace: 'it.justice.signature_portal', value: externalId },
    ],
    presentedAt: row.data_inizio || null,
    statusUpdatedAt: row.updated_at || null,
    metadata: {
      signatures: Number(row.firme_raccolte || 0),
      signatureThreshold: metadata.signatureThreshold,
      quorumReached: Boolean(row.quorum_raggiunto),
      ministryType: row.tipo || null,
    },
  };
}

async function loadMinisteroPopularInitiatives(pool) {
  if (!pool?.query) throw new Error('DATABASE_POOL_REQUIRED');
  const profile = getLegacyQueryProfile('iniziativa');
  const patterns = profile?.sqlLikePatterns || [];
  if (!patterns.length) throw new Error('MINISTERO_INITIATIVE_PROFILE_MISSING');

  const conditions = patterns.map((_, index) => `tipo LIKE $${index + 1}`).join(' OR ');
  const result = await pool.query(
    `SELECT id, id_ministero, titolo, descrizione, tipo, stato,
            firme_raccolte, quorum_raggiunto, sito_web,
            data_inizio, data_fine, updated_at
       FROM iniziative_ministero
      WHERE id_ministero IS NOT NULL
        AND (${conditions})
      ORDER BY updated_at DESC NULLS LAST, data_inizio DESC NULLS LAST`,
    patterns
  );

  return result.rows
    .map(normalizeMinisteroPopularInitiativeRow)
    .filter(Boolean);
}

module.exports = {
  SOURCE_ID,
  normalizeMinisteroPopularInitiativeRow,
  loadMinisteroPopularInitiatives,
};
