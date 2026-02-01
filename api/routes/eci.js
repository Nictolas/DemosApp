const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();

const DECIDIM_GRAPHQL_URL = process.env.DECIDIM_GRAPHQL_URL || 'https://www.demos.community/api';

// Query GraphQL Decidim secondo la documentazione: URL/api, POST, Content-Type: application/json.
// Le collezioni di spazi partecipativi (participatoryProcesses, assemblies, conferences, initiatives)
// possono restituire un array diretto O una connection (edges/nodes). Gestiamo entrambi.
// Titolo: TranslatedField con translation(locale: "it").
const INITIATIVES_QUERY = `query ECIInitiatives {
  initiatives {
    slug
    title {
      translation(locale: "it")
    }
  }
}`;

// Variante con filter/order (come negli appunti: filter e order sono tipi InitiativeFilter, InitiativeSort).
// Se l'istanza supporta first/edges/node (connection), usiamo quella.
const INITIATIVES_QUERY_CONNECTION = `query ECIInitiativesConnection {
  initiatives(first: 100) {
    edges {
      node {
        id
        slug
        title {
          translation(locale: "it")
        }
      }
    }
  }
}`;

function normalizeItem(nodeOrItem) {
  const item = nodeOrItem || {};
  const titleVal = (item.title && item.title.translation) != null
    ? item.title.translation
    : (typeof item.title === 'string' ? item.title : '');
  const title = titleVal || 'Senza titolo';
  const sig = item.signatureCount != null ? parseInt(item.signatureCount, 10) : (item.onlineVotesCount != null ? parseInt(item.onlineVotesCount, 10) : 0);
  const off = item.offlineVotesCount != null ? parseInt(item.offlineVotesCount, 10) : 0;
  const firme = (Number.isNaN(sig) ? 0 : sig) + (Number.isNaN(off) ? 0 : off);
  return {
    id: String(item.id || item.slug || Math.random().toString(36).slice(2)),
    title: title,
    signature_count: firme,
    slug: item.slug || item.id,
    state: item.state,
  };
}

/** Estrae lista initiative da data secondo la doc: array diretto O edges[].node */
function parseInitiativesFromResponse(data) {
  const list = [];
  // Formato connection (edges/nodes) come per proposals
  const initiatives = data.initiatives;
  const edges = initiatives && initiatives.edges;
  if (Array.isArray(edges)) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const node = edge && edge.node;
      if (node) list.push(normalizeItem(node));
    }
    return list;
  }
  // Formato array diretto come participatoryProcesses negli appunti: initiatives: [ { slug, title } ]
  const arr = data.initiatives;
  if (Array.isArray(arr)) {
    for (const item of arr) list.push(normalizeItem(item));
    return list;
  }
  return list;
}

/**
 * Chiama l'API GraphQL Decidim come da documentazione:
 * - Richieste su URL/api in POST con Content-Type: application/json e body {"query": "..."}.
 */
async function fetchFromDecidimGraphQL() {
  const endpoint = DECIDIM_GRAPHQL_URL.replace(/\/$/, '');
  const apiUrl = endpoint.endsWith('/api') ? endpoint : `${endpoint}/api`;

  // Prova prima query minima (array diretto), poi con connection se necessario
  const queries = [INITIATIVES_QUERY, INITIATIVES_QUERY_CONNECTION];
  let lastError = null;

  for (const query of queries) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        lastError = new Error(`GraphQL HTTP ${res.status}`);
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (json.errors && json.errors.length > 0) {
        lastError = new Error(json.errors.map((e) => e.message).join('; '));
        continue;
      }
      const data = json.data;
      if (!data) {
        lastError = new Error('Risposta senza data');
        continue;
      }
      const list = parseInitiativesFromResponse(data);
      if (list.length > 0) return list;
      lastError = new Error('Nessuna initiative nella risposta');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Decidim GraphQL non raggiungibile');
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
      console.warn('⚠️ ECI: Decidim GraphQL non disponibile, uso tabella ECI:', graphqlErr.message);
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
        console.error('❌ ECI: né GraphQL né tabella ECI disponibili:', dbErr.message);
        return res.status(503).json({
          success: false,
          error: 'Dati ECI non disponibili. Configura DECIDIM_GRAPHQL_URL o crea la tabella ECI.',
          details: graphqlErr.message,
        });
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
