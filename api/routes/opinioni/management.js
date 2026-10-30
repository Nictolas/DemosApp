'use strict';
const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { getOpinionScopeLabel } = require('../../services/politicalJurisdictionRegistryService');
const { getAllOpinions, sortOpinionsByText } = require('../../services/opinionCatalog');
const router = express.Router();

// Official opinion metadata is immutable at runtime. Old Android clients may
// still send these requests: reject server-side instead of silently diverging
// from the code catalog or modifying the legacy database table.
const officialCatalogReadOnly = (_req, res) => res.status(409).json({
  success: false,
  error: 'CATALOG_RELEASE_REQUIRED',
  message: 'Le opinioni ufficiali si aggiornano solo tramite codice e release.'
});

router.get('/', verifyToken, (_req, res) => {
  res.json({ success: true, data: sortOpinionsByText(getAllOpinions()) });
});
router.get('/proposte', verifyToken, requireAdmin, (_req, res) => {
  const data = sortOpinionsByText(getAllOpinions()).map(op => ({
    ...op,
    gradi_opinione: op.gradi_opinione.map(grado => getOpinionScopeLabel(grado) || grado)
  }));
  res.json({ success: true, data });
});
router.post('/', verifyToken, requireAdmin, officialCatalogReadOnly);
router.put('/:id', verifyToken, requireAdmin, officialCatalogReadOnly);
router.delete('/:id', verifyToken, requireAdmin, officialCatalogReadOnly);
module.exports = router;
