'use strict';

const { fetchSparqlBindings, bindingValue } = require('./sparqlClient');
const { mapItalianParliamentaryStage } = require('./italyParliamentStage');

const ENDPOINT = 'https://dati.camera.it/sparql';
const SOURCE_ID = 'it.parliament.camera';
const PROCESS_TYPE_ID = 'it.popular_law_initiative';
const JURISDICTION_ID = 'it';

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

SELECT DISTINCT ?atto ?numero ?titolo ?data ?statoIter ?statoLabel ?scheda
WHERE {
  ?atto a ocd:atto ;
        ocd:rif_leg <http://dati.camera.it/ocd/legislatura.rdf/repubblica_${safeLegislature}> ;
        ocd:iniziativa "Popolare" ;
        dc:type "Progetto di Legge" ;
        dc:identifier ?numero ;
        dc:title ?titolo .
  OPTIONAL { ?atto dc:date ?data . }
  OPTIONAL {
    ?atto ocd:rif_statoIter ?statoIter .
    OPTIONAL { ?statoIter rdfs:label ?statoLabel . }
  }
  OPTIONAL { ?atto dcterms:isReferencedBy ?scheda . }
}
ORDER BY DESC(?data) ?numero
LIMIT ${safeLimit}`;
}

function normalizeCameraBinding(binding, { legislature = 19 } = {}) {
  const sourceUri = bindingValue(binding, 'atto');
  const number = bindingValue(binding, 'numero');
  const title = decodeCameraText(bindingValue(binding, 'titolo'));
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
    statusUpdatedAt: null,
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
    } else if (!existing.sourceStatus && record.sourceStatus) {
      existing.sourceStatus = record.sourceStatus;
    }
    if (!existing.sourceUrl && record.sourceUrl) existing.sourceUrl = record.sourceUrl;
  }
  return [...byExternalId.values()];
}

async function fetchCameraPopularInitiatives(options = {}) {
  const query = buildCameraPopularInitiativesQuery(options);
  const bindings = await fetchSparqlBindings({ endpoint: ENDPOINT, query, timeoutMs: options.timeoutMs });
  return normalizeCameraBindings(bindings, options);
}

module.exports = {
  ENDPOINT,
  SOURCE_ID,
  buildCameraPopularInitiativesQuery,
  decodeCameraText,
  normalizeCameraBinding,
  normalizeCameraBindings,
  fetchCameraPopularInitiatives,
};
