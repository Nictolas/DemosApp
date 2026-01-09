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

// GET /api/voti-camera/votazioni - Ottieni tutte le votazioni uniche da votazioni_parlamento
router.get('/votazioni', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/voti-camera/votazioni - Richiesta votazioni uniche');
    
    const dbResult = await pool.query(
      `SELECT 
        vp.id as votazione_id,
        vp.titolo_votazione,
        vp.descrizione_votazione,
        vp.camera,
        vp.data_votazione,
        vp.spiegazione,
        vp.url_votazione,
        vp.numero_seduta,
        vp.tipo_atto,
        vp.sigla_atto,
        vp.numero_atto,
        vp.created_at,
        vp.updated_at,
        COUNT(vc.politico_nome) as numero_politici
      FROM votazioni_parlamento vp
      LEFT JOIN voti_camera vc ON vc.votazione_id = vp.id
      WHERE vp.titolo_votazione IS NOT NULL
        AND vp.titolo_votazione != ''
      GROUP BY vp.id
      ORDER BY vp.data_votazione DESC NULLS LAST, vp.updated_at DESC
      LIMIT 1000`
    );

    const votazioni = dbResult.rows.map(row => ({
      votazione_id: row.votazione_id,
      titolo_votazione: row.titolo_votazione,
      descrizione_votazione: row.descrizione_votazione,
      camera: row.camera,
      data_votazione: row.data_votazione,
      spiegazione: row.spiegazione,
      url_votazione: row.url_votazione,
      numero_seduta: row.numero_seduta,
      tipo_atto: row.tipo_atto,
      sigla_atto: row.sigla_atto,
      numero_atto: row.numero_atto,
      created_at: row.created_at,
      updated_at: row.updated_at,
      numero_politici: parseInt(row.numero_politici) || 0
    }));

    return res.json({
      success: true,
      data: votazioni,
      count: votazioni.length,
      source: 'database'
    });

  } catch (error) {
    console.error('❌ Errore nel recupero votazioni:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dati',
      message: error.message || 'Errore interno del server',
      data: []
    });
  }
});

