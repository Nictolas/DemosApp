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

// ===== ENDPOINTS PER REFERENDUM ABROGATIVI =====

// GET /api/referendum-abrogativi - Lista referendum abrogativi (come ICE)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/referendum-abrogativi');
    // Disabilita caching per evitare dati stantii lato client/proxy
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Ottieni il ruolo dell'utente e l'ID se autenticato
    let userRole = null;
    let userId = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        
        // Ottieni il ruolo dell'utente
        const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [userId]);
        if (userResult.rows.length > 0) {
          userRole = userResult.rows[0].ruolo;
          console.log(`🔍 Ruolo utente: ${userRole}`);
        }
      } catch (authError) {
        console.log('⚠️ Errore nel recupero ruolo utente:', authError.message);
      }
    }
    
    // Query con filtro basato sul ruolo
    let query;
    if (userRole === "AD") {
      // Admin vedono tutti i referendum
      query = `
        SELECT *
        FROM referendum_abrogativi
        ORDER BY data_inizio DESC NULLS LAST, created_at DESC
      `;
    } else {
      // Altri utenti vedono:
      // 1. I referendum ufficiali (quorum != 'proposta') e con esito 'In Attesa'
      // 2. Le proposte proprie (quorum = 'proposta' e userid corrispondente)
      if (userId) {
        query = `
          SELECT *
          FROM referendum_abrogativi
          WHERE (
            (quorum != 'proposta' AND (esito = 'In Attesa' OR esito IS NULL))
            OR (quorum = 'proposta' AND userid = $1)
          )
          ORDER BY data_inizio DESC NULLS LAST, created_at DESC
        `;
      } else {
        // Utente non autenticato: solo referendum ufficiali
        query = `
          SELECT *
          FROM referendum_abrogativi
          WHERE quorum != 'proposta' AND (esito = 'In Attesa' OR esito IS NULL)
          ORDER BY data_inizio DESC NULLS LAST, created_at DESC
        `;
      }
    }
    
    // Esegui la query con parametri se necessario
    let result;
    if (userRole !== "AD" && userId) {
      result = await pool.query(query, [userId]);
    } else {
      result = await pool.query(query);
    }
    console.log(`✅ Recuperati ${result.rows.length} record da referendum_abrogativi`);
    
    // Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Query per recuperare i voti dell'utente
        // Usa DISTINCT ON per ottenere solo l'ultimo voto per utente (se ci sono duplicati)
        const userVotiQuery = `
          SELECT DISTINCT ON (userid) referendum_id 
          FROM voti_referendum_abrogativi 
          WHERE userid::text = $1 OR userid = $1::uuid
          ORDER BY userid, timestamp DESC, created_at DESC
          LIMIT 1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        
        // Se non trova voti, prova solo come UUID
        if (userVotiResult.rows.length === 0) {
          const userVotiQueryUUID = `
            SELECT referendum_id FROM voti_referendum_abrogativi 
            WHERE userid = $1::uuid
            ORDER BY timestamp DESC, created_at DESC
            LIMIT 1
          `;
          const userVotiResultUUID = await pool.query(userVotiQueryUUID, [userId]);
          console.log(`🔍 DEBUG: Query solo UUID per userId ${userId}:`, userVotiResultUUID.rows);
          mieiVoti = userVotiResultUUID.rows.map(v => v.referendum_id);
        } else {
          mieiVoti = userVotiResult.rows.map(v => v.referendum_id);
        }
        
        // Limita a massimo 1 voto (per sicurezza)
        mieiVoti = mieiVoti.slice(0, 1);
        
        console.log(`✅ Recuperati ${mieiVoti.length} voti utente:`, mieiVoti);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per referendum abrogativi, continuando senza autenticazione');
      }
    }
    
    // Normalizza i dati per il frontend
    const normalizedData = result.rows.map(row => ({
      ...row,
      dataInizio: row.data_inizio,
      dataFine: row.data_fine,
      sitoWeb: row.sito_web || row.sitoweb,
      data_creazione: row.created_at
    }));

    // Genera la classifica basata sui voti
    let classifica = [];
    if (result.rows.length > 0) {
      try {
        const classificaQuery = `
          SELECT 
            ra.nome,
            ra.sitoweb as sitoWeb,
            COUNT(CASE WHEN vra.referendum_id IS NOT NULL THEN 1 END) as voti
          FROM referendum_abrogativi ra
          LEFT JOIN voti_referendum_abrogativi vra ON (
            ra.id::text = vra.referendum_id::text OR 
            REPLACE(ra.id::text, '-', '') = REPLACE(vra.referendum_id::text, '-', '') OR
            ra.id::uuid::text = vra.referendum_id::text OR
            REPLACE(ra.id::uuid::text, '-', '') = REPLACE(vra.referendum_id::text, '-', '')
          )
          WHERE ra.quorum != 'proposta' AND (ra.esito = 'In Attesa' OR ra.esito IS NULL)
          GROUP BY ra.id, ra.nome, ra.sitoweb
          ORDER BY voti DESC, ra.nome ASC
        `;
        
        console.log('🔍 DEBUG - Esecuzione query classifica referendum');
        const classificaResult = await pool.query(classificaQuery);
        console.log('🔍 DEBUG - Risultati classifica raw referendum:', classificaResult.rows);
        
        // Debug: verifica tutti i voti nel database
        const debugVotiQuery = 'SELECT referendum_id, COUNT(*) as count FROM voti_referendum_abrogativi GROUP BY referendum_id';
        const debugVotiResult = await pool.query(debugVotiQuery);
        console.log('🔍 DEBUG - Tutti i voti per referendum_id:', debugVotiResult.rows);
        
        // Debug: verifica gli ID dei referendum
        const debugReferendumQuery = 'SELECT id, nome FROM referendum_abrogativi WHERE quorum != \'proposta\' AND (esito = \'In Attesa\' OR esito IS NULL)';
        const debugReferendumResult = await pool.query(debugReferendumQuery);
        console.log('🔍 DEBUG - ID referendum:', debugReferendumResult.rows.map(r => ({ id: r.id, id_text: r.id.toString(), nome: r.nome })));
        
        // Debug: verifica manualmente la corrispondenza tra voti e referendum
        if (debugVotiResult.rows.length > 0 && debugReferendumResult.rows.length > 0) {
          console.log('🔍 DEBUG - Verifica corrispondenza manuale:');
          debugVotiResult.rows.forEach(voto => {
            console.log(`🔍 DEBUG - Analizzando voto con referendum_id: ${voto.referendum_id} (tipo: ${typeof voto.referendum_id})`);
            debugReferendumResult.rows.forEach(ref => {
              const refIdText = ref.id.toString();
              const refIdNoDash = refIdText.replace(/-/g, '');
              const votoId = String(voto.referendum_id);
              const votoIdNoDash = votoId.replace(/-/g, '');
              
              console.log(`🔍 DEBUG - Confronto: "${ref.nome}" ref.id=${refIdText} (noDash=${refIdNoDash}) vs voto.referendum_id=${votoId} (noDash=${votoIdNoDash})`);
              
              const match1 = refIdText === votoId;
              const match2 = refIdNoDash === votoId;
              const match3 = refIdText === votoIdNoDash;
              const match4 = refIdNoDash === votoIdNoDash;
              
              if (match1 || match2 || match3 || match4) {
                console.log(`✅ MATCH trovato per "${ref.nome}": ${ref.id} <-> ${votoId} (match1=${match1}, match2=${match2}, match3=${match3}, match4=${match4})`);
              } else {
                // Log solo per "Cannabis Legale" o se il voto non ha match
                if (ref.nome.toLowerCase().includes('cannabis') || debugVotiResult.rows.length === 1) {
                  console.log(`❌ NO MATCH per "${ref.nome}": ref.id=${refIdText} vs voto.referendum_id=${votoId}`);
                }
              }
            });
          });
        }
        
        classifica = classificaResult.rows.map(row => ({
          nome: row.nome,
          sitoWeb: row.sitoweb || row.sito_web,
          voti: parseInt(row.voti) || 0
        }));
        console.log(`✅ Generata classifica con ${classifica.length} referendum:`, classifica);
      } catch (classificaError) {
        console.log('⚠️ Errore nella generazione classifica, continuando senza:', classificaError.message);
        // Se la classifica fallisce, continua senza di essa
        classifica = [];
      }
    }

    res.json({
      success: true,
      richieste: normalizedData,
      referendum: normalizedData,
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare referendum abrogativi:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare referendum abrogativi',
      details: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/referendum-abrogativi - Crea richiesta referendum abrogativo (come ICE)
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG POST: Inizio creazione referendum abrogativo');
    console.log('🔍 DEBUG POST: Headers:', req.headers);
    console.log('🔍 DEBUG POST: Body completo:', req.body);
    
    const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    console.log('🔍 DEBUG POST: UserId:', userId);
    console.log('🔍 DEBUG POST: req.user:', req.user);
    console.log('🔍 DEBUG POST: req.userId:', req.userId);
    console.log('🔍 DEBUG POST: Dati estratti:', { nome, descrizione, dataInizio, dataFine, sitoWeb });
    
    // Validazione userId
    if (!userId) {
      console.error('❌ DEBUG POST: UserId è null o undefined!');
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta. Esegui il login per proporre un referendum.'
      });
    }
    
    // Validazione campi obbligatori
    if (!nome || !descrizione) {
      return res.status(400).json({
        success: false,
        error: 'Nome e descrizione sono obbligatori'
      });
    }
    
    // Inizia una transazione per prevenire race conditions in caso di doppio submit simultaneo
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verifica se l'utente ha già una proposta in attesa
      // Usa SELECT FOR UPDATE per bloccare la riga durante la transazione
      const existingProposalQuery = `
        SELECT id, nome 
        FROM referendum_abrogativi 
        WHERE userid = $1 AND quorum = 'proposta'
        LIMIT 1
        FOR UPDATE
      `;
      const existingProposal = await client.query(existingProposalQuery, [userId]);
      
      if (existingProposal.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log('⚠️ DEBUG POST: Utente ha già una proposta in attesa, bloccando nuovo inserimento');
        return res.status(400).json({
          success: false,
          error: 'Hai già una proposta in attesa di approvazione. Puoi proporre solo un referendum alla volta.'
        });
      }
      
      // Genera un UUID valido per la richiesta referendum
      const crypto = require('crypto');
      const referendumId = crypto.randomUUID();
      console.log('🔍 DEBUG: Referendum ID generato:', referendumId);
      
      // Definisce i parametri per la query - include userid e quorum = 'proposta'
      const params = [referendumId, userId, nome, descrizione, dataInizio, dataFine, sitoWeb];
      
      // Inserisce con quorum = 'proposta' e userid dell'utente che propone
      // NOTA: La colonna si chiama 'sitoweb' non 'sito_web' nella tabella referendum_abrogativi
      const query = `
        INSERT INTO referendum_abrogativi (id, userid, nome, descrizione, data_inizio, data_fine, sitoweb, quorum)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposta')
        RETURNING *
      `;
      
      console.log('🔍 DEBUG POST: Parametri query:', params);
      console.log('🔍 DEBUG POST: Esecuzione query INSERT in transazione...');
      console.log('🔍 DEBUG POST: Query:', query);
      console.log('🔍 DEBUG POST: Parametri:', JSON.stringify(params, null, 2));
      
      const result = await client.query(query, params);
      console.log('🔍 DEBUG POST: Risultato inserimento:', result.rows[0]);
      console.log('🔍 DEBUG POST: Numero righe inserite:', result.rowCount);
      
      if (!result.rows || result.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        console.error('❌ DEBUG POST: Nessuna riga inserita!');
        return res.status(500).json({
          success: false,
          error: 'Errore: nessun dato inserito nel database'
        });
      }
      
      // Commit della transazione
      await client.query('COMMIT');
      client.release();
      
      console.log(`✅ Referendum proposta creata: ${referendumId} per utente: ${userId}`);
      
      res.json({
        success: true,
        richiesta: result.rows[0]
      });
    } catch (transactionError) {
      // Rollback in caso di errore
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Errore durante rollback:', rollbackError);
      }
      client.release();
      throw transactionError;
    }
  } catch (error) {
    console.error('❌ DEBUG POST: Errore nella creazione referendum abrogativo:', error);
    console.error('❌ DEBUG POST: Stack trace:', error.stack);
    console.error('❌ DEBUG POST: Error code:', error.code);
    console.error('❌ DEBUG POST: Error detail:', error.detail);
    
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione referendum abrogativo',
      details: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/referendum-abrogativi/:id - Aggiorna referendum abrogativo (per admin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, firme } = req.body;
    
    // Verifica che l'utente sia admin o moderatore
    const userId = req.userId;
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0 || !["AD"].includes(userResult.rows[0].ruolo)) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin possono modificare i referendum abrogativi.'
      });
    }
    
    // Costruisci la query di update dinamicamente per includere firme solo se presente
    let updateQuery;
    let updateParams;
    
    if (firme !== undefined) {
      updateQuery = `
        UPDATE referendum_abrogativi
        SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sitoweb = $5, quorum = $6, firme = $7
        WHERE id = $8
        RETURNING *
      `;
      updateParams = [nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, firme, id];
    } else {
      updateQuery = `
        UPDATE referendum_abrogativi
        SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sitoweb = $5, quorum = $6
        WHERE id = $7
        RETURNING *
      `;
      updateParams = [nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, id];
    }
    
    const result = await pool.query(updateQuery, updateParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum abrogativo non trovato'
      });
    }
    
    console.log(`✅ Referendum abrogativo aggiornato: ${id}, nuovo quorum: ${quorum}`);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento referendum abrogativo'
    });
  }
});

// DELETE /api/referendum-abrogativi/:id - Elimina referendum abrogativo
// Permette a:
// - Admin di eliminare qualsiasi referendum
// - Utenti di eliminare solo la propria proposta (quorum = 'proposta' e userid corrispondente)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const userId = req.userId;
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    // Ottieni il ruolo dell'utente e verifica i permessi
    const userRole = userResult.rows[0].ruolo;
    const isAdmin = userRole === 'AD';
    
    // Se non è admin, verifica che il referendum sia una proposta dell'utente
    if (!isAdmin) {
      const referendumQuery = `SELECT id, userid, quorum FROM referendum_abrogativi WHERE id = $1`;
      const referendumResult = await pool.query(referendumQuery, [id]);
      
      if (referendumResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Referendum abrogativo non trovato'
        });
      }
      
      const referendum = referendumResult.rows[0];
      const isOwner = referendum.userid === userId && referendum.quorum === 'proposta';
      
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Accesso negato. Puoi eliminare solo le tue proposte in attesa di approvazione.'
        });
      }
    }
    
    const deleteQuery = `DELETE FROM referendum_abrogativi WHERE id = $1 RETURNING *`;
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum abrogativo non trovato'
      });
    }
    
    console.log(`✅ Referendum abrogativo eliminato: ${id} da utente: ${userId} (${isAdmin ? 'Admin' : 'Proprietario'})`);
    
    res.json({
      success: true,
      message: 'Referendum abrogativo eliminato con successo'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione referendum abrogativo'
    });
  }
});

// POST /api/referendum-abrogativi/:id/accetta - Accetta referendum abrogativo proposto
router.post('/:id/accetta', verifyToken, async (req, res) => {
  try {
    const adminUserId = req.userId;
    const { id } = req.params;
    
    console.log('🔍 DEBUG /api/referendum-abrogativi/accetta - Admin:', adminUserId, 'ID:', id);
    
    // Verifica che l'utente sia admin
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [adminUserId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin possono approvare i referendum.'
      });
    }
    
    // Approva: cambia quorum da 'proposta' a 'ok' e azzera userid
    const result = await pool.query(
      `UPDATE referendum_abrogativi 
       SET quorum = 'ok', userid = NULL, updated_at = NOW() 
       WHERE id = $1 AND quorum = 'proposta'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum non trovato o già approvato'
      });
    }
    
    console.log('✅ DEBUG /api/referendum-abrogativi/accetta - Referendum approvato:', id);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'approvazione referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/referendum-abrogativi/:id/rifiuta - Rifiuta referendum abrogativo proposto
