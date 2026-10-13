'use strict';

const axios = require('axios');

async function fetchSparqlBindings({ endpoint, query, timeoutMs = 30000 }) {
  if (!endpoint || !query) throw new Error('SPARQL_ENDPOINT_AND_QUERY_REQUIRED');

  const response = await axios.get(endpoint, {
    params: { query, format: 'json' },
    headers: {
      Accept: 'application/sparql-results+json, application/json',
      'User-Agent': 'DEMOS civic-process sync/1.0 (+https://www.demos.community)'
    },
    timeout: timeoutMs,
    maxRedirects: 3,
  });

  const bindings = response.data?.results?.bindings;
  if (!Array.isArray(bindings)) throw new Error('INVALID_SPARQL_RESPONSE');
  return bindings;
}

function bindingValue(binding, key) {
  const value = binding?.[key]?.value;
  return value == null ? null : String(value);
}

module.exports = { fetchSparqlBindings, bindingValue };