// GET /api/voti-camera/votazione/:votazione_id - Ottieni dettagli di una votazione
router.get('/votazione/:votazione_id', verifyToken, async (req, res) => {
  try {
    const votazioneId = parseInt(req.params.votazione_id);
    
    if (isNaN(votazioneId)) {
      return res.status(400).json({
        success: false,
        error: 'ID votazione non valido',
        message: 'L\'ID votazione deve essere un numero'
      });
    }

    // Recupera i dettagli della votazione
    const votazioneResult = await pool.query(
      `SELECT 
        vp.id as votazione_id,
        vp.titolo_votazione as titolo,
        vp.descrizione_votazione as descrizione,
        vp.spiegazione,
        vp.camera,
        vp.data_votazione
      FROM votazioni_parlamento vp
      WHERE vp.id = $1`,
      [votazioneId]
    );

    if (votazioneResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Votazione non trovata',
        message: `Nessuna votazione trovata con ID: ${votazioneId}`
      });
    }

    const votazione = votazioneResult.rows[0];

    // Recupera tutti i politici che hanno votato questa votazione
    const politiciResult = await pool.query(
      `SELECT 
        vc.politico_nome,
        vc.voto
      FROM voti_camera vc
      WHERE vc.votazione_id = $1
      ORDER BY vc.politico_nome ASC`,
      [votazioneId]
    );

    return res.json({
      success: true,
      data: {
        votazione_id: votazione.votazione_id,
        titolo: votazione.titolo,
        descrizione: votazione.descrizione,
        spiegazione: votazione.spiegazione,
        camera: votazione.camera,
        data_votazione: votazione.data_votazione,
        politici: politiciResult.rows.map(row => ({
          politico_nome: row.politico_nome,
          voto: row.voto
        }))
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recupero dettagli votazione:', error);
    return res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei dettagli',
      message: error.message
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

// POST /api/voti-camera/votazione/:votazione_id/spiegazione - Genera spiegazione AI per una votazione (solo admin)
router.post('/votazione/:votazione_id/spiegazione', verifyToken, async (req, res) => {
  const startTime = Date.now();
  console.log(`[DEBUG] ========== INIZIO GENERAZIONE SPIEGAZIONE ==========`);
  console.log(`[DEBUG] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Verifica che l'utente sia admin
    console.log(`[DEBUG] Step 1: Verifica autenticazione e ruolo admin`);
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.error(`[DEBUG] Token mancante nell'header`);
      return res.status(401).json({
        success: false,
        error: 'Token mancante',
        message: 'Token di autenticazione non fornito'
      });
    }
    
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`[DEBUG] Token verificato, userId: ${decoded.userId}`);
    } catch (jwtError) {
      console.error(`[DEBUG] Errore verifica JWT:`, jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Token di autenticazione non valido o scaduto'
      });
    }
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    const userRole = userResult.rows[0]?.ruolo;
    console.log(`[DEBUG] Ruolo utente: ${userRole}`);
    
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
      console.error(`[DEBUG] Accesso negato: utente non è admin (ruolo: ${userRole})`);
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono generare spiegazioni'
      });
    }

    const votazioneId = parseInt(req.params.votazione_id);
    console.log(`[DEBUG] Step 2: Votazione richiesta: ID=${votazioneId}`);
    
    if (isNaN(votazioneId)) {
      console.error(`[DEBUG] ID votazione non valido: ${req.params.votazione_id}`);
      return res.status(400).json({
        success: false,
        error: 'ID votazione non valido',
        message: 'L\'ID votazione deve essere un numero'
      });
    }
    
    // Recupera i dati della votazione
    console.log(`[DEBUG] Step 3: Query database per trovare votazione`);
    const votazioneResult = await pool.query(
      `SELECT id, titolo_votazione, descrizione_votazione, camera, spiegazione
       FROM votazioni_parlamento
       WHERE id = $1`,
      [votazioneId]
    );

    console.log(`[DEBUG] Risultati query: ${votazioneResult.rows.length} righe trovate`);

    if (votazioneResult.rows.length === 0) {
      console.error(`[DEBUG] Votazione non trovata: ID=${votazioneId}`);
      return res.status(404).json({
        success: false,
        error: 'Votazione non trovata',
        message: `Nessuna votazione trovata con ID: ${votazioneId}`
      });
    }

    const row = votazioneResult.rows[0];
    console.log(`[DEBUG] Dati trovati: titolo="${row.titolo_votazione}", camera="${row.camera}"`);
    
    if (!row.titolo_votazione || row.titolo_votazione.trim() === '') {
      console.error(`[DEBUG] Votazione senza titolo: ID=${votazioneId}`);
      return res.status(400).json({
        success: false,
        error: 'Votazione non valida',
        message: 'La votazione non ha un titolo valido'
      });
    }

    const { titolo_votazione, descrizione_votazione, camera, spiegazione: spiegazioneEsistente } = row;

    // Se esiste già una spiegazione, restituiscila
    if (spiegazioneEsistente && spiegazioneEsistente.trim() !== '') {
      console.log(`[DEBUG] Step 4: Spiegazione già esistente, restituisco quella esistente`);
      return res.json({
        success: true,
        message: 'Spiegazione già esistente',
        data: {
          votazione_id: votazioneId,
          spiegazione: spiegazioneEsistente
        }
      });
    }

    // Genera la spiegazione
    console.log(`[DEBUG] Step 5: Caricamento servizio AI`);
    const { generaSpiegazioneVotazione, verificaLimiteGiornaliero } = require('../services/aiExplanationService');
    
    console.log(`[DEBUG] Step 6: Verifica limite giornaliero`);
    const limiteCheck = await verificaLimiteGiornaliero();
    console.log(`[DEBUG] Limite check: rispettato=${limiteCheck.rispettato}, count=${limiteCheck.count}, limite=${limiteCheck.limite}`);
    
    if (!limiteCheck.rispettato) {
      console.error(`[DEBUG] Limite giornaliero raggiunto`);
      return res.status(429).json({
        success: false,
        error: 'Limite giornaliero raggiunto',
        message: `Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite} spiegazioni generate oggi. Riprova domani.`,
        limite: limiteCheck
      });
    }

    // Genera la spiegazione per la votazione
    console.log(`[DEBUG] Step 7: Generazione spiegazione AI`);
    console.log(`[DEBUG] Parametri: votazione_id=${votazioneId}, titolo="${titolo_votazione}", camera="${camera}"`);
    console.log(`[DEBUG] Descrizione disponibile: ${descrizione_votazione ? 'Sì (' + descrizione_votazione.length + ' caratteri)' : 'No'}`);
    
    let spiegazione;
    try {
      spiegazione = await generaSpiegazioneVotazione(votazioneId, titolo_votazione, descrizione_votazione || null, camera);
      
      console.log(`[DEBUG] Step 8: Risultato generazione: ${spiegazione ? 'Sì (' + spiegazione.length + ' caratteri)' : 'No'}`);
    } catch (genError) {
      console.error('❌ Errore durante la generazione spiegazione:', genError);
      console.error('❌ Stack trace:', genError.stack);
      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (ERRORE) ========== Tempo: ${elapsed}ms`);
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: `Errore durante la generazione: ${genError.message}. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato.`
      });
    }

    if (!spiegazione) {
      console.error(`[DEBUG] Spiegazione non generata (null o vuota) per votazione_id=${votazioneId}`);
      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (FALLITA) ========== Tempo: ${elapsed}ms`);
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: 'Impossibile generare la spiegazione. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato e che l\'API sia raggiungibile.'
      });
    }

    console.log(`[DEBUG] Step 9: Spiegazione generata con successo, restituisco risposta`);
    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (SUCCESSO) ========== Tempo: ${elapsed}ms`);
    
    return res.json({
      success: true,
      message: 'Spiegazione generata con successo',
      data: {
        votazione_id: votazioneId,
        spiegazione
      }
    });

  } catch (error) {
    console.error('❌ Errore nella generazione spiegazione:', error);
    console.error('❌ Stack trace:', error.stack);
    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (ERRORE GENERALE) ========== Tempo: ${elapsed}ms`);
    return res.status(500).json({
      success: false,
      error: 'Errore nella generazione della spiegazione',
      message: error.message
    });
  }
});

