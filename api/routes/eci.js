const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();

const DECIDIM_GRAPHQL_URL = process.env.DECIDIM_GRAPHQL_URL || 'https://www.demos.community/api';
const DECIDIM_ECI_ASSEMBLY_ID = process.env.DECIDIM_ECI_ASSEMBLY_ID; // ID dello spazio partecipativo che contiene le ECI (es. 3 per EU portal)

// API EU ECI: endpoint possono essere spostati dalla Commissione (es. 404). Override con env.
var EU_BASE = process.env.EU_ECI_API_BASE || 'https://citizens-initiative.europa.eu';
var EU_ECI_ONGOING_URL = process.env.EU_ECI_ONGOING_URL || (EU_BASE + '/api/register/search/ONGOING/IT/0/100');
var EU_ECI_ALL_URL = process.env.EU_ECI_ALL_URL || (EU_BASE + '/api/register/search/ALL/IT/0/200');
// URL alternativi da provare in caso di 404 (path senza /register/)
var EU_ECI_ONGOING_ALT = EU_BASE + '/api/search/ONGOING/IT/0/100';
var EU_ECI_ALL_ALT = EU_BASE + '/api/search/ALL/IT/0/200';
var SUCCESSI_MIN_FIRME = 1000000;

/** Estrae lista da risposta JSON API EU (struttura flessibile). */
function extractListFromEuResponse(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data;
  var keys = ['content', 'items', 'initiatives', 'data', 'results', 'searchResult'];
  for (var k = 0; k < keys.length; k++) {
    var val = data[keys[k]];
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      if (Array.isArray(val.content)) return val.content;
      if (Array.isArray(val.items)) return val.items;
      if (Array.isArray(val.initiatives)) return val.initiatives;
      if (Array.isArray(val.results)) return val.results;
    }
  }
  return [];
}

function getTitleFromEuItem(item) {
  var title = item.title || item.initiativeTitle || item.name || item.titleIt || item.titleEn;
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object') return title.it || title.en || title.title || '';
  return 'Senza titolo';
}

function getSupportersFromEuItem(item) {
  var n = item.totalSupporters != null ? item.totalSupporters : (item.supporters != null ? item.supporters : (item.signatures != null ? item.signatures : item.signatureCount));
  if (n == null) return 0;
  n = parseInt(n, 10);
  return isNaN(n) ? 0 : n;
}

function getEuItemId(item) {
  return String(item.identifier != null ? item.identifier : (item.id != null ? item.id : (item.code || Math.random().toString(36).slice(2))));
}

/** Fetch con timeout (ms). */
function fetchWithTimeout(url, ms) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeoutId = null;
  if (controller && ms > 0) {
    timeoutId = setTimeout(function () { controller.abort(); }, ms);
  }
  var opts = { method: 'GET', headers: { 'Accept': 'application/json' } };
  if (controller && controller.signal) opts.signal = controller.signal;
  var p = fetch(url, opts);
  if (timeoutId) {
    p = p.finally(function () { clearTimeout(timeoutId); });
  }
  return p;
}

/**
 * Recupera ECI in tempo reale dalle API ufficiali EU:
 * - ONGOING: iniziative in corso
 * - ALL: filtra solo quelle con totalSupporters >= 1.000.000 (successi).
 */
