'use strict';

const { fetchSparqlBindings, bindingValue } = require('./sparqlClient');
const { mapItalianParliamentaryStage } = require('./italyParliamentStage');

const ENDPOINT = 'https://dati.camera.it/sparql';
const SOURCE_ID = 'it.parliament.camera';
const PROCESS_TYPE_ID = 'it.popular_law_initiative';
const JURISDICTION_ID = 'it';
const DEFAULT_TIMEOUT_MS = 60000;

function decodeCameraText(value) {
  return String(value || '')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&')
    .replace(/&agrave;/g, 'à')
    .replace(/&egrave;/g, 'è')
    .replace(/&igrave;/g, 'ì')
    .replace(/&ograve;/g, 'ò')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&#39;/g, "'")
    .trim();
}

function buildCameraPopularInitiativesQuery({ legislature = 19, limit = 500 } = {}) {
  const safeLegislature = Math.max(1, Number.parseInt(legislature, 10) || 19);
  const safeLimit = Math.min(2000, Math.max(1, Number.parseInt(limit, 10) || 500));
  return `
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?atto ?numero ?titolo ?label ?data ?scheda
WHERE {
  ?atto a ocd:atto ;
        ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${safeLegislature}> ;
        ocd:iniziativa ?iniziativa ;
        dc:type ?tipo ;
        dc:identifier ?numero .
  FILTER(CONTAINS(LCASE(STR(?iniziativa)), "popolare"))
  FILTER(CONTAINS(LCASE(STR(?tipo)), "progetto di legge"))
  OPTIONAL { ?atto dc:title ?titolo . }
  OPTIONAL { ?atto rdfs:label ?label . }
  OPTIONAL { ?atto dc:date ?data . }
  OPTIONAL { ?atto dcterms:isReferencedBy ?scheda . }
}
ORDER BY DESC(?data) ?numero
LIMIT ${safeLimit}`;
}

function sanitizeCameraActUri(value) {
  const uri = String(value || '').trim();
  return /^http:\/\/dati\.camera\.it\/ocd\/attocamera\.rdf\/[A-Za-z0-9_-]+$/.test(uri)
    ? uri
    : null;
}

function buildCameraPopularInitiativeStatesQuery(sourceUris = []) {
  const safeUris = [...new Set((sourceUris || []).map(sanitizeCameraActUri).filter(Boolean))];
  if (safeUris.length === 0) return null;
  const values = safeUris.map(uri => `<${uri}>`).join(' ');
  return `
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?atto ?statoIter ?statoLabel ?statoData
WHERE {
  VALUES ?atto { ${values} }
  ?atto ocd:rif_statoIter ?statoIter .
  OPTIONAL { ?statoIter dc:title ?statoLabel . }
  OPTIONAL { ?statoIter dc:date ?statoData . }
}
ORDER BY ?atto ?statoData ?statoIter`;
}

function normalizeCameraBinding(binding, { legislature = 19 } = {}) {
  const sourceUri = bindingValue(binding, 'atto');
  const number = bindingValue(binding, 'numero');
  const title = decodeCameraText(bindingValue(binding, 'titolo') || bindingValue(binding, 'label'));
  if (!sourceUri || !title) return null;

  const sourceStatus = bindingValue(binding, 'statoLabel') || bindingValue(binding, 'statoIter');
  return {
    jurisdictionId: JURISDICTION_ID,
    processTypeId: PROCESS_TYPE_ID,
    sourceId: SOURCE_ID,
    externalId: sourceUri,
    sourceUri,
    sourceUrl: bindingValue(binding, 'scheda') || sourceUri,
    title,
    stageId: mapItalianParliamentaryStage(sourceStatus),
    sourceStatus,
    officialReference: null,
    officialIdentifiers: number ? [
      { namespace: 'it.parliament.phase', value: `${legislature}:C:${number}` }
    ] : [],
    presentedAt: bindingValue(binding, 'data'),
    statusUpdatedAt: bindingValue(binding, 'statoData'),
    metadata: {
      chamber: 'Camera',
      legislature,
      number,
      stateUri: bindingValue(binding, 'statoIter'),
    },
  };
}

