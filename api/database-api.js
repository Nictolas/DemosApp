const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connessione
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Connessione database riuscita'
    });
  } catch (error) {
    console.error('Errore test connessione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Utenti
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM utenti ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento utenti:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Errore caricamento utente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Opinion
app.get('/api/opinions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento opinioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Voti
app.get('/api/votes/capo-stato', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voti_capo_stato ORDER BY timestamp DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento voti capo stato:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/votes/ministri', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voti_ministri ORDER BY timestamp DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento voti ministri:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/votes/amnistia', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voti_amnistia ORDER BY timestamp DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento voti amnistia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/votes/grazia', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voti_grazia ORDER BY timestamp DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento voti grazia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Iniziative
app.get('/api/initiatives/popolari', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM iniziative_popolari ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/initiatives/ice', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ice ORDER BY data_creazione DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento ICE:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/initiatives/referendum', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM referendum_abrogativi ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento referendum:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Elezioni
app.get('/api/elections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM elezioni ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento elezioni:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Ministeri
app.get('/api/ministries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ministeri ORDER BY data_creazione DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento ministeri:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Notifiche
app.get('/api/notifications/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM notifiche_utente WHERE utente_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento notifiche utente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/notifications/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_notifications ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Errore caricamento notifiche admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Statistiche
app.get('/api/stats', async (req, res) => {
  try {
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM utenti'),
      pool.query('SELECT COUNT(*) as count FROM opinioni'),
      pool.query('SELECT COUNT(*) as count FROM voti_capo_stato'),
      pool.query('SELECT COUNT(*) as count FROM voti_ministri'),
      pool.query('SELECT COUNT(*) as count FROM voti_amnistia'),
      pool.query('SELECT COUNT(*) as count FROM voti_grazia'),
      pool.query('SELECT COUNT(*) as count FROM iniziative_popolari'),
      pool.query('SELECT COUNT(*) as count FROM ice'),
      pool.query('SELECT COUNT(*) as count FROM referendum_abrogativi'),
      pool.query('SELECT COUNT(*) as count FROM elezioni'),
      pool.query('SELECT COUNT(*) as count FROM ministeri'),
      pool.query('SELECT COUNT(*) as count FROM programmi'),
      pool.query('SELECT COUNT(*) as count FROM richieste_grazia'),
      pool.query('SELECT COUNT(*) as count FROM notifiche_utente'),
      pool.query('SELECT COUNT(*) as count FROM admin_notifications')
    ]);
    
    const stats = {
      utenti: counts[0].rows[0].count,
      opinioni: counts[1].rows[0].count,
      voti_capo_stato: counts[2].rows[0].count,
      voti_ministri: counts[3].rows[0].count,
      voti_amnistia: counts[4].rows[0].count,
      voti_grazia: counts[5].rows[0].count,
      iniziative_popolari: counts[6].rows[0].count,
      ice: counts[7].rows[0].count,
      referendum_abrogativi: counts[8].rows[0].count,
      elezioni: counts[9].rows[0].count,
      ministeri: counts[10].rows[0].count,
      programmi: counts[11].rows[0].count,
      richieste_grazia: counts[12].rows[0].count,
      notifiche_utente: counts[13].rows[0].count,
      admin_notifications: counts[14].rows[0].count
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Errore caricamento statistiche:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint di debug per verificare la tabella utenti
app.get('/api/debug/utenti-table', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Inizio endpoint /api/debug/utenti-table (pubblico)');
    
    // Test ultra-semplice - solo connessione database
    const result = await pool.query('SELECT 1 as test');
    
    console.log('✅ DEBUG: Connessione database OK');

    res.json({
      success: true,
      message: 'Connessione database OK',
      test: result.rows[0].test
    });

  } catch (error) {
    console.error('❌ Errore durante debug tabella utenti:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore durante debug',
      details: error.message
    });
  }
});

// Gestione errori
app.use((err, req, res, next) => {
  console.error('Errore server:', err);
  res.status(500).json({
    success: false,
    error: 'Errore interno del server'
  });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota non trovata'
  });
});

// Avvia server
app.listen(port, () => {
  console.log(`🚀 Server API database avviato sulla porta ${port}`);
  console.log(`📊 Database Neon connesso`);
  console.log(`🌐 API disponibile su: http://localhost:${port}/api`);
});

module.exports = app;
