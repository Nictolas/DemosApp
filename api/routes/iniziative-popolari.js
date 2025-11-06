const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { mapToLegacyFormat, buildQueryForTipo } = require('../utils/iniziativeMinisteroMapper');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Lista iniziative popolari (come ICE)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Chiamata endpoint /api/iniziative-popolari');
    // Disabilita caching per evitare dati stantii lato client/proxy
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Ottieni il ruolo dell'utente se autenticato
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
    
    // Query dalla nuova tabella iniziative_ministero con tipo = 'iniziativa'
    // Se il parametro vota=true è presente, mostra solo quelle con quorum_raggiunto = TRUE
    // Per la pagina iniziative-popolari (non vota), mostra solo quelle con stato = 'in_corso'
    const votaOnly = req.query.vota === 'true';
    const soloInCorso = !votaOnly; // Per la pagina listing, mostra solo quelle in corso
    console.log(`🔍 DEBUG: votaOnly = ${votaOnly}, soloInCorso = ${soloInCorso}, req.query.vota = ${req.query.vota}`);
    const { query, params } = buildQueryForTipo('iniziativa', userRole, userId, votaOnly, soloInCorso);
    console.log(`🔍 DEBUG: Query generata: ${query.substring(0, 200)}...`);
    
    const result = await pool.query(query, params);
    console.log(`✅ Recuperati ${result.rows.length} record da iniziative_ministero (tipo=iniziativa, votaOnly=${votaOnly})`);
    console.log(`🔍 DEBUG: Query completa:`, query);
    console.log(`🔍 DEBUG: Parametri query:`, params);
    
    // Debug: verifica cosa restituisce la query
    if (votaOnly && result.rows.length === 0) {
      console.warn(`⚠️ ATTENZIONE: La query per votaOnly non ha restituito risultati. Verificando nel database...`);
      // Query di debug per vedere cosa c'è nel database
      const debugQuery = `
        SELECT 
          COUNT(*) as totale,
          COUNT(*) FILTER (WHERE quorum_raggiunto = true) as con_quorum,
          COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
          COUNT(*) FILTER (WHERE quorum_raggiunto = true AND stato != 'in_corso') as valide
        FROM iniziative_ministero
        WHERE tipo LIKE $1 AND id_ministero IS NOT NULL
      `;
      const debugResult = await pool.query(debugQuery, params);
      console.log(`🔍 DEBUG: Statistiche database:`, debugResult.rows[0]);
    }
    
    // Filtro aggiuntivo di sicurezza:
    // - Per votaOnly: ESCLUDE TUTTE quelle con stato = 'in_corso' (INDIPENDENTEMENTE dal quorum) e solo quelle con quorum_raggiunto = true
    // - Per listing (soloInCorso): ESCLUDE TUTTE quelle con stato != 'in_corso'
    let filteredRows = result.rows;
    if (votaOnly) {
      const beforeFilter = filteredRows.length;
      filteredRows = filteredRows.filter(row => {
        // ESCLUDE TUTTE quelle con stato = 'in_corso'
        if (row.stato === 'in_corso') {
          return false;
        }
        // Solo quelle con quorum_raggiunto = true
        return row.quorum_raggiunto === true;
      });
      const afterFilter = filteredRows.length;
      
      if (beforeFilter !== afterFilter) {
        console.warn(`⚠️ FILTRO SICUREZZA: Rimosse ${beforeFilter - afterFilter} iniziative che non rispettano i criteri (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => {
          // Rimuove quelle con stato = 'in_corso' O quorum_raggiunto != true
          return row.stato === 'in_corso' || row.quorum_raggiunto !== true;
        });
        console.warn(`⚠️ Iniziative rimosse:`, removed.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato 
        })));
      }
      
      // Debug: verifica quorum_raggiunto e stato dei risultati finali
      if (filteredRows.length > 0) {
        const quorumStatus = filteredRows.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato
        }));
        console.log(`🔍 DEBUG: Stato quorum_raggiunto e stato dei risultati FINALI (dopo filtro sicurezza):`, quorumStatus);
        
        // Verifica che non ci siano iniziative con stato = 'in_corso'
        const inCorso = filteredRows.filter(r => r.stato === 'in_corso');
        if (inCorso.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovate ${inCorso.length} iniziative con stato='in_corso' dopo il filtro sicurezza:`, inCorso.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50) })));
        }
        
        // Verifica che tutte abbiano quorum_raggiunto = true
        const noQuorum = filteredRows.filter(r => r.quorum_raggiunto !== true);
        if (noQuorum.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovate ${noQuorum.length} iniziative con quorum_raggiunto != true dopo il filtro sicurezza:`, noQuorum.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto })));
        }
      }
    } else if (soloInCorso) {
      // Filtro di sicurezza per la pagina listing: ESCLUDE TUTTE quelle con stato != 'in_corso'
      const beforeFilter = filteredRows.length;
      filteredRows = filteredRows.filter(row => {
        return row.stato === 'in_corso';
      });
      const afterFilter = filteredRows.length;
      
      if (beforeFilter !== afterFilter) {
        console.warn(`⚠️ FILTRO SICUREZZA LISTING: Rimosse ${beforeFilter - afterFilter} iniziative che non hanno stato='in_corso' (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => row.stato !== 'in_corso');
        console.warn(`⚠️ Iniziative rimosse (stato != 'in_corso'):`, removed.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          stato: r.stato 
        })));
      }
      
      // Debug: verifica che tutte le iniziative abbiano stato = 'in_corso'
      if (filteredRows.length > 0) {
        const notInCorso = filteredRows.filter(r => r.stato !== 'in_corso');
        if (notInCorso.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovate ${notInCorso.length} iniziative con stato != 'in_corso' dopo il filtro sicurezza:`, notInCorso.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), stato: r.stato })));
        }
      }
    }
    
    // Se l'utente è autenticato, ottieni i suoi voti
    let mieiVoti = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        console.log(`🔍 DEBUG: UserId dal token: ${userId}`);
        
        // Prima verifica tutti i voti esistenti per debug
        const debugQuery = `SELECT userid, iniziativa_id FROM voti_iniziative_popolari LIMIT 10`;
        const debugResult = await pool.query(debugQuery);
        console.log(`🔍 DEBUG: Voti totali nel DB (primi 10):`, debugResult.rows.map(r => ({ userid: r.userid, iniziativa_id: r.iniziativa_id })));
        
        // Query per recuperare i voti dell'utente
        // Usa DISTINCT ON per ottenere solo l'ultimo voto per utente (se ci sono duplicati)
        // e LIMIT 1 per rispettare il limite di 1 voto per utente
        const userVotiQuery = `
          SELECT DISTINCT ON (userid) iniziativa_id 
          FROM voti_iniziative_popolari 
          WHERE userid::text = $1 OR userid = $1::uuid
          ORDER BY userid, timestamp DESC, created_at DESC
          LIMIT 1
        `;
        const userVotiResult = await pool.query(userVotiQuery, [userId]);
        console.log(`🔍 DEBUG: Query risultato per userId ${userId}:`, userVotiResult.rows);
        
        // Se non trova voti, prova solo come UUID
        if (userVotiResult.rows.length === 0) {
          const userVotiQueryUUID = `
            SELECT iniziativa_id FROM voti_iniziative_popolari 
            WHERE userid = $1::uuid
            ORDER BY timestamp DESC, created_at DESC
            LIMIT 1
          `;
          const userVotiResultUUID = await pool.query(userVotiQueryUUID, [userId]);
          console.log(`🔍 DEBUG: Query solo UUID per userId ${userId}:`, userVotiResultUUID.rows);
          mieiVoti = userVotiResultUUID.rows.map(v => v.iniziativa_id);
        } else {
          mieiVoti = userVotiResult.rows.map(v => v.iniziativa_id);
        }
        
        // Limita a massimo 1 voto (per sicurezza)
        mieiVoti = mieiVoti.slice(0, 1);
        
        console.log(`✅ Recuperati ${mieiVoti.length} voti utente:`, mieiVoti);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        console.log('⚠️ Token non valido per iniziative popolari, continuando senza autenticazione:', authError.message);
      }
    }
    
    // Normalizza i dati per il frontend usando il mapper (usa filteredRows invece di result.rows)
    const normalizedData = filteredRows.map(row => mapToLegacyFormat(row, 'iniziativa'));

    // Genera la classifica basata sui voti (usa filteredRows invece di result.rows)
    let classifica = [];
    if (filteredRows.length > 0) {
      try {
        // Costruisci la query di classifica con il filtro appropriato
        // Per la pagina iniziative-popolari, mostra solo quelle con stato = 'in_corso'
        // Per la pagina vota: quorum_raggiunto = TRUE E ESCLUDE TUTTE quelle con stato = 'in_corso'
        const quorumFilter = votaOnly 
          ? 'AND im.quorum_raggiunto = true AND im.stato != \'in_corso\''
          : 'AND im.stato = \'in_corso\'';
        
        const classificaQuery = `
          SELECT 
            im.titolo as nome,
            im.sito_web as sitoWeb,
            COUNT(vip.iniziativa_id) as voti
          FROM iniziative_ministero im
          LEFT JOIN voti_iniziative_popolari vip ON (
            im.id::text = vip.iniziativa_id OR 
            REPLACE(im.id::text, '-', '') = vip.iniziativa_id OR
            im.id::text = REPLACE(vip.iniziativa_id, '-', '') OR
            REPLACE(im.id::text, '-', '') = REPLACE(vip.iniziativa_id, '-', '')
          )
          WHERE im.tipo LIKE '%Legge di iniziativa popolare%'
            AND im.id_ministero IS NOT NULL
            ${quorumFilter}
          GROUP BY im.id, im.titolo, im.sito_web, im.firme_raccolte
          ORDER BY im.firme_raccolte DESC NULLS LAST, voti DESC, im.titolo ASC
        `;
        
        console.log('🔍 DEBUG - Esecuzione query classifica');
        const classificaResult = await pool.query(classificaQuery);
        console.log('🔍 DEBUG - Risultati classifica raw:', classificaResult.rows);
        
        // Debug: verifica tutti i voti nel database
        const debugVotiQuery = 'SELECT iniziativa_id, COUNT(*) as count FROM voti_iniziative_popolari GROUP BY iniziativa_id';
        const debugVotiResult = await pool.query(debugVotiQuery);
        console.log('🔍 DEBUG - Tutti i voti per iniziativa_id:', debugVotiResult.rows);
        
        // Debug: verifica gli ID delle iniziative
        const debugQuorumFilter = votaOnly 
          ? 'AND quorum_raggiunto = true AND stato != \'in_corso\''
          : 'AND stato = \'in_corso\'';
        const debugIniziativeQuery = `SELECT id, titolo as nome, stato, quorum_raggiunto, firme_raccolte FROM iniziative_ministero WHERE tipo LIKE '%Legge di iniziativa popolare%' AND id_ministero IS NOT NULL ${debugQuorumFilter} ORDER BY firme_raccolte DESC NULLS LAST`;
        const debugIniziativeResult = await pool.query(debugIniziativeQuery);
        console.log('🔍 DEBUG - ID iniziative:', debugIniziativeResult.rows.map(r => ({ id: r.id, id_text: r.id.toString(), nome: r.nome })));
        
        classifica = classificaResult.rows.map(row => ({
          nome: row.nome,
          sitoWeb: row.sitoweb || row.sito_web,
          voti: parseInt(row.voti) || 0
        }));
        console.log(`✅ Generata classifica con ${classifica.length} iniziative:`, classifica);
      } catch (classificaError) {
        console.log('⚠️ Errore nella generazione classifica, continuando senza:', classificaError.message);
        // Se la classifica fallisce, continua senza di essa
        classifica = [];
      }
    }

    res.json({
      success: true,
      richieste: normalizedData,
      iniziative: normalizedData,
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare iniziative popolari',
      details: error.message
    });
  }
});

// POST /api/iniziative-popolari - Crea richiesta iniziativa popolare (come ICE)
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG POST: Inizio creazione iniziativa popolare');
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
        error: 'Autenticazione richiesta. Esegui il login per proporre un\'iniziativa.'
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
        FROM iniziative_popolari
        WHERE userid = $1 AND quorum = 'proposta'
        LIMIT 1
        FOR UPDATE
      `;
      const existingProposal = await client.query(existingProposalQuery, [userId]);

      if (existingProposal.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        console.log('⚠️ DEBUG POST: Utente ha già una proposta in attesa, bloccando nuovo inserimento');
        return res.status(400).json({
          success: false,
          error: 'Hai già una proposta in attesa di approvazione. Puoi proporre solo una iniziativa alla volta.'
        });
      }

      // Genera un UUID valido per la richiesta iniziativa
      const crypto = require('crypto');
      const iniziativaId = crypto.randomUUID();
      console.log('🔍 DEBUG: Iniziativa ID generato:', iniziativaId);

      // Definisce i parametri per la query - include userid e quorum = 'proposta'
      const params = [iniziativaId, userId, nome, descrizione, dataInizio, dataFine, sitoWeb];

      // Inserisce con quorum = 'proposta' e userid dell'utente che propone
      const query = `
        INSERT INTO iniziative_popolari (id, userid, nome, descrizione, data_inizio, data_fine, sito_web, quorum)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposta')
        RETURNING *
      `;

      console.log('🔍 DEBUG POST: Parametri query:', params);
      console.log('🔍 DEBUG POST: Tentativo connessione database...');
      console.log('🔍 DEBUG POST: DATABASE_URL presente:', !!process.env.DATABASE_URL);
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

      console.log(`✅ Iniziativa proposta creata: ${iniziativaId} per utente: ${userId}`);

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
    console.error('❌ DEBUG POST: Errore nella creazione iniziativa popolare:', error);
    console.error('❌ DEBUG POST: Stack trace:', error.stack);
    console.error('❌ DEBUG POST: Error code:', error.code);
    console.error('❌ DEBUG POST: Error detail:', error.detail);
    
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione iniziativa popolare',
      details: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/iniziative-popolari/:id - Aggiorna iniziativa popolare (per admin)
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
        error: 'Accesso negato. Solo Admin possono modificare le iniziative popolari.'
      });
    }
    
    // Costruisci la query di update dinamicamente per includere firme solo se presente
    let updateQuery;
    let updateParams;
    
    if (firme !== undefined) {
      updateQuery = `
        UPDATE iniziative_popolari
        SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sito_web = $5, quorum = $6, firme = $7
        WHERE id = $8
        RETURNING *
      `;
      updateParams = [nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, firme, id];
    } else {
      updateQuery = `
        UPDATE iniziative_popolari
        SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sito_web = $5, quorum = $6
        WHERE id = $7
        RETURNING *
      `;
      updateParams = [nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, id];
    }
    
    const result = await pool.query(updateQuery, updateParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Iniziativa popolare non trovata'
      });
    }
    
    console.log(`✅ Iniziativa popolare aggiornata: ${id}, nuovo quorum: ${quorum}`);
    
    res.json({
      success: true,
      richiesta: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento iniziativa popolare'
    });
  }
});

