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

    // Recupera i dati dalla tabella voti_camera JOIN con votazioni_parlamento e users
    // Mostra solo i politici con ruolo="P" e grado_elezione="C" o "S"
    // Ottimizzato: usa vp.data_votazione per ORDER BY e gestisce NULL correttamente
    const dbResult = await pool.query(
      `SELECT DISTINCT
        COALESCE(vc.politico_nome, CONCAT(u.nome, ' ', u.cognome)) as politico_nome,
        CASE 
          WHEN u.grado_elezione = 'C' THEN 'Camera'
          WHEN u.grado_elezione = 'S' THEN 'Senato'
          ELSE COALESCE(vc.camera, 'Camera')
        END as camera,
        COALESCE(vc.url_openpolis, '') as url_openpolis,
        vp.titolo_votazione as votazione,
        vp.descrizione_votazione,
        vc.voto,
        vp.data_votazione as data_votazione,
        vc.ultimo_aggiornamento,
        vp.spiegazione,
        vp.id as votazione_id,
        u.id as user_id,
        u.nome,
        u.cognome
      FROM users u
      LEFT JOIN voti_camera vc ON CONCAT(u.nome, ' ', u.cognome) = vc.politico_nome
      LEFT JOIN votazioni_parlamento vp ON vc.votazione_id = vp.id
      WHERE u.ruolo = 'P' 
        AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
        AND u.status = 'a'
      ORDER BY vp.data_votazione DESC NULLS LAST, u.cognome ASC, u.nome ASC
      LIMIT 1000`
    );

    const votazioni = dbResult.rows.map(row => ({
      politico_nome: row.politico_nome,
      camera: row.camera,
      url_openpolis: row.url_openpolis,
      votazione: row.votazione,
      descrizione_votazione: row.descrizione_votazione,
      voto: row.voto,
      data_votazione: row.data_votazione,
      ultimo_aggiornamento: row.ultimo_aggiornamento,
      spiegazione: row.spiegazione,
      votazione_id: row.votazione_id
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
    const userRole = userResult.rows[0]?.ruolo;
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
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
    const userRole = userResult.rows[0]?.ruolo;
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono sincronizzare i voti'
      });
    }
    
    // Esegui la sincronizzazione in background (non bloccare la risposta)
    const { syncVotiOpenpolis } = require('../sync-voti-openpolis');
    
    // Avvia la sincronizzazione in background senza attendere il completamento
    syncVotiOpenpolis().catch(error => {
      console.error('❌ Errore durante la sincronizzazione:', error);
    });
    
    return res.json({
      success: true,
      message: 'Sincronizzazione avviata in background. I dati verranno aggiornati a breve.'
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

// POST /api/voti-camera/:politico/spiegazione - Genera spiegazione AI per una votazione (solo admin)
router.post('/:politico/spiegazione', verifyToken, async (req, res) => {
  try {
    // Verifica che l'utente sia admin
    const token = req.headers.authorization?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    const userRole = userResult.rows[0]?.ruolo;
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono generare spiegazioni'
      });
    }

    const politicoNome = decodeURIComponent(req.params.politico);
    
    // Recupera i dati del politico e la votazione associata
    // Fix: gestisce correttamente il caso in cui votazione_id è NULL
    const politicoResult = await pool.query(
      `SELECT vc.votazione_id, vp.titolo_votazione, vp.descrizione_votazione, vp.camera, vp.spiegazione
       FROM voti_camera vc
       LEFT JOIN votazioni_parlamento vp ON vc.votazione_id = vp.id
       WHERE vc.politico_nome = $1`,
      [politicoNome]
    );

    if (politicoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Politico non trovato',
        message: `Nessun politico trovato con il nome: ${politicoNome}`
      });
    }

    const row = politicoResult.rows[0];
    
    // Fix: controlla esplicitamente se votazione_id è NULL o se la votazione non esiste
    if (!row.votazione_id || !row.titolo_votazione || row.titolo_votazione.trim() === '') {
      return res.status(404).json({
        success: false,
        error: 'Votazione non trovata',
        message: `Nessuna votazione trovata per il politico: ${politicoNome}. Esegui prima una sincronizzazione.`
      });
    }

    const { votazione_id, titolo_votazione, descrizione_votazione, camera, spiegazione: spiegazioneEsistente } = row;

    // Se esiste già una spiegazione, restituiscila
    if (spiegazioneEsistente && spiegazioneEsistente.trim() !== '') {
      return res.json({
        success: true,
        message: 'Spiegazione già esistente',
        data: {
          politico_nome: politicoNome,
          votazione_id,
          spiegazione: spiegazioneEsistente
        }
      });
    }

    // Genera la spiegazione
    const { generaSpiegazioneVotazione, verificaLimiteGiornaliero } = require('../services/aiExplanationService');
    const limiteCheck = await verificaLimiteGiornaliero();
    
    if (!limiteCheck.rispettato) {
      return res.status(429).json({
        success: false,
        error: 'Limite giornaliero raggiunto',
        message: `Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite} spiegazioni generate oggi. Riprova domani.`,
        limite: limiteCheck
      });
    }

    // Genera la spiegazione per la votazione (non per il politico)
    let spiegazione;
    try {
      spiegazione = await generaSpiegazioneVotazione(votazione_id, titolo_votazione, descrizione_votazione || null, camera);
    } catch (genError) {
      console.error('❌ Errore durante la generazione spiegazione:', genError);
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: `Errore durante la generazione: ${genError.message}. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato.`
      });
    }

    if (!spiegazione) {
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: 'Impossibile generare la spiegazione. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato.'
      });
    }

    return res.json({
      success: true,
      message: 'Spiegazione generata con successo',
      data: {
        politico_nome: politicoNome,
        spiegazione
      }
    });

  } catch (error) {
    console.error('❌ Errore nella generazione spiegazione:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nella generazione della spiegazione',
      message: error.message
    });
  }
});