function normalizeCameraBindings(bindings, options = {}) {
  const byExternalId = new Map();
  for (const binding of bindings || []) {
    const record = normalizeCameraBinding(binding, options);
    if (!record) continue;
    const existing = byExternalId.get(record.externalId);
    if (!existing) {
      byExternalId.set(record.externalId, record);
      continue;
    }
    if (record.stageId === 'closed' && existing.stageId !== 'closed') {
      existing.stageId = record.stageId;
      existing.sourceStatus = record.sourceStatus;
      existing.statusUpdatedAt = record.statusUpdatedAt;
      existing.metadata.stateUri = record.metadata.stateUri;
    } else if (!existing.sourceStatus && record.sourceStatus) {
      existing.sourceStatus = record.sourceStatus;
      existing.statusUpdatedAt = record.statusUpdatedAt;
      existing.metadata.stateUri = record.metadata.stateUri;
    }
    if (!existing.sourceUrl && record.sourceUrl) existing.sourceUrl = record.sourceUrl;
  }
  return [...byExternalId.values()];
}

function compareCameraStateRows(a, b) {
  const aClosed = mapItalianParliamentaryStage(a.sourceStatus) === 'closed';
  const bClosed = mapItalianParliamentaryStage(b.sourceStatus) === 'closed';
  if (aClosed !== bClosed) return aClosed ? 1 : -1;
  const aDate = String(a.statusUpdatedAt || '');
  const bDate = String(b.statusUpdatedAt || '');
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return String(a.stateUri || '').localeCompare(String(b.stateUri || ''));
}

function selectLatestCameraStates(bindings = []) {
  const byAct = new Map();
  for (const binding of bindings || []) {
    const act = bindingValue(binding, 'atto');
    if (!act) continue;
    const row = {
      sourceStatus: decodeCameraText(bindingValue(binding, 'statoLabel') || bindingValue(binding, 'statoIter')),
      statusUpdatedAt: bindingValue(binding, 'statoData'),
      stateUri: bindingValue(binding, 'statoIter'),
    };
    const existing = byAct.get(act);
    if (!existing || compareCameraStateRows(existing, row) < 0) byAct.set(act, row);
  }
  return byAct;
}

function applyCameraStateBindings(records = [], stateBindings = []) {
  const states = selectLatestCameraStates(stateBindings);
  return (records || []).map(record => {
    const state = states.get(record.sourceUri);
    if (!state) return record;
    return {
      ...record,
      stageId: mapItalianParliamentaryStage(state.sourceStatus),
      sourceStatus: state.sourceStatus || null,
      statusUpdatedAt: state.statusUpdatedAt || null,
      metadata: {
        ...(record.metadata || {}),
        stateUri: state.stateUri || null,
      },
    };
  });
}

async function fetchCameraPopularInitiatives(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const query = buildCameraPopularInitiativesQuery(options);
  const bindings = await fetchSparqlBindings({ endpoint: ENDPOINT, query, timeoutMs });
  const records = normalizeCameraBindings(bindings, options);
  if (records.length === 0) return records;

  const stateQuery = buildCameraPopularInitiativeStatesQuery(records.map(record => record.sourceUri));
  if (!stateQuery) return records;

  try {
    const stateBindings = await fetchSparqlBindings({ endpoint: ENDPOINT, query: stateQuery, timeoutMs });
    return applyCameraStateBindings(records, stateBindings);
  } catch (error) {
    console.warn(
      `[camera-popular-initiatives] state enrichment unavailable: ${error.code || error.message || 'UNKNOWN_ERROR'}; ` +
      'using parliamentary_review for records without a terminal status'
    );
    return records;
  }
}

module.exports = {
  ENDPOINT,
  SOURCE_ID,
  DEFAULT_TIMEOUT_MS,
  buildCameraPopularInitiativesQuery,
  buildCameraPopularInitiativeStatesQuery,
  decodeCameraText,
  normalizeCameraBinding,
  normalizeCameraBindings,
  selectLatestCameraStates,
  applyCameraStateBindings,
  fetchCameraPopularInitiatives,
};