// DELETE /api/iniziative-popolari/:id - Elimina iniziativa popolare
// Permette a:
// - Admin di eliminare qualsiasi iniziativa
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
    
    // Se non è admin, verifica che l'iniziativa sia una proposta dell'utente
    if (!isAdmin) {
      const iniziativaQuery = `SELECT id, userid, quorum FROM iniziative_popolari WHERE id = $1`;
      const iniziativaResult = await pool.query(iniziativaQuery, [id]);
      
      if (iniziativaResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Iniziativa popolare non trovata'
        });
      }
      
      const iniziativa = iniziativaResult.rows[0];
      const isOwner = iniziativa.userid === userId && iniziativa.quorum === 'proposta';
      
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Accesso negato. Puoi eliminare solo le tue proposte in attesa di approvazione.'
        });
      }
    }
    
    const deleteQuery = `DELETE FROM iniziative_popolari WHERE id = $1 RETURNING *`;
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Iniziativa popolare non trovata'
      });
    }
    
    console.log(`✅ Iniziativa popolare eliminata: ${id}`);
    
    res.json({
      success: true,
      message: 'Iniziativa popolare eliminata con successo'
    });
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione iniziativa popolare'
    });
  }
});

// POST /api/iniziative-popolari/vota - Salva i voti dell'utente
router.post('/vota', verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Usa req.userId come negli altri endpoint, con fallback a req.user.id
    const userId = req.userId || req.user?.id;
    const { voti } = req.body;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Utente:', userId);
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - req.userId:', req.userId);
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - req.user:', req.user);
    console.log('🔍 DEBUG /api/iniziative-popolari/vota - Voti da salvare:', voti);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta'
      });
    }
    
    // Limita a massimo 1 voto come da limite configurato
    const votiDaSalvare = Array.isArray(voti) ? voti.slice(0, 1) : [];
    
    // Verifica che gli ID delle iniziative esistano nella nuova tabella
    if (votiDaSalvare.length > 0) {
      // Per votare, l'iniziativa deve avere quorum_raggiunto = TRUE E NON deve avere stato = 'in_corso'
      const iniziativeCheckQuery = `SELECT id FROM iniziative_ministero WHERE tipo LIKE '%Legge di iniziativa popolare%' AND id_ministero IS NOT NULL AND quorum_raggiunto = true AND stato != 'in_corso' AND id = ANY($1)`;
      const iniziativeCheckResult = await client.query(iniziativeCheckQuery, [votiDaSalvare]);
      console.log('🔍 DEBUG /api/iniziative-popolari/vota - Iniziative trovate nel DB:', iniziativeCheckResult.rows.map(i => i.id));
      console.log('🔍 DEBUG /api/iniziative-popolari/vota - Iniziative richieste:', votiDaSalvare);
      
      // Verifica che tutti gli ID delle iniziative esistano
      if (iniziativeCheckResult.rows.length !== votiDaSalvare.length) {
        const missingIds = votiDaSalvare.filter(id => !iniziativeCheckResult.rows.some(row => row.id === id));
        console.error('❌ DEBUG /api/iniziative-popolari/vota - ID iniziative non trovati:', missingIds);
        return res.status(400).json({
          success: false,
          error: `Alcune iniziative non esistono: ${missingIds.join(', ')}`
        });
      }
    }
    
    await client.query('BEGIN');
    
    // Prima cancella TUTTI i voti esistenti dell'utente (sia come UUID che come text)
    const deleteQuery = `
      DELETE FROM voti_iniziative_popolari 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [userId]);
    console.log(`🔍 DEBUG /api/iniziative-popolari/vota - Voti eliminati: ${deleteResult.rowCount}`);
    
    // Poi inserisce i nuovi voti (massimo 1)
    if (votiDaSalvare.length > 0) {
      const iniziativaId = votiDaSalvare[0];
      await client.query(
        'INSERT INTO voti_iniziative_popolari (userid, iniziativa_id, timestamp, created_at, updated_at) VALUES ($1::uuid, $2, NOW(), NOW(), NOW())',
        [userId, iniziativaId]
      );
      console.log(`🔍 DEBUG /api/iniziative-popolari/vota - Voto inserito: ${iniziativaId}`);
    }
    
    await client.query('COMMIT');
    
    console.log('✅ DEBUG /api/iniziative-popolari/vota - Voti salvati con successo');
    
    res.json({
      success: true,
      message: 'Voti salvati con successo'
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(err => {
      console.error('❌ Errore nel ROLLBACK:', err);
    });
    console.error('❌ Errore nel salvataggio voti iniziative popolari:', error);
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

// GET /api/iniziative-popolari/debug - Debug per verificare la struttura delle tabelle
router.get('/debug', verifyToken, async (req, res) => {
  try {
    // Query per vedere la struttura delle iniziative
    const iniziativeQuery = 'SELECT id, nome FROM iniziative_popolari ORDER BY created_at DESC LIMIT 10';
    const iniziativeResult = await pool.query(iniziativeQuery);
    
    // Query per vedere i voti esistenti
    const votiQuery = 'SELECT DISTINCT iniziativa_id FROM voti_iniziative_popolari LIMIT 10';
    const votiResult = await pool.query(votiQuery);
    
    // Query per vedere se ci sono corrispondenze
    const corrispondenzeQuery = `
      SELECT 
        i.id as iniziativa_id,
        i.nome,
        COUNT(v.id) as voti_count
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id::text = v.iniziativa_id
      GROUP BY i.id, i.nome
      ORDER BY voti_count DESC
    `;
    const corrispondenzeResult = await pool.query(corrispondenzeQuery);
    
    res.json({
      success: true,
      debug: {
        iniziative: iniziativeResult.rows,
        voti_esistenti: votiResult.rows,
        corrispondenze: corrispondenzeResult.rows
      }
    });
  } catch (error) {
    console.error('❌ Errore nel debug iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari/richiesta - Crea richiesta di nuova iniziativa popolare
router.post('/richiesta', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nome, sito_web, descrizione, data_inizio, data_fine, userid, status, quorum } = req.body;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/richiesta - Utente:', userId);
    console.log('🔍 DEBUG /api/iniziative-popolari/richiesta - Dati ricevuti:', req.body);
    
    if (!nome || !userid) {
      return res.status(400).json({
        success: false,
        error: 'Nome e userid sono obbligatori'
      });
    }
    
    // Genera un ID univoco per la richiesta
    const richiestaId = `richiesta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      'INSERT INTO iniziative_popolari (id, userid, nome, data_inizio, data_fine, sito_web, status, quorum, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
      [richiestaId, userid, nome, data_inizio, data_fine, sito_web, status || 'pending', quorum || 'ok']
    );
    
    console.log('✅ DEBUG /api/iniziative-popolari/richiesta - Richiesta creata:', result.rows[0].id);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione richiesta iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/iniziative-popolari/richieste - Lista richieste di iniziative popolari (solo per Admin)
