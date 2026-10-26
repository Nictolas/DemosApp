'use strict';

const {
  LEGACY_DEFAULT_ADAPTER_ID,
} = require('../config/politicalJurisdictions');
const {
  resolvePoliticalOffice,
  getPoliticalAdapter,
  getLegacySelectionField,
  getLegacySelectionDescriptors,
} = require('./politicalJurisdictionRegistryService');

const { getPoliticalConsentState } = require('./politicalConsentService');

const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);
const SELECTION_KINDS = new Set(['candidate', 'representative']);

function isPoliticalSelectionSchemaError(error) {
  return SCHEMA_COMPAT_ERROR_CODES.has(error?.code);
}

function normalizeSelectionKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  return SELECTION_KINDS.has(kind) ? kind : null;
}

function resolveSelectionContract({ kind, officeValue, adapterId = null, jurisdictionId = null } = {}) {
  const normalizedKind = normalizeSelectionKind(kind);
  if (!normalizedKind) return null;
  const context = {};
  if (adapterId) context.adapterId = adapterId;
  if (jurisdictionId) context.jurisdictionId = jurisdictionId;
  const office = resolvePoliticalOffice(officeValue, context);
  if (!office) return null;
  return Object.freeze({
    kind: normalizedKind,
    officeId: office.id,
    jurisdictionId: office.jurisdictionId,
    adapterId: office.adapterId,
    office,
  });
}

async function writeCanonicalSelection(db, {
  userId,
  kind,
  officeId,
  jurisdictionId,
  selectedUserId,
  source = 'matching',
  selectedCandidacyId = null,
  selectedMandateId = null,
  context = {},
}) {
  try {
    if (selectedUserId == null || selectedUserId === '') {
      await db.query(
        `DELETE FROM public.political_selections
         WHERE user_id = $1
           AND selection_kind = $2
           AND political_office_id = $3`,
        [userId, kind, officeId],
      );
      return { available: true, written: true, removed: true };
    }

    await db.query(
      `INSERT INTO public.political_selections (
         user_id, selection_kind, jurisdiction_id, political_office_id,
         selected_user_id, selected_candidacy_id, selected_mandate_id,
         source, context, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())
       ON CONFLICT (user_id, selection_kind, political_office_id)
       DO UPDATE SET
         jurisdiction_id = EXCLUDED.jurisdiction_id,
         selected_user_id = EXCLUDED.selected_user_id,
         selected_candidacy_id = EXCLUDED.selected_candidacy_id,
         selected_mandate_id = EXCLUDED.selected_mandate_id,
         source = EXCLUDED.source,
         context = EXCLUDED.context,
         updated_at = NOW()`,
      [
        userId,
        kind,
        jurisdictionId,
        officeId,
        selectedUserId,
        selectedCandidacyId,
        selectedMandateId,
        String(source || 'matching'),
        JSON.stringify(context || {}),
      ],
    );
    return { available: true, written: true, removed: false };
  } catch (error) {
    if (!isPoliticalSelectionSchemaError(error)) throw error;
    return { available: false, written: false, removed: false };
  }
}

