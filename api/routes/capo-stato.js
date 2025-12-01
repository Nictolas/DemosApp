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

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Lista candidati capo di stato con classifica voti
router.get('/', async (req, res) => {
  try {
    // Query per ottenere la classifica dei candidati basata sui voti ricevuti
    const classificaQuery = `
      SELECT 
        nome,
        COUNT(*) as voti
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti DESC, nome ASC
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    
    console.log('🔍 DEBUG /api/capo-stato - Candidati trovati:', classificaResult.rows.length);
    
    // Processa la classifica per il frontend
    const classifica = classificaResult.rows.map(candidato => ({
      nome: candidato.nome,
      voti: parseInt(candidato.voti)
    }));
    
    // Ottieni i voti dell'utente corrente se autenticato
    let mieiVoti = [];
    let blocco = {
      isBlocked: false,
      unlockDate: null
    };
    
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Controlla il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        const userRole = userResult.rows[0]?.ruolo;

        // Solo per utenti non-Admin, controlla il limite settimanale
        if (userRole !== 'Admin') {
          // Verifica la struttura della tabella per capire quale colonna usare
          const tableInfoQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'voti_capo_stato'
            ORDER BY ordinal_position
          `;
          const tableInfo = await pool.query(tableInfoQuery);
          const columns = tableInfo.rows.map(r => r.column_name);
          const hasUserId = columns.includes('userId');
          const hasUserid = columns.includes('userid');
          const userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'userId' : 'userid'); // Default a userid
          
          const bloccoQuery = `
            SELECT 
              CASE 
                WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
                ELSE false
              END as is_blocked,
              MAX(timestamp) + INTERVAL '7 days' as unlock_date
            FROM voti_capo_stato
            WHERE ${userIdColumn} = $1
          `;
          const bloccoResult = await pool.query(bloccoQuery, [userId]);
          const isBlocked = bloccoResult.rows[0]?.is_blocked || false;
          const unlockDate = bloccoResult.rows[0]?.unlock_date;
          
          blocco = {
            isBlocked,
            unlockDate: unlockDate ? new Date(unlockDate).toISOString() : null
          };
        }

        // Verifica la struttura della tabella per capire quale colonna usare
        const tableInfoQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'voti_capo_stato'
          ORDER BY ordinal_position
        `;
        const tableInfo = await pool.query(tableInfoQuery);
        const columns = tableInfo.rows.map(r => r.column_name);
        const hasUserId = columns.includes('userId');
        const hasUserid = columns.includes('userid');
        const userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'userId' : 'userid'); // Default a userid
        
        const userVotiQuery = `
          SELECT nome
          FROM voti_capo_stato
          WHERE ${userIdColumn} = $1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        mieiVoti = userVotiResult.rows.map(v => v.nome);
      } catch (authError) {
        console.log('⚠️ Token non valido per capo di stato:', authError.message);
      }
    }
    
    const responseData = {
      success: true,
      classifica,
      mieiVoti,
      blocco
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint rimosso - duplicato, usa quello alla riga 265

// POST /api/capo-stato/test-vota - Endpoint di test per voti (senza autenticazione)
router.post('/test-vota', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/test-vota - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    
    const { voti, userid } = req.body;
    
    if (!Array.isArray(voti)) {
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }
    
    if (!userid) {
      return res.status(400).json({
        success: false,
        error: 'UserID è obbligatorio'
      });
    }
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    await pool.query('BEGIN');
    
    try {
      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userid);
      const deleteResult = await pool.query(
        'DELETE FROM voti_capo_stato WHERE userid = $1',
        [userid]
      );
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);
        const insertPromises = voti.map(async (nome, index) => {
          const votoId = `voto_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome);
          return pool.query(
            `INSERT INTO voti_capo_stato (
              id, userid, nome, timestamp, created_at, updated_at
            ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
            [votoId, userid, nome]
          );
        });
        
        await Promise.all(insertPromises);
        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await pool.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.log('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore nel salvataggio voti capo di stato (test):', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/capo-stato/vota - Endpoint principale per voti (con autenticazione)
router.post('/vota', verifyToken, async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('🚨🚨🚨 POST /api/capo-stato/vota - RICHIESTA RICEVUTA 🚨🚨🚨');
  console.log('🚨🚨🚨 Request ID:', requestId);
  console.log('🚨🚨🚨 Timestamp:', new Date().toISOString());
  console.log('🚨🚨🚨 Method:', req.method);
  console.log('🚨🚨🚨 URL:', req.url);
  console.log('🚨🚨🚨 Headers authorization:', req.headers.authorization ? 'PRESENTE' : 'MANCANTE');
  console.log('🚨🚨🚨 Body:', JSON.stringify(req.body));
  console.log('🚨🚨🚨 User:', req.user ? JSON.stringify(req.user) : 'MANCANTE');
  console.log('🚨🚨🚨 UserId:', req.userId || 'MANCANTE');
  
  let client = null;
  try {
    console.log('🔍 DEBUG /api/capo-stato/vota - Richiesta ricevuta');
    console.log('🔍 DEBUG - Headers:', req.headers);
    console.log('🔍 DEBUG - Body:', req.body);
    console.log('🔍 DEBUG - User:', req.user);
    
    const { voti } = req.body;
    // Usa req.userId con fallback a req.user.id per sicurezza
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      console.log('❌ DEBUG - User ID non trovato');
      return res.status(401).json({
        success: false,
        error: 'Utente non autenticato'
      });
    }
    
    console.log('🔍 DEBUG - Voti ricevuti:', voti);
    console.log('🔍 DEBUG - User ID:', userId);
    
    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }

    // Controlla il limite di 1 voto massimo per Capo di Stato
    if (voti.length > 1) {
      console.log('❌ DEBUG - Troppi voti:', voti.length);
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 candidato per Capo di Stato'
      });
    }

    // Controlla se l'utente è bloccato (Admin può sempre votare)
    console.log('🔍 DEBUG - Controllo ruolo utente per userId:', userId);
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    console.log('🔍 DEBUG - Esecuzione query:', userQuery, 'con parametro:', userId);
    
    const userResult = await pool.query(userQuery, [userId]);
    console.log('🔍 DEBUG - Risultato query utente:', userResult.rows);
    
    const userRole = userResult.rows[0]?.ruolo;
    console.log('🔍 DEBUG - Ruolo utente:', userRole);

    // Usa 'userid' come default (standard nel database)
    // Se necessario, possiamo rilevare dinamicamente, ma per ora usiamo userid
    const userIdColumn = 'userid';
    let idType = 'uuid'; // Default a UUID
    
    // Prova a rilevare il tipo di ID, ma non fallire se non riesce
    try {
      const tableInfoQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE LOWER(table_name) = 'voti_capo_stato' AND column_name = 'id'
        LIMIT 1
      `;
      const tableInfo = await pool.query(tableInfoQuery);
      if (tableInfo.rows.length > 0) {
        idType = tableInfo.rows[0].data_type;
        console.log('🔍 DEBUG - Tipo id rilevato:', idType);
      }
    } catch (tableInfoError) {
      console.log('⚠️ DEBUG - Impossibile rilevare tipo id, uso default UUID:', tableInfoError.message);
    }
    
    console.log('🔍 DEBUG - Colonna userId usata:', userIdColumn);
    console.log('🔍 DEBUG - Tipo id usato:', idType);

    if (userRole !== 'Admin') {
      const bloccoQuery = `
        SELECT 
          CASE 
            WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
            ELSE false
          END as is_blocked
        FROM voti_capo_stato
        WHERE ${userIdColumn} = $1
      `;

      const bloccoResult = await pool.query(bloccoQuery, [userId]);
      const isBlocked = bloccoResult.rows[0]?.is_blocked || false;

      if (isBlocked) {
        console.log('❌ DEBUG - Utente bloccato per limite settimanale');
        return res.status(403).json({
          success: false,
          error: 'Non puoi modificare i voti più di una volta a settimana'
        });
      }
    }
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Prima elimina tutti i voti esistenti dell'utente
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteQuery = `DELETE FROM voti_capo_stato WHERE ${userIdColumn} = $1`;
      const deleteResult = await client.query(deleteQuery, [userId]);
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Poi inserisce i nuovi voti
      if (voti.length > 0) {
        console.log('🔍 DEBUG - Inserimento nuovi voti:', voti.length);
        
        for (const nome of voti) {
          // Genera ID in base al tipo della colonna
          let votoId;
          if (idType === 'uuid') {
            // Se la colonna è UUID, genera un UUID
            const uuidResult = await client.query('SELECT gen_random_uuid() as id');
            votoId = uuidResult.rows[0].id;
          } else {
            // Se è VARCHAR o TEXT, usa una stringa
            votoId = `voto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome, 'userId:', userId);
          
          // Costruisci la query in base alle colonne disponibili
          const insertQuery = `
            INSERT INTO voti_capo_stato (id, ${userIdColumn}, nome, timestamp) 
            VALUES ($1, $2, $3, NOW())
          `;
          
          await client.query(insertQuery, [votoId, userId, nome]);
          console.log('✅ DEBUG - Voto inserito con successo');
        }
        
        console.log('🔍 DEBUG - Tutti i voti inseriti con successo');
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await client.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({
        success: true,
        message: 'Voti salvati con successo',
        voti: voti
      });
    } catch (error) {
      // Rollback in caso di errore
      console.error('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      console.error('❌ DEBUG - Stack trace:', error.stack);
      console.error('❌ DEBUG - Error code:', error.code);
      console.error('❌ DEBUG - Error detail:', error.detail);
      console.error('❌ DEBUG - Error hint:', error.hint);
      console.error('❌ DEBUG - Error name:', error.name);
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ DEBUG - Errore durante rollback:', rollbackError.message);
      }
      throw error;
    } finally {
      if (client) {
        client.release();
        console.log('🔍 DEBUG - Client rilasciato');
      }
    }
  } catch (error) {
    console.error('❌❌❌ ERRORE CRITICO nel salvataggio voti capo di stato ❌❌❌');
    console.error('❌ Request ID:', requestId);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error hint:', error.hint);
    console.error('❌ Error stack:', error.stack);
    
    // Rilascia il client se non è stato rilasciato
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Errore nel rilasciare client:', releaseError.message);
      }
    }
    
    // Assicurati che la risposta non sia già stata inviata
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        details: error.message,
        code: error.code,
        requestId: requestId
      });
    } else {
      console.error('❌ Risposta già inviata, impossibile inviare errore');
    }
  }
});

