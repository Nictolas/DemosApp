const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// POST /api/grazia - Crea richiesta di grazia
router.post('/', verifyToken, validateInput(['nome_carcerato', 'motivo']), async (req, res) => {
  try {
    const { nome_carcerato, motivo } = req.body;
    const userId = req.userId;
    
    const query = `
      INSERT INTO richieste_grazia (utente_id, nome_carcerato, motivo, stato, created_at)
      VALUES ($1, $2, $3, 'in_attesa', NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, nome_carcerato, motivo]);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione richiesta grazia'
    });
  }
});

// GET /api/grazia - Ottieni richieste di grazia
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/grazia');
    
    // Recupera userId se autenticato (opzionale)
    let userId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        console.log(`🔍 DEBUG: Utente autenticato: ${userId}`);
      } catch (authError) {
        console.log('⚠️ Token non valido o assente, continuando senza autenticazione');
      }
    }
    
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    console.log(`✅ Recuperati ${result.rows.length} record da voti_grazia`);
    
    // Creiamo una classifica Top 10 basata sul numero di voti per carcerato
    const classificaQuery = `
      SELECT nome, COUNT(*) as richieste
      FROM voti_grazia
      GROUP BY nome
      ORDER BY richieste DESC
      LIMIT 10
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    console.log(`✅ Classifica creata con ${classificaResult.rows.length} carcerati`);
    
    // Recupera i voti dell'utente se autenticato
    let mieiVoti = [];
    if (userId) {
      try {
        const mieiVotiQuery = `
          SELECT nome
          FROM voti_grazia
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        const mieiVotiResult = await pool.query(mieiVotiQuery, [userId]);
        mieiVoti = mieiVotiResult.rows.map(row => row.nome);
        console.log(`✅ Recuperati ${mieiVoti.length} voti per utente ${userId}`);
      } catch (error) {
        console.error('⚠️ Errore nel recuperare voti utente:', error);
        // Continua senza voti utente
      }
    }
    
    res.json({
      success: true,
      classifica: classificaResult.rows,
      richieste: result.rows,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia',
      details: error.message
    });
  }
});

// GET /api/grazia/richieste - Ottieni richieste per gestione
router.get('/richieste', verifyToken, async (req, res) => {
  try {
    // SOLUZIONE: Uso solo voti_grazia senza JOIN problematico
    const query = `
      SELECT *
      FROM voti_grazia
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      richieste: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare richieste grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare richieste grazia'
    });
  }
});

