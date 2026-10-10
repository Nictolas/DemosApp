const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getPreferenceCooldown, assertPreferenceChangeAllowed, recordPreferenceChange, sendCooldownError } = require('../services/preferenceCooldownService');
const jwt = require('jsonwebtoken');
const { mapToLegacyFormat, buildQueryForTipo, mapIniziativePopolariToLegacyFormat } = require('../utils/iniziativeMinisteroMapper');
const { getPool } = require('../config/database');
const { resolveIniziativaDataFine } = require('../utils/dateUtils');
const { getLegacyQueryProfile } = require('../services/civicProcessRegistryService');
const {
  getPrioritySourceStatus,
  listPriorityEligiblePopularInitiatives,
  getPriorityEligiblePopularInitiative,
  getCurrentPopularInitiativeVote,
  getCurrentEligiblePopularInitiativeVote,
  isMissingCivicSchemaError,
} = require('../services/civicProcessReadService');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();
const INIZIATIVA_PROCESS_PROFILE = getLegacyQueryProfile('iniziativa');
const INIZIATIVA_FIRME_MINIME = INIZIATIVA_PROCESS_PROFILE?.signatureThreshold;
if (!Number.isFinite(INIZIATIVA_FIRME_MINIME)) {
  throw new Error('Configurazione civic process mancante per iniziativa popolare italiana');
}
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};
const debugWarn = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.warn(...args);
};

// ===== FUNZIONE PER GENERARE EMOJI AUTOMATICHE =====
/**
 * Genera un'emoji automatica basata sul contenuto dell'iniziativa
 * Analizza titolo e descrizione per trovare parole chiave
 */
