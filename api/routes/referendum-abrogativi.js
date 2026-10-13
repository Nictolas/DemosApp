const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { mapToLegacyFormat, buildQueryForTipo, mapReferendumAbrogativiToLegacyFormat } = require('../utils/iniziativeMinisteroMapper');
const { getPool } = require('../config/database');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};
const debugWarn = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.warn(...args);
};

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
function referendumPriorityRetired(res) {
  return res.status(410).json({
    success: false,
    error: 'PRIORITA_REFERENDUM_DISMESSA',
    message: 'DEMOS non usa una classifica di priorità tra referendum. Consulta la raccolta ufficiale dei referendum.'
  });
}

// GET /api/referendum-abrogativi - raccolta ufficiale dei referendum in corso.
// La priorità DEMOS tra referendum è stata ritirata: ?vota=true resta solo come alias legacy fail-closed.
router.get('/', async (req, res) => {
  try {
    if (req.query.vota === 'true') {
      return referendumPriorityRetired(res);
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Fonte canonica attuale: iniziative_ministero sincronizzata dalla fonte ufficiale.
    // Mostriamo solo le raccolte in corso; nessuna classifica, preferenza utente o cooldown.
    const { query, params } = buildQueryForTipo('referendum', null, null, false, true);
    const result = await pool.query(query, params);

    const normalizedData = result.rows
      .map(row => mapToLegacyFormat(row, 'referendum'))
      .map(referendum => ({
        ...referendum,
        emoji: getEmojiAutomaticaReferendum(referendum)
      }));

    res.json({
      success: true,
      richieste: normalizedData,
      referendum: normalizedData
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare referendum abrogativi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare referendum abrogativi'
    });
  }
});

// POST /api/referendum-abrogativi - Crea richiesta referendum abrogativo (come ICE)
router.post('/', verifyToken, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'PROPOSTA_MANUALE_DISABILITATA',
    message: 'I referendum in DEMOS provengono esclusivamente dalla fonte ufficiale sincronizzata.'
  });

  try {
    debugLog('🔍 DEBUG POST: Inizio creazione referendum abrogativo');

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
        debugLog('⚠️ DEBUG POST: Utente ha già una proposta in attesa, bloccando nuovo inserimento');
        return res.status(400).json({
          success: false,
          error: 'Hai già una proposta in attesa di approvazione. Puoi proporre solo un referendum alla volta.'
        });
      }

      // Genera un UUID valido per la richiesta referendum
      const crypto = require('crypto');
      const referendumId = crypto.randomUUID();
      debugLog('🔍 DEBUG: Referendum ID generato:', referendumId);

      // Definisce i parametri per la query - include userid e quorum = 'proposta'
      const params = [referendumId, userId, nome, descrizione, dataInizio, dataFine, sitoWeb];

      // Inserisce con quorum = 'proposta' e userid dell'utente che propone
      // NOTA: La colonna si chiama 'sitoweb' non 'sito_web' nella tabella referendum_abrogativi
      const query = `
        INSERT INTO referendum_abrogativi (id, userid, nome, descrizione, data_inizio, data_fine, sitoweb, quorum)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'proposta')
        RETURNING *
      `;

      debugLog('🔍 DEBUG POST: Parametri query:', params);
      debugLog('🔍 DEBUG POST: Esecuzione query INSERT in transazione...');
      debugLog('🔍 DEBUG POST: Query:', query);

      const result = await client.query(query, params);
      debugLog('🔍 DEBUG POST: Risultato inserimento:', result.rows[0]);
      debugLog('🔍 DEBUG POST: Numero righe inserite:', result.rowCount);

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

      debugLog(`✅ Referendum proposta creata: ${referendumId} per utente: ${userId}`);

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
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descrizione, dataInizio, dataFine, sitoWeb, quorum, firme } = req.body;

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

    debugLog(`✅ Referendum abrogativo aggiornato: ${id}, nuovo quorum: ${quorum}`);

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
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === 'vota') return next();

    const userId = req.userId;
    const isAdmin = Boolean(req.user?.isAdmin);

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
      const isOwner = String(referendum.userid) === String(userId) && referendum.quorum === 'proposta';

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

    debugLog(`✅ Referendum abrogativo eliminato: ${id} da utente: ${userId} (${isAdmin ? 'Admin' : 'Proprietario'})`);

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
router.post('/:id/accetta', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

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

    debugLog('✅ DEBUG /api/referendum-abrogativi/accetta - Referendum approvato:', id);

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
router.post('/:id/rifiuta', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

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

    debugLog('✅ DEBUG /api/referendum-abrogativi/rifiuta - Referendum rifiutato:', id);

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

// POST /api/referendum-abrogativi/vota - endpoint legacy: la priorità tra referendum è dismessa.
router.post('/vota', verifyToken, async (req, res) => {
  return referendumPriorityRetired(res);
});

// DELETE /api/referendum-abrogativi/vota - endpoint legacy: la priorità tra referendum è dismessa.
router.delete('/vota', verifyToken, async (req, res) => {
  return referendumPriorityRetired(res);
});

// GET /api/referendum-abrogativi/prossima - Ottieni il referendum con scadenza più vicina
router.get('/prossima', verifyToken, async (req, res) => {
  try {
    debugLog('🔍 GET /api/referendum-abrogativi/prossima - Richiesta referendum più imminente');

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
    // soloInCorso = true per mostrare solo referendum in corso
    const votaOnly = false;
    const soloInCorso = true;
    const { query, params } = buildQueryForTipo('referendum', userRole, userId, votaOnly, soloInCorso);

    debugLog('🔍 Query iniziative_ministero (usando buildQueryForTipo):', query.substring(0, 200) + '...');
    const resultMinistero = await pool.query(query, params);
    debugLog(`✅ Trovati ${resultMinistero.rows.length} referendum da iniziative_ministero`);

    // Query per referendum_abrogativi: usa la stessa logica dell'endpoint principale
    // soloInCorso = true per mostrare solo referendum in corso
    let referendumAbrogativiResult = { rows: [] };
    try {
      let referendumAbrogativiQuery;
      let referendumAbrogativiParams = [];

      if (soloInCorso) {
        // Per listing: solo quelle con status = 'P' o 'p' (pending, in corso)
        referendumAbrogativiQuery = `
          SELECT
            id, nome, descrizione, data_inizio, data_fine,
            firme, sito_web, status, quorum, firestore_id_backup
          FROM referendum_abrogativi
          WHERE (status = 'P' OR status = 'p')
          ORDER BY
            CASE WHEN data_fine IS NULL THEN 1 ELSE 0 END,
            CASE WHEN data_fine IS NULL THEN '9999-12-31'::date ELSE data_fine END ASC,
            firme DESC NULLS LAST
          LIMIT 5
        `;
      } else {
        // Per admin o altre viste: tutte tranne le proposte (status != NULL)
        referendumAbrogativiQuery = `
          SELECT
            id, nome, descrizione, data_inizio, data_fine,
            firme, sito_web, status, quorum, firestore_id_backup
          FROM referendum_abrogativi
          WHERE status IS NOT NULL
          ORDER BY
            CASE WHEN data_fine IS NULL THEN 1 ELSE 0 END,
            CASE WHEN data_fine IS NULL THEN '9999-12-31'::date ELSE data_fine END ASC,
            firme DESC NULLS LAST
          LIMIT 5
        `;
      }

      debugLog('🔍 Query referendum_abrogativi:', referendumAbrogativiQuery);
      // F12-26: le liste pubbliche derivano esclusivamente dalla fonte ufficiale Ministero.
      referendumAbrogativiResult = { rows: [] };
      debugLog(`✅ Trovati ${referendumAbrogativiResult.rows.length} referendum da referendum_abrogativi`);
    } catch (error) {
      debugWarn(`⚠️ Errore nel recupero referendum_abrogativi:`, error.message);
      // Continua senza referendum_abrogativi se c'è un errore
    }

    // Normalizza i referendum dal ministero (mapToLegacyFormat già azzera i sentinel 9999)
    const referendumMinistero = resultMinistero.rows.map(row => {
      const mapped = mapToLegacyFormat(row, 'referendum');
      return {
        ...mapped,
        source: 'ministero',
        dataFine: mapped.dataFine ? new Date(mapped.dataFine) : null,
        firme: row.firme_raccolte || 0
      };
    });

    // Normalizza i referendum abrogativi
    const referendumAbrogativi = referendumAbrogativiResult.rows.map(row => {
      const mapped = mapReferendumAbrogativiToLegacyFormat(row);
      return {
        ...mapped,
        source: 'abrogativi',
        dataFine: mapped.dataFine ? new Date(mapped.dataFine) : null,
        firme: row.firme || 0
      };
    });

    // Unisci tutti i referendum
    const tuttiReferendum = [...referendumMinistero, ...referendumAbrogativi];

    if (tuttiReferendum.length === 0) {
      debugLog('📭 Nessun referendum in corso trovato');
      debugLog('🔍 Debug: resultMinistero.rows.length =', resultMinistero.rows.length);
      debugLog('🔍 Debug: referendumAbrogativiResult.rows.length =', referendumAbrogativiResult.rows.length);
      return res.json({
        success: true,
        data: null,
        message: 'Nessun referendum in corso trovato'
      });
    }

    // Ordina per: 1) scadenza più vicina (data_fine ASC), 2) più firme (firme DESC)
    // I referendum senza data_fine vanno in fondo
    tuttiReferendum.sort((a, b) => {
      // Se uno non ha data_fine, mettilo in fondo
      if (!a.dataFine && !b.dataFine) {
        return b.firme - a.firme; // Ordina per firme se entrambi senza data
      }
      if (!a.dataFine) return 1; // a senza data va in fondo
      if (!b.dataFine) return -1; // b senza data va in fondo

      // Entrambi hanno data_fine, ordina per scadenza più vicina (anche se passata)
      const dataDiff = a.dataFine.getTime() - b.dataFine.getTime();
      if (dataDiff !== 0) {
        return dataDiff; // Scadenza più vicina prima
      }
      return b.firme - a.firme; // Più firme prima (se stessa scadenza)
    });

    debugLog('🔍 Tutti i referendum trovati:', tuttiReferendum.map(r => ({
      nome: r.nome || r.titolo,
      data_fine: r.dataFine,
      firme: r.firme,
      source: r.source
    })));

    const referendum = tuttiReferendum[0];

    // Aggiungi emoji automatica
    referendum.emoji = getEmojiAutomaticaReferendum(referendum);

    debugLog(`✅ Referendum più imminente trovato (${referendum.source}):`, referendum.nome || referendum.titolo);
    debugLog('🔍 Dettagli referendum:', {
      nome: referendum.nome || referendum.titolo,
      data_fine: referendum.data_fine || referendum.dataFine,
      firme: referendum.firme || referendum.firme_raccolte,
      source: referendum.source,
      allKeys: Object.keys(referendum)
    });

    res.json({
      success: true,
      data: referendum
    });
  } catch (error) {
    console.error('❌ Errore nel recupero referendum più imminente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;