// POST /api/grazia/vota - Salva voti grazia
router.post('/vota', verifyToken, async (req, res) => {
  console.log('🚨🚨🚨 POST /api/grazia/vota - RICHIESTA RICEVUTA 🚨🚨🚨');
  console.log('🚨🚨🚨 Body:', JSON.stringify(req.body));
  console.log('🚨🚨🚨 UserId:', req.userId || req.user?.id);
  
  try {
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
    
    if (!Array.isArray(voti)) {
      console.log('❌ DEBUG - Voti non è un array:', typeof voti);
      return res.status(400).json({
        success: false,
        error: 'I voti devono essere un array'
      });
    }
    
    // Limita a massimo 1 voto come da limite configurato
    if (voti.length > 1) {
      console.log('❌ DEBUG - Troppi voti:', voti.length);
      return res.status(400).json({
        success: false,
        error: 'Puoi selezionare al massimo 1 carcerato per Grazia'
      });
    }
    
    // Rileva la struttura della tabella per capire quale colonna usare
    let userIdColumn = 'user_id';
    let idType = 'uuid'; // Default a UUID
    let timestampColumn = 'timestamp'; // Default a timestamp
    
    try {
      const tableInfoQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE LOWER(table_name) = 'voti_grazia'
        ORDER BY ordinal_position
      `;
      const tableInfo = await pool.query(tableInfoQuery);
      console.log('🔍 DEBUG - Colonne tabella:', tableInfo.rows.map(r => `${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
      
      const columns = tableInfo.rows.map(r => r.column_name);
      const hasUserId = columns.includes('user_id');
      const hasUserid = columns.includes('userid');
      userIdColumn = hasUserid ? 'userid' : (hasUserId ? 'user_id' : 'user_id');
      
      // Rileva il tipo della colonna id
      const idColumn = tableInfo.rows.find(r => r.column_name === 'id');
      if (idColumn) {
        idType = idColumn.data_type;
        console.log('🔍 DEBUG - Tipo id rilevato:', idType);
      }
      
      // Rileva quale colonna timestamp usare
      if (columns.includes('timestamp')) {
        timestampColumn = 'timestamp';
      } else if (columns.includes('data_voto')) {
        timestampColumn = 'data_voto';
      } else if (columns.includes('created_at')) {
        timestampColumn = 'created_at';
      }
    } catch (tableInfoError) {
      console.log('⚠️ DEBUG - Impossibile rilevare struttura tabella, uso default:', tableInfoError.message);
    }
    
    console.log('🔍 DEBUG - Colonna userId usata:', userIdColumn);
    console.log('🔍 DEBUG - Tipo id usato:', idType);
    console.log('🔍 DEBUG - Colonna timestamp usata:', timestampColumn);
    
    // Inizia una transazione
    console.log('🔍 DEBUG - Inizio transazione');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Elimina i voti esistenti
      console.log('🔍 DEBUG - Eliminazione voti esistenti per user:', userId);
      const deleteQuery = `DELETE FROM voti_grazia WHERE ${userIdColumn} = $1`;
      const deleteResult = await client.query(deleteQuery, [userId]);
      console.log('🔍 DEBUG - Voti eliminati:', deleteResult.rowCount);
      
      // Inserisci i nuovi voti
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
            votoId = `voto_grazia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          
          console.log('🔍 DEBUG - Inserimento voto:', votoId, 'per', nome, 'userId:', userId);
          
          // Inserisci il voto
          const insertQuery = `
            INSERT INTO voti_grazia (id, ${userIdColumn}, nome, ${timestampColumn}) 
            VALUES ($1, $2, $3, NOW())
          `;
          const insertParams = [votoId, userId, nome];
          
          await client.query(insertQuery, insertParams);
          console.log('✅ DEBUG - Voto inserito con successo');
        }
      }
      
      // Conferma la transazione
      console.log('🔍 DEBUG - Commit transazione');
      await client.query('COMMIT');
      
      console.log('✅ DEBUG - Voti salvati con successo');
      res.json({ success: true, message: 'Voti grazia salvati' });
    } catch (error) {
      // Rollback in caso di errore
      console.error('❌ DEBUG - Errore nella transazione, rollback:', error.message);
      console.error('❌ DEBUG - Stack trace:', error.stack);
      console.error('❌ DEBUG - Error code:', error.code);
      console.error('❌ DEBUG - Error detail:', error.detail);
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ DEBUG - Errore durante rollback:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
      console.log('🔍 DEBUG - Client rilasciato');
    }
  } catch (error) {
    console.error('❌❌❌ ERRORE CRITICO nel salvataggio voti grazia ❌❌❌');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Errore nel salvare voti grazia',
      details: error.message,
      code: error.code
    });
  }
});

// POST /api/grazia/richiesta/:id/:action - Gestisci richiesta grazia
router.post('/richiesta/:id/:action', verifyToken, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    if (action === 'approve') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['approvata', id]);
    } else if (action === 'reject') {
      await pool.query('UPDATE voti_grazia SET stato = $1 WHERE id = $2', ['rifiutata', id]);
    }
    
    res.json({ success: true, message: `Richiesta ${action === 'approve' ? 'approvata' : 'rifiutata'}` });
  } catch (error) {
    console.error('❌ Errore nella gestione richiesta grazia:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella gestione richiesta grazia'
    });
  }
});

module.exports = router;
