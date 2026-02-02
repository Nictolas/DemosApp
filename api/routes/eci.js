const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();
var SUCCESSI_MIN_FIRME = 1000000;

/**
 * Legge dalla tabella ECI su Neon. I dati sono popolati dallo script scripts/sync_eci.py
 * (GitHub Actions ogni 6 ore) che chiama l'API EU con User-Agent valido.
 */
async function fetchFromEciTable() {
  const client = pool;
  const result = await client.query(
    'SELECT id, title, signature_count, slug, end_date, obiettivi, url FROM eci ORDER BY signature_count DESC NULLS LAST'
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title || 'Senza titolo',
    signature_count: parseInt(row.signature_count, 10) || 0,
    slug: row.slug,
    end_date: row.end_date ? (row.end_date.toISOString ? row.end_date.toISOString().slice(0, 10) : String(row.end_date).slice(0, 10)) : null,
    obiettivi: row.obiettivi || null,
    url: row.url || null,
  }));
}

// GET /api/eci - Lista ECI solo da database (sync via GitHub Actions)
router.get('/', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    var list = [];
    try {
      list = await fetchFromEciTable();
    } catch (dbErr) {
      console.error('ECI: errore lettura tabella eci:', dbErr.message);
      return res.status(503).json({
        success: false,
        error: 'Dati ECI non disponibili. Verifica che lo sync ECI (GitHub Actions) sia stato eseguito.',
        details: dbErr.message,
      });
    }

    var ongoing = [];
    var successi = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var count = it.signature_count != null ? parseInt(it.signature_count, 10) : 0;
      var row = { id: it.id, title: it.title, firme: count, signature_count: count, slug: it.slug, end_date: it.end_date, obiettivi: it.obiettivi, url: it.url };
      if (count >= SUCCESSI_MIN_FIRME) {
        successi.push(row);
      } else {
        ongoing.push(row);
      }
    }

    res.json({
      success: true,
      source: 'eci_table',
      ongoing: ongoing,
      successi: successi,
      initiatives: list.map(function (item) {
        var c = item.signature_count != null ? parseInt(item.signature_count, 10) : 0;
        return { id: item.id, title: item.title, firme: c, signature_count: c, slug: item.slug, end_date: item.end_date, obiettivi: item.obiettivi, url: item.url };
      }),
    });
  } catch (error) {
    console.error('Errore GET /api/eci:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle ECI',
      details: error.message,
    });
  }
});

module.exports = router;