// POST /api/voti-camera/genera-spiegazioni - Genera spiegazioni per tutte le votazioni senza spiegazione (solo admin)
router.post('/genera-spiegazioni', verifyToken, async (req, res) => {
  try {
    // Verifica che l'utente sia admin
    const token = req.headers.authorization?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    const userRole = userResult.rows[0]?.ruolo;
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono generare spiegazioni'
      });
    }

    const limit = Math.min(parseInt(req.body.limit) || 10, 50); // Massimo 50 per volta

    // Verifica limite giornaliero prima di avviare
    const { verificaLimiteGiornaliero } = require('../services/aiExplanationService');
    const limiteCheck = await verificaLimiteGiornaliero();
    
    if (!limiteCheck.rispettato) {
      return res.status(429).json({
        success: false,
        error: 'Limite giornaliero raggiunto',
        message: `Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite} spiegazioni generate oggi. Riprova domani.`,
        limite: limiteCheck
      });
    }

    // Avvia la generazione in background
    const { generaSpiegazioniMancanti } = require('../services/aiExplanationService');
    
    generaSpiegazioniMancanti(limit).then(result => {
      console.log(`✅ Generazione spiegazioni completata: ${result.successi} successi, ${result.errori} errori`);
      if (result.limiteRaggiunto) {
        console.warn(`⚠️ Limite giornaliero raggiunto durante la generazione`);
      }
    }).catch(error => {
      console.error('❌ Errore nella generazione spiegazioni:', error);
    });

    return res.json({
      success: true,
      message: `Generazione spiegazioni avviata in background per massimo ${limit} votazioni`,
      limite: limiteCheck
    });

  } catch (error) {
    console.error('❌ Errore nell\'avvio generazione spiegazioni:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nell\'avvio della generazione',
      message: error.message
    });
  }
});

module.exports = router;

