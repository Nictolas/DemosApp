const express = require('express');
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Funzione per assicurarsi che la tabella esista
async function ensureTableExists() {
  try {
    // Verifica se la tabella esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voti_camera'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('⚠️ Tabella voti_camera non trovata. Assicurati di averla creata nel database.');
      return false;
    }

    console.log('✅ Tabella voti_camera verificata');
    return true;
  } catch (error) {
    console.error('❌ Errore nella verifica tabella voti_camera:', error);
    return false;
  }
}

// GET /api/voti-camera - Ottieni tutte le votazioni dalla tabella voti_camera
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-camera - Richiesta votazioni Camera');
    
    const tableExists = await ensureTableExists();
    
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        error: 'Tabella voti_camera non trovata',
        message: 'La tabella voti_camera non esiste nel database. Esegui lo script Python per crearla e popolarla.',
        data: []
      });
    }

    // Recupera tutti i dati dalla tabella voti_camera
    const dbResult = await pool.query(
      `SELECT 
        politico_nome,
        camera,
        url_openpolis,
        votazione,
        voto,
        data_votazione,
        ultimo_aggiornamento
      FROM voti_camera
      ORDER BY data_votazione DESC NULLS LAST, politico_nome ASC
      LIMIT 1000`
    );

    const votazioni = dbResult.rows.map(row => ({
      politico_nome: row.politico_nome,
      camera: row.camera,
      url_openpolis: row.url_openpolis,
      votazione: row.votazione,
      voto: row.voto,
      data_votazione: row.data_votazione,
      ultimo_aggiornamento: row.ultimo_aggiornamento
    }));

    return res.json({
      success: true,
      data: votazioni,
      count: votazioni.length,
      source: 'database'
    });

  } catch (error) {
    console.error('❌ Errore nel recupero voti_camera:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dati',
      message: error.message || 'Errore interno del server',
      data: []
    });
  }
});

// GET /api/voti-camera/stats - Statistiche sui dati
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const tableExists = await ensureTableExists();
    
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        error: 'Tabella voti_camera non trovata'
      });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT politico_nome) as total_politici,
        COUNT(DISTINCT data_votazione) as total_date,
        MIN(data_votazione) as data_minima,
        MAX(data_votazione) as data_massima
      FROM voti_camera
    `);

    const esitiStats = await pool.query(`
      SELECT 
        voto,
        COUNT(*) as count
      FROM voti_camera
      GROUP BY voto
      ORDER BY count DESC
    `);

    return res.json({
      success: true,
      stats: {
        ...stats.rows[0],
        esiti: esitiStats.rows
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recupero statistiche:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle statistiche',
      message: error.message
    });
  }
});

// PUT /api/voti-camera/:politico/url - Aggiorna l'URL Openpolis di un politico (solo admin)
router.put('/:politico/url', verifyToken, async (req, res) => {
  try {
    // Verifica che l'utente sia admin
    const token = req.headers.authorization?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono modificare gli URL'
      });
    }
    
    const politicoNome = decodeURIComponent(req.params.politico);
    const { url_openpolis } = req.body;
    
    if (!url_openpolis || !url_openpolis.startsWith('https://parlamento19.openpolis.it')) {
      return res.status(400).json({
        success: false,
        error: 'URL non valido',
        message: 'L\'URL deve essere un link valido a parlamento19.openpolis.it'
      });
    }
    
    const result = await pool.query(
      `UPDATE voti_camera 
       SET url_openpolis = $1, ultimo_aggiornamento = CURRENT_TIMESTAMP
       WHERE politico_nome = $2
       RETURNING politico_nome, url_openpolis`,
      [url_openpolis, politicoNome]
    );
    
    if (result.rows.length === 0) {
      // Se non esiste, crealo
      await pool.query(
        `INSERT INTO voti_camera (politico_nome, url_openpolis, camera)
         VALUES ($1, $2, $3)`,
        [politicoNome, url_openpolis, 'Camera']
      );
    }
    
    return res.json({
      success: true,
      message: 'URL aggiornato con successo',
      data: result.rows[0] || { politico_nome: politicoNome, url_openpolis }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento URL:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento dell\'URL',
      message: error.message
    });
  }
});

// POST /api/voti-camera/sync - Sincronizza i voti da Openpolis (solo admin)
router.post('/sync', verifyToken, async (req, res) => {
  try {
    // Verifica che l'utente sia admin
    const token = req.headers.authorization?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono sincronizzare i voti'
      });
    }
    
    // Esegui lo script di sincronizzazione in background
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', 'sync-voti-openpolis.js');
    
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Errore sincronizzazione:', error);
      }
      console.log('Output sincronizzazione:', stdout);
      if (stderr) console.error('Stderr:', stderr);
    });
    
    return res.json({
      success: true,
      message: 'Sincronizzazione avviata in background'
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'avvio sincronizzazione:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nell\'avvio della sincronizzazione',
      message: error.message
    });
  }
});

module.exports = router;