router.get('/richieste', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/richieste - Utente:', userId, 'Ruolo:', userRole);
    
    // Solo gli Admin possono vedere le richieste
    if (userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato'
      });
    }
    
    // Query per ottenere le richieste pending
    const richiesteResult = await pool.query(
      'SELECT id, nome, data_inizio as "dataInizio", data_fine as "dataFine", sito_web as "sitoWeb", status, created_at FROM iniziative_popolari WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );
    
    console.log('🔍 DEBUG /api/iniziative-popolari/richieste - Richieste trovate:', richiesteResult.rows.length);
    
    res.json(richiesteResult.rows);
  } catch (error) {
    console.error('❌ Errore nel recupero richieste iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari/:id/accetta - Accetta richiesta iniziativa popolare
router.post('/:id/accetta', verifyToken, async (req, res) => {
  try {
    const adminUserId = req.userId;
    const { id } = req.params;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/accetta - Admin:', adminUserId, 'ID:', id);
    
    // Verifica che l'utente sia admin
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [adminUserId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin possono approvare le iniziative.'
      });
    }
    
    // Approva: cambia quorum da 'proposta' a 'ok' e azzera userid
    const result = await pool.query(
      `UPDATE iniziative_popolari 
       SET quorum = 'ok', userid = NULL, updated_at = NOW() 
       WHERE id = $1 AND quorum = 'proposta'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Richiesta non trovata'
      });
    }
    
    console.log('✅ DEBUG /api/iniziative-popolari/accetta - Richiesta accettata:', id);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'accettazione richiesta iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari/:id/rifiuta - Rifiuta richiesta iniziativa popolare
router.post('/:id/rifiuta', verifyToken, async (req, res) => {
  try {
    const adminUserId = req.userId;
    const { id } = req.params;
    
    console.log('🔍 DEBUG /api/iniziative-popolari/rifiuta - Admin:', adminUserId, 'ID:', id);
    
    // Verifica che l'utente sia admin
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [adminUserId]);
    
    if (userResult.rows.length === 0 || userResult.rows[0].ruolo !== 'AD') {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo Admin possono rifiutare le iniziative.'
      });
    }
    
    // Rifiuta: elimina la proposta
    const result = await pool.query(
      `DELETE FROM iniziative_popolari 
       WHERE id = $1 AND quorum = 'proposta'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Iniziativa non trovata o già processata'
      });
    }
    
    console.log('✅ DEBUG /api/iniziative-popolari/rifiuta - Iniziativa rifiutata:', id);
    
    res.json({
      success: true,
      message: 'Iniziativa rifiutata e eliminata'
    });
  } catch (error) {
    console.error('❌ Errore nel rifiuto iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
