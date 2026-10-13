const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();

/**
 * Sorgente canonica: tabella eci popolata dallo sync del portale UE.
 * Lo script sync_eci.py scarica esclusivamente STATUS=ONGOING.
 * Nessun ranking DEMOS: ordine neutro per scadenza e titolo.
 */
async function fetchOfficialOngoing() {
  const result = await pool.query(
    `SELECT id, title, signature_count, slug, end_date, obiettivi, url, status
     FROM eci
     ORDER BY end_date ASC NULLS LAST, title ASC, id ASC`
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    title: row.title || 'Senza titolo',
    firme: Number(row.signature_count) || 0,
    signature_count: Number(row.signature_count) || 0,
    slug: row.slug || null,
    end_date: row.end_date
      ? (row.end_date.toISOString
          ? row.end_date.toISOString().slice(0, 10)
          : String(row.end_date).slice(0, 10))
      : null,
    obiettivi: row.obiettivi || null,
    url: row.url || null,
    status: row.status || 'ONGOING',
  }));
}

// Alias API legacy di /api/ice: conserva il contratto di lettura senza reintrodurre ranking.
router.get('/', async (_req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    const initiatives = await fetchOfficialOngoing();
    return res.json({
      success: true,
      source: 'eci_table',
      ordering: 'neutral',
      initiatives,
      ongoing: initiatives,
      successi: [],
    });
  } catch (error) {
    console.error('Errore GET /api/eci:', error);
    return res.status(503).json({
      success: false,
      error: 'Dati ECI ufficiali non disponibili',
    });
  }
});

module.exports = router;
