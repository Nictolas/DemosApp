const express = require('express');
const { requireVerifiedCivicIdentity } = require('../middleware/civicIdentity');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');
const { buildPoliticalMatches, getUserOpinionCompletion } = require('../services/politicalMatchingService');
const { listEligibleCandidates, isCandidateSelectionEligible } = require('../services/politicalEligibilityService');
const { getPoliticalConsentState } = require('../services/politicalConsentService');
const {
  getLegacySelectionDescriptors,
  getSelectionFieldContract,
  resolvePoliticalOffice,
} = require('../services/politicalJurisdictionRegistryService');
const {
  setPoliticalSelection,
  loadPoliticalSelections,
  selectionsByOffice,
} = require('../services/politicalSelectionService');

const router = express.Router();

// These authenticated endpoints return personal political selections or
// inferred compatibility scores. Apply before auth, including 401/4xx/5xx.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
});
const CANDIDATE_SELECTION_DESCRIPTORS = Object.freeze(getLegacySelectionDescriptors('candidate'));
const CANDIDATE_TEST_FIELD_MAPPING = Object.freeze(Object.fromEntries(
  CANDIDATE_SELECTION_DESCRIPTORS.map((item) => [item.testField, item.field])
));

function emptyCandidateSelectionProjection() {
  return {
    state: { source: 'WITHHELD', strict: true, selections: [] },
    projection: Object.fromEntries(CANDIDATE_SELECTION_DESCRIPTORS.map(({ field }) => [field, null])),
  };
}

async function loadCandidateSelectionProjection(userId) {
  // Election preferences are political personal data, not institutional records.
  // A revoked consent takes precedence over legacy selection rows.
  const consent = await getPoliticalConsentState(pool, userId);
  if (!consent.granted) return emptyCandidateSelectionProjection();

  const state = await loadPoliticalSelections(pool, { userId, kind: 'candidate', adapterId: 'it' });
  // A revocation may have completed while the selection store was queried.
  const finalConsent = await getPoliticalConsentState(pool, userId);
  if (!finalConsent.granted) return emptyCandidateSelectionProjection();

  const byOffice = selectionsByOffice(state);
  const projection = Object.fromEntries(CANDIDATE_SELECTION_DESCRIPTORS.map((descriptor) => [
    descriptor.field,
    byOffice.get(descriptor.officeId)?.selectedUserId || null,
  ]));
  return { state, projection };
}

// GET /api/candidati - Ottieni selezioni candidati dell'utente corrente
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const selectionState = await loadCandidateSelectionProjection(userId);
    const identityResult = await pool.query(
      'SELECT id, nome, cognome, ruolo, status, avatar_config FROM users WHERE id = $1',
      [userId],
    );
    const identity = identityResult.rows[0];
    const user = identity ? { ...identity, ...selectionState.projection } : null;
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Inizializza le strutture dati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Campi candidati da controllare
    const campiCandidati = CANDIDATE_SELECTION_DESCRIPTORS.map(({ field, category }) => ({ campo: field, categoria: category }));
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo il filtro ruolo per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            
            ruolo,
            status,
            avatar_config,
            grado_candidatura
          FROM users
          WHERE id::text = $1
        `;

        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);

        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;

        } else {

        }
      }
    }


    // Last check protects the serialized response if revocation completed
    // during selected-candidate detail fetching. Never return old choices.
    const finalConsent = await getPoliticalConsentState(pool, userId);
    res.json({
      success: true,
      data: {
        candidati: finalConsent.granted ? candidatiSelezionati : {},
        idMap: finalConsent.granted ? idMap : {}
      }
    });
    
  } catch (error) {

    console.error('Errore interno nella lettura delle selezioni candidati');

    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

// GET /api/candidati/sostenitori - Ottieni sostenitori candidati di un utente
router.get('/sostenitori', verifyToken, async (req, res) => {
  try {
    const { sostenuto_id } = req.query;
    
    if (!sostenuto_id) {
      return res.status(400).json({
        success: false,
        error: 'ID sostenuto richiesto'
      });
    }

    if (String(req.userId) !== String(sostenuto_id) && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato'
      });
    }

    // Trova tutti gli utenti che hanno scelto questo utente come candidato
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.data_nascita,
        u.genere,
        u.regione_residenza,
        u.provincia_residenza,
        u.comune_residenza,
        u.created_at,
        CASE 
          WHEN u.candidato_europeo = $1 THEN 'Candidato Europeo'
          WHEN u.candidato_camera = $1 THEN 'Candidato Camera'
          WHEN u.candidato_senato = $1 THEN 'Candidato Senato'
          WHEN u.candidato_regionale = $1 THEN 'Candidato Regionale'
          WHEN u.candidato_comune = $1 THEN 'Candidato Comunale'
        END as supporter_role
      FROM users u
      WHERE (
        u.candidato_europeo = $1 OR
        u.candidato_camera = $1 OR
        u.candidato_senato = $1 OR
        u.candidato_regionale = $1 OR
        u.candidato_comune = $1
      )
      AND u.status = 'a'
      ORDER BY u.created_at DESC
    `, [sostenuto_id]);

    const sostenitori = result.rows;

    res.json({
      success: true,
      data: {
        sostenitori: req.user?.isAdmin ? sostenitori : [],
        count: sostenitori.length
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare sostenitori candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sostenitori candidati'
    });
  }
});