function getEmojiAutomatica(iniziativa) {
  const testo = `${iniziativa.nome || ''} ${iniziativa.titolo || ''} ${iniziativa.descrizione || ''}`.toLowerCase();

  // Mappa di parole chiave -> emoji (in ordine di priorità)
  const emojiMap = [
    // Educazione e scuola
    { keywords: ['educazione', 'scuola', 'istruzione', 'studenti', 'docenti', 'curriculum', 'materia'], emoji: '📚' },
    // Ambiente e clima
    { keywords: ['ambiente', 'clima', 'energia', 'rinnovabile', 'sostenibilità', 'ecologia', 'inquinamento'], emoji: '🌱' },
    // Sanità e salute
    { keywords: ['sanità', 'salute', 'ospedale', 'cure', 'medico', 'farmaco', 'igiene', 'femminile'], emoji: '🏥' },
    // Diritti e uguaglianza
    { keywords: ['diritti', 'uguaglianza', 'discriminazione', 'parità', 'genere', 'lgbt', 'matrimonio'], emoji: '🤝' },
    // Lavoro ed economia
    { keywords: ['lavoro', 'economia', 'iva', 'tasse', 'fiscale', 'occupazione', 'salario'], emoji: '💼' },
    // Nucleare ed energia
    { keywords: ['nucleare', 'energia nucleare', 'reattore', 'fissione'], emoji: '⚛️' },
    // Giustizia e legalità
    { keywords: ['giustizia', 'legge', 'penale', 'carcere', 'reato', 'criminale'], emoji: '⚖️' },
    // Cultura e arte
    { keywords: ['cultura', 'arte', 'patrimonio', 'museo', 'teatro'], emoji: '🎭' },
    // Trasporti e mobilità
    { keywords: ['trasporti', 'mobilità', 'auto', 'strada', 'traffico'], emoji: '🚗' },
    // Tecnologia e digitale
    { keywords: ['tecnologia', 'digitale', 'internet', 'informatica', 'software'], emoji: '💻' },
    // Famiglia e sociale
    { keywords: ['famiglia', 'bambini', 'infanzia', 'prima infanzia', 'maternità'], emoji: '👨‍👩‍👧‍👦' },
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

  // Emoji di default per iniziative popolari
  return '📋';
}

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Lista iniziative popolari (come ICE)
router.get('/', async (req, res) => {
  try {
    debugLog('🔍 DEBUG: Chiamata endpoint /api/iniziative-popolari');
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
        // Verifica che JWT_SECRET sia configurato
        if (!process.env.JWT_SECRET) {
          console.error('❌ JWT_SECRET non configurato!');
          throw new Error('JWT_SECRET non configurato');
        }

        const token = req.headers.authorization.replace('Bearer ', '');
        if (!token || token === 'Bearer') {
          debugLog('⚠️ Token JWT mancante o malformato');
        } else {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded?.userId;

          // Ottieni il ruolo dell'utente solo se userId è valido
          if (userId) {
            const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult?.rows && userResult.rows.length > 0) {
              userRole = userResult.rows[0]?.ruolo;
              debugLog(`🔍 Ruolo utente: ${userRole}`);
            }
          }
        }
      } catch (authError) {
        // Log solo se non è un errore di token mancante (normale per richieste non autenticate)
        if (authError.name !== 'JsonWebTokenError' && authError.name !== 'TokenExpiredError') {
          debugLog('⚠️ Errore nel recupero ruolo utente:', authError.message);
        }
      }
    }

    // Fonte pubblica canonica: iniziative_ministero sincronizzata automaticamente.
    // Se vota=true, mostra solo iniziative ufficiali che hanno raggiunto la soglia firme.
    // Per la pagina iniziative-popolari (non vota), mostra solo quelle con stato = 'in_corso'
    const votaOnly = req.query.vota === 'true';
    const soloInCorso = !votaOnly; // Per la pagina listing, mostra solo quelle in corso
    debugLog(`🔍 DEBUG: votaOnly = ${votaOnly}, soloInCorso = ${soloInCorso}, req.query.vota = ${req.query.vota}`);

    // IMP-029: la priorità DEMOS deriva dal modello canonico multi-fonte.
    // Eleggibilità: raccolta firme ufficiale conclusa + quorum/soglia raggiunta.
    // Camera/Senato arricchiscono il lifecycle ma NON sono un gate della classifica.
    if (votaOnly) {
      const sourceStatus = await getPrioritySourceStatus(pool);
      const policyBase = {
        eligibility: 'signature_collection_closed_and_threshold_reached',
        signature_source_records: sourceStatus.signatureSourceRecords,
      };

      if (!sourceStatus.schemaReady) {
        return res.json({
          success: true,
          richieste: [],
          iniziative: [],
          classifica: [],
          mieiVoti: [],
          blocco: { isBlocked: false, unlockDate: null },
          civic_process_policy: {
            ...policyBase,
            enabled: false,
            reason: 'CIVIC_PROCESS_MIGRATION_REQUIRED',
          },
        });
      }

      let canonicalInitiatives = await listPriorityEligiblePopularInitiatives(pool);
      canonicalInitiatives = canonicalInitiatives.map(iniziativa => ({
        ...iniziativa,
        emoji: getEmojiAutomatica(iniziativa),
      }));

      let mieiVoti = [];
      let preferenceBlock = { isBlocked: false, unlockDate: null };
      if (userId) {
        const eligibleVote = await getCurrentEligiblePopularInitiativeVote(pool, userId);
        const currentVote = await getCurrentPopularInitiativeVote(pool, userId);
        mieiVoti = eligibleVote?.iniziativa_id ? [String(eligibleVote.iniziativa_id)] : [];

        if (userRole !== 'Admin' && userRole !== 'AD') {
          const cooldown = await getPreferenceCooldown(pool, {
            userId,
            scope: 'iniziative-popolari:preferenza',
            fallbackChangedAt: currentVote?.timestamp || currentVote?.created_at || null,
          });
          preferenceBlock = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
        }
      }

      const classifica = canonicalInitiatives
        .map(iniziativa => ({
          nome: iniziativa.nome,
          sitoWeb: iniziativa.sitoWeb,
          voti: Number(iniziativa.voti || 0),
          emoji: iniziativa.emoji,
        }))
        .sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome, 'it'));

      return res.json({
        success: true,
        richieste: canonicalInitiatives,
        iniziative: canonicalInitiatives,
        classifica,
        mieiVoti,
        blocco: preferenceBlock,
        civic_process_policy: {
          ...policyBase,
          enabled: true,
        },
      });
    }

    // 1. Query da iniziative_ministero
    const { query, params } = buildQueryForTipo('iniziativa', userRole, userId, votaOnly, soloInCorso);
    debugLog(`🔍 DEBUG: Query generata: ${query.substring(0, 200)}...`);

    const result = await pool.query(query, params);
    debugLog(`✅ Recuperati ${result.rows.length} record da iniziative_ministero (tipo=iniziativa, votaOnly=${votaOnly})`);

    // 2. Query da iniziative_popolari
    let iniziativePopolariResult = { rows: [] };
    try {
      let iniziativePopolariQuery;
      let iniziativePopolariParams = [];

      if (votaOnly) {
        // Per votaOnly: solo quelle con quorum_raggiunto = TRUE
        iniziativePopolariQuery = `
          SELECT *
          FROM iniziative_popolari
          WHERE quorum_raggiunto = true
          ORDER BY created_at DESC
        `;
      } else if (soloInCorso) {
        // Per listing: solo quelle in corso (stato; colonna "status" rimossa da migrazione), non scadute (data_fine >= oggi), ordinate per firme
        iniziativePopolariQuery = `
          SELECT *
          FROM iniziative_popolari
          WHERE (stato IS NULL OR stato = 'in_corso')
            AND (data_fine IS NULL OR data_fine >= CURRENT_DATE)
          ORDER BY firme DESC NULLS LAST, created_at DESC
        `;
      } else {
        // Per admin o altre viste: tutte tranne le proposte (quorum != 'proposta')
        iniziativePopolariQuery = `
          SELECT *
          FROM iniziative_popolari
          WHERE quorum != 'proposta'
          ORDER BY created_at DESC
        `;
      }

      // F12-26: le liste pubbliche derivano esclusivamente dalla fonte ufficiale Ministero.
      iniziativePopolariResult = { rows: [] };
      debugLog(`✅ Recuperati ${iniziativePopolariResult.rows.length} record da iniziative_popolari (votaOnly=${votaOnly})`);
    } catch (error) {
      debugWarn(`⚠️ Errore nel recupero iniziative_popolari:`, error.message);
      // Continua senza iniziative_popolari se c'è un errore
    }
    debugLog(`🔍 DEBUG: Query completa:`, query);
    debugLog(`🔍 DEBUG: Parametri query:`, params);

    // Debug: verifica cosa restituisce la query
    if (votaOnly) {
      debugLog(`🔍 DEBUG VOTA: result.rows.length = ${result.rows.length}`);
      if (result.rows.length === 0 && process.env.NODE_ENV !== 'production') {
        const debugQuery = `SELECT COUNT(*) as totale,
          COUNT(*) FILTER (WHERE quorum_raggiunto = true AND firme_raccolte >= ${INIZIATIVA_FIRME_MINIME}) as valide
          FROM iniziative_ministero WHERE tipo LIKE $1 AND id_ministero IS NOT NULL`;
        const debugResult = await pool.query(debugQuery, params);
        debugWarn('VOTA: nessun risultato, statistiche DB:', debugResult.rows[0]);
      }
      if (result.rows.length > 0 && process.env.NODE_ENV !== 'production') {
        debugLog(`🔍 DEBUG VOTA: Prime 3 righe:`, result.rows.slice(0, 3).map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto, stato: r.stato })));
      }
    }

    // Filtro aggiuntivo di sicurezza:
    // - Per votaOnly: solo quelle ufficiali con quorum_raggiunto = true e firme_raccolte >= soglia configurata
    // - Per listing (soloInCorso): ESCLUDE TUTTE quelle con stato != 'in_corso'
    let filteredRows = result.rows;
    if (votaOnly) {
      const beforeFilter = filteredRows.length;
      filteredRows = filteredRows.filter(row => {
        // Solo quelle con quorum_raggiunto = true e firme_raccolte >= soglia configurata
        return row.quorum_raggiunto === true
          && (row.firme_raccolte || 0) >= INIZIATIVA_FIRME_MINIME;
      });
      const afterFilter = filteredRows.length;

      if (beforeFilter !== afterFilter) {
        debugWarn(`⚠️ FILTRO SICUREZZA: Rimosse ${beforeFilter - afterFilter} iniziative che non rispettano i criteri (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => {
          // Rimuove quelle che non hanno raggiunto la soglia ufficiale.
          return row.quorum_raggiunto !== true
            || (row.firme_raccolte || 0) < INIZIATIVA_FIRME_MINIME;
        });
        debugWarn(`⚠️ Iniziative rimosse:`, removed.map(r => ({
          id: r.id,
          titolo: r.titolo?.substring(0, 50),
          quorum_raggiunto: r.quorum_raggiunto,
          stato: r.stato
        })));
      }

      // Debug: verifica quorum_raggiunto e stato dei risultati finali
      debugLog(`🔍 DEBUG VOTA: Dopo filtro sicurezza - filteredRows.length = ${filteredRows.length}`);
      if (filteredRows.length === 0 && beforeFilter > 0) {
        console.error(`❌ ERRORE: Tutte le iniziative sono state rimosse dal filtro sicurezza!`);
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
        debugLog(`🔍 DEBUG: Stato quorum_raggiunto e stato dei risultati FINALI (dopo filtro sicurezza):`, quorumStatus);

        // Verifica che tutte abbiano quorum_raggiunto = true
        const noQuorum = filteredRows.filter(r => r.quorum_raggiunto !== true);
        if (noQuorum.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovate ${noQuorum.length} iniziative con quorum_raggiunto != true dopo il filtro sicurezza:`, noQuorum.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), quorum_raggiunto: r.quorum_raggiunto })));
        }

        // Verifica che tutte abbiano firme_raccolte >= soglia configurata
        const insufficientFirme = filteredRows.filter(r => (r.firme_raccolte || 0) < INIZIATIVA_FIRME_MINIME);
        if (insufficientFirme.length > 0) {
          console.error(`❌ ERRORE CRITICO: Trovate ${insufficientFirme.length} iniziative con firme_raccolte < soglia configurata dopo il filtro sicurezza:`, insufficientFirme.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), firme_raccolte: r.firme_raccolte })));
        }
      }
    } else if (soloInCorso) {
      // Filtro di sicurezza per la pagina listing: ESCLUDE quelle con stato != 'in_corso' e quelle scadute (data_fine < oggi)
      const todayStr = new Date().toISOString().slice(0, 10);
      const beforeFilter = filteredRows.length;
      filteredRows = filteredRows.filter(row => {
        if (row.stato !== 'in_corso') return false;
        const dataFine = row.data_fine;
        if (!dataFine) return true;
        const fineStr = typeof dataFine === 'string' ? dataFine.slice(0, 10) : new Date(dataFine).toISOString().slice(0, 10);
        return fineStr >= todayStr;
      });
      const afterFilter = filteredRows.length;

      if (beforeFilter !== afterFilter) {
        debugWarn(`⚠️ FILTRO SICUREZZA LISTING: Rimosse ${beforeFilter - afterFilter} iniziative (stato != 'in_corso' o scadute, oggi=${todayStr}) (prima: ${beforeFilter}, dopo: ${afterFilter})`);
        const removed = result.rows.filter(row => {
          if (row.stato !== 'in_corso') return true;
          const dataFine = row.data_fine;
          if (!dataFine) return false;
          const fineStr = typeof dataFine === 'string' ? dataFine.slice(0, 10) : new Date(dataFine).toISOString().slice(0, 10);
          return fineStr < todayStr;
        });
        debugWarn(`⚠️ Iniziative rimosse (scadute o non in corso):`, removed.map(r => ({ id: r.id, titolo: r.titolo?.substring(0, 50), stato: r.stato, data_fine: r.data_fine })));
      }

      // Debug: verifica che tutte le iniziative abbiano stato = 'in_corso' e non siano scadute
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
        // Verifica che JWT_SECRET sia configurato
        if (!process.env.JWT_SECRET) {
          console.error('❌ JWT_SECRET non configurato!');
          throw new Error('JWT_SECRET non configurato');
        }

        const token = req.headers.authorization.replace('Bearer ', '');
        if (!token || token === 'Bearer') {
          debugLog('⚠️ Token JWT mancante o malformato');
          throw new Error('Token JWT mancante o malformato');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.userId;

        if (!userId) {
          debugLog('⚠️ UserId non presente nel token JWT');
          throw new Error('UserId non presente nel token');
        }

        // Query per recuperare i voti dell'utente
        // Prova prima come UUID, poi come text se non trova risultati
        let userVotiResult = null;

        // Prova come UUID
        try {
          const userVotiQueryUUID = `
            SELECT iniziativa_id
            FROM voti_iniziative_popolari
            WHERE userid = $1::uuid
            ORDER BY timestamp DESC, created_at DESC
            LIMIT 1
          `;
          userVotiResult = await pool.query(userVotiQueryUUID, [userId]);
        } catch (uuidError) {
          // fallback a query text
        }
        if (!userVotiResult || userVotiResult.rows.length === 0) {
          const userVotiQueryText = `
            SELECT iniziativa_id
            FROM voti_iniziative_popolari
            WHERE userid::text = $1
            ORDER BY timestamp DESC, created_at DESC
            LIMIT 1
          `;
          userVotiResult = await pool.query(userVotiQueryText, [userId]);
        }

        // Estrai gli ID delle iniziative con controlli null safety
        if (userVotiResult && userVotiResult.rows && userVotiResult.rows.length > 0) {
          mieiVoti = userVotiResult.rows
            .filter(v => v && v.iniziativa_id) // Filtra valori null/undefined
            .map(v => {
              // Assicurati che l'ID sia una stringa
              const id = v?.iniziativa_id;
              return id ? String(id) : null;
            })
            .filter(id => id !== null);
        }

        // Limita a massimo 1 voto (per sicurezza)
        mieiVoti = mieiVoti.slice(0, 1);
      } catch (authError) {
        // Se il token non è valido, continua senza autenticazione
        // Log solo se non è un errore di token mancante (normale per richieste non autenticate)
        if (authError.name !== 'JsonWebTokenError' && authError.name !== 'TokenExpiredError') {
          debugLog('⚠️ Token non valido per iniziative popolari, continuando senza autenticazione:', authError.message);
          if (authError.stack) {
            debugLog('⚠️ Stack trace:', authError.stack);
          }
        }
      }
    }

    // Normalizza i dati per il frontend usando il mapper
    // 1. Normalizza dati da iniziative_ministero
    const normalizedMinistero = filteredRows.map(row => mapToLegacyFormat(row, 'iniziativa'));

    // 2. Normalizza dati da iniziative_popolari
    let normalizedPopolari = [];
    if (iniziativePopolariResult.rows.length > 0) {
      // Applica gli stessi filtri di sicurezza anche a iniziative_popolari
      let filteredPopolari = iniziativePopolariResult.rows;

      if (votaOnly) {
        // Filtro sicurezza: solo quelle con quorum_raggiunto = TRUE
        filteredPopolari = filteredPopolari.filter(row => {
          return row.quorum_raggiunto === true;
        });
      } else if (soloInCorso) {
        // Filtro sicurezza: solo quelle in corso (stato) e non scadute (data_fine >= oggi)
        const todayStrPop = new Date().toISOString().slice(0, 10);
        filteredPopolari = filteredPopolari.filter(row => {
          const stato = (row.stato || row.status || '').toString().toLowerCase();
          if (stato && stato !== 'pending' && stato !== 'in attesa' && stato !== 'in_corso') return false;
          const dataFine = row.data_fine;
          if (!dataFine) return true;
          const fineStr = typeof dataFine === 'string' ? dataFine.slice(0, 10) : new Date(dataFine).toISOString().slice(0, 10);
          return fineStr >= todayStrPop;
        });
      }

      normalizedPopolari = filteredPopolari.map(row => mapIniziativePopolariToLegacyFormat(row));
      debugLog(`✅ Normalizzate ${normalizedPopolari.length} iniziative da iniziative_popolari`);
    }

    // 3. Unisci i risultati (rimuovi duplicati per ID)
    const allNormalized = [...normalizedMinistero, ...normalizedPopolari];
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
    debugLog(`✅ Totale iniziative normalizzate: ${normalizedData.length} (${normalizedMinistero.length} da ministero, ${normalizedPopolari.length} da popolari)`);

    // Dopo la normalizzazione, escludi le iniziative già scadute (data_fine nel DB < oggi)
    if (soloInCorso) {
      const todayStrNorm = new Date().toISOString().slice(0, 10);
      const beforeExpiryFilter = normalizedData.length;
      normalizedData = normalizedData.filter((iniziativa) => {
        const dataFine = iniziativa.data_fine ?? iniziativa.dataFine;
        if (!dataFine) return false;
        const fineStr = typeof dataFine === 'string'
          ? dataFine.slice(0, 10)
          : new Date(dataFine).toISOString().slice(0, 10);
        return fineStr >= todayStrNorm;
      });
      if (beforeExpiryFilter !== normalizedData.length) {
        debugWarn(`⚠️ Filtro scadenza post-normalizzazione: rimosse ${beforeExpiryFilter - normalizedData.length} iniziative scadute (oggi=${todayStrNorm})`);
      }
    }

    // Aggiungi emoji automatiche a tutte le iniziative
    normalizedData = normalizedData.map(iniziativa => {
      const emoji = getEmojiAutomatica(iniziativa);
      return {
        ...iniziativa,
        emoji: emoji
      };
    });

    // Se l'iniziativa votata non è nella lista, recuperala con al massimo 3 query (batch) invece di 6 per voto
    if (mieiVoti.length > 0) {
      const votoId = String(mieiVoti[0]);
      const votoEsisteInNormalized = normalizedData.some(iniz => String(iniz.id) === votoId);
      if (!votoEsisteInNormalized) {
        try {
          const votoIdNoDashes = votoId.replace(/-/g, '');
          // 1. Una query ministero: id esatto o senza trattini
          let row = null;
          let src = null;
          const ministeroResult = await pool.query(
            `SELECT *, 'ministero' as _src FROM iniziative_ministero WHERE id = $1 OR (LENGTH($2) > 10 AND REPLACE(id, '-', '') = $2) LIMIT 1`,
            [votoId, votoIdNoDashes]
          );
          if (ministeroResult.rows.length > 0) {
            row = ministeroResult.rows[0];
            src = 'ministero';
          }
          if (!row) {
            // 2. Una query popolari: id text, no-dash, oppure uuid se valido
            let popolariResult = await pool.query(
              `SELECT *, 'popolari' as _src FROM iniziative_popolari WHERE id::text = $1 OR REPLACE(id::text, '-', '') = $2 LIMIT 1`,
              [votoId, votoIdNoDashes]
            );
            if (popolariResult.rows.length === 0 && votoId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              try {
                popolariResult = await pool.query(`SELECT *, 'popolari' as _src FROM iniziative_popolari WHERE id = $1::uuid LIMIT 1`, [votoId]);
              } catch (_) { /* ignore invalid uuid */ }
            }
            if (popolariResult.rows.length > 0) {
              row = popolariResult.rows[0];
              src = 'popolari';
            }
          }
          if (!row && votoId.length > 10 && !votoId.match(/^[0-9a-f-]+$/i)) {
            const byNome = await pool.query(
              `SELECT *, 'popolari' as _src FROM iniziative_popolari WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1)) LIMIT 1`,
              [votoId]
            );
            if (byNome.rows.length > 0) {
              row = byNome.rows[0];
              src = 'popolari';
            }
          }
          if (row && src) {
            const mapped = src === 'ministero' ? mapToLegacyFormat(row, 'iniziativa') : mapIniziativePopolariToLegacyFormat(row);
            mapped.emoji = getEmojiAutomatica(mapped);
            // In listing (soloInCorso), non aggiungere alla lista se l'iniziativa votata è scaduta
            const dataFine = mapped.data_fine ?? mapped.dataFine;
            const isExpired = dataFine && (typeof dataFine === 'string' ? dataFine.slice(0, 10) : new Date(dataFine).toISOString().slice(0, 10)) < new Date().toISOString().slice(0, 10);
            if (!soloInCorso || !isExpired) {
              normalizedData.push(mapped);
            }
            mieiVoti[0] = String(mapped.id);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            debugWarn('Errore recupero iniziativa votata:', error.message);
          }
        }
      }
    }

    // Normalizza gli ID in mieiVoti per assicurarsi che corrispondano agli ID delle iniziative normalizzate
    // Questo gestisce il caso in cui gli ID nel database hanno un formato diverso (con/senza trattini)
    // E anche il caso in cui iniziativa_id è un nome invece di un ID
    if (mieiVoti.length > 0 && normalizedData.length > 0) {
      const normalizedIds = normalizedData.map(i => String(i.id));
      const normalizedNomi = normalizedData.map(i => String(i.nome || '').toLowerCase().trim());

      mieiVoti = mieiVoti.map(votoId => {
        const votoIdStr = String(votoId);
        const votoIdNoDashes = votoIdStr.replace(/-/g, '');
        const votoIdLower = votoIdStr.toLowerCase().trim();

        if (normalizedIds.includes(votoIdStr)) return votoIdStr;
        const matchById = normalizedIds.find(id => id.replace(/-/g, '') === votoIdNoDashes);
        if (matchById) return matchById;
        const matchByNome = normalizedData.find(i => {
          const nomeNormalized = String(i.nome || '').toLowerCase().trim();
          return nomeNormalized === votoIdLower || nomeNormalized.includes(votoIdLower) || votoIdLower.includes(nomeNormalized);
        });
        if (matchByNome) return String(matchByNome.id);
        const matchParziale = normalizedData.find(i => {
          const nomeNormalized = String(i.nome || '').toLowerCase().trim();
          if (votoIdStr.length >= 10 && nomeNormalized.length >= 10) {
            return nomeNormalized.includes(votoIdLower) || votoIdLower.includes(nomeNormalized);
          }
          return false;
        });
        if (matchParziale) return String(matchParziale.id);
        return votoIdStr;
      });
    }

    // Genera la classifica basata sui voti da ENTRAMBE le tabelle
    let classifica = [];
    if (normalizedData.length > 0) {
      try {
        // Costruisci la query di classifica con UNION per includere entrambe le tabelle
        // Per la pagina iniziative-popolari, mostra solo quelle con stato = 'in_corso'
        // Per la pagina vota: quorum_raggiunto = TRUE E ESCLUDE TUTTE quelle con stato = 'in_corso'
        const quorumFilterMinistero = votaOnly
          ? `AND im.quorum_raggiunto = true AND im.firme_raccolte >= ${INIZIATIVA_FIRME_MINIME}`
          : 'AND im.stato = \'in_corso\'';

        // Tabella iniziative_popolari usa "stato" (colonna "status" rimossa da migrazione); per listing solo non scadute
        const quorumFilterPopolari = votaOnly
          ? `ip.quorum_raggiunto = true`
          : `(ip.stato IS NULL OR ip.stato = 'in_corso') AND (ip.data_fine IS NULL OR ip.data_fine >= CURRENT_DATE)`;

        const classificaQuery = `
          (
            SELECT
              im.titolo as nome,
              im.sito_web as sitoWeb,
              COALESCE(im.firme_raccolte, 0) as firme,
              COUNT(vip.iniziativa_id) as voti
            FROM iniziative_ministero im
            LEFT JOIN voti_iniziative_popolari vip ON (
              im.id::text = vip.iniziativa_id OR
              REPLACE(im.id::text, '-', '') = vip.iniziativa_id OR
              im.id::text = REPLACE(vip.iniziativa_id, '-', '') OR
              REPLACE(im.id::text, '-', '') = REPLACE(vip.iniziativa_id, '-', '')
            )
            WHERE im.tipo LIKE $1
              AND im.id_ministero IS NOT NULL
              ${quorumFilterMinistero}
            GROUP BY im.id, im.titolo, im.sito_web, im.firme_raccolte
          )
          UNION ALL
          (
            SELECT
              ip.nome,
              COALESCE(ip.sito_web, ip.sitoweb) as sitoWeb,
              COALESCE(ip.firme, 0) as firme,
              COUNT(vip2.iniziativa_id) as voti
            FROM iniziative_popolari ip
            LEFT JOIN voti_iniziative_popolari vip2 ON (
              ip.id::text = vip2.iniziativa_id OR
              REPLACE(ip.id::text, '-', '') = vip2.iniziativa_id OR
              ip.id::text = REPLACE(vip2.iniziativa_id, '-', '') OR
              REPLACE(ip.id::text, '-', '') = REPLACE(vip2.iniziativa_id, '-', '')
            )
            WHERE FALSE
            GROUP BY ip.id, ip.nome, ip.sito_web, ip.sitoweb, ip.firme
          )
          ORDER BY firme DESC NULLS LAST, voti DESC, nome ASC
        `;

        debugLog('🔍 DEBUG - Esecuzione query classifica (con UNION)');
        const classificaResult = await pool.query(classificaQuery, params);
        debugLog('🔍 DEBUG - Risultati classifica raw:', classificaResult.rows);

        classifica = classificaResult.rows
          .filter(row => row && row.nome) // Filtra righe null/undefined o senza nome
          .map(row => {
            // Trova l'iniziativa corrispondente per ottenere l'emoji
            // Prova prima per nome esatto, poi per nome normalizzato (trim, lowercase), poi per sitoWeb
            let iniziativa = normalizedData.find(i =>
              i && (i.nome === row.nome || i.titolo === row.nome)
            );

            // Se non trova, prova con normalizzazione (trim, lowercase)
            if (!iniziativa) {
              const rowNomeNormalized = String(row?.nome || '').toLowerCase().trim();
              iniziativa = normalizedData.find(i => {
                if (!i) return false;
                const nomeNormalized = String(i.nome || '').toLowerCase().trim();
                const titoloNormalized = String(i.titolo || '').toLowerCase().trim();
                return nomeNormalized === rowNomeNormalized || titoloNormalized === rowNomeNormalized;
              });
            }

            // Se ancora non trova, prova per sitoWeb
            if (!iniziativa && row?.sitoweb) {
              iniziativa = normalizedData.find(i =>
                i && i.sitoWeb && (i.sitoWeb === row.sitoweb || i.sitoWeb === row.sito_web || i.sito_web === row.sitoweb)
              );
            }

            // Genera sempre un'emoji (usa quella trovata o genera una nuova)
            const emoji = iniziativa?.emoji || getEmojiAutomatica({ nome: row?.nome || '' });

            return {
              nome: row?.nome || '',
              sitoWeb: row?.sitoweb || row?.sito_web || '',
              voti: parseInt(row?.voti) || 0,
              emoji: emoji
            };
          });
        debugLog(`✅ Generata classifica con ${classifica.length} iniziative (da entrambe le tabelle):`, classifica);
        // Debug: verifica che tutte le iniziative nella classifica abbiano un'emoji
        const classificaSenzaEmoji = classifica.filter(c => !c.emoji);
        if (classificaSenzaEmoji.length > 0) {
          debugWarn(`⚠️ ATTENZIONE: ${classificaSenzaEmoji.length} iniziative nella classifica senza emoji:`, classificaSenzaEmoji.map(c => c.nome));
        } else {
          debugLog(`✅ Tutte le ${classifica.length} iniziative nella classifica hanno un'emoji`);
        }
      } catch (classificaError) {
        debugLog('⚠️ Errore nella generazione classifica, continuando senza:', classificaError.message);
        debugLog('⚠️ Stack trace:', classificaError.stack);
        // Se la classifica fallisce, continua senza di essa
        classifica = [];
      }
    }

    // Ordina sempre per numero di firme (decrescente): in alto quelle con più firme
    normalizedData.sort((a, b) => {
      const firmeA = Number(a.firme ?? a.firme_raccolte ?? 0);
      const firmeB = Number(b.firme ?? b.firme_raccolte ?? 0);
      return firmeB - firmeA;
    });

    let preferenceBlock = { isBlocked: false, unlockDate: null };
    if (userId && userRole !== 'Admin' && userRole !== 'AD') {
      const lastChangeResult = await pool.query(
        `SELECT MAX(timestamp) AS last_changed_at
         FROM voti_iniziative_popolari
         WHERE userid::text = $1 OR userid = $1::uuid`,
        [userId]
      );
      const cooldown = await getPreferenceCooldown(pool, {
        userId,
        scope: 'iniziative-popolari:preferenza',
        fallbackChangedAt: lastChangeResult.rows[0]?.last_changed_at || null
      });
      preferenceBlock = { isBlocked: cooldown.isBlocked, unlockDate: cooldown.unlockDate };
    }

    const responseData = {
      success: true,
      richieste: normalizedData,
      iniziative: normalizedData,
      classifica: classifica,
      mieiVoti: mieiVoti,
      blocco: preferenceBlock
    };

    debugLog(`🔍 ========== RISPOSTA FINALE INIZIATIVE ==========`);
    debugLog(`🔍 richieste.length = ${normalizedData.length}`);
    debugLog(`🔍 iniziative.length = ${normalizedData.length}`);
    debugLog(`🔍 classifica.length = ${classifica.length}`);
    debugLog(`🔍 filteredRows.length = ${filteredRows.length}`);
    debugLog(`🔍 result.rows.length = ${result.rows.length}`);
    debugLog(`🔍 mieiVoti.length = ${mieiVoti.length}`);
    debugLog(`🔍 mieiVoti =`, mieiVoti);
    if (normalizedData.length > 0 && mieiVoti.length > 0) {
      debugLog(`🔍 Verifica corrispondenza ID:`);
      normalizedData.forEach(i => {
        const match = mieiVoti.some(votoId => {
          // Confronta con e senza trattini
          const votoIdNormalized = String(votoId).replace(/-/g, '');
          const iniziativaIdNormalized = String(i.id).replace(/-/g, '');
          return votoIdNormalized === iniziativaIdNormalized || String(votoId) === String(i.id);
        });
        if (match) {
          debugLog(`   ✅ Trovata corrispondenza: votoId=${mieiVoti.find(v => String(v).replace(/-/g, '') === String(i.id).replace(/-/g, ''))}, iniziativaId=${i.id}`);
        }
      });
    }

    if (normalizedData.length > 0) {
      debugLog(`✅ ========== INIZIATIVE NORMALIZZATE ==========`);
      normalizedData.slice(0, 3).forEach((i, idx) => {
        debugLog(`   ${idx + 1}. ID: ${i.id}, Nome: ${i.nome?.substring(0, 60)}..., Stato: ${i.stato}, Tipo: ${i.tipo}, Emoji: ${i.emoji || 'NON PRESENTE'}`);
      });
      // Verifica che tutte le iniziative abbiano un'emoji
      const iniziativeSenzaEmoji = normalizedData.filter(i => !i.emoji);
      if (iniziativeSenzaEmoji.length > 0) {
        debugWarn(`⚠️ ATTENZIONE: ${iniziativeSenzaEmoji.length} iniziative senza emoji su ${normalizedData.length} totali`);
      } else {
        debugLog(`✅ Tutte le ${normalizedData.length} iniziative hanno un'emoji`);
      }
    } else {
      debugWarn(`⚠️ Nessuna iniziativa normalizzata`);
      debugWarn(`⚠️ filteredRows.length = ${filteredRows.length}, result.rows.length = ${result.rows.length}`);
    }

    res.json(responseData);
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
  return res.status(410).json({
    success: false,
    error: 'PROPOSTA_MANUALE_DISABILITATA',
    message: 'Le iniziative popolari in DEMOS provengono esclusivamente dalla fonte ufficiale sincronizzata.'
  });

  let client = null;

  try {
    debugLog('🔍 DEBUG POST: Inizio creazione iniziativa popolare');

    const { nome, descrizione, dataInizio, dataFine, sitoWeb } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato

    debugLog('🔍 DEBUG POST: UserId:', userId);
    debugLog('🔍 DEBUG POST: req.userId:', req.userId);
    debugLog('🔍 DEBUG POST: Dati estratti:', { nome, descrizione, dataInizio, dataFine, sitoWeb });

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

    // Se manca data_fine ma c'è data_inizio, salva inizio + 6 mesi
    const dataFineSalvata = resolveIniziativaDataFine(dataFine, dataInizio) || dataFine || null;

    // Inizia una transazione per prevenire race conditions in caso di doppio submit simultaneo
    client = await pool.connect();

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
        debugLog('⚠️ DEBUG POST: Utente ha già una proposta in attesa, bloccando nuovo inserimento');
        return res.status(400).json({
          success: false,
          error: 'Hai già una proposta in attesa di approvazione. Puoi proporre solo una iniziativa alla volta.'
        });
      }

      // Genera un UUID valido per la richiesta iniziativa
      const crypto = require('crypto');
      const iniziativaId = crypto.randomUUID();
      debugLog('🔍 DEBUG: Iniziativa ID generato:', iniziativaId);

      // Definisce i parametri per la query - include userid e quorum = 'proposta'
      const params = [iniziativaId, userId, nome, descrizione, dataInizio, dataFineSalvata, sitoWeb];

      // Inserisce con quorum = 'proposta' e userid dell'utente che propone
      const query = `
        INSERT INTO iniziative_popolari (id, userid, nome, descrizione, data_inizio, data_fine, sito_web, quorum)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposta')
        RETURNING *
      `;

      debugLog('🔍 DEBUG POST: Parametri query:', params);
      debugLog('🔍 DEBUG POST: Tentativo connessione database...');
      debugLog('🔍 DEBUG POST: DATABASE_URL presente:', !!process.env.DATABASE_URL);
      debugLog('🔍 DEBUG POST: Esecuzione query INSERT in transazione...');
      debugLog('🔍 DEBUG POST: Query:', query);

      const result = await client.query(query, params);
      debugLog('🔍 DEBUG POST: Risultato inserimento:', result.rows[0]);
      debugLog('🔍 DEBUG POST: Numero righe inserite:', result.rowCount);

      if (!result.rows || result.rows.length === 0) {
        await client.query('ROLLBACK');
        console.error('❌ DEBUG POST: Nessuna riga inserita!');
        return res.status(500).json({
          success: false,
          error: 'Errore: nessun dato inserito nel database'
        });
      }

      // Commit della transazione
      await client.query('COMMIT');

      debugLog(`✅ Iniziativa proposta creata: ${iniziativaId} per utente: ${userId}`);

      res.json({
        success: true,
        richiesta: result.rows[0]
      });
    } catch (transactionError) {
      // Rollback in caso di errore
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('❌ Errore durante rollback:', rollbackError);
        }
      }
      throw transactionError;
    }
  } catch (error) {
    console.error('❌ DEBUG POST: Errore nella creazione iniziativa popolare:', error);
    console.error('❌ DEBUG POST: Stack trace:', error.stack);
    console.error('❌ DEBUG POST: Error code:', error.code);
    console.error('❌ DEBUG POST: Error detail:', error.detail);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Errore nella creazione iniziativa popolare',
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  } finally {
    // Garantisce sempre il release del client, anche in caso di errori
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Errore nel rilasciare client database:', releaseError);
      }
    }
  }
});

