const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER GOVERNO =====

// GET /api/governo/voti - Ottieni dati per la pagina principale del governo
router.get('/voti', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 'ambiente_sicurezza_energetica',
      'cultura', 'sport'
    ];

    const classifiche = {};
    const mieiVoti = {};
    let isBlocked = false;
    let unlockDate = null;

    // Per ogni ministero, ottieni classifiche e voti utente
    for (const ministero of ministeri) {
      const tableName = `voti_${ministero}`;
      
      console.log(`🔍 DEBUG - Processando ministero: ${ministero}, tabella: ${tableName}`);
      
      // Classifica per questo ministero
      const classificaQuery = `
        SELECT 
          nome_display as nome,
          COUNT(*) as voti
        FROM ${tableName}
        GROUP BY nome_display
        ORDER BY voti DESC, nome_display ASC
      `;

      try {
        const classificaResult = await pool.query(classificaQuery);
        console.log(`✅ DEBUG - ${ministero}: ${classificaResult.rows.length} record trovati`);
        classifiche[ministero] = classificaResult.rows.map(row => ({
          nome: row.nome,
          voti: parseInt(row.voti)
        }));
      } catch (error) {
        console.error(`❌ DEBUG - Errore per ${ministero}:`, error.message);
        classifiche[ministero] = [];
      }

      // Voti dell'utente per questo ministero
      try {
        const mieiVotiQuery = `
          SELECT nome_display as nome
          FROM ${tableName}
          WHERE userid = $1
          LIMIT 1
        `;

        const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
        if (mieiVotiResult.rows.length > 0) {
          mieiVoti[ministero] = mieiVotiResult.rows[0].nome;
        }
      } catch (error) {
        console.error(`❌ DEBUG - Errore nel recupero voti utente per ${ministero}:`, error.message);
        // Continua senza aggiungere voti per questo ministero
      }

      // Controlla blocco settimanale per questo ministero (Admin può sempre votare)
      try {
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        const userRole = userResult.rows[0]?.ruolo;

        if (userRole !== 'Admin') {
          const bloccoQuery = `
            SELECT 
              CASE 
                WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
                ELSE false
              END as is_blocked,
              MAX(timestamp) + INTERVAL '7 days' as unlock_date
            FROM ${tableName}
            WHERE userid = $1
          `;

          const bloccoResult = await pool.query(bloccoQuery, [userId]);
          if (bloccoResult.rows.length > 0 && bloccoResult.rows[0].is_blocked) {
            isBlocked = true;
            unlockDate = bloccoResult.rows[0].unlock_date;
          }
        }
      } catch (error) {
        console.error(`❌ DEBUG - Errore nel controllo blocco per ${ministero}:`, error.message);
        // Continua senza bloccare
      }
    }

    console.log('🔍 DEBUG - Risposta API governo/voti:');
    console.log('📊 Classifiche:', Object.keys(classifiche).length, 'ministeri');
    console.log('👤 Miei voti:', Object.keys(mieiVoti).length, 'voti utente');
    console.log('🔒 Blocco:', { isBlocked, unlockDate });

    res.json({
      classifiche,
      mieiVoti,
      blocco: {
        isBlocked,
        unlockDate
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare i voti del governo'
    });
  }
});

