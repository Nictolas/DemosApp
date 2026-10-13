const express = require('express');
const { requireAdmin, verifyToken, pool } = require('../middleware/auth');

const router = express.Router();

async function loadOfficialOngoingInitiatives() {
  const result = await pool.query(
    `SELECT id, title, signature_count, slug, end_date, obiettivi, url, status
     FROM eci
     ORDER BY end_date ASC NULLS LAST, title ASC, id ASC`
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    nome: row.title || 'Senza titolo',
    descrizione: row.obiettivi || null,
    firme: Number(row.signature_count) || 0,
    signature_count: Number(row.signature_count) || 0,
    slug: row.slug || null,
    dataFine: row.end_date
      ? (row.end_date.toISOString
          ? row.end_date.toISOString().slice(0, 10)
          : String(row.end_date).slice(0, 10))
      : null,
    datafine: row.end_date
      ? (row.end_date.toISOString
          ? row.end_date.toISOString().slice(0, 10)
          : String(row.end_date).slice(0, 10))
      : null,
    sitoWeb: row.url || null,
    sitoweb: row.url || null,
    status: row.status || 'ONGOING',
    source: 'eu_official',
  }));
}

// GET /api/ice — collezione read-only delle ICE ufficiali UE attualmente sincronizzate.
// Lo sync eci interroga già la lista UE STATUS=ONGOING; DEMOS non crea una classifica propria.
router.get('/', async (_req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    const richieste = await loadOfficialOngoingInitiatives();
    return res.json({
      success: true,
      source: 'eci_table',
      ordering: 'neutral',
      richieste,
    });
  } catch (error) {
    console.error('Errore nel recupero delle ICE ufficiali:', error);
    return res.status(503).json({
      success: false,
      error: 'Dati ICE ufficiali non disponibili',
    });
  }
});

// Vista diagnostica Admin: stessa sorgente ufficiale, nessun dataset manuale parallelo.
router.get('/richieste', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const richieste = await loadOfficialOngoingInitiatives();
    return res.json({ success: true, source: 'eci_table', richieste });
  } catch (error) {
    console.error('Errore nel recupero ICE per Admin:', error);
    return res.status(503).json({ success: false, error: 'Dati ICE ufficiali non disponibili' });
  }
});

function officialSourceOnly(_req, res) {
  return res.status(410).json({
    success: false,
    error: 'ICE gestite dalla fonte ufficiale UE',
    message:
      'DEMOS mostra le ICE ufficiali in raccolta firme. Creazione, modifica, approvazione e voto interno DEMOS sono disabilitati; per firmare usa il link al portale UE.',
  });
}

// Le ICE non sono oggetti proposti o votati dentro DEMOS.
router.post('/', verifyToken, officialSourceOnly);
router.put('/:id', verifyToken, requireAdmin, officialSourceOnly);
router.post('/vota', verifyToken, officialSourceOnly);
router.post('/:id/:action', verifyToken, requireAdmin, officialSourceOnly);

module.exports = router;