async function fetchFromEuOfficialApi() {
  var EU_API_TIMEOUT_MS = 20000;
  var ongoingRes;
  var allRes;
  try {
    ongoingRes = await fetchWithTimeout(EU_ECI_ONGOING_URL, EU_API_TIMEOUT_MS);
  } catch (err) {
    console.warn('⚠️ ECI: EU API ONGOING richiesta fallita:', err.message);
    throw new Error('EU API non raggiungibile (timeout o rete): ' + err.message);
  }
  if (!ongoingRes.ok) {
    if (ongoingRes.status === 404 && EU_ECI_ONGOING_URL !== EU_ECI_ONGOING_ALT) {
      console.warn('⚠️ ECI: EU API ONGOING 404, provo URL alternativo:', EU_ECI_ONGOING_ALT);
      ongoingRes = await fetchWithTimeout(EU_ECI_ONGOING_ALT, EU_API_TIMEOUT_MS);
    }
    if (!ongoingRes.ok) {
      console.warn('⚠️ ECI: EU API ONGOING HTTP', ongoingRes.status, '(endpoint potrebbe essere cambiato dalla Commissione EU)');
      throw new Error('EU API ONGOING HTTP ' + ongoingRes.status);
    }
  }
  var ongoingJson = await ongoingRes.json().catch(function () { return {}; });
  var ongoingList = extractListFromEuResponse(ongoingJson);
  if (ongoingList.length === 0 && typeof ongoingJson === 'object') {
    console.warn('⚠️ ECI: EU API ONGOING 200 ma lista vuota. Chiavi risposta:', Object.keys(ongoingJson).join(', '));
  }

  try {
    allRes = await fetchWithTimeout(EU_ECI_ALL_URL, EU_API_TIMEOUT_MS);
  } catch (err) {
    console.warn('⚠️ ECI: EU API ALL richiesta fallita:', err.message);
    if (ongoingList.length > 0) {
      var byId = {};
      for (var o = 0; o < ongoingList.length; o++) {
        var it = ongoingList[o];
        var id = getEuItemId(it);
        byId[id] = { id: id, title: getTitleFromEuItem(it), signature_count: getSupportersFromEuItem(it), slug: id };
      }
      var out = [];
      for (id in byId) out.push(byId[id]);
      out.sort(function (a, b) { return (b.signature_count || 0) - (a.signature_count || 0); });
      return out;
    }
    throw new Error('EU API non raggiungibile: ' + err.message);
  }
  if (!allRes.ok) {
    if (allRes.status === 404 && EU_ECI_ALL_URL !== EU_ECI_ALL_ALT) {
      console.warn('⚠️ ECI: EU API ALL 404, provo URL alternativo:', EU_ECI_ALL_ALT);
      allRes = await fetchWithTimeout(EU_ECI_ALL_ALT, EU_API_TIMEOUT_MS);
    }
    if (!allRes.ok) {
      if (ongoingList.length > 0) {
        var byId2 = {};
        for (var o2 = 0; o2 < ongoingList.length; o2++) {
          var it2 = ongoingList[o2];
          var id2 = getEuItemId(it2);
          byId2[id2] = { id: id2, title: getTitleFromEuItem(it2), signature_count: getSupportersFromEuItem(it2), slug: id2 };
        }
        var out2 = [];
        for (id2 in byId2) out2.push(byId2[id2]);
        out2.sort(function (a, b) { return (b.signature_count || 0) - (a.signature_count || 0); });
        return out2;
      }
      console.warn('⚠️ ECI: EU API ALL HTTP', allRes.status, '(endpoint potrebbe essere cambiato dalla Commissione EU)');
      throw new Error('EU API ALL HTTP ' + allRes.status);
    }
  }
  var allJson = await allRes.json().catch(function () { return {}; });
  var allList = extractListFromEuResponse(allJson);

  var byId = {};
  var i, item, id, title, supporters;
  for (i = 0; i < ongoingList.length; i++) {
    item = ongoingList[i];
    id = getEuItemId(item);
    title = getTitleFromEuItem(item);
    supporters = getSupportersFromEuItem(item);
    byId[id] = { id: id, title: title, signature_count: supporters, slug: id };
  }
  for (i = 0; i < allList.length; i++) {
    item = allList[i];
    if (getSupportersFromEuItem(item) < SUCCESSI_MIN_FIRME) continue;
    id = getEuItemId(item);
    if (byId[id]) continue;
    title = getTitleFromEuItem(item);
    supporters = getSupportersFromEuItem(item);
    byId[id] = { id: id, title: title, signature_count: supporters, slug: id };
  }
  var list = [];
  for (id in byId) list.push(byId[id]);
  list.sort(function (a, b) { return (b.signature_count || 0) - (a.signature_count || 0); });
  return list;
}

