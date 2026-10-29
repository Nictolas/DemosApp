const express = require('express');
const router = express.Router();
const { getAllOpinions } = require('../services/opinionCatalog');
const { getPool } = require('../config/database');
const { remember, isEnabled } = require('../services/redisCache');
const { queryWithAccountModelFallback } = require('../services/accountCapabilitiesService');
const { keys, ttl } = require('../config/cacheKeys');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// ===== ENDPOINTS PER STATISTICHE =====

// GET /api/statistiche/utenti - Statistiche utenti
router.get('/utenti', async (req, res) => {
  try {
    const body = await remember(keys.statisticheUtenti, ttl.statistiche, async () => {
      const result = await queryWithAccountModelFallback(
        pool,
        `SELECT
           COUNT(*) as totale_utenti,
           COUNT(CASE WHEN status = 'A' OR status = 'a' THEN 1 END) as utenti_verificati,
           COUNT(CASE WHEN is_admin = TRUE THEN 1 END) as admin
         FROM users`,
        `SELECT
           COUNT(*) as totale_utenti,
           COUNT(CASE WHEN status = 'A' OR status = 'a' THEN 1 END) as utenti_verificati,
           COUNT(CASE WHEN ruolo = 'AD' THEN 1 END) as admin
         FROM users`
      );
      return {
        success: true,
        data: result.rows[0]
      };
    });

    if (isEnabled()) {
      res.set('Cache-Control', `public, max-age=${Math.min(ttl.statistiche, 60)}, s-maxage=${Math.min(ttl.statistiche, 60)}`);
    }
    res.json(body);
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche utenti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/statistiche/opinioni - Statistiche opinioni
router.get('/opinioni', async (req, res) => {
  try {
    const body = await remember(keys.statisticheOpinioni, ttl.statistiche, async () => {
      const count = String(getAllOpinions().length);
      return { success: true, data: { totale_opinioni: count, opinioni_approvate: count } };
    });

    if (isEnabled()) {
      res.set('Cache-Control', `public, max-age=${Math.min(ttl.statistiche, 60)}, s-maxage=${Math.min(ttl.statistiche, 60)}`);
    }
    res.json(body);
  } catch (error) {
    console.error('❌ Errore nel recupero statistiche opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