// GET /api/candidati/europei - Alias compatibile sul motore canonico di eleggibilità.
router.get('/europei', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const eligibility = await listEligibleCandidates(pool, userId, 'E');
    const matching = await buildPoliticalMatches({ pool, userId, subjects: eligibility.subjects, grade: 'E' });
    const candidati = matching.matches.slice(0, 4);
    return res.json({
      success: true,
      data: candidati,
      count: candidati.length,
      eligibility: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason }
    });
  } catch (error) {
    console.error('❌ Errore /api/candidati/europei:', error);
    return res.status(500).json({ success: false, error: 'Errore nel recuperare i candidati europei' });
  }
});

// GET /api/candidati/disponibili - Ottieni candidati disponibili per grado_candidatura
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_candidatura } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Richiesta ricevuta:', { grado_candidatura, userId });
    
    if (!grado_candidatura) {
      return res.status(400).json({
        success: false,
        error: 'Parametro grado_candidatura richiesto'
      });
    }
    
    // Fonte canonica: candidature attive legate a elezione + unità elettorale.
    // Finché la migrazione DB non è applicata, il servizio ricade sul legacy per compatibilità.
    const eligibility = await listEligibleCandidates(pool, userId, grado_candidatura);
    const candidati = eligibility.subjects;
    
        console.log('🔍 DEBUG - Candidati trovati:', candidati.length);
        candidati.forEach((candidato, index) => {
          console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome} (${candidato.ruolo})`);
        });
    
    const office = resolvePoliticalOffice(grado_candidatura);
    const gradoDatabase = office?.opinionGrade || grado_candidatura;

    const matching = await buildPoliticalMatches({
      pool,
      userId,
      subjects: candidati,
      grade: gradoDatabase
    });
    const candidatiMappati = matching.matches.slice(0, 4);

    console.log('🔍 DEBUG - Candidati finali matching:', candidatiMappati.map((candidato) => ({
      id: candidato.id,
      score: candidato.matching_score,
      compatibilita: candidato.compatibilita_percentuale,
      copertura: `${candidato.copertura_posizioni}/${candidato.copertura_totale}`
    })));

    res.json({
      success: true,
      data: candidatiMappati,
      count: candidatiMappati.length,
      message: `Trovati ${candidatiMappati.length} candidati più compatibili per grado_candidatura: ${grado_candidatura}`,
      eligibility: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare i candidati'
    });
  }
});

// PUT /api/candidati/seleziona-candidato - Seleziona candidato per categoria
router.put('/seleziona-candidato', verifyToken, requireVerifiedCivicIdentity, async (req, res) => {
  try {
    console.log('🎯 PUT /api/candidati/seleziona-candidato - Selezione candidato');
    
    const { campo, candidatoId } = req.body;
    const userId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId:', userId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - candidatoId:', candidatoId);
    
    // Compatibilità client: i vecchi test_* vengono tradotti dall'adapter politico.
    const realField = CANDIDATE_TEST_FIELD_MAPPING[campo] || null;
    if (!realField) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido per le selezioni di candidati'
      });
    }

    const fieldContract = getSelectionFieldContract(realField);
    let selectedCandidacyId = null;

    // Il gate è una regola backend, non soltanto un alert UI.
    // La rimozione di una selezione resta sempre consentita.
    if (candidatoId !== null && candidatoId !== undefined && candidatoId !== '') {
      const opinionGrade = fieldContract?.office?.opinionGrade;
      const eligibilityGrade = fieldContract?.office?.aliases?.[0];
      const completion = await getUserOpinionCompletion(pool, userId, opinionGrade);
      if (!completion.isComplete) {
        return res.status(409).json({
          success: false,
          error: 'OPINIONI_INCOMPLETE',
          message: 'Completa tutte le Opinioni di questo livello prima di scegliere un candidato.',
          data: {
            totalOpinions: completion.totalOpinions,
            answeredOpinions: completion.answeredOpinions,
            missingOpinions: completion.missingOpinions
          }
        });
      }
      const eligibility = await isCandidateSelectionEligible(
        pool,
        userId,
        candidatoId,
        eligibilityGrade
      );
      const selectedSubject = eligibility.subjects?.find((row) => String(row.id) === String(candidatoId));
      selectedCandidacyId = selectedSubject?.candidacy_id || null;
      if (!eligibility.eligible) {
        return res.status(422).json({
          success: false,
          error: 'CANDIDATO_NON_VOTABILE',
          message: 'Il candidato selezionato non è votabile nella tua elezione/circoscrizione.',
          data: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason }
        });
      }
    }

    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      await setPoliticalSelection(client, {
        userId,
        kind: 'candidate',
        officeValue: fieldContract.office.id,
        selectedUserId: candidatoId || null,
        selectedCandidacyId,
        source: 'matching',
      });
      result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Candidato selezionato con successo');
    
    res.json({
      success: true,
      message: 'Candidato selezionato con successo',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore durante la selezione candidato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/candidati/selezioni - Ottieni selezioni di candidati dell'utente
router.get('/selezioni', verifyToken, async (req, res) => {
  try {

    const userId = req.userId;

    const selectionState = await loadCandidateSelectionProjection(userId);
    const user = selectionState.projection;

    // Ottieni i dettagli dei candidati selezionati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Lista dei campi candidati
    const campiCandidati = CANDIDATE_SELECTION_DESCRIPTORS.map(({ field, category }) => ({ campo: field, categoria: category }));
    
    for (const { campo, categoria } of campiCandidati) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Cerca il candidato selezionato (rimuoviamo i filtri per trovare tutti gli utenti)
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            
            ruolo,
            status,
            avatar_config
          FROM users
          WHERE id::text = $1
        `;

        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);

        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          candidatiSelezionati[categoria] = [candidato];
          idMap[categoria] = candidatoId;

        } else {

        }
      }
    }


    // Last check protects the serialized response if revocation completed
    // during selected-candidate detail fetching. Never return old choices.
    const finalConsent = await getPoliticalConsentState(pool, userId);
    res.json({
      success: true,
      data: {
        candidati: finalConsent.granted ? candidatiSelezionati : {},
        idMap: finalConsent.granted ? idMap : {}
      }
    });
    
  } catch (error) {

    console.error('Errore interno nella lettura delle selezioni candidati');

    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare selezioni candidati utente'
    });
  }
});

module.exports = router;