router.post('/:id/rifiuta', verifyToken, async (req, res) => {
  try {
    const adminUserId = req.userId;
    const { id } = req.params;
    
    console.log('🔍 DEBUG /api/referendum-abrogativi/rifiuta - Admin:', adminUserId, 'ID:', id);
    
    // Verifica che l'utente sia admin
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [adminUserId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin possono rifiutare i referendum.'
      });
    }
    
    // Rifiuta: elimina il referendum o marca come rifiutato
    const result = await pool.query(
      `DELETE FROM referendum_abrogativi 
       WHERE id = $1 AND quorum = 'proposta'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referendum non trovato o già processato'
      });
    }
    
    console.log('✅ DEBUG /api/referendum-abrogativi/rifiuta - Referendum rifiutato:', id);
    
    res.json({
      success: true,
      message: 'Referendum rifiutato e eliminato'
    });
  } catch (error) {
    console.error('❌ Errore nel rifiuto referendum abrogativo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/referendum-abrogativi/vota - Salva i voti dell'utente
router.post('/vota', verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Usa req.userId come negli altri endpoint, con fallback a req.user.id
    const userId = req.userId || req.user?.id;
    const { voti } = req.body;
    
    console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Utente:', userId);
    console.log('🔍 DEBUG /api/referendum-abrogativi/vota - req.userId:', req.userId);
    console.log('🔍 DEBUG /api/referendum-abrogativi/vota - req.user:', req.user);
    console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Voti da salvare:', voti);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta'
      });
    }
    
    // Limita a massimo 1 voto come da limite configurato
    const votiDaSalvare = Array.isArray(voti) ? voti.slice(0, 1) : [];
    
    // Verifica che gli ID dei referendum esistano
    if (votiDaSalvare.length > 0) {
      const referendumCheckQuery = 'SELECT id FROM referendum_abrogativi WHERE id = ANY($1::uuid[])';
      const referendumCheckResult = await client.query(referendumCheckQuery, [votiDaSalvare]);
      console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Referendum trovati nel DB:', referendumCheckResult.rows.map(r => r.id));
      console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Referendum richiesti:', votiDaSalvare);
      
      // Verifica che tutti gli ID dei referendum esistano
      if (referendumCheckResult.rows.length !== votiDaSalvare.length) {
        const missingIds = votiDaSalvare.filter(id => !referendumCheckResult.rows.some(row => row.id.toString() === id.toString()));
        console.error('❌ DEBUG /api/referendum-abrogativi/vota - ID referendum non trovati:', missingIds);
        return res.status(400).json({
          success: false,
          error: `Alcuni referendum non esistono: ${missingIds.join(', ')}`
        });
      }
    }
    
    await client.query('BEGIN');
    
    // Prima cancella TUTTI i voti esistenti dell'utente (sia come UUID che come text)
    const deleteQuery = `
      DELETE FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [userId]);
    console.log(`🔍 DEBUG /api/referendum-abrogativi/vota - Voti eliminati: ${deleteResult.rowCount}`);
    
      // Poi inserisce i nuovi voti (massimo 1)
      if (votiDaSalvare.length > 0) {
        const referendumId = votiDaSalvare[0];
        console.log(`🔍 DEBUG /api/referendum-abrogativi/vota - Tentativo inserimento voto:`, {
          userId,
          referendumId,
          referendumIdType: typeof referendumId
        });

        // Verifica quale referendum corrisponde a questo ID
        const refInfoQuery = 'SELECT id, nome FROM referendum_abrogativi WHERE id::text = $1 OR id = $1::uuid';
        const refInfoResult = await client.query(refInfoQuery, [referendumId]);
        if (refInfoResult.rows.length > 0) {
          console.log(`🔍 DEBUG /api/referendum-abrogativi/vota - Referendum trovato:`, {
            id: refInfoResult.rows[0].id,
            idText: refInfoResult.rows[0].id.toString(),
            nome: refInfoResult.rows[0].nome,
            referendumIdInserito: referendumId
          });
        } else {
          console.log(`⚠️ DEBUG /api/referendum-abrogativi/vota - Referendum non trovato con ID:`, referendumId);
        }

        // Inserisce il voto - referendum_id è TEXT, quindi lo convertiamo a stringa
        const referendumIdString = String(referendumId);
        await client.query(
          'INSERT INTO voti_referendum_abrogativi (userid, referendum_id, timestamp, created_at, updated_at) VALUES ($1::uuid, $2, NOW(), NOW(), NOW())',
          [userId, referendumIdString]
        );
        console.log(`✅ DEBUG /api/referendum-abrogativi/vota - Voto inserito con successo:`, {
          referendumId: referendumId,
          userId
        });
      }
    
    await client.query('COMMIT');
    
    console.log('✅ DEBUG /api/referendum-abrogativi/vota - Voti salvati con successo');
    
    res.json({
      success: true,
      message: 'Voti salvati con successo'
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(err => {
      console.error('❌ Errore nel ROLLBACK:', err);
    });
    console.error('❌ Errore nel salvataggio voti referendum abrogativi:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        details: error.message
      });
    }
  } finally {
    client.release();
  }
});

module.exports = router;