// POST /api/capo-stato - Vota per un candidato capo di stato (legacy)
router.post('/', async (req, res) => {
  try {
    const { nome, userid } = req.body;
    
    if (!nome || !userid) {
      return res.status(400).json({
        success: false,
        error: 'Nome del candidato e userid sono obbligatori'
      });
    }
    
    // Genera un ID univoco per il voto
    const votoId = `voto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inserisce il voto nella tabella voti_capo_stato
    const result = await pool.query(
      `INSERT INTO voti_capo_stato (
        id, userid, nome, timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW(), NOW()) 
      RETURNING id, userid, nome, timestamp`,
      [votoId, userid, nome]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel voto per candidato capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// ===== ENDPOINTS PER CONSENSO CAPO DI STATO =====

// GET /api/capo-stato/consenso - Ottieni i dati di consenso
router.get('/consenso', async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso GET - Richiesta ricevuta');
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
          FROM consenso_capo_stato 
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
          FROM consenso_capo_stato 
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
        console.log('🔍 DEBUG - Token non valido per consenso:', error.message);
      }
    }

    // Ottieni le statistiche aggregate dei voti di consenso
    const statsQuery = `
      SELECT 
        risposta,
        COUNT(*) as conteggio
      FROM consenso_capo_stato
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
    console.error('❌ Errore nel recupero dati consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato/consenso - Salva il voto di consenso
router.post('/consenso', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG /api/capo-stato/consenso - Richiesta ricevuta');
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
      FROM consenso_capo_stato 
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
        'DELETE FROM consenso_capo_stato WHERE userid = $1',
        [userId]
      );
      
      // Inserisce il nuovo voto
      const votoId = `consenso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await pool.query(
        `INSERT INTO consenso_capo_stato (
          id, userid, risposta, timestamp, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
        [votoId, userId, risposta]
      );
      
      // Conferma la transazione
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Voto di consenso salvato con successo',
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
    console.error('❌ Errore nel salvataggio consenso:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