// PUT /api/iniziative-popolari/:id - Aggiorna iniziativa popolare (per admin)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, firme } = req.body;

    // Se manca data_fine ma c'è data_inizio, salva inizio + 6 mesi
    const dataFineSalvata = resolveIniziativaDataFine(dataFine, dataInizio) || dataFine || null;

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
      updateParams = [nome, descrizione, dataInizio, dataFineSalvata, sitoWeb, quorum, firme, id];
    } else {
      updateQuery = `
        UPDATE iniziative_popolari
        SET nome = $1, descrizione = $2, data_inizio = $3, data_fine = $4, sito_web = $5, quorum = $6
        WHERE id = $7
        RETURNING *
      `;
      updateParams = [nome, descrizione, dataInizio, dataFineSalvata, sitoWeb, quorum, id];
    }

    const result = await pool.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Iniziativa popolare non trovata'
      });
    }

    debugLog(`✅ Iniziativa popolare aggiornata: ${id}, nuovo quorum: ${quorum}`);

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
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === 'vota') return next();
    const userId = req.userId;

    const isAdmin = Boolean(req.user?.isAdmin);

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
      const isOwner = String(iniziativa.userid) === String(userId) && iniziativa.quorum === 'proposta';

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

    debugLog(`✅ Iniziativa popolare eliminata: ${id}`);

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

