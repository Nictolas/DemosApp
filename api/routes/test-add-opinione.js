'use strict';
const express = require('express');
const router = express.Router();
// Kept only for compatibility with optional development-route mounting.
// The official catalog is release-managed; this endpoint must NEVER write a
// question or create a test record even in a development environment.
router.post('/', (_req, res) => res.status(409).json({
  success: false,
  error: 'CATALOG_RELEASE_REQUIRED',
  message: 'Le Opinioni ufficiali si modificano solo tramite codice e release.'
}));
module.exports = router;
