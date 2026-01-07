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
        data_votazione,
        oggetto_voto,
        esito_voto
      FROM voti_camera
      ORDER BY data_votazione DESC NULLS LAST, politico_nome ASC
      LIMIT 1000`
    );

    const votazioni = dbResult.rows.map(row => ({
      politico_nome: row.politico_nome,
      data_votazione: row.data_votazione,
      oggetto_voto: row.oggetto_voto,
      esito_voto: row.esito_voto
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
        esito_voto,
        COUNT(*) as count
      FROM voti_camera
      GROUP BY esito_voto
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

module.exports = router;