// POST /api/iniziative-popolari/vota - preferenza su iniziativa canonica con raccolta conclusa e soglia raggiunta
router.post('/vota', verifyToken, async (req, res) => {
  let client = null;
  let transactionStarted = false;

  try {
    const userId = req.userId || req.user?.id;
    const voti = Array.isArray(req.body?.voti) ? req.body.voti : [];
    const selectedId = voti.length === 1 ? String(voti[0] || '').trim() : '';

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Autenticazione richiesta' });
    }
    if (!selectedId || voti.length !== 1) {
      return res.status(400).json({
        success: false,
        error: 'PREFERENZA_NON_VALIDA',
        message: 'Seleziona una sola iniziativa popolare.'
      });
    }

    client = await pool.connect();
    const sourceStatus = await getPrioritySourceStatus(client);
    if (!sourceStatus.schemaReady) {
      return res.status(409).json({
        success: false,
        error: 'CIVIC_PROCESS_MIGRATION_REQUIRED',
        message: 'L’archivio canonico dei processi civici non è ancora disponibile.'
      });
    }
    const eligible = await getPriorityEligiblePopularInitiative(client, selectedId);
    if (!eligible) {
      return res.status(409).json({
        success: false,
        error: 'INIZIATIVA_NON_ELEGGIBILE',
        message: 'Questa iniziativa non ha una raccolta firme ufficiale conclusa con quorum/soglia raggiunta.'
      });
    }

    const existingVote = await getCurrentPopularInitiativeVote(client, userId);
    if (String(existingVote?.iniziativa_id || '') === selectedId) {
      return res.json({
        success: true,
        unchanged: true,
        iniziativaId: selectedId,
        message: 'Preferenza già registrata.'
      });
    }

    const isAdmin = Boolean(req.user?.isAdmin);
    await assertPreferenceChangeAllowed(client, {
      userId,
      scope: 'iniziative-popolari:preferenza',
      fallbackChangedAt: existingVote?.timestamp || existingVote?.created_at || null,
      isAdmin
    });

    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(
      `DELETE FROM voti_iniziative_popolari WHERE userid::text = $1`,
      [String(userId)]
    );
    await client.query(
      `INSERT INTO voti_iniziative_popolari (userid, iniziativa_id)
       VALUES ($1::uuid, $2)`,
      [String(userId), selectedId]
    );
    await recordPreferenceChange(client, {
      userId,
      scope: 'iniziative-popolari:preferenza'
    });
    await client.query('COMMIT');
    transactionStarted = false;

    return res.json({
      success: true,
      unchanged: false,
      iniziativaId: selectedId,
      message: 'Preferenza salvata con successo.'
    });
  } catch (error) {
    if (transactionStarted && client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (sendCooldownError(res, error)) return;
    if (isMissingCivicSchemaError(error)) {
      return res.status(409).json({
        success: false,
        error: 'CIVIC_PROCESS_MIGRATION_REQUIRED',
        message: 'L’archivio canonico dei processi civici non è ancora disponibile.'
      });
    }
    console.error('❌ Errore nel salvataggio preferenza iniziativa popolare:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/iniziative-popolari/vota - consente di rimuovere una preferenza legacy già esistente
router.delete('/vota', verifyToken, async (req, res) => {
  let client = null;

  try {
    const userId = req.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Autenticazione richiesta'
      });
    }

    // Acquisisci client dopo le validazioni iniziali
    client = await pool.connect();

    const isAdmin = Boolean(req.user?.isAdmin);
    const existingVoteResult = await client.query(
      `SELECT iniziativa_id, timestamp
       FROM voti_iniziative_popolari
       WHERE userid::text = $1 OR userid = $1::uuid
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );
    const existingVote = existingVoteResult.rows[0] || null;
    if (!existingVote) {
      return res.json({ success: true, message: 'Nessun voto da cancellare', deletedCount: 0 });
    }

    await assertPreferenceChangeAllowed(client, {
      userId,
      scope: 'iniziative-popolari:preferenza',
      fallbackChangedAt: existingVote.timestamp || null,
      isAdmin
    });

    await client.query('BEGIN');

    // Cancella tutti i voti dell'utente
    const deleteQuery = `
      DELETE FROM voti_iniziative_popolari
      WHERE userid::text = $1 OR userid = $1::uuid
    `;
    const deleteResult = await client.query(deleteQuery, [userId]);

    await recordPreferenceChange(client, { userId, scope: 'iniziative-popolari:preferenza' });

    await client.query('COMMIT');

    debugLog(`✅ DEBUG /api/iniziative-popolari/vota DELETE - Voti eliminati: ${deleteResult.rowCount} (utente: ${userId}, admin: ${isAdmin})`);

    res.json({
      success: true,
      message: 'Voto cancellato con successo',
      deletedCount: deleteResult.rowCount
    });

  } catch (error) {
    if (sendCooldownError(res, error)) return;
    if (client) {
      try {
        await client.query('ROLLBACK').catch(err => {
          console.error('❌ Errore nel ROLLBACK:', err);
        });
      } catch (rollbackError) {
        console.error('❌ Errore durante tentativo di rollback:', rollbackError);
      }
    }

    console.error('❌ Errore nella cancellazione voto iniziative popolari:', error);
    console.error('❌ Stack trace:', error.stack);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Errore interno del server',
        details: error.message
      });
    }
  } finally {
    // Garantisce sempre il release del client
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Errore nel rilasciare client database:', releaseError);
      }
    }
  }
});

// GET /api/iniziative-popolari/debug - Debug per verificare la struttura delle tabelle
router.get('/debug', verifyToken, requireAdmin, async (req, res) => {
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
router.post('/richiesta', verifyToken, (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Endpoint legacy disabilitato',
    message: 'Usa il percorso canonico POST /api/iniziative-popolari. Identità del proponente e stato della proposta sono determinati dal server.'
  });
});

// GET /api/iniziative-popolari/richieste - Lista richieste di iniziative popolari (solo per Admin)
router.get('/richieste', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Query per ottenere le richieste pending
    const richiesteResult = await pool.query(
      'SELECT id, nome, data_inizio as "dataInizio", data_fine as "dataFine", sito_web as "sitoWeb", status, created_at FROM iniziative_popolari WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );

    debugLog('🔍 DEBUG /api/iniziative-popolari/richieste - Richieste trovate:', richiesteResult.rows.length);

    res.json(richiesteResult.rows);
  } catch (error) {
    console.error('❌ Errore nel recupero richieste iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/iniziative-popolari/prossima - Ottieni l'iniziativa con scadenza più vicina e più firme
router.get('/prossima', verifyToken, async (req, res) => {
  try {
    debugLog('🔍 GET /api/iniziative-popolari/prossima - Richiesta iniziativa più rilevante');

    const userId = req.userId;

    // Ottieni il ruolo dell'utente
    let userRole = null;
    try {
      const userQuery = `SELECT ruolo FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);
      if (userResult.rows.length > 0) {
        userRole = userResult.rows[0].ruolo;
        debugLog(`🔍 Ruolo utente: ${userRole}`);
      }
    } catch (authError) {
      debugLog('⚠️ Errore nel recupero ruolo utente:', authError.message);
    }

    // Usa la stessa logica dell'endpoint principale per iniziative_ministero
    // soloInCorso = true per mostrare solo iniziative in corso
    const votaOnly = false;
    const soloInCorso = true;
    const { query, params } = buildQueryForTipo('iniziativa', userRole, userId, votaOnly, soloInCorso);

    debugLog('🔍 Query iniziative_ministero (usando buildQueryForTipo):', query.substring(0, 200) + '...');
    const resultMinistero = await pool.query(query, params);
    debugLog(`✅ Trovate ${resultMinistero.rows.length} iniziative da iniziative_ministero`);

    // Query per iniziative_popolari: usa la stessa logica dell'endpoint principale
    // soloInCorso = true per mostrare solo iniziative in corso
    let iniziativePopolariResult = { rows: [] };
    try {
      let iniziativePopolariQuery;
      let iniziativePopolariParams = [];

      if (soloInCorso) {
        // Per listing: solo quelle con status = 'pending' o 'in attesa' o NULL (in corso)
        iniziativePopolariQuery = `
          SELECT
            id, nome, descrizione, data_inizio, data_fine,
            firme, sito_web, status, quorum, userid
          FROM iniziative_popolari
          WHERE (status IS NULL OR status = 'pending' OR status = 'in attesa' OR status = 'in_corso')
            AND quorum != 'proposta'
          ORDER BY
            CASE WHEN data_fine IS NULL THEN 1 ELSE 0 END,
            CASE WHEN data_fine IS NULL THEN '9999-12-31'::date ELSE data_fine END ASC,
            firme DESC NULLS LAST
          LIMIT 5
        `;
      } else {
        // Per admin o altre viste: tutte tranne le proposte (quorum != 'proposta')
        iniziativePopolariQuery = `
          SELECT
            id, nome, descrizione, data_inizio, data_fine,
            firme, sito_web, status, quorum, userid
          FROM iniziative_popolari
          WHERE quorum != 'proposta'
          ORDER BY
            CASE WHEN data_fine IS NULL THEN 1 ELSE 0 END,
            CASE WHEN data_fine IS NULL THEN '9999-12-31'::date ELSE data_fine END ASC,
            firme DESC NULLS LAST
          LIMIT 5
        `;
      }

      debugLog('🔍 Query iniziative_popolari:', iniziativePopolariQuery);
      // F12-26: le liste pubbliche derivano esclusivamente dalla fonte ufficiale Ministero.
      iniziativePopolariResult = { rows: [] };
      debugLog(`✅ Trovate ${iniziativePopolariResult.rows.length} iniziative da iniziative_popolari`);
    } catch (error) {
      debugWarn(`⚠️ Errore nel recupero iniziative_popolari:`, error.message);
      // Continua senza iniziative_popolari se c'è un errore
    }

    // Normalizza le iniziative dal ministero (mapToLegacyFormat già azzera i sentinel 9999)
    const iniziativeMinistero = resultMinistero.rows.map(row => {
      const mapped = mapToLegacyFormat(row, 'iniziativa');
      return {
        ...mapped,
        source: 'ministero',
        dataFine: mapped.dataFine ? new Date(mapped.dataFine) : null,
        firme: row.firme_raccolte || 0
      };
    });

    // Normalizza le iniziative popolari
    const iniziativePopolari = iniziativePopolariResult.rows.map(row => {
      const mapped = mapIniziativePopolariToLegacyFormat(row);
      return {
        ...mapped,
        source: 'popolari',
        dataFine: mapped.dataFine ? new Date(mapped.dataFine) : null,
        firme: row.firme || 0
      };
    });

    // Unisci tutte le iniziative
    const tutteIniziative = [...iniziativeMinistero, ...iniziativePopolari];

    if (tutteIniziative.length === 0) {
      debugLog('📭 Nessuna iniziativa in corso trovata');
      debugLog('🔍 Debug: resultMinistero.rows.length =', resultMinistero.rows.length);
      debugLog('🔍 Debug: resultPopolari.rows.length =', resultPopolari.rows.length);
      return res.json({
        success: true,
        data: null,
        message: 'Nessuna iniziativa in corso trovata'
      });
    }

    // Ordina per: 1) scadenza più vicina (data_fine ASC), 2) più firme (firme DESC)
    // Le iniziative senza data_fine vanno in fondo
    tutteIniziative.sort((a, b) => {
      // Se una non ha data_fine, mettila in fondo
      if (!a.dataFine && !b.dataFine) {
        return b.firme - a.firme; // Ordina per firme se entrambe senza data
      }
      if (!a.dataFine) return 1; // a senza data va in fondo
      if (!b.dataFine) return -1; // b senza data va in fondo

      // Entrambe hanno data_fine, ordina per scadenza più vicina (anche se passata)
      const dataDiff = a.dataFine.getTime() - b.dataFine.getTime();
      if (dataDiff !== 0) {
        return dataDiff; // Scadenza più vicina prima
      }
      return b.firme - a.firme; // Più firme prima (se stessa scadenza)
    });

    debugLog('🔍 Tutte le iniziative trovate:', tutteIniziative.map(i => ({
      nome: i.nome || i.titolo,
      data_fine: i.dataFine,
      firme: i.firme,
      source: i.source
    })));

    const iniziativa = tutteIniziative[0];

    // Aggiungi emoji automatica
    iniziativa.emoji = getEmojiAutomatica(iniziativa);

    debugLog(`✅ Iniziativa più rilevante trovata (${iniziativa.source}):`, iniziativa.nome || iniziativa.titolo);
    debugLog('🔍 Dettagli iniziativa:', {
      nome: iniziativa.nome || iniziativa.titolo,
      data_fine: iniziativa.data_fine || iniziativa.dataFine,
      firme: iniziativa.firme || iniziativa.firme_raccolte,
      source: iniziativa.source,
      allKeys: Object.keys(iniziativa)
    });

    res.json({
      success: true,
      data: iniziativa
    });
  } catch (error) {
    console.error('❌ Errore nel recupero iniziativa più rilevante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

// POST /api/iniziative-popolari/:id/accetta - Accetta richiesta iniziativa popolare
router.post('/:id/accetta', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

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

    debugLog('✅ DEBUG /api/iniziative-popolari/accetta - Richiesta accettata:', id);

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
router.post('/:id/rifiuta', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

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

    debugLog('✅ DEBUG /api/iniziative-popolari/rifiuta - Iniziativa rifiutata:', id);

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