// POST /api/governo/vota - Salva voti per tutti i ministeri
router.post('/vota', verifyToken, async (req, res) => {
  try {
    const { voti } = req.body;
    const userId = req.userId;

    if (!voti || typeof voti !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un oggetto'
      });
    }

    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 'ambiente_sicurezza_energetica',
      'cultura', 'sport'
    ];

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;

    if (userRole !== 'Admin') {
      let isBlocked = false;
      for (const ministero of ministeri) {
        const tableName = `voti_${ministero}`;
        const bloccoQuery = `
          SELECT 
            CASE 
              WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
              ELSE false
            END as is_blocked
          FROM ${tableName}
          WHERE userid = $1
        `;

        const bloccoResult = await pool.query(bloccoQuery, [userId]);
        if (bloccoResult.rows.length > 0 && bloccoResult.rows[0].is_blocked) {
          isBlocked = true;
          break;
        }
      }

      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: 'Non puoi modificare i voti più di una volta a settimana'
        });
      }
    }

    // Inizia transazione
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Elimina tutti i voti esistenti dell'utente da tutte le tabelle
      for (const ministero of ministeri) {
        const tableName = `voti_${ministero}`;
        await client.query(
          `DELETE FROM ${tableName} WHERE userid = $1`,
          [userId]
        );
      }

      // Inserisci i nuovi voti nelle tabelle appropriate
      for (const [categoria, nome] of Object.entries(voti)) {
        if (nome && nome.trim() && ministeri.includes(categoria)) {
          const tableName = `voti_${categoria}`;
          const nomeKey = nome.trim().toLowerCase();
          const nomeDisplay = nome.trim().split(' ').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');

          await client.query(
            `INSERT INTO ${tableName} (id, userid, nome_ministro, nome_display, timestamp) 
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
            [userId, nomeKey, nomeDisplay]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Voti salvati con successo' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Errore nel salvare voti governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare i voti del governo'
    });
  }
});

// GET /api/governo - Lista membri del governo
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM governo ORDER BY ruolo, cognome'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/governo/ideale - Governo ideale dell'utente
router.get('/ideale', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/governo/ideale - Richiesta governo ideale');
    const userId = req.userId;
    
    const governoIdeale = {};
    
    // Lista dei ministeri
    const ministeri = [
      'primo_ministro', 'difesa', 'economia', 'esteri', 'giustizia', 'interno', 
      'istruzione', 'lavoro', 'salute', 'trasporti', 'ambiente', 'ambiente_sicurezza_energetica',
      'cultura', 'sport'
    ];
    
    // Per ogni ministero, ottieni il voto dell'utente
    for (const ministero of ministeri) {
      const tableName = `voti_${ministero}`;
      
      try {
        const votoQuery = `
          SELECT nome_display
          FROM ${tableName}
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        
        const votoResult = await pool.query(votoQuery, [userId]);
        if (votoResult.rows.length > 0) {
          governoIdeale[ministero] = votoResult.rows[0].nome_display;
        }
      } catch (error) {
        console.warn(`⚠️ Errore per ministero ${ministero}:`, error.message);
        // Continua con gli altri ministeri
      }
    }
    
    console.log('🔍 DEBUG - Governo ideale recuperato:', governoIdeale);
    
    res.json({
      success: true,
      data: governoIdeale
    });
  } catch (error) {
    console.error('❌ Errore nel recupero governo ideale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/governo - Aggiungi membro governo
router.post('/', async (req, res) => {
  try {
    const { nome, cognome, ruolo, partito, data_nominazione } = req.body;
    
    if (!nome || !cognome || !ruolo) {
      return res.status(400).json({
        success: false,
        error: 'Nome, cognome e ruolo sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO governo (nome, cognome, ruolo, partito, data_nominazione) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cognome, ruolo, partito, data_nominazione]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiunta membro governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// ===== ENDPOINTS PER CONSENSO GOVERNO =====

// GET /api/governo/consenso - Ottieni i dati di consenso del governo
router.get('/consenso', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/governo/consenso GET - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    
    // Ottieni i voti di consenso dell'utente corrente se autenticato
    let mioConsenso = null;
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };
    
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.email;
        
        console.log('🔍 DEBUG - Token decodificato:', decoded);
        console.log('🔍 DEBUG - User ID:', userId);

        // Controlla se l'utente ha già votato per il consenso
        const consensoQuery = `
          SELECT risposta, timestamp
          FROM consenso_governo 
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        
        const consensoResult = await pool.query(consensoQuery, [userId]);
        
        if (consensoResult.rows.length > 0) {
          mioConsenso = {
            risposta: consensoResult.rows[0].risposta,
            timestamp: consensoResult.rows[0].timestamp
          };
        }

        // Controlla se l'utente è bloccato (stessa logica dei voti normali)
        const bloccoQuery = `
          SELECT timestamp
          FROM consenso_governo 
          WHERE userid = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        
        const bloccoResult = await pool.query(bloccoQuery, [userId]);
        
        if (bloccoResult.rows.length > 0) {
          const lastVote = new Date(bloccoResult.rows[0].timestamp);
          const now = new Date();
          const diffInDays = Math.floor((now - lastVote) / (1000 * 60 * 60 * 24));
          
          if (diffInDays < 7) {
            const unlockDate = new Date(lastVote);
            unlockDate.setDate(unlockDate.getDate() + 7);
            blocco = {
              isBlocked: true,
              unlockDate: unlockDate.toISOString()
            };
          }
        }
      } catch (error) {
        console.log('🔍 DEBUG - Token non valido per consenso governo:', error.message);
      }
    }

    // Ottieni le statistiche aggregate dei voti di consenso
    const statsQuery = `
      SELECT 
        risposta,
        COUNT(*) as conteggio
      FROM consenso_governo
      GROUP BY risposta
      ORDER BY risposta
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    const statistiche = {
      'Sì': 0,
      'Non so': 0,
      'No': 0,
      totale: 0
    };
    
    statsResult.rows.forEach(row => {
      statistiche[row.risposta] = parseInt(row.conteggio);
      statistiche.totale += parseInt(row.conteggio);
    });

    res.json({
      success: true,
      data: {
        mioConsenso,
        statistiche,
        blocco
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dati consenso governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/governo/consenso - Salva il voto di consenso del governo
router.post('/consenso', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/governo/consenso POST - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);
    
    const { risposta } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 DEBUG - Risposta ricevuta:', risposta);
    console.log('🔍 DEBUG - User ID:', userId);

    if (!risposta || !['Sì', 'Non so', 'No'].includes(risposta)) {
      return res.status(400).json({
        success: false,
        error: 'Risposta non valida. Deve essere "Sì", "Non so" o "No"'
      });
    }

    // Controlla se l'utente è bloccato
    const bloccoQuery = `
      SELECT timestamp
      FROM consenso_governo 
      WHERE userid = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    const bloccoResult = await pool.query(bloccoQuery, [userId]);
    
    if (bloccoResult.rows.length > 0) {
      const lastVote = new Date(bloccoResult.rows[0].timestamp);
      const now = new Date();
      const diffInDays = Math.floor((now - lastVote) / (1000 * 60 * 60 * 24));
      
      if (diffInDays < 7) {
        const unlockDate = new Date(lastVote);
        unlockDate.setDate(unlockDate.getDate() + 7);
        return res.status(400).json({
          success: false,
          error: 'Hai già votato per il consenso questa settimana',
          unlockDate: unlockDate.toISOString()
        });
      }
    }

    // Inizia transazione
    await pool.query('BEGIN');
    
    try {
      // Elimina il voto precedente se esiste
      await pool.query(
        'DELETE FROM consenso_governo WHERE userid = $1',
        [userId]
      );
      
      // Inserisce il nuovo voto
      const votoId = `consenso_gov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await pool.query(
        `INSERT INTO consenso_governo (
          id, userid, risposta, timestamp, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
        [votoId, userId, risposta]
      );
      
      // Conferma la transazione
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Voto di consenso del governo salvato con successo',
        data: {
          risposta,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback in caso di errore
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio consenso governo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// ===== ENDPOINTS PER GOVERNO ATTUALE =====

// GET /api/governo/attuale - Ottieni i ministri attuali del governo
router.get('/attuale', async (req, res) => {
  try {
    // Verifica se la tabella esiste prima di fare la query
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'governo_attuale'
      );
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0]?.exists;
    
    if (!tableExists) {
      // Se la tabella non esiste, restituisci un array vuoto
      console.log('⚠️ Tabella governo_attuale non esiste ancora, restituisco array vuoto');
      return res.json({
        success: true,
        data: []
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM governo_attuale ORDER BY ruolo_ministro'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    // Se l'errore è "relation does not exist", restituisci array vuoto
    if (error.code === '42P01') {
      console.log('⚠️ Tabella governo_attuale non esiste, restituisco array vuoto');
      return res.json({
        success: true,
        data: []
      });
    }
    
    console.error('❌ Errore nel recupero governo attuale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/governo/attuale/:ruolo - Aggiorna o crea un ministro attuale
router.put('/attuale/:ruolo', verifyToken, async (req, res) => {
  try {
    const { ruolo } = req.params;
    const { user_id } = req.body;
    const userId = req.userId;

    // Verifica che l'utente sia admin
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;

    if (userRole !== 'A' && userRole !== 'AD' && userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo gli amministratori possono modificare il governo attuale.'
      });
    }

    // Verifica se la tabella esiste, altrimenti restituisci errore
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'governo_attuale'
      );
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0]?.exists;
    
    if (!tableExists) {
      return res.status(500).json({
        success: false,
        error: 'Tabella governo_attuale non esiste. Esegui lo script SQL per crearla.'
      });
    }

    // Se user_id è fornito, verifica che l'utente esista
    let userData = null;
    if (user_id) {
      const userCheckQuery = `SELECT id, nome, cognome, email FROM users WHERE id = $1`;
      const userCheckResult = await pool.query(userCheckQuery, [user_id]);
      
      if (userCheckResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Utente non trovato'
        });
      }
      
      userData = userCheckResult.rows[0];
    }

    // Decodifica il ruolo dal parametro URL
    const ruoloDecoded = decodeURIComponent(ruolo);

    // Verifica se esiste già un record per questo ruolo
    const existingQuery = `SELECT id FROM governo_attuale WHERE ruolo_ministro = $1`;
    const existingResult = await pool.query(existingQuery, [ruoloDecoded]);

    if (existingResult.rows.length > 0) {
      // Aggiorna il record esistente
      const updateQuery = `
        UPDATE governo_attuale 
        SET user_id = $1, 
            nome_utente = $2, 
            cognome_utente = $3, 
            email_utente = $4,
            updated_at = NOW()
        WHERE ruolo_ministro = $5
        RETURNING *
      `;
      
      const updateResult = await pool.query(updateQuery, [
        userData?.id || null,
        userData?.nome || null,
        userData?.cognome || null,
        userData?.email || null,
        ruoloDecoded
      ]);

      res.json({
        success: true,
        message: 'Ministro aggiornato con successo',
        data: updateResult.rows[0]
      });
    } else {
      // Crea un nuovo record
      const insertId = `gov_att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const insertQuery = `
        INSERT INTO governo_attuale (
          id, ruolo_ministro, user_id, nome_utente, cognome_utente, email_utente, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `;
      
      const insertResult = await pool.query(insertQuery, [
        insertId,
        ruoloDecoded,
        userData?.id || null,
        userData?.nome || null,
        userData?.cognome || null,
        userData?.email || null
      ]);

      res.json({
        success: true,
        message: 'Ministro aggiunto con successo',
        data: insertResult.rows[0]
      });
    }
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento governo attuale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
