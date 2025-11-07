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
    
    // Query dalla nuova tabella iniziative_ministero con tipo = 'referendum'
    // Se il parametro vota=true è presente, mostra solo quelle con quorum_raggiunto = TRUE
    // Per la pagina referendum-abrogativi (non vota), mostra solo quelle con stato = 'in_corso'
    const votaOnly = req.query.vota === 'true';
    const soloInCorso = !votaOnly; // Per la pagina listing, mostra solo quelle in corso
    console.log(`🔍 DEBUG: votaOnly = ${votaOnly}, soloInCorso = ${soloInCorso}, req.query.vota = ${req.query.vota}`);
    const { query, params } = buildQueryForTipo('referendum', userRole, userId, votaOnly, soloInCorso);
    console.log(`🔍 DEBUG: Query generata: ${query.substring(0, 200)}...`);
    
    const result = await pool.query(query, params);
    console.log(`✅ Recuperati ${result.rows.length} record da iniziative_ministero (tipo=referendum, votaOnly=${votaOnly}, soloInCorso=${soloInCorso}, userRole=${userRole})`);
    console.log(`🔍 DEBUG: Query completa:`, query);
    console.log(`🔍 DEBUG: Parametri query:`, params);
    if (result.rows.length > 0) {
      console.log(`🔍 DEBUG REFERENDUM: Prime 3 righe restituite dalla query SQL:`, result.rows.slice(0, 3).map(r => ({
        id: r.id,
        titolo: r.titolo?.substring(0, 50),
        tipo: r.tipo,
        stato: r.stato,
        id_ministero: r.id_ministero,
        quorum_raggiunto: r.quorum_raggiunto
      })));
    } else {
      console.warn(`⚠️ ATTENZIONE: La query SQL non ha restituito risultati!`);
      console.warn(`⚠️ Query eseguita:`, query);
      console.warn(`⚠️ Parametri:`, params);
      // Query di debug per vedere cosa c'è nel database
      const debugQuery = `
        SELECT 
          COUNT(*) as totale,
          COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
          COUNT(*) FILTER (WHERE stato = 'conclusa') as conclusa,
          COUNT(*) FILTER (WHERE stato IS NULL) as stato_null,
          COUNT(*) FILTER (WHERE id_ministero IS NOT NULL) as con_id_ministero,
          COUNT(*) FILTER (WHERE tipo LIKE '%Referendum abrogativo%' AND stato = 'in_corso' AND id_ministero IS NOT NULL) as valide
        FROM iniziative_ministero
        WHERE tipo LIKE $1
      `;
      const debugResult = await pool.query(debugQuery, params);
      console.log(`🔍 DEBUG REFERENDUM: Statistiche database (tipo LIKE '%Referendum abrogativo%'):`, debugResult.rows[0]);
      
      // Query di test diretta per vedere se ci sono risultati
      const testQuery = `
        SELECT id, titolo, tipo, stato, id_ministero
        FROM iniziative_ministero
        WHERE tipo LIKE '%Referendum abrogativo%' 
          AND stato = 'in_corso' 
          AND id_ministero IS NOT NULL
        LIMIT 5
      `;
      const testResult = await pool.query(testQuery);
      console.log(`🔍 DEBUG REFERENDUM: Test query diretta restituisce ${testResult.rows.length} risultati:`, testResult.rows.map(r => ({
        id: r.id,
        titolo: r.titolo?.substring(0, 50),
        tipo: r.tipo,
        stato: r.stato,
        id_ministero: r.id_ministero
      })));
    }
    
    // Debug: verifica cosa restituisce la query
    if (votaOnly) {
      console.log(`🔍 DEBUG VOTA REFERENDUM: result.rows.length = ${result.rows.length}`);
      if (result.rows.length === 0) {
        console.warn(`⚠️ ATTENZIONE: La query per votaOnly non ha restituito risultati. Verificando nel database...`);
        console.warn(`⚠️ Query eseguita:`, query);
        console.warn(`⚠️ Parametri:`, params);
        // Query di debug per vedere cosa c'è nel database
        const debugQuery = `
          SELECT 
            COUNT(*) as totale,
            COUNT(*) FILTER (WHERE quorum_raggiunto = true) as con_quorum,
            COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
            COUNT(*) FILTER (WHERE quorum_raggiunto = true AND stato != 'in_corso') as valide,
            COUNT(*) FILTER (WHERE tipo LIKE '%Referendum abrogativo%' AND quorum_raggiunto = true AND stato != 'in_corso' AND id_ministero IS NOT NULL) as valide_complete
          FROM iniziative_ministero
          WHERE tipo LIKE $1 AND id_ministero IS NOT NULL
        `;
        const debugResult = await pool.query(debugQuery, params);
        console.log(`🔍 DEBUG VOTA REFERENDUM: Statistiche database:`, debugResult.rows[0]);
        
        // Query di test diretta per vedere se ci sono risultati
        const testQuery = `
          SELECT id, titolo, tipo, stato, id_ministero, quorum_raggiunto
          FROM iniziative_ministero
          WHERE tipo LIKE '%Referendum abrogativo%' 
            AND quorum_raggiunto = true 
            AND stato != 'in_corso' 
            AND id_ministero IS NOT NULL
          LIMIT 5
        `;
        const testResult = await pool.query(testQuery);
        console.log(`🔍 DEBUG VOTA REFERENDUM: Test query diretta restituisce ${testResult.rows.length} risultati:`, testResult.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          tipo: r.tipo,
          stato: r.stato,
          id_ministero: r.id_ministero,
          quorum_raggiunto: r.quorum_raggiunto
        })));
      } else {
        console.log(`🔍 DEBUG VOTA REFERENDUM: Prime 3 righe prima del filtro:`, result.rows.slice(0, 3).map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato 
        })));
      }
    } else if (soloInCorso) {
      console.log(`🔍 DEBUG LISTING REFERENDUM: result.rows.length = ${result.rows.length}`);
      if (result.rows.length === 0) {
        console.warn(`⚠️ ATTENZIONE: La query per soloInCorso non ha restituito risultati. Verificando nel database...`);
        // Query di debug per vedere cosa c'è nel database
        const debugQuery = `
          SELECT 
            COUNT(*) as totale,
            COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
            COUNT(*) FILTER (WHERE stato = 'conclusa') as conclusa,
            COUNT(*) FILTER (WHERE stato IS NULL) as stato_null
          FROM iniziative_ministero
          WHERE tipo LIKE $1 AND id_ministero IS NOT NULL
        `;
        const debugResult = await pool.query(debugQuery, params);
        console.log(`🔍 DEBUG LISTING: Statistiche database:`, debugResult.rows[0]);
      } else {
        console.log(`🔍 DEBUG LISTING REFERENDUM: Prime 3 righe prima del filtro:`, result.rows.slice(0, 3).map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          stato: r.stato 
        })));
      }
    }
    
    // Filtro aggiuntivo di sicurezza per votaOnly: 
    // - ESCLUDE TUTTE quelle con stato = 'in_corso' (INDIPENDENTEMENTE dal quorum)
    // - Solo quelle con quorum_raggiunto = true
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
        console.warn(`⚠️ FILTRO SICUREZZA: Rimosse ${beforeFilter - afterFilter} referendum che non rispettano i criteri (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => {
          // Rimuove quelle con stato = 'in_corso' O quorum_raggiunto != true
          return row.stato === 'in_corso' || row.quorum_raggiunto !== true;
        });
        console.warn(`⚠️ Referendum rimossi:`, removed.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato 
        })));
      }
      
      // Debug: verifica quorum_raggiunto e stato dei risultati finali
      console.log(`🔍 DEBUG VOTA REFERENDUM: Dopo filtro sicurezza - filteredRows.length = ${filteredRows.length}`);
      if (filteredRows.length === 0 && beforeFilter > 0) {
        console.error(`❌ ERRORE: Tutti i referendum sono stati rimossi dal filtro sicurezza!`);
        console.error(`❌ Prima del filtro: ${beforeFilter}, dopo: ${afterFilter}`);
        console.error(`❌ Analisi delle righe rimosse:`, result.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          quorum_raggiunto: r.quorum_raggiunto,
          quorum_raggiunto_type: typeof r.quorum_raggiunto,
          stato: r.stato,
          stato_type: typeof r.stato
        })));
      }
      if (filteredRows.length > 0) {
        const quorumStatus = filteredRows.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato
        }));
        console.log(`🔍 DEBUG: Stato quorum_raggiunto e stato dei risultati FINALI (dopo filtro sicurezza):`, quorumStatus);
        
        // Verifica che non ci siano referendum con stato = 'in_corso'
        const inCorso = filteredRows.filter(r => r.stato === 'in_corso');
        if (inCorso.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${inCorso.length} referendum con stato='in_corso' dopo il filtro sicurezza:`, inCorso.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50) })));
        }
        
        // Verifica che tutti abbiano quorum_raggiunto = true
        const noQuorum = filteredRows.filter(r => r.quorum_raggiunto !== true);
        if (noQuorum.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${noQuorum.length} referendum con quorum_raggiunto != true dopo il filtro sicurezza:`, noQuorum.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto })));
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
        console.warn(`⚠️ FILTRO SICUREZZA LISTING REFERENDUM: Rimosse ${beforeFilter - afterFilter} referendum che non hanno stato='in_corso' (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => row.stato !== 'in_corso');
        console.warn(`⚠️ Referendum rimossi (stato != 'in_corso'):`, removed.map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          stato: r.stato 
        })));
      }
      
      // Debug: verifica che tutti i referendum abbiano stato = 'in_corso'
      console.log(`🔍 DEBUG LISTING REFERENDUM: Dopo filtro sicurezza - filteredRows.length = ${filteredRows.length}`);
      if (filteredRows.length === 0 && beforeFilter > 0) {
        console.error(`❌ ERRORE: Tutti i referendum sono stati rimossi dal filtro sicurezza!`);
        console.error(`❌ Prima del filtro: ${beforeFilter}, dopo: ${afterFilter}`);
        console.error(`❌ Analisi delle righe rimosse:`, result.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          stato: r.stato,
          stato_type: typeof r.stato
        })));
      }
      if (filteredRows.length > 0) {
        const notInCorso = filteredRows.filter(r => r.stato !== 'in_corso');
        if (notInCorso.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${notInCorso.length} referendum con stato != 'in_corso' dopo il filtro sicurezza:`, notInCorso.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), stato: r.stato })));
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
    
    // Normalizza i dati per il frontend usando il mapper
    const normalizedData = filteredRows.map(row => mapToLegacyFormat(row, 'referendum'));

    // Genera la classifica basata sui voti
    let classifica = [];
    if (filteredRows.length > 0) {
      try {
        // Per la pagina listing: solo quelle con stato = 'in_corso'
        // Per la pagina vota: quorum_raggiunto = TRUE E ESCLUDE TUTTE quelle con stato = 'in_corso'
        const quorumFilter = votaOnly 
          ? 'AND im.quorum_raggiunto = true AND im.stato != \'in_corso\''
          : 'AND im.stato = \'in_corso\'';
        
        const classificaQuery = `
          SELECT 
            im.titolo as nome,
            im.sito_web as sitoWeb,
            COUNT(vra.referendum_id) as voti
          FROM iniziative_ministero im
          LEFT JOIN voti_referendum_abrogativi vra ON (
            im.id::text = vra.referendum_id::text OR 
            REPLACE(im.id::text, '-', '') = vra.referendum_id::text OR
            im.id::text = REPLACE(vra.referendum_id::text, '-', '') OR
            REPLACE(im.id::text, '-', '') = REPLACE(vra.referendum_id::text, '-', '')
          )
          WHERE im.tipo LIKE '%Referendum abrogativo%'
            AND im.id_ministero IS NOT NULL
            ${quorumFilter}
          GROUP BY im.id, im.titolo, im.sito_web, im.firme_raccolte
          ORDER BY im.firme_raccolte DESC NULLS LAST, voti DESC, im.titolo ASC
        `;
        
        console.log('🔍 DEBUG - Esecuzione query classifica referendum');
        const classificaResult = await pool.query(classificaQuery);
        console.log('🔍 DEBUG - Risultati classifica raw referendum:', classificaResult.rows);
        
        // Debug: verifica tutti i voti nel database
        const debugVotiQuery = 'SELECT referendum_id, COUNT(*) as count FROM voti_referendum_abrogativi GROUP BY referendum_id';
        const debugVotiResult = await pool.query(debugVotiQuery);
        console.log('🔍 DEBUG - Tutti i voti per referendum_id:', debugVotiResult.rows);
        
        // Debug: verifica gli ID dei referendum
        const debugQuorumFilter = votaOnly 
          ? 'AND quorum_raggiunto = true AND stato != \'in_corso\''
          : 'AND stato = \'in_corso\'';
        const debugReferendumQuery = `SELECT id, titolo as nome, stato, quorum_raggiunto, firme_raccolte FROM iniziative_ministero WHERE tipo LIKE '%Referendum abrogativo%' AND id_ministero IS NOT NULL ${debugQuorumFilter} ORDER BY firme_raccolte DESC NULLS LAST`;
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

    const responseData = {
      success: true,
      richieste: normalizedData,
      referendum: normalizedData,
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null }
    };
    
    console.log(`🔍 DEBUG REFERENDUM: Risposta finale - referendum.length = ${normalizedData.length}, classifica.length = ${classifica.length}, mieiVoti.length = ${mieiVoti.length}`);
    if (normalizedData.length > 0) {
      console.log(`🔍 DEBUG REFERENDUM: Prime 3 referendum:`, normalizedData.slice(0, 3).map(r => ({ id: r.id, nome: r.nome?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto, stato: r.stato })));
    } else {
      console.warn(`⚠️ ATTENZIONE: normalizedData è vuoto! filteredRows.length = ${filteredRows.length}`);
    }
    
    res.json(responseData);
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
    
    // Verifica che gli ID dei referendum esistano nella nuova tabella
    if (votiDaSalvare.length > 0) {
      // Per votare, il referendum deve avere quorum_raggiunto = TRUE E NON deve avere stato = 'in_corso'
      const referendumCheckQuery = `SELECT id FROM iniziative_ministero WHERE tipo LIKE '%Referendum abrogativo%' AND id_ministero IS NOT NULL AND quorum_raggiunto = true AND stato != 'in_corso' AND id = ANY($1)`;
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
        const refInfoQuery = `SELECT id, titolo as nome FROM iniziative_ministero WHERE tipo LIKE '%Referendum abrogativo%' AND (id::text = $1 OR id = $1)`;
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