// ECI su Decidim sono Proposals dentro un assembly (o processo partecipativo).
// Query: assembly(id) -> components(type: Proposals) -> proposals con endorsementCount / endorsements.
// Paginazione: first, after, pageInfo.endCursor, hasNextPage.
const ECI_PROPOSALS_QUERY = `
query ECIProposals($assemblyId: ID!, $first: Int!, $after: String) {
  assembly(id: $assemblyId) {
    components(filter: { type: "Proposals" }) {
      id
      name { translation(locale: "it") }
      ... on Proposals {
        proposals(first: $first, after: $after) {
          pageInfo {
            endCursor
            hasNextPage
          }
          edges {
            node {
              id
              title { translation(locale: "it") }
              endorsementCount
              endorsements { id }
            }
          }
        }
      }
    }
  }
}
`;

/** Normalizza un node proposta: titolo e numero firme (endorsementCount o len(endorsements)). */
function normalizeProposalNode(node) {
  if (!node) return null;
  const titleObj = node.title;
  const titleVal = (titleObj && titleObj.translation) != null
    ? titleObj.translation
    : (typeof titleObj === 'string' ? titleObj : '');
  const title = titleVal || 'Senza titolo';
  let firme = 0;
  if (node.endorsementCount != null) {
    firme = parseInt(node.endorsementCount, 10);
  } else if (node.endorsements && Array.isArray(node.endorsements)) {
    firme = node.endorsements.length;
  }
  if (Number.isNaN(firme)) firme = 0;
  return {
    id: String(node.id),
    title: title,
    signature_count: firme,
    slug: node.slug || node.id,
  };
}

/**
 * Chiama Decidim GraphQL: assembly(id) -> Proposals -> proposals con paginazione.
 * Richiede DECIDIM_GRAPHQL_URL e DECIDIM_ECI_ASSEMBLY_ID.
 */
async function fetchFromDecidimGraphQL() {
  const assemblyId = DECIDIM_ECI_ASSEMBLY_ID;
  if (!assemblyId) {
    throw new Error('DECIDIM_ECI_ASSEMBLY_ID non configurato. Imposta l\'ID dello spazio partecipativo che contiene le ECI.');
  }

  const endpoint = DECIDIM_GRAPHQL_URL.replace(/\/$/, '');
  const apiUrl = endpoint.endsWith('/api') ? endpoint : endpoint + '/api';

  const PAGE_SIZE = 50;
  let after = null;
  const allResults = [];

  for (;;) {
    const variables = {
      assemblyId: String(assemblyId),
      first: PAGE_SIZE,
      after: after,
    };
    const body = { query: ECI_PROPOSALS_QUERY, variables: variables };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('GraphQL HTTP ' + res.status);
    }

    const json = await res.json().catch(function () { return {}; });
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors.map(function (e) { return e.message; }).join('; '));
    }

    const data = json.data;
    if (!data || !data.assembly || !data.assembly.components) {
      break;
    }

    const components = data.assembly.components;
    let nextCursor = null;
    let hasMore = false;

    for (let c = 0; c < components.length; c++) {
      const comp = components[c];
      const proposals = comp && comp.proposals;
      if (!proposals || !proposals.edges) continue;

      const edges = proposals.edges;
      for (let i = 0; i < edges.length; i++) {
        const node = edges[i] && edges[i].node;
        const item = normalizeProposalNode(node);
        if (item) allResults.push(item);
      }

      const pageInfo = proposals.pageInfo;
      if (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
        hasMore = true;
        nextCursor = pageInfo.endCursor;
      }
      break;
    }

    if (!hasMore || !nextCursor) break;
    after = nextCursor;
  }

  allResults.sort(function (a, b) { return (b.signature_count || 0) - (a.signature_count || 0); });
  return allResults;
}