async function writeLegacySelectionProjection(db, {
  userId,
  kind,
  office,
  selectedUserId,
}) {
  const field = getLegacySelectionField(kind, office.id, { adapterId: office.adapterId });
  if (!field) return { available: false, written: false, field: null };

  const result = await db.query(
    `UPDATE public.users
     SET ${field} = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [selectedUserId || null, userId],
  );

  const legacyRelation = await db.query(
    `SELECT to_regclass('public.user_representatives') IS NOT NULL AS available`
  );
  if (legacyRelation.rows[0]?.available) {
    await db.query(
      `INSERT INTO public.user_representatives (user_id, ${field})
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         ${field} = EXCLUDED.${field},
         updated_at = NOW()`,
      [userId, selectedUserId || null],
    );
  }

  return { available: true, written: result.rowCount > 0, field };
}

async function setPoliticalSelection(db, {
  userId,
  kind,
  officeValue,
  adapterId = null,
  jurisdictionId = null,
  selectedUserId,
  source = 'matching',
  selectedCandidacyId = null,
  selectedMandateId = null,
  context = {},
}) {
  const contract = resolveSelectionContract({ kind, officeValue, adapterId, jurisdictionId });
  if (!contract) {
    const error = new Error('Invalid political selection contract');
    error.code = 'POLITICAL_SELECTION_CONTRACT_INVALID';
    throw error;
  }

  // All call sites must hold a BEGIN transaction on this very db client.
  // Revocation updates this same users row inside its own transaction.
  // Acquiring the lock before checking consent serializes SELECT and REVOKE
  // irrespective of how long matching/eligibility checks took upstream.
  const lockedUser = await db.query(
    'SELECT id FROM public.users WHERE id = $1 FOR UPDATE', [userId]
  );
  if (!lockedUser.rows.length) {
    const error = new Error('Political selection subject not found');
    error.code = 'POLITICAL_SELECTION_USER_NOT_FOUND';
    throw error;
  }
  // Deleting an existing choice must remain possible even after revocation.
  // Setting a candidate/representative is processing political preference data
  // and requires active Article 9 consent while the user lock is held.
  if (selectedUserId !== null && selectedUserId !== undefined && selectedUserId !== '') {
    const consent = await getPoliticalConsentState(db, userId);
    if (!consent.granted) {
      const error = new Error('Political consent required to set a selection');
      error.code = 'POLITICAL_SELECTION_CONSENT_REQUIRED';
      throw error;
    }
  }

  const canonical = await writeCanonicalSelection(db, {
    userId,
    kind: contract.kind,
    officeId: contract.officeId,
    jurisdictionId: contract.jurisdictionId,
    selectedUserId,
    source,
    selectedCandidacyId,
    selectedMandateId,
    context,
  });

  const legacy = await writeLegacySelectionProjection(db, {
    userId,
    kind: contract.kind,
    office: contract.office,
    selectedUserId,
  });

  if (!canonical.available && !legacy.available) {
    const error = new Error('Political selection storage unavailable');
    error.code = 'POLITICAL_SELECTION_STORAGE_UNAVAILABLE';
    throw error;
  }

  return Object.freeze({ contract, canonical, legacy });
}

async function loadLegacySelections(db, {
  userId,
  kind = null,
  adapterId = LEGACY_DEFAULT_ADAPTER_ID,
}) {
  const kinds = kind ? [normalizeSelectionKind(kind)].filter(Boolean) : ['representative', 'candidate'];
  const descriptors = kinds.flatMap((selectionKind) =>
    getLegacySelectionDescriptors(selectionKind, { adapterId }).map((descriptor) => ({
      ...descriptor,
      kind: selectionKind,
    })),
  );
  const fields = [...new Set(descriptors.map((item) => item.field).filter(Boolean))];
  if (!fields.length) return [];

  const result = await db.query(
    `SELECT ${fields.join(', ')}
     FROM users
     WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0] || {};

  return descriptors
    .map((descriptor) => ({
      userId: String(userId),
      kind: descriptor.kind,
      officeId: descriptor.officeId,
      jurisdictionId: resolvePoliticalOffice(descriptor.officeId)?.jurisdictionId || null,
      selectedUserId: row[descriptor.field] || null,
      source: 'LEGACY',
      legacyField: descriptor.field,
      category: descriptor.category,
    }))
    .filter((selection) => Boolean(selection.selectedUserId));
}

async function loadPoliticalSelections(db, {
  userId,
  kind = null,
  adapterId = null,
}) {
  const normalizedKind = kind == null ? null : normalizeSelectionKind(kind);
  if (kind != null && !normalizedKind) return { source: 'CANONICAL', strict: true, selections: [] };

  const params = [userId];
  const where = ['ps.user_id = $1'];
  if (normalizedKind) {
    params.push(normalizedKind);
    where.push(`ps.selection_kind = $${params.length}`);
  }
  if (adapterId) {
    const adapter = getPoliticalAdapter(adapterId);
    if (!adapter) return { source: 'CANONICAL', strict: true, selections: [] };
    const ids = [...new Set(adapter.officeIds || [])];
    if (!ids.length) return { source: 'CANONICAL', strict: true, selections: [] };
    params.push(ids);
    where.push(`ps.political_office_id = ANY($${params.length}::text[])`);
  }

  try {
    const result = await db.query(
      `SELECT
         ps.user_id::text AS user_id,
         ps.selection_kind,
         ps.jurisdiction_id,
         ps.political_office_id,
         ps.selected_user_id::text AS selected_user_id,
         ps.selected_candidacy_id::text AS selected_candidacy_id,
         ps.selected_mandate_id::text AS selected_mandate_id,
         ps.source,
         ps.context,
         ps.updated_at
       FROM political_selections ps
       WHERE ${where.join(' AND ')}
       ORDER BY ps.selection_kind, ps.political_office_id`,
      params,
    );
    return {
      source: 'CANONICAL',
      strict: true,
      selections: result.rows.map((row) => ({
        userId: row.user_id,
        kind: row.selection_kind,
        jurisdictionId: row.jurisdiction_id,
        officeId: row.political_office_id,
        selectedUserId: row.selected_user_id,
        selectedCandidacyId: row.selected_candidacy_id,
        selectedMandateId: row.selected_mandate_id,
        source: row.source,
        context: row.context || {},
        updatedAt: row.updated_at,
      })),
    };
  } catch (error) {
    if (!isPoliticalSelectionSchemaError(error)) throw error;
    const legacyAdapter = adapterId || LEGACY_DEFAULT_ADAPTER_ID;
    const selections = await loadLegacySelections(db, { userId, kind: normalizedKind, adapterId: legacyAdapter });
    return { source: 'LEGACY', strict: false, selections };
  }
}

