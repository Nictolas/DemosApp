'use strict';
const express = require('express');
const referendumVoteRoutes = require('./referendum-vote');
const router = express.Router();

// The real YES/NO referendum ballots remain active under /api/referendum/vote-real.
router.use('/vote-real', referendumVoteRoutes);

// The former "which referendum has priority" feature was retired.
// Its list/management/vote endpoints referenced obsolete PostgreSQL columns;
// old URLs must fail closed instead of reading or modifying user preferences.
router.use((req, res) => {
  // Retired preference endpoints must neither read nor expose private state.
  res.set('Cache-Control', 'private, no-store');
  return res.status(410).json({
    success: false,
    error: 'PRIORITA_REFERENDUM_DISMESSA',
    message: 'Le votazioni di priorità non sono disponibili. Consulta /api/referendum-abrogativi per la raccolta ufficiale.'
  });
});

module.exports = router;