/**
 * Legge dalla tabella ECI su Neon (fallback/cache).
 */
async function fetchFromEciTable() {
  const client = pool;
  const result = await client.query(
    `SELECT id, title, signature_count, slug FROM eci ORDER BY signature_count DESC NULLS LAST`
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title || 'Senza titolo',
    signature_count: parseInt(row.signature_count, 10) || 0,
    slug: row.slug,
  }));
}

/**
 * Scrive in tabella ECI (upsert) per cache/fallback.
 */
async function upsertEciTable(items) {
  if (!items || items.length === 0) return;
  const client = pool;
  for (const item of items) {
    await client.query(
      `INSERT INTO eci (id, title, signature_count, slug, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         signature_count = EXCLUDED.signature_count,
         slug = EXCLUDED.slug,
         updated_at = NOW()`,
      [item.id, item.title, item.signature_count, item.slug || item.id]
    );
  }
}

/** Seed iniziale in tabella ECI se vuota (dati di esempio finché non c’è Decidim o import reale). */
async function seedEciTableIfEmpty() {
  if (!pool) return;
  const countResult = await pool.query('SELECT COUNT(*)::int AS n FROM eci');
  if (countResult.rows[0].n > 0) return;
  const examples = [
    { id: 'eci-esempio-1', title: 'Esempio ECI 1 – Iniziativa dei Cittadini Europei', signature_count: 0, slug: 'esempio-1' },
    { id: 'eci-esempio-2', title: 'Esempio ECI 2 – Popola la tabella ECI o configura DECIDIM_GRAPHQL_URL', signature_count: 0, slug: 'esempio-2' },
  ];
  await upsertEciTable(examples);
}

// GET /api/eci - Lista ECI (Iniziative Cittadini Europei) da Decidim GraphQL, con fallback su tabella ECI
router.get('/', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    let list = [];
    let source = 'eci_table';

    try {
      list = await fetchFromEuOfficialApi();
      source = 'eu_official';
      if (list.length > 0 && pool) {
        try {
          await upsertEciTable(list);
        } catch (upsertErr) {
          console.warn('⚠️ ECI: upsert in tabella ECI fallito (tabella assente?):', upsertErr.message);
        }
      }
    } catch (euErr) {
      try {
        list = await fetchFromDecidimGraphQL();
        source = 'decidim_graphql';
        if (list.length > 0 && pool) {
          try {
            await upsertEciTable(list);
          } catch (upsertErr) {
            console.warn('⚠️ ECI: upsert in tabella ECI fallito (tabella assente?):', upsertErr.message);
          }
        }
      } catch (graphqlErr) {
        console.warn('⚠️ ECI: EU API e Decidim non disponibili, uso tabella ECI:', euErr.message);
        try {
          list = await fetchFromEciTable();
          if (list.length === 0) {
            try {
              await seedEciTableIfEmpty();
              list = await fetchFromEciTable();
            } catch (seedErr) {
              console.warn('⚠️ ECI: seed tabella fallito:', seedErr.message);
            }
          }
        } catch (dbErr) {
          console.error('❌ ECI: né EU API né Decidim né tabella ECI disponibili:', dbErr.message);
          return res.status(503).json({
            success: false,
            error: 'Dati ECI non disponibili. Verifica connessione alle API EU o popola la tabella ECI.',
            details: euErr.message,
          });
        }
      }
    }

    res.json({
      success: true,
      source,
      initiatives: list.map((item) => ({
        id: item.id,
        title: item.title,
        firme: item.signature_count,
        signature_count: item.signature_count,
        slug: item.slug,
      })),
    });
  } catch (error) {
    console.error('❌ Errore GET /api/eci:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle ECI',
      details: error.message,
    });
  }
});

module.exports = router;
