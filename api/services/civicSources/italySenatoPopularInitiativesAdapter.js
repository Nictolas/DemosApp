'use strict';

const { fetchSparqlBindings, bindingValue } = require('./sparqlClient');
const { mapItalianParliamentaryStage } = require('./italyParliamentStage');

const ENDPOINT = 'https://dati.senato.it/sparql';
const SOURCE_ID = 'it.parliament.senate';
const PROCESS_TYPE_ID = 'it.popular_law_initiative';
const JURISDICTION_ID = 'it';

function buildSenatoPopularInitiativesQuery({ legislature = 19, limit = 1000 } = {}) {
  const safeLegislature = Math.max(1, Number.parseInt(legislature, 10) || 19);
  const safeLimit = Math.min(4000, Math.max(1, Number.parseInt(limit, 10) || 1000));
  return `
PREFIX osr: <http://dati.senato.it/osr/>

SELECT DISTINCT ?ddl ?idDdl ?ramo ?numeroFase ?titolo ?dataPresentazione ?stato ?dataStato ?tipoIniziativa
WHERE {
  ?ddl a osr:Ddl ;
       osr:legislatura ${safeLegislature} ;
       osr:idDdl ?idDdl ;
       osr:ramo ?ramo ;
       osr:numeroFase ?numeroFase ;
       osr:titolo ?titolo ;
       osr:iniziativa ?iniziativa .
  ?iniziativa osr:tipoIniziativa ?tipoIniziativa .
  FILTER (LCASE(STR(?tipoIniziativa)) = "popolare")
  OPTIONAL { ?ddl osr:dataPresentazione ?dataPresentazione . }
  OPTIONAL { ?ddl osr:statoDdl ?stato . }
  OPTIONAL { ?ddl osr:dataStatoDdl ?dataStato . }
}
ORDER BY DESC(?dataStato) DESC(?dataPresentazione) ?idDdl ?ramo ?numeroFase
LIMIT ${safeLimit}`;
}

function normalizeSenatoBinding(binding, { legislature = 19 } = {}) {
  const sourceUri = bindingValue(binding, 'ddl');
  const idDdl = bindingValue(binding, 'idDdl');
  const title = bindingValue(binding, 'titolo');
  if (!sourceUri || !idDdl || !title) return null;

  const sourceStatus = bindingValue(binding, 'stato');
  const chamber = bindingValue(binding, 'ramo');
  const number = bindingValue(binding, 'numeroFase');
  const officialIdentifiers = [
    { namespace: 'it.parliament.iter', value: `${legislature}:${idDdl}` },
  ];
  if (chamber && number) {
    officialIdentifiers.push({ namespace: 'it.parliament.phase', value: `${legislature}:${chamber}:${number}` });
  }

  return {
    jurisdictionId: JURISDICTION_ID,
    processTypeId: PROCESS_TYPE_ID,
    sourceId: SOURCE_ID,
    externalId: sourceUri,
    sourceUri,
    sourceUrl: sourceUri,
    title,
    stageId: mapItalianParliamentaryStage(sourceStatus),
    sourceStatus,
    // idDdl identifica l'iter nelle fasi Camera/Senato esposte dal dataset del Senato.
    officialReference: `it:parliament:ddl:${legislature}:${idDdl}`,
    officialIdentifiers,
    presentedAt: bindingValue(binding, 'dataPresentazione'),
    statusUpdatedAt: bindingValue(binding, 'dataStato'),
    metadata: {
      chamber,
      legislature,
      idDdl,
      number,
      initiativeType: bindingValue(binding, 'tipoIniziativa'),
    },
  };
}

function normalizeSenatoBindings(bindings, options = {}) {
  const byExternalId = new Map();
  for (const binding of bindings || []) {
    const record = normalizeSenatoBinding(binding, options);
    if (!record) continue;
    byExternalId.set(record.externalId, record);
  }
  return [...byExternalId.values()];
}

async function fetchSenatoPopularInitiatives(options = {}) {
  const query = buildSenatoPopularInitiativesQuery(options);
  const bindings = await fetchSparqlBindings({ endpoint: ENDPOINT, query, timeoutMs: options.timeoutMs });
  return normalizeSenatoBindings(bindings, options);
}

module.exports = {
  ENDPOINT,
  SOURCE_ID,
  buildSenatoPopularInitiativesQuery,
  normalizeSenatoBinding,
  normalizeSenatoBindings,
  fetchSenatoPopularInitiatives,
};
