const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { mapToLegacyFormat, buildQueryForTipo, mapReferendumAbrogativiToLegacyFormat } = require('../utils/iniziativeMinisteroMapper');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== FUNZIONE PER GENERARE EMOJI AUTOMATICHE =====
/**
 * Genera un'emoji automatica basata sul contenuto del referendum
 * Analizza titolo e descrizione per trovare parole chiave
 */
function getEmojiAutomaticaReferendum(referendum) {
  const testo = `${referendum.nome || ''} ${referendum.titolo || ''} ${referendum.descrizione || ''} ${referendum.quesito || ''}`.toLowerCase();
  
  // Mappa di parole chiave -> emoji (in ordine di priorità)
  const emojiMap = [
    // Educazione e scuola
    { keywords: ['educazione', 'scuola', 'istruzione', 'studenti', 'docenti', 'curriculum', 'materia'], emoji: '📚' },
    // Ambiente e clima
    { keywords: ['ambiente', 'clima', 'energia', 'rinnovabile', 'sostenibilità', 'ecologia', 'inquinamento'], emoji: '🌱' },
    // Sanità e salute
    { keywords: ['sanità', 'salute', 'ospedale', 'cure', 'medico', 'farmaco', 'igiene'], emoji: '🏥' },
    // Diritti e uguaglianza
    { keywords: ['diritti', 'uguaglianza', 'discriminazione', 'parità', 'genere', 'lgbt', 'matrimonio'], emoji: '🤝' },
    // Lavoro ed economia
    { keywords: ['lavoro', 'economia', 'iva', 'tasse', 'fiscale', 'occupazione', 'salario'], emoji: '💼' },
    // Giustizia e legalità
    { keywords: ['giustizia', 'legge', 'penale', 'carcere', 'reato', 'criminale', 'abrogativo'], emoji: '⚖️' },
    // Cultura e arte
    { keywords: ['cultura', 'arte', 'patrimonio', 'museo', 'teatro'], emoji: '🎭' },
    // Trasporti e mobilità
    { keywords: ['trasporti', 'mobilità', 'auto', 'strada', 'traffico'], emoji: '🚗' },
    // Tecnologia e digitale
    { keywords: ['tecnologia', 'digitale', 'internet', 'informatica', 'software'], emoji: '💻' },
    // Famiglia e sociale
    { keywords: ['famiglia', 'bambini', 'infanzia', 'maternità'], emoji: '👨‍👩‍👧‍👦' },
    // Animali
    { keywords: ['animali', 'cane', 'gatto', 'pet', 'sperimentazione animale'], emoji: '🐕' },
    // Sport
    { keywords: ['sport', 'calcio', 'atletica', 'olimpico'], emoji: '⚽' },
    // Cibo e agricoltura
    { keywords: ['cibo', 'agricoltura', 'alimentare', 'produzione'], emoji: '🌾' },
    // Casa e abitazione
    { keywords: ['casa', 'abitazione', 'edilizia', 'alloggio'], emoji: '🏠' },
    // Sicurezza
    { keywords: ['sicurezza', 'polizia', 'protezione', 'difesa'], emoji: '🛡️' },
    // Democrazia e politica
    { keywords: ['democrazia', 'politica', 'elezioni', 'voto', 'referendum'], emoji: '🗳️' }
  ];
  
  // Cerca la prima corrispondenza
  for (const mapping of emojiMap) {
    if (mapping.keywords.some(keyword => testo.includes(keyword))) {
      return mapping.emoji;
    }
  }
  
  // Emoji di default per referendum
  return '🗳️';
}

// ===== ENDPOINTS PER REFERENDUM ABROGATIVI =====

