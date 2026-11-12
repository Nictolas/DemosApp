'use strict';

/**
 * RESEARCH ONLY. Never imported by DEMOS runtime routes.
 *
 * Future opinion answer schema could hold TWO JSONB maps, with immutable IDs:
 * { answers: {"opinione_0":"f"}, sources: {"opinione_0":"Public URL..."} }
 *
 * Existing fonti_opinioni is in the legacy table and is not migrated by any
 * previous candidate. This module makes source preservation an explicit gate.
 * Caller MUST authenticate, check consent AFTER users FOR UPDATE, and use one
 * transaction for answers, sources, export and GDPR erasure.
 */
const ID=/^[a-z][a-z0-9_]{0,62}$/;
const MAX_IDS=512;
const MAX_SOURCE_BYTES=8192;
const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const {validateLegacyIds,legacyRowToAnswers} = require('./opinionAnswersV2BackfillCandidate');

function plainRecord(x) {
  return x!==null && typeof x==='object' &&
    (Object.getPrototypeOf(x)===Object.prototype || Object.getPrototypeOf(x)===null);
}
function validateSourceMap(value,{historicalIds}={}) {
  if(value===null || value===undefined)return Object.create(null);
  if(!plainRecord(value))throw new TypeError('Opinion sources must be a plain JSON object');
  const entries=Object.entries(value);
  if(entries.length>MAX_IDS)throw new RangeError('Too many historical source IDs');
  if(historicalIds!==undefined && !(historicalIds instanceof Set)) {
    throw new TypeError('Historical IDs must be an explicit Set');
  }
  const result=Object.create(null);
  for(const [id,source] of entries) {
    if(!ID.test(id) || (historicalIds && !historicalIds.has(id))) {
      // Do not silently drop an archived source, or accept an unknown key:
      // the migration manifest must include every historical opinion ID.
      throw new RangeError('Unknown historical opinion source ID');
    }
    // Preserve source text byte-for-byte, including whitespace and archived
    // answers, for legacy parity and an eventual authorized GDPR export.
    if(typeof source!=='string'||Buffer.byteLength(source,'utf8')>MAX_SOURCE_BYTES) {
      throw new TypeError('Invalid stored opinion source text');
    }
    result[id]=source;
  }
  return result;
}

/**
 * A complete v2 backfill must copy BOTH the answer map and its sources.
 * This is an offline candidate only: schema preflight, user lock, consent
 * and restore/erasure journal checks are separate mandatory blockers.
 */
function legacyRowToOpinionMaps(legacyRow,immutableHistoricalIds) {
  const ids=validateLegacyIds(immutableHistoricalIds);
  if(!legacyRow || !Object.prototype.hasOwnProperty.call(legacyRow,'fonti_opinioni')) {
    throw new Error('Missing legacy fonti_opinioni column in backfill row');
  }
  const answers=legacyRowToAnswers(legacyRow,ids);
  const sources=validateSourceMap(legacyRow.fonti_opinioni,{historicalIds:new Set(ids)});
  return {answers,sources};
}

function planSourcePatch(stored,patch,publishedIds) {
  if(!(publishedIds instanceof Set))throw new TypeError('Published IDs Set required');
  if(!plainRecord(patch))throw new TypeError('Expected source patch object');
  const entries=Object.entries(patch);
  if(!entries.length || entries.length>MAX_IDS)throw new RangeError('Invalid source patch length');
  const current=validateSourceMap(stored);
  const added=Object.create(null);
  const removed=[];
  const merged=Object.assign(Object.create(null),current);
  for(const [id,source] of entries) {
    if(!ID.test(id)||!publishedIds.has(id))throw new RangeError('Unpublished source ID');
    if(source!==null && typeof source!=='string')throw new TypeError('Source must be text or null');
    if(typeof source==='string' && Buffer.byteLength(source,'utf8')>MAX_SOURCE_BYTES) {
      throw new RangeError('Source too large');
    }
    // Current DEMOS admin profile treats empty/whitespace-only as removing
    // the source, and leaves unmentioned source IDs untouched.
    if(source===null || source.trim()==='') {
      if(hasOwn(merged,id)) {
        delete merged[id];
        removed.push(id);
      }
    } else if(merged[id]!==source) {
      merged[id]=source;
      added[id]=source;
    }
  }
  return {
    added,removed,merged,
    changedCount:Object.keys(added).length+removed.length
  };
}

// SQL deliberately uses a JSONB patch and explicit removal keys, so a
// concurrent client cannot blindly replace the entire sources document.
// Update MUST be paired with the identical user-row lock protocol applied
// to opinion answers; do not use the SQL directly in production.
const SQL=Object.freeze({
  readForUpdate:
    'SELECT answers, sources FROM demos_private.opinion_answer_maps_v2 WHERE user_id=$1::uuid FOR UPDATE',
  upsertSources:
    'INSERT INTO demos_private.opinion_answer_maps_v2 AS existing (user_id, answers, sources) '+
    "VALUES($1::uuid, '{}'::jsonb, $2::jsonb) "+
    'ON CONFLICT(user_id) DO UPDATE SET '+
    'sources=(existing.sources - $3::text[]) || EXCLUDED.sources,updated_at=now()',
  exportWithSources:
    'SELECT user_id,answers,sources FROM demos_private.opinion_answer_maps_v2 WHERE user_id=$1::uuid'
});

function projectSourcesForProfile(published,storedSources) {
  if(!Array.isArray(published))throw new TypeError('Published opinions array required');
  const sources=validateSourceMap(storedSources);
  return published.map(op=>{
    if(!op || typeof op.id!=='string' || !ID.test(op.id)) {
      throw new TypeError('Invalid published opinion ID');
    }
    // Existing authorized profile GET returns unknown for a missing source.
    return {id:op.id,source:hasOwn(sources,op.id) ? sources[op.id] || 'unknown' : 'unknown'};
  });
}

module.exports={
  validateSourceMap,legacyRowToOpinionMaps,planSourcePatch,projectSourcesForProfile,SQL
};
