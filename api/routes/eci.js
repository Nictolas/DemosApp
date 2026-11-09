const express = require('express');
const { pool } = require('../middleware/auth');

const router = express.Router();

/**
 * Sorgente canonica: tabella eci popolata dallo sync del portale UE.
 * Lo script sync_eci.py scarica esclusivamente STATUS=ONGOING.
 * Nessun ranking DEMOS: ordine neutro per scadenza e titolo.
 */
function toPublicInitiative(row) {
  return {
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
    status: row.status || 'NOT_ONGOING',
  };
}

async function fetchOfficialOngoing() {
  const result = await pool.query(
    `SELECT id, title, signature_count, slug, end_date, obiettivi, url, status
     FROM eci
     WHERE status = 'ONGOING'
     ORDER BY end_date ASC NULLS LAST, title ASC, id ASC`
  );

  return result.rows.map(toPublicInitiative);
}

// For a push link to an ECI whose collection has since ended, fetch only
// the one public official record on demand. Never load the entire archive
// on a normal ECI page. IDs are strict Commission registration numbers.
async function fetchHistoricalById(id) {
  const { rows } = await pool.query(
    `SELECT id, title, signature_count, slug, end_date, obiettivi, url, status
     FROM eci
     WHERE id = $1 AND status IS DISTINCT FROM 'ONGOING'
     LIMIT 1`,
    [id],
  );
  return rows.length === 1 ? toPublicInitiative(rows[0]) : null;
}

// Alias API legacy di /api/ice: conserva il contratto di lettura senza reintrodurre ranking.
router.get('/', async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    const requestedId = req.query.initiative;
    if (requestedId !== undefined &&
        (typeof requestedId !== 'string' ||
         !/^[0-9]{4}-[0-9]{6}$/.test(requestedId))) {
      return res.status(400).json({success:false,error:'ID ECI non valido'});
    }
    const ongoing = await fetchOfficialOngoing();
    // Only after a notification references a closed ECI is a second SQL query
    // used. The regular list remains one SELECT and never grows historically.
    const archived = requestedId && !ongoing.some(row => row.id === requestedId)
      ? await fetchHistoricalById(requestedId)
      : null;
    const initiatives = archived ? [...ongoing, archived] : ongoing;
    return res.json({
      success: true,
      source: 'eci_table',
      ordering: 'neutral',
      initiatives,
      ongoing,
      successi: [],
    });
  } catch (error) {
    console.error('ECI_OFFICIAL_SOURCE_UNAVAILABLE');
    return res.status(503).json({
      success: false,
      error: 'Dati ECI ufficiali non disponibili',
    });
  }
});

module.exports = router;