// GET /api/referendum-abrogativi - Lista referendum abrogativi (come ICE)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 ========== DEBUG REFERENDUM: Chiamata endpoint /api/referendum-abrogativi ==========');
    console.log('🔍 DEBUG: Query params:', req.query);
    console.log('🔍 DEBUG: Headers authorization:', req.headers.authorization ? 'presente' : 'assente');
    
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
    
    // Query da ENTRAMBE le tabelle: iniziative_ministero e referendum_abrogativi
    // Se il parametro vota=true è presente, mostra solo quelle con quorum_raggiunto = TRUE
    // Per la pagina referendum-abrogativi (non vota), mostra solo quelle con stato = 'in_corso'
    const votaOnly = req.query.vota === 'true';
    const soloInCorso = !votaOnly; // Per la pagina listing, mostra solo quelle in corso (come iniziative-popolari)
    console.log(`🔍 DEBUG: votaOnly = ${votaOnly}, soloInCorso = ${soloInCorso}, req.query.vota = ${req.query.vota}`);
    
    // 1. Query da iniziative_ministero
    const { query, params } = buildQueryForTipo('referendum', userRole, userId, votaOnly, soloInCorso);
    console.log(`🔍 DEBUG: Query completa generata:`, query);
    console.log(`🔍 DEBUG: Parametri query:`, params);
    console.log(`🔍 DEBUG: Query generata: ${query.substring(0, 200)}...`);
    
    console.log('🔍 DEBUG: Esecuzione query SQL...');
    console.log('🔍 DEBUG: Query SQL completa:', query);
    console.log('🔍 DEBUG: Parametri query:', params);
    
    const result = await pool.query(query, params);
    console.log(`🔍 DEBUG: Query eseguita, risultato: ${result.rows.length} righe`);
    if (result.rows.length > 0) {
      console.log('🔍 DEBUG: Prime 3 righe risultato query:', result.rows.slice(0, 3).map(r => ({
        id: r.id,
        titolo: r.titolo?.substring(0, 50),
        tipo: r.tipo,
        stato: r.stato,
        quorum_raggiunto: r.quorum_raggiunto,
        quorum_raggiunto_type: typeof r.quorum_raggiunto,
        id_ministero: r.id_ministero
      })));
    }
    
    // 2. Query da referendum_abrogativi
    let referendumAbrogativiResult = { rows: [] };
    try {
      let referendumAbrogativiQuery;
      let referendumAbrogativiParams = [];
      
      if (votaOnly) {
        // Per votaOnly: solo quelle con quorum_raggiunto = TRUE
        referendumAbrogativiQuery = `
          SELECT *
          FROM referendum_abrogativi
          WHERE quorum_raggiunto = true
          ORDER BY data_inizio DESC NULLS LAST, nome ASC
        `;
      } else if (soloInCorso) {
        // Per listing: solo quelle con status = 'P' o 'p' (pending, in corso)
        referendumAbrogativiQuery = `
          SELECT *
          FROM referendum_abrogativi
          WHERE (status = 'P' OR status = 'p')
          ORDER BY data_inizio DESC NULLS LAST, nome ASC
        `;
      } else {
        // Per admin o altre viste: tutte tranne le proposte (status != NULL)
        referendumAbrogativiQuery = `
          SELECT *
          FROM referendum_abrogativi
          WHERE status IS NOT NULL
          ORDER BY data_inizio DESC NULLS LAST, nome ASC
        `;
      }
      
      console.log(`🔍 DEBUG: Query referendum_abrogativi:`, referendumAbrogativiQuery);
      referendumAbrogativiResult = await pool.query(referendumAbrogativiQuery, referendumAbrogativiParams);
      console.log(`✅ Recuperati ${referendumAbrogativiResult.rows.length} record da referendum_abrogativi (votaOnly=${votaOnly})`);
      if (referendumAbrogativiResult.rows.length > 0) {
        console.log(`🔍 DEBUG: Prime 3 righe da referendum_abrogativi:`, referendumAbrogativiResult.rows.slice(0, 3).map(r => ({
          id: r.id,
          nome: r.nome?.substring(0, 50),
          status: r.status,
          quorum: r.quorum
        })));
      }
    } catch (error) {
      console.error(`❌ Errore nel recupero referendum_abrogativi:`, error.message);
      console.error(`❌ Stack trace:`, error.stack);
      // Continua senza referendum_abrogativi se c'è un errore
    }
    
    console.log(`✅ ========== RECUPERATI ${result.rows.length} RECORD ==========`);
    console.log(`✅ Tipo: referendum, votaOnly: ${votaOnly}, soloInCorso: ${soloInCorso}, userRole: ${userRole || 'null'}`);
    
    if (result.rows.length > 0) {
      console.log('✅ Prime 3 righe recuperate:');
      result.rows.slice(0, 3).forEach((r, i) => {
        console.log(`   ${i + 1}. ID: ${r.id}, Titolo: ${r.titolo?.substring(0, 60)}..., Tipo: ${r.tipo}, Stato: ${r.stato}, ID Ministero: ${r.id_ministero}`);
      });
    } else {
      console.warn('⚠️ ========== NESSUN RECORD RECUPERATO ==========');
      console.warn('⚠️ La query non ha restituito risultati!');
    }
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
      // Query di debug: usa la stessa condizione tipo della query principale
      const debugTipoCondition = params.length === 0
        ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
        : `tipo LIKE $1`;
      const debugQuery = `
        SELECT 
          COUNT(*) as totale,
          COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
          COUNT(*) FILTER (WHERE stato = 'conclusa') as conclusa,
          COUNT(*) FILTER (WHERE stato IS NULL) as stato_null,
          COUNT(*) FILTER (WHERE id_ministero IS NOT NULL) as con_id_ministero,
            COUNT(*) FILTER (WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%') AND stato = 'in_corso' AND id_ministero IS NOT NULL) as valide
        FROM iniziative_ministero
        WHERE ${debugTipoCondition}
      `;
      const debugResult = await pool.query(debugQuery, params);
      console.log(`🔍 DEBUG REFERENDUM: Statistiche database (tipo LIKE '%Referendum%abrogativo%' OR '%Referendum%costituzionale%'):`, debugResult.rows[0]);
      
      // Query di test diretta per vedere se ci sono risultati
      const testQuery = `
        SELECT id, titolo, tipo, stato, id_ministero, quorum_raggiunto
        FROM iniziative_ministero
        WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')
        ORDER BY stato, data_inizio DESC
        LIMIT 10
      `;
      const testResult = await pool.query(testQuery);
      console.log(`🔍 DEBUG REFERENDUM: Test query diretta restituisce ${testResult.rows.length} risultati:`, testResult.rows.map(r => ({
        id: r.id,
        titolo: r.titolo?.substring(0, 50),
        tipo: r.tipo,
        stato: r.stato,
        id_ministero: r.id_ministero,
        quorum_raggiunto: r.quorum_raggiunto
      })));
      
      // Query per vedere tutti i tipi unici nel database
      const tipiQuery = `
        SELECT DISTINCT tipo, COUNT(*) as count
        FROM iniziative_ministero
        WHERE tipo ILIKE '%referendum%'
        GROUP BY tipo
        ORDER BY count DESC
      `;
      const tipiResult = await pool.query(tipiQuery);
      console.log(`🔍 DEBUG REFERENDUM: Tipi trovati nel database:`, tipiResult.rows);
    }
    
    // Debug: verifica cosa restituisce la query
    if (votaOnly) {
      console.log(`🔍 DEBUG VOTA REFERENDUM: result.rows.length = ${result.rows.length}`);
      if (result.rows.length === 0) {
        console.warn(`⚠️ ATTENZIONE: La query per votaOnly non ha restituito risultati. Verificando nel database...`);
        console.warn(`⚠️ Query eseguita:`, query);
        console.warn(`⚠️ Parametri:`, params);
        // Query di debug per vedere cosa c'è nel database
        // Query di debug: usa la stessa condizione tipo della query principale
        const debugTipoCondition = params.length === 0
          ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
          : `tipo LIKE $1`;
        const debugQuery = `
          SELECT 
            COUNT(*) as totale,
            COUNT(*) FILTER (WHERE quorum_raggiunto = true) as con_quorum,
            COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
            COUNT(*) FILTER (WHERE quorum_raggiunto = true AND stato = 'conclusa' AND firme_raccolte >= 500000) as valide,
            COUNT(*) FILTER (WHERE ${debugTipoCondition} AND quorum_raggiunto = true AND stato = 'conclusa' AND firme_raccolte >= 500000 AND id_ministero IS NOT NULL) as valide_complete
          FROM iniziative_ministero
          WHERE ${debugTipoCondition} AND id_ministero IS NOT NULL
        `;
        const debugResult = await pool.query(debugQuery, params);
        console.log(`🔍 DEBUG VOTA REFERENDUM: Statistiche database:`, debugResult.rows[0]);
        
        // Query di test diretta per vedere se ci sono risultati
        const testQuery = `
          SELECT id, titolo, tipo, stato, id_ministero, quorum_raggiunto, firme_raccolte
          FROM iniziative_ministero
          WHERE tipo LIKE '%Referendum%abrogativo%' 
            AND quorum_raggiunto = true 
            AND stato = 'conclusa' 
            AND firme_raccolte >= 500000
            AND id_ministero IS NOT NULL
          LIMIT 5
        `;
        const testResult = await pool.query(testQuery);
        console.log(`🔍 DEBUG VOTA REFERENDUM: Test query diretta (con quorum_raggiunto = true, stato = 'conclusa', firme_raccolte >= 500000) restituisce ${testResult.rows.length} risultati:`, testResult.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          tipo: r.tipo,
          stato: r.stato,
          id_ministero: r.id_ministero,
          quorum_raggiunto: r.quorum_raggiunto,
          firme_raccolte: r.firme_raccolte,
          quorum_raggiunto_type: typeof r.quorum_raggiunto
        })));
        
        // Query aggiuntiva per vedere tutti i record con stato != 'in_corso' (senza filtro quorum_raggiunto)
        const testQuery2 = `
          SELECT id, titolo, tipo, stato, id_ministero, quorum_raggiunto
          FROM iniziative_ministero
          WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%') 
            AND stato != 'in_corso' 
            AND id_ministero IS NOT NULL
          ORDER BY stato, data_inizio DESC
          LIMIT 10
        `;
        const testResult2 = await pool.query(testQuery2);
        console.log(`🔍 DEBUG VOTA REFERENDUM: Test query 2 (senza filtro quorum_raggiunto) restituisce ${testResult2.rows.length} risultati:`, testResult2.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          tipo: r.tipo,
          stato: r.stato,
          id_ministero: r.id_ministero,
          quorum_raggiunto: r.quorum_raggiunto,
          quorum_raggiunto_type: typeof r.quorum_raggiunto,
          quorum_raggiunto_is_true: r.quorum_raggiunto === true,
          quorum_raggiunto_is_t: r.quorum_raggiunto === 't'
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
        // Query di debug: usa la stessa condizione tipo della query principale
        const debugTipoCondition = params.length === 0
          ? `(tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%')`
          : `tipo LIKE $1`;
        const debugQuery = `
          SELECT 
            COUNT(*) as totale,
            COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
            COUNT(*) FILTER (WHERE stato = 'conclusa') as conclusa,
            COUNT(*) FILTER (WHERE stato IS NULL) as stato_null
          FROM iniziative_ministero
          WHERE ${debugTipoCondition} AND id_ministero IS NOT NULL
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
    // - Solo quelle con quorum_raggiunto = true, stato = 'conclusa' E firme_raccolte >= 500000
    let filteredRows = result.rows;
    if (votaOnly) {
      const beforeFilter = filteredRows.length;
      filteredRows = filteredRows.filter(row => {
        // Solo quelle con quorum_raggiunto = true, stato = 'conclusa' E firme_raccolte >= 500000
        const quorumRaggiunto = row.quorum_raggiunto;
        const hasQuorum = quorumRaggiunto === true || quorumRaggiunto === 't' || quorumRaggiunto === 'true' || quorumRaggiunto === 1;
        return hasQuorum 
          && row.stato === 'conclusa' 
          && (row.firme_raccolte || 0) >= 500000;
      });
      const afterFilter = filteredRows.length;
      
      if (beforeFilter !== afterFilter) {
        console.warn(`⚠️ FILTRO SICUREZZA: Rimosse ${beforeFilter - afterFilter} referendum che non rispettano i criteri (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => {
          // Rimuove quelle con stato != 'conclusa' O quorum_raggiunto != true O firme_raccolte < 500000
          const quorumRaggiunto = row.quorum_raggiunto;
          const hasQuorum = quorumRaggiunto === true || quorumRaggiunto === 't' || quorumRaggiunto === 'true' || quorumRaggiunto === 1;
          return row.stato !== 'conclusa' 
            || !hasQuorum 
            || (row.firme_raccolte || 0) < 500000;
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
        
        // Verifica che tutte abbiano stato = 'conclusa'
        const notConclusa = filteredRows.filter(r => r.stato !== 'conclusa');
        if (notConclusa.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${notConclusa.length} referendum con stato != 'conclusa' dopo il filtro sicurezza:`, notConclusa.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), stato: r.stato })));
        }
        
        // Verifica che tutti abbiano quorum_raggiunto = true
        const noQuorum = filteredRows.filter(r => {
          const quorumRaggiunto = r.quorum_raggiunto;
          return !(quorumRaggiunto === true || quorumRaggiunto === 't' || quorumRaggiunto === 'true' || quorumRaggiunto === 1);
        });
        if (noQuorum.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${noQuorum.length} referendum con quorum_raggiunto != true dopo il filtro sicurezza:`, noQuorum.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto })));
        }
        
        // Verifica che tutte abbiano firme_raccolte >= 500000
        const insufficientFirme = filteredRows.filter(r => (r.firme_raccolte || 0) < 500000);
        if (insufficientFirme.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovati ${insufficientFirme.length} referendum con firme_raccolte < 500000 dopo il filtro sicurezza:`, insufficientFirme.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), firme_raccolte: r.firme_raccolte })));
        }
      }
    } else if (soloInCorso) {
      // Filtro di sicurezza per la pagina listing: ESCLUDE TUTTE quelle con stato != 'in_corso'
      // NOTA: Questo blocco viene eseguito solo se soloInCorso = true
      // Ma ora abbiamo impostato soloInCorso = false per mostrare tutti i referendum
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
    } else {
      // Per la pagina listing (soloInCorso = false), mostriamo TUTTI i referendum
      // Non applichiamo filtri aggiuntivi, la query SQL già filtra correttamente
      console.log(`🔍 DEBUG LISTING REFERENDUM: Mostrando tutti i referendum (in corso e conclusi) - filteredRows.length = ${filteredRows.length}`);
      if (filteredRows.length > 0) {
        console.log(`🔍 DEBUG LISTING REFERENDUM: Prime 3 righe:`, filteredRows.slice(0, 3).map(r => ({ 
          id: r.id, 
          titolo: r.titolo?.substring(0, 50), 
          stato: r.stato,
          id_ministero: r.id_ministero,
          tipo: r.tipo
        })));
      } else {
        console.warn(`⚠️ ATTENZIONE: filteredRows è vuoto! result.rows.length = ${result.rows.length}`);
        if (result.rows.length > 0) {
          console.warn(`⚠️ Prime 3 righe da result.rows:`, result.rows.slice(0, 3).map(r => ({ 
            id: r.id, 
            titolo: r.titolo?.substring(0, 50), 
            stato: r.stato,
            id_ministero: r.id_ministero,
            tipo: r.tipo
          })));
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
    // 1. Normalizza dati da iniziative_ministero
    const normalizedMinistero = filteredRows.map(row => mapToLegacyFormat(row, 'referendum'));
    
    // 2. Normalizza dati da referendum_abrogativi
    let normalizedReferendum = [];
    if (referendumAbrogativiResult.rows.length > 0) {
      // Applica gli stessi filtri di sicurezza anche a referendum_abrogativi
      let filteredReferendum = referendumAbrogativiResult.rows;
      
      if (votaOnly) {
        // Filtro sicurezza: solo quelle con quorum_raggiunto = TRUE
        filteredReferendum = filteredReferendum.filter(row => {
          return row.quorum_raggiunto === true;
        });
      } else if (soloInCorso) {
        // Filtro sicurezza: solo quelle in corso (status = 'P' o 'p')
        filteredReferendum = filteredReferendum.filter(row => {
          return row.status === 'P' || row.status === 'p';
        });
      }
      
      normalizedReferendum = filteredReferendum.map(row => mapReferendumAbrogativiToLegacyFormat(row));
      console.log(`✅ Normalizzate ${normalizedReferendum.length} referendum da referendum_abrogativi`);
    }
    
    // 3. Unisci i risultati (rimuovi duplicati per ID)
    const allNormalized = [...normalizedMinistero, ...normalizedReferendum];
    const uniqueNormalized = allNormalized.reduce((acc, current) => {
      const existing = acc.find(item => item.id === current.id);
      if (!existing) {
        acc.push(current);
      } else {
        // Se esiste già, preferisci quella da iniziative_ministero (più aggiornata)
        const index = acc.indexOf(existing);
        if (normalizedMinistero.some(m => m.id === current.id)) {
          acc[index] = current;
        }
      }
      return acc;
    }, []);
    
    let normalizedData = uniqueNormalized;
    console.log(`✅ Totale referendum normalizzati: ${normalizedData.length} (${normalizedMinistero.length} da ministero, ${normalizedReferendum.length} da referendum_abrogativi)`);
    
    // Aggiungi emoji automatiche a tutti i referendum
    normalizedData = normalizedData.map(referendum => {
      const emoji = getEmojiAutomaticaReferendum(referendum);
      return {
        ...referendum,
        emoji: emoji
      };
    });

    // Genera la classifica basata sui voti da ENTRAMBE le tabelle
    let classifica = [];
    console.log(`🔍 DEBUG CLASSIFICA: normalizedData.length = ${normalizedData.length}, votaOnly = ${votaOnly}`);
    if (normalizedData.length > 0) {
      try {
        // Costruisci la query di classifica con UNION per includere entrambe le tabelle
        // Per la pagina listing: mostra solo quelle con stato = 'in_corso'
        // Per la pagina vota: quorum_raggiunto = TRUE E ESCLUDE TUTTE quelle con stato = 'in_corso'
        const quorumFilterMinistero = votaOnly 
          ? 'AND im.quorum_raggiunto = true AND im.stato = \'conclusa\' AND im.firme_raccolte >= 500000'
          : 'AND im.stato = \'in_corso\'';
        
        // Per votaOnly, la query della classifica deve includere TUTTI i referendum
        // che sono in normalizedData, indipendentemente dal loro quorum_raggiunto
        // perché vengono mostrati nella pagina e devono avere i voti contati
        const referendumIdsFromNormalized = normalizedData
          .filter(r => {
            // Solo quelli che provengono da referendum_abrogativi (non da iniziative_ministero)
            // perché quelli da iniziative_ministero sono già gestiti nella prima parte della UNION
            const isFromAbrogativi = normalizedReferendum.some(ra => String(ra.id) === String(r.id));
            return isFromAbrogativi;
          })
          .map(r => String(r.id));
        
        // Per votaOnly, includiamo TUTTI i referendum mostrati nella pagina
        // anche se hanno quorum_raggiunto = false, perché vengono mostrati comunque
        const quorumFilterReferendum = votaOnly
          ? referendumIdsFromNormalized.length > 0
            ? `AND (ra.quorum_raggiunto = true OR ra.id::text = ANY($1::text[]))`
            : `AND ra.quorum_raggiunto = true`
          : `AND (ra.status = 'P' OR ra.status = 'p')`;
        
        // Parametri per la query (solo se necessario)
        const classificaParams = votaOnly && referendumIdsFromNormalized.length > 0
          ? [referendumIdsFromNormalized]
          : [];
        
        console.log('🔍 DEBUG CLASSIFICA - referendumIdsFromNormalized:', referendumIdsFromNormalized);
        console.log('🔍 DEBUG CLASSIFICA - normalizedReferendum.length:', normalizedReferendum.length);
        console.log('🔍 DEBUG CLASSIFICA - normalizedData.length:', normalizedData.length);
        
        const classificaQuery = `
          (
            SELECT 
              im.titolo as nome,
              im.sito_web as sitoWeb,
              COALESCE(im.firme_raccolte, 0) as firme,
              COUNT(vra.referendum_id) as voti
            FROM iniziative_ministero im
            LEFT JOIN voti_referendum_abrogativi vra ON (
              im.id::text = vra.referendum_id::text OR 
              REPLACE(im.id::text, '-', '') = vra.referendum_id::text OR
              im.id::text = REPLACE(vra.referendum_id::text, '-', '') OR
              REPLACE(im.id::text, '-', '') = REPLACE(vra.referendum_id::text, '-', '')
            )
            WHERE (im.tipo LIKE '%Referendum%abrogativo%' OR im.tipo LIKE '%Referendum%costituzionale%')
              AND im.id_ministero IS NOT NULL
              ${quorumFilterMinistero}
            GROUP BY im.id, im.titolo, im.sito_web, im.firme_raccolte
          )
          UNION ALL
          (
            SELECT 
              ra.nome,
              COALESCE(ra.sito_web, ra.sitoweb) as sitoWeb,
              COALESCE(ra.firme, 0) as firme,
              COUNT(vra2.referendum_id) as voti
            FROM referendum_abrogativi ra
            LEFT JOIN voti_referendum_abrogativi vra2 ON (
              ra.id::text = vra2.referendum_id::text OR 
              REPLACE(ra.id::text, '-', '') = vra2.referendum_id::text OR
              ra.id::text = REPLACE(vra2.referendum_id::text, '-', '') OR
              REPLACE(ra.id::text, '-', '') = REPLACE(vra2.referendum_id::text, '-', '') OR
              (ra.firestore_id_backup IS NOT NULL AND (ra.firestore_id_backup::text = vra2.referendum_id::text OR REPLACE(ra.firestore_id_backup::text, '-', '') = REPLACE(vra2.referendum_id::text, '-', '')))
            )
            WHERE 1=1
              ${quorumFilterReferendum}
            GROUP BY ra.id, ra.nome, ra.sito_web, ra.sitoweb, ra.firme
          )
          ORDER BY firme DESC NULLS LAST, voti DESC, nome ASC
        `;
        
        console.log('🔍 DEBUG - Esecuzione query classifica referendum (con UNION)');
        console.log('🔍 DEBUG - Query classifica:', classificaQuery.substring(0, 500));
        console.log('🔍 DEBUG - quorumFilterMinistero:', quorumFilterMinistero);
        console.log('🔍 DEBUG - quorumFilterReferendum:', quorumFilterReferendum);
        console.log('🔍 DEBUG - referendumIdsFromNormalized:', referendumIdsFromNormalized);
        console.log('🔍 DEBUG - classificaParams:', classificaParams);
        
        // Test: verifica se ci sono voti che corrispondono ai referendum in normalizedData
        if (normalizedData.length > 0 && debugVotiResult.rows.length > 0) {
          console.log('🔍 DEBUG - Test matching voti con referendum in normalizedData:');
          normalizedData.forEach(ref => {
            const refId = String(ref.id);
            const refIdNoDash = refId.replace(/-/g, '');
            debugVotiResult.rows.forEach(voto => {
              const votoId = String(voto.referendum_id);
              const votoIdNoDash = votoId.replace(/-/g, '');
              if (refId === votoId || refIdNoDash === votoIdNoDash || refId === votoIdNoDash || refIdNoDash === votoId) {
                console.log(`✅ MATCH POTENZIALE: "${ref.nome?.substring(0, 50)}" (ID: ${refId}) <-> Voto ID: ${votoId} (count: ${voto.count})`);
              }
            });
          });
        }
        
        const classificaResult = await pool.query(classificaQuery, classificaParams);
        console.log('🔍 DEBUG - Risultati classifica raw referendum:', classificaResult.rows);
        console.log('🔍 DEBUG - Numero risultati classifica:', classificaResult.rows.length);
        
        // Per votaOnly, creiamo SEMPRE la classifica basata su normalizedData
        // perché la query SQL potrebbe non includere tutti i referendum mostrati
        if (votaOnly && normalizedData.length > 0) {
          console.log('🔍 DEBUG - votaOnly=true, creo classifica da normalizedData');
          
          // Crea una classifica basata direttamente su normalizedData
          const classificaAlternativa = await Promise.all(normalizedData.map(async (ref) => {
            const refId = String(ref.id);
            const refIdNoDash = refId.replace(/-/g, '');
            const votiQuery = `
              SELECT COUNT(*) as count 
              FROM voti_referendum_abrogativi 
              WHERE referendum_id::text = $1 
                 OR REPLACE(referendum_id::text, '-', '') = $2
                 OR referendum_id::text = $3
                 OR REPLACE(referendum_id::text, '-', '') = $4
            `;
            const votiResult = await pool.query(votiQuery, [refId, refIdNoDash, refIdNoDash, refId]);
            const votiCount = parseInt(votiResult.rows[0]?.count || 0);
            
            return {
              nome: ref.nome || ref.titolo,
              sitoWeb: ref.sitoWeb || ref.sito_web || ref.sitoweb,
              voti: votiCount,
              emoji: ref.emoji || getEmojiAutomaticaReferendum(ref)
            };
          }));
          
          // Ordina per voti (decrescente) e poi per firme (decrescente)
          classificaAlternativa.sort((a, b) => {
            if (b.voti !== a.voti) return b.voti - a.voti;
            const refA = normalizedData.find(r => (r.nome || r.titolo) === a.nome);
            const refB = normalizedData.find(r => (r.nome || r.titolo) === b.nome);
            const firmeA = refA?.firme_raccolte || refA?.firme || 0;
            const firmeB = refB?.firme_raccolte || refB?.firme || 0;
            return firmeB - firmeA;
          });
          
          console.log(`✅ DEBUG - Classifica creata da normalizedData con ${classificaAlternativa.length} referendum:`, classificaAlternativa.map(c => ({ nome: c.nome?.substring(0, 50), voti: c.voti })));
          classifica = classificaAlternativa;
        } else if (classificaResult.rows.length === 0 && normalizedData.length > 0) {
          // Fallback: se la query non ha restituito risultati, usa normalizedData
          console.warn('⚠️ DEBUG - La query della classifica non ha restituito risultati, creo classifica alternativa da normalizedData');
          
          const classificaAlternativa = await Promise.all(normalizedData.map(async (ref) => {
            const refId = String(ref.id);
            const refIdNoDash = refId.replace(/-/g, '');
            const votiQuery = `
              SELECT COUNT(*) as count 
              FROM voti_referendum_abrogativi 
              WHERE referendum_id::text = $1 
                 OR REPLACE(referendum_id::text, '-', '') = $2
                 OR referendum_id::text = $3
                 OR REPLACE(referendum_id::text, '-', '') = $4
            `;
            const votiResult = await pool.query(votiQuery, [refId, refIdNoDash, refIdNoDash, refId]);
            const votiCount = parseInt(votiResult.rows[0]?.count || 0);
            
            return {
              nome: ref.nome || ref.titolo,
              sitoWeb: ref.sitoWeb || ref.sito_web || ref.sitoweb,
              voti: votiCount,
              emoji: ref.emoji || getEmojiAutomaticaReferendum(ref)
            };
          }));
          
          classificaAlternativa.sort((a, b) => {
            if (b.voti !== a.voti) return b.voti - a.voti;
            const refA = normalizedData.find(r => (r.nome || r.titolo) === a.nome);
            const refB = normalizedData.find(r => (r.nome || r.titolo) === b.nome);
            const firmeA = refA?.firme_raccolte || refA?.firme || 0;
            const firmeB = refB?.firme_raccolte || refB?.firme || 0;
            return firmeB - firmeA;
          });
          
          console.log(`✅ DEBUG - Classifica alternativa creata con ${classificaAlternativa.length} referendum:`, classificaAlternativa.map(c => ({ nome: c.nome?.substring(0, 50), voti: c.voti })));
          classifica = classificaAlternativa;
        }
        
        // Debug: verifica se i risultati della classifica corrispondono ai referendum in normalizedData
        if (classificaResult.rows.length > 0) {
          console.log('🔍 DEBUG - Risultati classifica per nome:', classificaResult.rows.map(r => ({
            nome: r.nome?.substring(0, 50),
            voti: r.voti,
            firme: r.firme
          })));
        } else if (normalizedData.length > 0) {
          console.warn('⚠️ DEBUG - La classifica è vuota ma ci sono referendum in normalizedData!');
          console.warn('⚠️ DEBUG - Verifica se i referendum in normalizedData corrispondono ai filtri della query:');
          normalizedData.forEach(ref => {
            const refId = String(ref.id);
            const isFromMinistero = normalizedMinistero.some(m => String(m.id) === refId);
            const isFromAbrogativi = normalizedReferendum.some(r => String(r.id) === refId);
            console.warn(`⚠️   - "${ref.nome?.substring(0, 50)}" (ID: ${refId}): da ministero=${isFromMinistero}, da abrogativi=${isFromAbrogativi}, quorum=${ref.quorum_raggiunto}, stato=${ref.stato}, firme=${ref.firme_raccolte || ref.firme}`);
          });
        }
        
        // Debug: verifica tutti i voti nel database
        const debugVotiQuery = 'SELECT referendum_id, COUNT(*) as count FROM voti_referendum_abrogativi GROUP BY referendum_id';
        const debugVotiResult = await pool.query(debugVotiQuery);
        console.log('🔍 DEBUG - Tutti i voti per referendum_id:', debugVotiResult.rows);
        console.log('🔍 DEBUG - Numero totale di voti nel database:', debugVotiResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0));
        
        // Debug: verifica i referendum in normalizedData
        console.log('🔍 DEBUG - Referendum in normalizedData:', normalizedData.map(r => ({
          id: r.id,
          idText: String(r.id),
          idNoDash: String(r.id).replace(/-/g, ''),
          nome: r.nome?.substring(0, 50),
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato,
          firme_raccolte: r.firme_raccolte
        })));
        
        // Debug: verifica gli ID dei referendum in iniziative_ministero
        const debugQuorumFilter = votaOnly 
          ? 'AND quorum_raggiunto = true AND stato = \'conclusa\' AND firme_raccolte >= 500000'
          : 'AND stato = \'in_corso\'';
        const debugReferendumQuery = `SELECT id, titolo as nome, stato, quorum_raggiunto, firme_raccolte FROM iniziative_ministero WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%') AND id_ministero IS NOT NULL ${debugQuorumFilter} ORDER BY firme_raccolte DESC NULLS LAST`;
        const debugReferendumResult = await pool.query(debugReferendumQuery);
        console.log('🔍 DEBUG - ID referendum in iniziative_ministero (con filtri):', debugReferendumResult.rows.map(r => ({ id: r.id, id_text: r.id.toString(), nome: r.nome?.substring(0, 50), stato: r.stato, quorum: r.quorum_raggiunto, firme: r.firme_raccolte })));
        
        // Debug: verifica gli ID dei referendum in referendum_abrogativi
        const debugReferendumAbrogativiQuery = votaOnly
          ? `SELECT id, nome, quorum_raggiunto, firme FROM referendum_abrogativi WHERE quorum_raggiunto = true ORDER BY firme DESC NULLS LAST`
          : `SELECT id, nome, quorum_raggiunto, firme FROM referendum_abrogativi WHERE (status = 'P' OR status = 'p') ORDER BY firme DESC NULLS LAST`;
        const debugReferendumAbrogativiResult = await pool.query(debugReferendumAbrogativiQuery);
        console.log('🔍 DEBUG - ID referendum in referendum_abrogativi (con filtri):', debugReferendumAbrogativiResult.rows.map(r => ({ id: r.id, id_text: r.id.toString(), nome: r.nome?.substring(0, 50), quorum: r.quorum_raggiunto, firme: r.firme })));
        
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
        
        classifica = classificaResult.rows.map(row => {
          // Trova il referendum corrispondente per ottenere l'emoji
          // Prova prima per nome esatto, poi per nome normalizzato (trim, lowercase), poi per sitoWeb
          let referendum = normalizedData.find(r => 
            r.nome === row.nome || 
            r.titolo === row.nome
          );
          
          // Se non trova, prova con normalizzazione (trim, lowercase)
          if (!referendum) {
            const rowNomeNormalized = String(row.nome || '').toLowerCase().trim();
            referendum = normalizedData.find(r => {
              const nomeNormalized = String(r.nome || '').toLowerCase().trim();
              const titoloNormalized = String(r.titolo || '').toLowerCase().trim();
              return nomeNormalized === rowNomeNormalized || titoloNormalized === rowNomeNormalized;
            });
          }
          
          // Se ancora non trova, prova per sitoWeb
          if (!referendum && row.sitoweb) {
            referendum = normalizedData.find(r => 
              r.sitoWeb && (r.sitoWeb === row.sitoweb || r.sitoWeb === row.sito_web || r.sito_web === row.sitoweb)
            );
          }
          
          // Genera sempre un'emoji (usa quella trovata o genera una nuova)
          const emoji = referendum?.emoji || getEmojiAutomaticaReferendum({ nome: row.nome });
          
          const votiCount = parseInt(row.voti) || 0;
          console.log(`🔍 DEBUG CLASSIFICA - Referendum "${row.nome?.substring(0, 50)}": ${votiCount} voti`);
          
          return {
            nome: row.nome,
            sitoWeb: row.sitoweb || row.sito_web || row.sitoWeb,
            voti: votiCount,
            emoji: emoji
          };
        });
        console.log(`✅ Generata classifica con ${classifica.length} referendum (da entrambe le tabelle):`, classifica.map(c => ({ nome: c.nome?.substring(0, 50), voti: c.voti })));
        
        // Debug: verifica che tutti i referendum nella classifica abbiano un'emoji
        const classificaSenzaEmoji = classifica.filter(c => !c.emoji);
        if (classificaSenzaEmoji.length > 0) {
          console.warn(`⚠️ ATTENZIONE: ${classificaSenzaEmoji.length} referendum nella classifica senza emoji:`, classificaSenzaEmoji.map(c => c.nome));
        } else if (classifica.length > 0) {
          console.log(`✅ Tutti i ${classifica.length} referendum nella classifica hanno un'emoji`);
        }
        
        // Debug: verifica se ci sono referendum in normalizedData che non sono nella classifica
        if (normalizedData.length > classifica.length) {
          console.warn(`⚠️ ATTENZIONE: Ci sono ${normalizedData.length} referendum in normalizedData ma solo ${classifica.length} nella classifica!`);
          const nomiInNormalized = normalizedData.map(r => r.nome);
          const nomiInClassifica = classifica.map(c => c.nome);
          const mancanti = nomiInNormalized.filter(nome => !nomiInClassifica.includes(nome));
          if (mancanti.length > 0) {
            console.warn(`⚠️ Referendum in normalizedData ma non in classifica:`, mancanti.map(n => n?.substring(0, 50)));
          }
        }
        
        // Debug: verifica se la classifica è vuota e perché
        if (classifica.length === 0 && classificaResult.rows.length === 0) {
          console.warn(`⚠️ ATTENZIONE: La query della classifica non ha restituito risultati!`);
          console.warn(`⚠️ Verifica i filtri: quorumFilterMinistero = "${quorumFilterMinistero}", quorumFilterReferendum = "${quorumFilterReferendum}"`);
          console.warn(`⚠️ normalizedData contiene ${normalizedData.length} referendum, ma la query della classifica non trova risultati`);
        } else if (classifica.length === 0 && classificaResult.rows.length > 0) {
          console.warn(`⚠️ ATTENZIONE: La query ha restituito ${classificaResult.rows.length} risultati, ma la classifica è vuota dopo il mapping!`);
        }
      } catch (classificaError) {
        console.log('⚠️ Errore nella generazione classifica, continuando senza:', classificaError.message);
        // Se la classifica fallisce, continua senza di essa
        classifica = [];
      }
    }

    // Aggiungi informazioni di debug nella risposta (sempre, per capire il problema)
    let debugStats = null;
    if (result.rows.length === 0) {
      // Esegui query di debug per vedere cosa c'è nel database
      try {
        const debugStatsQuery = `
          SELECT 
            COUNT(*) as totale,
            COUNT(*) FILTER (WHERE tipo ILIKE '%referendum%') as tipo_referendum,
            COUNT(*) FILTER (WHERE tipo ILIKE '%referendum%' AND stato = 'in_corso') as in_corso,
            COUNT(*) FILTER (WHERE tipo ILIKE '%referendum%' AND id_ministero IS NOT NULL) as con_id_ministero,
            COUNT(*) FILTER (WHERE tipo ILIKE '%referendum%' AND stato = 'in_corso' AND id_ministero IS NOT NULL) as valide
          FROM iniziative_ministero
        `;
        const debugStatsResult = await pool.query(debugStatsQuery);
        debugStats = debugStatsResult.rows[0];
      } catch (e) {
        console.error('Errore query debug stats:', e);
      }
    }
    
    // Esegui anche una query di test diretta per vedere cosa c'è nel database
    let testQueryResult = null;
    if (result.rows.length === 0) {
      try {
        const testQuery = `
          SELECT id, titolo, tipo, stato, id_ministero, quorum_raggiunto
          FROM iniziative_ministero
          WHERE tipo ILIKE '%referendum%'
            AND id_ministero IS NOT NULL
            AND stato != 'in_corso'
          ORDER BY stato, data_inizio DESC
          LIMIT 5
        `;
        const testResult = await pool.query(testQuery);
        testQueryResult = testResult.rows.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 60),
          tipo: r.tipo,
          stato: r.stato,
          id_ministero: r.id_ministero,
          quorum_raggiunto: r.quorum_raggiunto
        }));
        console.log('🔍 DEBUG - testQueryResult con quorum_raggiunto:', testQueryResult);
      } catch (e) {
        console.error('Errore query test:', e);
      }
    }
    
    const debugInfo = {
      query: query, // Query completa
      params: params,
      resultRowsCount: result.rows.length,
      filteredRowsCount: filteredRows.length,
      normalizedDataCount: normalizedData.length,
      votaOnly: votaOnly,
      soloInCorso: soloInCorso,
      userRole: userRole || 'null',
      debugStats: debugStats,
      testQueryResult: testQueryResult // Risultati query di test
    };
    
    const responseData = {
      success: true,
      richieste: normalizedData,
      referendum: normalizedData, // Alias per compatibilità
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: { isBlocked: false, unlockDate: null },
      debug: debugInfo // Sempre incluso per debug
    };
    
    // Log esplicito del debug per vedere nella console del server
    console.log('🔍 ========== DEBUG INFO PER CLIENT ==========');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    console.log(`🔍 ========== RISPOSTA FINALE ==========`);
    console.log(`🔍 richieste.length = ${normalizedData.length}`);
    console.log(`🔍 referendum.length = ${normalizedData.length}`);
    console.log(`🔍 classifica.length = ${classifica.length}`);
    console.log(`🔍 mieiVoti.length = ${mieiVoti.length}`);
    console.log(`🔍 filteredRows.length = ${filteredRows.length}`);
    console.log(`🔍 result.rows.length = ${result.rows.length}`);
    
    if (normalizedData.length > 0) {
      console.log(`✅ ========== REFERENDUM NORMALIZZATI ==========`);
      normalizedData.slice(0, 3).forEach((r, i) => {
        console.log(`   ${i + 1}. ID: ${r.id}, Nome: ${r.nome?.substring(0, 60)}..., Stato: ${r.stato}, Tipo: ${r.tipo}`);
      });
    } else {
      console.error(`❌ ========== ERRORE: NORMALIZED DATA VUOTO ==========`);
      console.error(`❌ filteredRows.length = ${filteredRows.length}`);
      console.error(`❌ result.rows.length = ${result.rows.length}`);
      if (result.rows.length > 0) {
        console.error(`❌ Prime 3 righe da result.rows (prima della normalizzazione):`);
        result.rows.slice(0, 3).forEach((r, i) => {
          console.error(`   ${i + 1}. ID: ${r.id}, Titolo: ${r.titolo?.substring(0, 60)}..., Tipo: ${r.tipo}, Stato: ${r.stato}, ID Ministero: ${r.id_ministero}`);
        });
      } else {
        console.error(`❌ La query SQL non ha restituito risultati!`);
      }
    }
    
    console.log(`🔍 ========== INVIO RISPOSTA AL CLIENT ==========`);
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
    
    // Verifica che gli ID dei referendum esistano in ENTRAMBE le tabelle
    if (votiDaSalvare.length > 0) {
      // Per votare, il referendum deve:
      // - Da iniziative_ministero: quorum_raggiunto = TRUE, stato = 'conclusa' E firme_raccolte >= 500000
      // - Da referendum_abrogativi: quorum_raggiunto = TRUE
      // Verifica prima in iniziative_ministero
      const referendumCheckQueryMinistero = `
        SELECT id::text as id FROM iniziative_ministero 
        WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%') 
          AND id_ministero IS NOT NULL 
          AND quorum_raggiunto = true 
          AND stato = 'conclusa' 
          AND firme_raccolte >= 500000 
          AND (id::text = ANY($1) OR REPLACE(id::text, '-', '') = ANY(SELECT REPLACE(unnest($1::text[]), '-', '')))
      `;
      const referendumCheckResultMinistero = await client.query(referendumCheckQueryMinistero, [votiDaSalvare]);
      
      // Verifica poi in referendum_abrogativi
      // Per votare, il referendum deve avere quorum_raggiunto = TRUE
      const referendumCheckQueryAbrogativi = `
        SELECT id::text as id FROM referendum_abrogativi 
        WHERE quorum_raggiunto = true 
          AND (id::text = ANY($1) OR REPLACE(id::text, '-', '') = ANY(SELECT REPLACE(unnest($1::text[]), '-', '')))
      `;
      const referendumCheckResultAbrogativi = await client.query(referendumCheckQueryAbrogativi, [votiDaSalvare]);
      
      // Combina i risultati
      const allFoundIds = [
        ...referendumCheckResultMinistero.rows.map(r => r.id),
        ...referendumCheckResultAbrogativi.rows.map(r => r.id)
      ];
      
      console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Referendum trovati in iniziative_ministero:', referendumCheckResultMinistero.rows.map(r => r.id));
      console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Referendum trovati in referendum_abrogativi:', referendumCheckResultAbrogativi.rows.map(r => r.id));
      console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Referendum richiesti:', votiDaSalvare);
      
      // Verifica che tutti gli ID dei referendum esistano (con matching flessibile)
      const missingIds = votiDaSalvare.filter(id => {
        const idString = String(id);
        const idNoDash = idString.replace(/-/g, '');
        return !allFoundIds.some(foundId => {
          const foundIdString = String(foundId);
          const foundIdNoDash = foundIdString.replace(/-/g, '');
          return foundIdString === idString || foundIdNoDash === idNoDash || foundIdString === idNoDash || foundIdNoDash === idString;
        });
      });
      
      if (missingIds.length > 0) {
        console.error('❌ DEBUG /api/referendum-abrogativi/vota - ID referendum non trovati:', missingIds);
        console.error('❌ DEBUG /api/referendum-abrogativi/vota - ID trovati:', allFoundIds);
        
        // Debug: verifica se il referendum esiste ma non rispetta i criteri
        for (const missingId of missingIds) {
          const debugQuery = `
            SELECT id, quorum_raggiunto, stato, firme_raccolte, tipo 
            FROM iniziative_ministero 
            WHERE id::text = $1 OR REPLACE(id::text, '-', '') = $2
            UNION ALL
            SELECT id::text, quorum_raggiunto, stato, firme, 'referendum_abrogativi' as tipo
            FROM referendum_abrogativi 
            WHERE id::text = $1 OR REPLACE(id::text, '-', '') = $2
          `;
          const debugResult = await client.query(debugQuery, [missingId, String(missingId).replace(/-/g, '')]);
          if (debugResult.rows.length > 0) {
            console.error(`❌ DEBUG - Referendum ${missingId} esiste ma non rispetta i criteri:`, debugResult.rows[0]);
          } else {
            console.error(`❌ DEBUG - Referendum ${missingId} non esiste in nessuna tabella`);
          }
        }
        
        return res.status(400).json({
          success: false,
          error: `Alcuni referendum non esistono o non rispettano i criteri: ${missingIds.join(', ')}`
        });
      }
    }
    
    await client.query('BEGIN');
    
    // Prima cancella TUTTI i voti esistenti dell'utente (sia come UUID che come text)
    // Questo garantisce che l'utente abbia sempre massimo 1 voto
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
        const refInfoQuery = `SELECT id, titolo as nome FROM iniziative_ministero WHERE (tipo LIKE '%Referendum%abrogativo%' OR tipo LIKE '%Referendum%costituzionale%') AND (id::text = $1 OR id = $1)`;
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
        console.log(`🔍 DEBUG /api/referendum-abrogativi/vota - Tentativo inserimento con:`, {
          userId: userId,
          userIdType: typeof userId,
          referendumId: referendumId,
          referendumIdString: referendumIdString,
          referendumIdStringType: typeof referendumIdString
        });
        
        try {
          const insertResult = await client.query(
            'INSERT INTO voti_referendum_abrogativi (userid, referendum_id, timestamp, created_at, updated_at) VALUES ($1::uuid, $2, NOW(), NOW(), NOW()) RETURNING id',
            [userId, referendumIdString]
          );
          console.log(`✅ DEBUG /api/referendum-abrogativi/vota - Voto inserito con successo:`, {
            id: insertResult.rows[0]?.id,
            referendumId: referendumId,
            referendumIdString: referendumIdString,
            userId: userId
          });
        } catch (insertError) {
          console.error(`❌ DEBUG /api/referendum-abrogativi/vota - Errore durante inserimento:`, {
            error: insertError.message,
            code: insertError.code,
            detail: insertError.detail,
            hint: insertError.hint,
            userId: userId,
            referendumId: referendumId,
            referendumIdString: referendumIdString
          });
          throw insertError;
        }
      } else {
        console.log(`🔍 DEBUG /api/referendum-abrogativi/vota - Nessun voto da inserire (array vuoto)`);
      }
    
    await client.query('COMMIT');
    
    console.log('✅ DEBUG /api/referendum-abrogativi/vota - Voti salvati con successo');
    
    // Verifica che il voto sia stato effettivamente salvato
    const verifyQuery = `
      SELECT referendum_id FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
      ORDER BY timestamp DESC, created_at DESC
      LIMIT 1
    `;
    const verifyResult = await client.query(verifyQuery, [userId]);
    console.log('🔍 DEBUG /api/referendum-abrogativi/vota - Verifica voto salvato:', verifyResult.rows);
    
    res.json({
      success: true,
      message: 'Voti salvati con successo',
      savedVote: verifyResult.rows.length > 0 ? verifyResult.rows[0].referendum_id : null
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

// DELETE /api/referendum-abrogativi/vota - Cancella il voto dell'utente
router.delete('/vota', verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta'
      });
    }
    
    // Verifica se l'utente è admin (gli admin possono sempre cancellare)
    const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
    const userResult = await client.query(userQuery, [userId]);
    const userRole = userResult.rows[0]?.ruolo;
    const isAdmin = userRole === 'AD' || userRole === 'Admin';
    
    // Se non è admin, verifica il blocco settimanale
    if (!isAdmin) {
      const bloccoQuery = `
        SELECT 
          CASE 
            WHEN MAX(timestamp) > NOW() - INTERVAL '7 days' THEN true
            ELSE false
          END as is_blocked,
          MAX(timestamp) + INTERVAL '7 days' as unlock_date
        FROM voti_referendum_abrogativi
        WHERE userid::text = $1 OR userid = $1::uuid
      `;
      const bloccoResult = await client.query(bloccoQuery, [userId]);
      
      if (bloccoResult.rows.length > 0 && bloccoResult.rows[0].is_blocked) {
        const unlockDate = bloccoResult.rows[0].unlock_date;
        return res.status(400).json({
          success: false,
          error: 'Non puoi modificare il voto prima di 7 giorni dall\'ultimo voto',
          unlockDate: unlockDate ? new Date(unlockDate).toISOString() : null
        });
      }
    }
    
    await client.query('BEGIN');
    
    // Cancella tutti i voti dell'utente
    const deleteQuery = `
      DELETE FROM voti_referendum_abrogativi 
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [userId]);
    
    await client.query('COMMIT');
    
    console.log(`✅ DEBUG /api/referendum-abrogativi/vota DELETE - Voti eliminati: ${deleteResult.rowCount} (utente: ${userId}, admin: ${isAdmin})`);
    
    res.json({
      success: true,
      message: 'Voto cancellato con successo',
      deletedCount: deleteResult.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK').catch(err => {
      console.error('❌ Errore nel ROLLBACK:', err);
    });
    console.error('❌ Errore nella cancellazione voto referendum abrogativi:', error);
    console.error('❌ Stack trace:', error.stack);
    
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