// POST /api/voti-camera/:politico/spiegazione - DEPRECATO: Usa /votazione/:votazione_id/spiegazione
// Mantenuto per retrocompatibilità
router.post('/:politico/spiegazione', verifyToken, async (req, res) => {
  const startTime = Date.now();
  console.log(`[DEBUG] ========== INIZIO GENERAZIONE SPIEGAZIONE ==========`);
  console.log(`[DEBUG] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Verifica che l'utente sia admin
    console.log(`[DEBUG] Step 1: Verifica autenticazione e ruolo admin`);
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.error(`[DEBUG] Token mancante nell'header`);
      return res.status(401).json({
        success: false,
        error: 'Token mancante',
        message: 'Token di autenticazione non fornito'
      });
    }
    
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`[DEBUG] Token verificato, userId: ${decoded.userId}`);
    } catch (jwtError) {
      console.error(`[DEBUG] Errore verifica JWT:`, jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token non valido',
        message: 'Token di autenticazione non valido o scaduto'
      });
    }
    
    const userResult = await pool.query('SELECT ruolo FROM users WHERE id = $1', [decoded.userId]);
    const userRole = userResult.rows[0]?.ruolo;
    console.log(`[DEBUG] Ruolo utente: ${userRole}`);
    
    if (userResult.rows.length === 0 || (userRole !== 'admin' && userRole !== 'AD')) {
      console.error(`[DEBUG] Accesso negato: utente non è admin (ruolo: ${userRole})`);
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Solo gli amministratori possono generare spiegazioni'
      });
    }

    const politicoNome = decodeURIComponent(req.params.politico);
    console.log(`[DEBUG] Step 2: Politico richiesto: "${politicoNome}"`);
    
    // Recupera i dati del politico e la votazione associata
    console.log(`[DEBUG] Step 3: Query database per trovare politico e votazione`);
    const politicoResult = await pool.query(
      `SELECT vc.votazione_id, vp.titolo_votazione, vp.descrizione_votazione, vp.camera, vp.spiegazione
       FROM voti_camera vc
       LEFT JOIN votazioni_parlamento vp ON vc.votazione_id = vp.id
       WHERE vc.politico_nome = $1`,
      [politicoNome]
    );

    console.log(`[DEBUG] Risultati query: ${politicoResult.rows.length} righe trovate`);

    if (politicoResult.rows.length === 0) {
      console.error(`[DEBUG] Politico non trovato: "${politicoNome}"`);
      return res.status(404).json({
        success: false,
        error: 'Politico non trovato',
        message: `Nessun politico trovato con il nome: ${politicoNome}`
      });
    }

    const row = politicoResult.rows[0];
    console.log(`[DEBUG] Dati trovati: votazione_id=${row.votazione_id}, titolo="${row.titolo_votazione}", camera="${row.camera}"`);
    
    // Fix: controlla esplicitamente se votazione_id è NULL o se la votazione non esiste
    if (!row.votazione_id || !row.titolo_votazione || row.titolo_votazione.trim() === '') {
      console.error(`[DEBUG] Votazione non trovata per politico: "${politicoNome}"`);
      return res.status(404).json({
        success: false,
        error: 'Votazione non trovata',
        message: `Nessuna votazione trovata per il politico: ${politicoNome}. Esegui prima una sincronizzazione.`
      });
    }

    const { votazione_id, titolo_votazione, descrizione_votazione, camera, spiegazione: spiegazioneEsistente } = row;

    // Se esiste già una spiegazione, restituiscila
    if (spiegazioneEsistente && spiegazioneEsistente.trim() !== '') {
      console.log(`[DEBUG] Step 4: Spiegazione già esistente, restituisco quella esistente`);
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
    console.log(`[DEBUG] Step 5: Caricamento servizio AI`);
    const { generaSpiegazioneVotazione, verificaLimiteGiornaliero } = require('../services/aiExplanationService');
    
    console.log(`[DEBUG] Step 6: Verifica limite giornaliero`);
    const limiteCheck = await verificaLimiteGiornaliero();
    console.log(`[DEBUG] Limite check: rispettato=${limiteCheck.rispettato}, count=${limiteCheck.count}, limite=${limiteCheck.limite}`);
    
    if (!limiteCheck.rispettato) {
      console.error(`[DEBUG] Limite giornaliero raggiunto`);
      return res.status(429).json({
        success: false,
        error: 'Limite giornaliero raggiunto',
        message: `Limite giornaliero raggiunto: ${limiteCheck.count}/${limiteCheck.limite} spiegazioni generate oggi. Riprova domani.`,
        limite: limiteCheck
      });
    }

    // Genera la spiegazione per la votazione (non per il politico)
    console.log(`[DEBUG] Step 7: Generazione spiegazione AI`);
    console.log(`[DEBUG] Parametri: votazione_id=${votazione_id}, titolo="${titolo_votazione}", camera="${camera}"`);
    console.log(`[DEBUG] Descrizione disponibile: ${descrizione_votazione ? 'Sì (' + descrizione_votazione.length + ' caratteri)' : 'No'}`);
    
    let spiegazione;
    try {
      spiegazione = await generaSpiegazioneVotazione(votazione_id, titolo_votazione, descrizione_votazione || null, camera);
      
      console.log(`[DEBUG] Step 8: Risultato generazione: ${spiegazione ? 'Sì (' + spiegazione.length + ' caratteri)' : 'No'}`);
    } catch (genError) {
      console.error('❌ Errore durante la generazione spiegazione:', genError);
      console.error('❌ Stack trace:', genError.stack);
      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (ERRORE) ========== Tempo: ${elapsed}ms`);
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: `Errore durante la generazione: ${genError.message}. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato.`
      });
    }

    if (!spiegazione) {
      console.error(`[DEBUG] Spiegazione non generata (null o vuota) per votazione_id=${votazione_id}`);
      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (FALLITA) ========== Tempo: ${elapsed}ms`);
      return res.status(500).json({
        success: false,
        error: 'Errore nella generazione',
        message: 'Impossibile generare la spiegazione. Verifica che GROQ_API_KEY o OPENAI_API_KEY sia configurato e che l\'API sia raggiungibile.'
      });
    }

    console.log(`[DEBUG] Step 9: Spiegazione generata con successo, restituisco risposta`);
    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (SUCCESSO) ========== Tempo: ${elapsed}ms`);
    
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
    console.error('❌ Stack trace:', error.stack);
    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] ========== FINE GENERAZIONE SPIEGAZIONE (ERRORE GENERALE) ========== Tempo: ${elapsed}ms`);
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

