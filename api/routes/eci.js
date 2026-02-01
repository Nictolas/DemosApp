const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();

const DECIDIM_GRAPHQL_URL = process.env.DECIDIM_GRAPHQL_URL || 'https://www.demos.community/api';

// Query GraphQL Decidim per le initiative (ECI) - titolo e numero firme/voti
// Campi possibili a seconda versione Decidim: signatureCount, onlineVotesCount, votesCount, scopedType { signatureType }
const INITIATIVES_QUERY = `
  query ECIInitiatives {
    initiatives(first: 100) {
      edges {
        node {
          id
          title {
            translation(locale: "it")
          }
          signatureCount
          onlineVotesCount
          offlineVotesCount
          state
          slug
        }
      }
    }
  }
`;

/**
 * Chiama l'API GraphQL Decidim e restituisce la lista delle initiative con titolo e firme.
 * Gestisce risposte con signatureCount, onlineVotesCount, offlineVotesCount o somma.
 */
async function fetchFromDecidimGraphQL() {
  const url = DECIDIM_GRAPHQL_URL.replace(/\/$/, '');
  const graphqlEndpoint = url.includes('/api') ? url : `${url}/api`;
  const res = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: INITIATIVES_QUERY }),
  });
  if (!res.ok) {
    throw new Error(`Decidim GraphQL HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  const data = json.data;
  if (!data || !data.initiatives) {
    return [];
  }
  const edges = data.initiatives.edges || [];
  const list = [];
  for (const edge of edges) {
    const node = edge.node;
    if (!node) continue;
    const title =
      (node.title && node.title.translation) ||
      (node.title && typeof node.title === 'string') ||
      '';
    const signatureCount =
      node.signatureCount != null
        ? parseInt(node.signatureCount, 10)
        : node.onlineVotesCount != null
          ? parseInt(node.onlineVotesCount, 10)
          : 0;
    const offline = node.offlineVotesCount != null ? parseInt(node.offlineVotesCount, 10) : 0;
    const firme = Number.isNaN(signatureCount) ? 0 : signatureCount + (Number.isNaN(offline) ? 0 : offline);
    list.push({
      id: String(node.id),
      title: title || 'Senza titolo',
      signature_count: firme,
      slug: node.slug || node.id,
      state: node.state,
    });
  }
  return list;
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