function selectionsByOffice(selectionState) {
  return new Map((selectionState?.selections || []).map((selection) => [selection.officeId, selection]));
}

async function loadSupporterUserIds(db, {
  selectedUserId,
  kind = null,
  officeId = null,
}) {
  if (!selectedUserId) return { source: 'CANONICAL', strict: true, userIds: [] };

  const normalizedKind = kind == null ? null : normalizeSelectionKind(kind);
  try {
    const params = [selectedUserId];
    const where = ['ps.selected_user_id = $1', `u.status = 'a'`];
    if (normalizedKind) {
      params.push(normalizedKind);
      where.push(`ps.selection_kind = $${params.length}`);
    }
    if (officeId) {
      const office = resolvePoliticalOffice(officeId);
      if (!office) return { source: 'CANONICAL', strict: true, userIds: [] };
      params.push(office.id);
      where.push(`ps.political_office_id = $${params.length}`);
    }
    const result = await db.query(
      `SELECT DISTINCT u.id::text AS id
       FROM political_selections ps
       JOIN users u ON u.id = ps.user_id
       LEFT JOIN user_consents uc ON uc.user_id = u.id
       WHERE ${where.join(' AND ')}
         AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
       ORDER BY u.id::text`,
      params,
    );
    return { source: 'CANONICAL', strict: true, userIds: result.rows.map((row) => row.id) };
  } catch (error) {
    if (!isPoliticalSelectionSchemaError(error)) throw error;
  }

  const candidateFields = kind === 'representative' ? [] : getLegacySelectionDescriptors('candidate').map((item) => item.field);
  const representativeFields = kind === 'candidate' ? [] : getLegacySelectionDescriptors('representative').map((item) => item.field);
  let fields = [...candidateFields, ...representativeFields];
  if (officeId) {
    const office = resolvePoliticalOffice(officeId);
    if (!office) return { source: 'LEGACY', strict: false, userIds: [] };
    fields = [
      kind === 'candidate' ? office.legacyCandidateField : null,
      kind === 'representative' ? office.legacyRepresentativeField : null,
      kind == null ? office.legacyCandidateField : null,
      kind == null ? office.legacyRepresentativeField : null,
    ].filter(Boolean);
  }
  fields = [...new Set(fields.filter(Boolean))];
  if (!fields.length) return { source: 'LEGACY', strict: false, userIds: [] };
  const predicate = fields.map((field) => `u.${field}::text = $1::text`).join(' OR ');
  const result = await db.query(
    `SELECT DISTINCT u.id::text AS id
     FROM users u
     LEFT JOIN user_consents uc ON uc.user_id = u.id
     WHERE u.status = 'a'
       AND (${predicate})
       AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
     ORDER BY u.id::text`,
    [selectedUserId],
  );
  return { source: 'LEGACY', strict: false, userIds: result.rows.map((row) => row.id) };
}

module.exports = {
  SELECTION_KINDS,
  isPoliticalSelectionSchemaError,
  normalizeSelectionKind,
  resolveSelectionContract,
  setPoliticalSelection,
  loadPoliticalSelections,
  selectionsByOffice,
  loadSupporterUserIds,
};
