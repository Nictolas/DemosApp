const express = require('express');
const { requireVerifiedCivicIdentity } = require('../../middleware/civicIdentity');
const { pool, verifyToken, requireAdmin } = require('../../middleware/auth');
const { userDataAuditMiddleware } = require('../../middleware/auditMiddleware');
const { decompressUserOpinions, compressUserOpinions, getOpinionColumns } = require('../../utils/opinionUtils');
const { compressUserLocation, decompressUserLocation } = require('../../utils/locationUtils');
const { decompressGender } = require('../../utils/genderUtils');
const { getAccountSubject } = require('../../services/accountCapabilitiesService');
const { getUserOpinionCompletion } = require('../../services/politicalMatchingService');
const { normalizeOpinionAnswer } = require('../../utils/politicalMatching');
const { isCandidateSelectionEligible, isRepresentativeSelectionEligible } = require('../../services/politicalEligibilityService');
const {
  getLegacySelectionFields,
  getSelectionFieldContract,
} = require('../../services/politicalJurisdictionRegistryService');
const {
  resolveSelectionContract,
  setPoliticalSelection,
} = require('../../services/politicalSelectionService');

const { getAllOpinions, getOpinionsForGrade, sortOpinionsByText } = require('../../services/opinionCatalog');

const router = express.Router();
const isSchemaMigrationError = (error) => (
  error &&
  (error.code === '42P01' || error.code === '42703')
);
const PROFILE_FIELDS = new Set([
  'genere', 'data_nascita', 'cittadinanza',
  'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
  'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
  'grado_candidatura', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
  'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url', 'twitch_url', 'youtube_url',
  'avatar_config'
]);
const REPRESENTATIVE_FIELDS = new Set(getLegacySelectionFields('both'));

// GET /api/users/me - Ottieni profilo utente autenticato
router.get('/me', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/me - Richiesta profilo utente');
    
    const userId = req.user.id;
    
    // Recupera dati utente completi
    let result;
    try {
      result = await pool.query(`
        SELECT
          u.id, u.email, u.nome, u.cognome, u.ruolo, u.status, u.created_at, u.updated_at,
          COALESCE(up.genere, u.genere) AS genere,
          COALESCE(up.data_nascita, u.data_nascita) AS data_nascita,
          COALESCE(up.cittadinanza, u.cittadinanza) AS cittadinanza,
          COALESCE(up.paese_residenza, u.paese_residenza) AS paese_residenza,
          COALESCE(up.regione_residenza, u.regione_residenza) AS regione_residenza,
          COALESCE(up.provincia_residenza, u.provincia_residenza) AS provincia_residenza,
          COALESCE(up.comune_residenza, u.comune_residenza) AS comune_residenza,
          COALESCE(up.grado_elezione, u.grado_elezione) AS grado_elezione,
          COALESCE(up.paese_elezione, u.paese_elezione) AS paese_elezione,
          COALESCE(up.regione_elezione, u.regione_elezione) AS regione_elezione,
          COALESCE(up.provincia_elezione, u.provincia_elezione) AS provincia_elezione,
          COALESCE(up.comune_elezione, u.comune_elezione) AS comune_elezione,
          COALESCE(up.grado_candidatura, u.grado_candidatura) AS grado_candidatura,
          COALESCE(up.paese_candidatura, u.paese_candidatura) AS paese_candidatura,
          COALESCE(up.regione_candidatura, u.regione_candidatura) AS regione_candidatura,
          COALESCE(up.provincia_candidatura, u.provincia_candidatura) AS provincia_candidatura,
          COALESCE(up.comune_candidatura, u.comune_candidatura) AS comune_candidatura,
          COALESCE(ur.rappresentante_europeo, u.rappresentante_europeo) AS rappresentante_europeo,
          COALESCE(ur.rappresentante_camera, u.rappresentante_camera) AS rappresentante_camera,
          COALESCE(ur.rappresentante_senato, u.rappresentante_senato) AS rappresentante_senato,
          COALESCE(ur.rappresentante_regionale, u.rappresentante_regionale) AS rappresentante_regionale,
          COALESCE(ur.rappresentante_comune, u.rappresentante_comune) AS rappresentante_comune,
          COALESCE(ur.candidato_europeo, u.candidato_europeo) AS candidato_europeo,
          COALESCE(ur.candidato_camera, u.candidato_camera) AS candidato_camera,
          COALESCE(ur.candidato_senato, u.candidato_senato) AS candidato_senato,
          COALESCE(ur.candidato_regionale, u.candidato_regionale) AS candidato_regionale,
          COALESCE(ur.candidato_comune, u.candidato_comune) AS candidato_comune,
          COALESCE(up.avatar_config::text, u.avatar_config::text) AS avatar_config,
          COALESCE(up.facebook_url, u.facebook_url) AS facebook_url,
          COALESCE(up.twitter_url, u.twitter_url) AS twitter_url,
          COALESCE(up.instagram_url, u.instagram_url) AS instagram_url,
          COALESCE(up.linkedin_url, u.linkedin_url) AS linkedin_url,
          COALESCE(up.telegram_url, u.telegram_url) AS telegram_url,
          COALESCE(up.website_url, u.website_url) AS website_url,
          COALESCE(up.twitch_url, u.twitch_url) AS twitch_url,
          COALESCE(up.youtube_url, u.youtube_url) AS youtube_url
        FROM users u
        LEFT JOIN user_profile up ON up.user_id = u.id
        LEFT JOIN user_representatives ur ON ur.user_id = u.id
        WHERE u.id = $1
      `, [userId]);
    } catch (queryError) {
      if (!isSchemaMigrationError(queryError)) {
        throw queryError;
      }

      console.warn('⚠️ Fallback query /users/me su users (schema nuovo non disponibile):', queryError.message);
      result = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [userId]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    console.log('✅ Profilo utente recuperato:', user.email);
    
    // Data/anno di nascita: se è 1º gennaio restituiamo solo l'anno (GDPR), altrimenti DD/MM/YYYY
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      if (data.getMonth() === 0 && data.getDate() === 1) {
        dataNascitaFormattata = String(data.getFullYear());
      } else {
        dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
      }
    }
    
    // Gestisci avatar_config - può essere un oggetto JSONB o una stringa JSON
    let avatarConfig = null;
    if (user.avatar_config) {
      try {
        // Se è già un oggetto (JSONB dal database), usalo direttamente
        if (typeof user.avatar_config === 'object' && user.avatar_config !== null) {
          avatarConfig = JSON.stringify(user.avatar_config);
        } 
        // Se è una stringa, verifica che sia JSON valido
        else if (typeof user.avatar_config === 'string') {
          // Verifica se è già un JSON valido
          JSON.parse(user.avatar_config);
          avatarConfig = user.avatar_config;
        }
      } catch (e) {
        console.warn('⚠️ Errore nella gestione avatar_config:', e);
        // Se non è JSON valido, imposta null
        avatarConfig = null;
      }
    }
    
    // Applica decompressione per i dati geografici
    const decompressedUser = decompressUserLocation(user);
    
    res.json({
      success: true,
      user: {
        id: decompressedUser.id,
        email: decompressedUser.email,
        nome: decompressedUser.nome,
        cognome: decompressedUser.cognome,
        genere: decompressGender(decompressedUser.genere),
        data_nascita: dataNascitaFormattata,
        cittadinanza: decompressedUser.cittadinanza,
        paese_residenza: decompressedUser.paese_residenza,
        regione_residenza: decompressedUser.regione_residenza,
        provincia_residenza: decompressedUser.provincia_residenza,
        comune_residenza: decompressedUser.comune_residenza,
        ruolo: decompressedUser.ruolo,
        grado_elezione: decompressedUser.grado_elezione,
        paese_elezione: decompressedUser.paese_elezione,
        regione_elezione: decompressedUser.regione_elezione,
        provincia_elezione: decompressedUser.provincia_elezione,
        comune_elezione: decompressedUser.comune_elezione,
        grado_candidatura: decompressedUser.grado_candidatura,
        paese_candidatura: decompressedUser.paese_candidatura,
        regione_candidatura: decompressedUser.regione_candidatura,
        provincia_candidatura: decompressedUser.provincia_candidatura,
        comune_candidatura: decompressedUser.comune_candidatura,
        rappresentante_europeo: decompressedUser.rappresentante_europeo,
        rappresentante_camera: decompressedUser.rappresentante_camera,
        rappresentante_senato: decompressedUser.rappresentante_senato,
        rappresentante_regionale: decompressedUser.rappresentante_regionale,
        rappresentante_comune: decompressedUser.rappresentante_comune,
        candidato_europeo: decompressedUser.candidato_europeo,
        candidato_camera: decompressedUser.candidato_camera,
        candidato_senato: decompressedUser.candidato_senato,
        candidato_regionale: decompressedUser.candidato_regionale,
        candidato_comune: decompressedUser.candidato_comune,
        status: decompressedUser.status,
        avatar_config: avatarConfig,
        created_at: decompressedUser.created_at,
        updated_at: decompressedUser.updated_at,
        facebook_url: decompressedUser.facebook_url,
        twitter_url: decompressedUser.twitter_url,
        instagram_url: decompressedUser.instagram_url,
        linkedin_url: decompressedUser.linkedin_url,
        telegram_url: decompressedUser.telegram_url,
        website_url: decompressedUser.website_url,
        twitch_url: decompressedUser.twitch_url,
        youtube_url: decompressedUser.youtube_url
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/users/me/avatar - Aggiorna configurazione avatar
router.post('/me/avatar', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar_config } = req.body;
    
    console.log('🎨 POST /api/users/me/avatar - Aggiornamento avatar per utente:', userId);
    
    if (!avatar_config) {
      return res.status(400).json({
        success: false,
        error: 'Configurazione avatar richiesta'
      });
    }
    
    // Aggiorna la configurazione avatar
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(
        'UPDATE users SET avatar_config = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_config',
        [avatar_config, userId]
      );
      await client.query(
        `INSERT INTO user_profile (user_id, avatar_config)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           avatar_config = EXCLUDED.avatar_config,
           updated_at = NOW()`,
        [userId, avatar_config]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Avatar aggiornato per utente:', userId);
    
    res.json({
      success: true,
      message: 'Avatar aggiornato con successo',
      avatar_config: result.rows[0].avatar_config
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/users/me - Aggiorna profilo utente autenticato
router.put('/me', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('✏️ PUT /api/users/me - Aggiornamento profilo utente');
    
    const userId = req.user.id;
    const updateData = req.body;
    
    // Lista dei campi consentiti per l'aggiornamento
    const allowedFields = [
      'nome', 'cognome', 'data_nascita', 'cittadinanza',
      'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
      'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
      'grado_elezione', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura',
      'comune_candidatura', 'grado_candidatura',
      'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url', 'website_url', 'twitch_url', 'youtube_url'
    ];
    
    // Normalizza i gradi di elezione e candidatura (tutto maiuscolo)
    const normalizeGrado = (grado) => {
      // Se è null o undefined, restituisci null (per permettere la cancellazione)
      if (grado === null || grado === undefined) return null;
      // Se non è una stringa, restituisci il valore originale
      if (typeof grado !== 'string') return grado;
      // Se è una stringa vuota, restituisci null
      if (grado.trim() === '') return null;
      // I valori validi sono: CO, P, R, N, C, S, E (tutti maiuscoli)
      return grado.toUpperCase();
    };
    
    // Filtra solo i campi consentiti e applica compressione per i dati geografici e ruolo
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        // Normalizza i gradi di elezione e candidatura
        if (key === 'grado_elezione' || key === 'grado_candidatura') {
          filteredData[key] = normalizeGrado(updateData[key]);
          console.log(`🔧 Grado ${key} normalizzato:`, updateData[key], '→', filteredData[key]);
        }
        // Applica compressione per i campi paese
        else if (key === 'paese_residenza' || key === 'paese_elezione' || key === 'paese_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        } 
        // Applica compressione per le regioni
        else if (key === 'regione_residenza' || key === 'regione_elezione' || key === 'regione_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        }
        // Applica compressione per le province
        else if (key === 'provincia_residenza' || key === 'provincia_elezione' || key === 'provincia_candidatura') {
          const compressedValue = compressUserLocation({ [key]: updateData[key] })[key];
          filteredData[key] = compressedValue;
        }
        // GDPR: data_nascita può essere solo anno (YYYY) → salviamo come YYYY-01-01
        else if (key === 'data_nascita') {
          const v = String(updateData[key]).trim();
          if (/^\d{4}$/.test(v)) {
            filteredData[key] = `${v}-01-01`;
          } else {
            filteredData[key] = updateData[key];
          }
        } else {
          filteredData[key] = updateData[key];
        }
      }
    });
    
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo valido da aggiornare'
      });
    }
    
    // Costruisci la query di aggiornamento dinamicamente
    const setClause = Object.keys(filteredData).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(filteredData);
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`;
    
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(query, [...values, userId]);

      const profileData = {};
      for (const [k, v] of Object.entries(filteredData)) {
        if (PROFILE_FIELDS.has(k)) profileData[k] = v;
      }

      if (Object.keys(profileData).length > 0) {
        const profileKeys = Object.keys(profileData);
        const profileValues = Object.values(profileData);
        const profileColumns = profileKeys.join(', ');
        const profileParams = profileKeys.map((_, idx) => `$${idx + 2}`).join(', ');
        const profileSet = profileKeys.map((k, idx) => `${k} = $${idx + 2}`).join(', ');
        await client.query(
          `INSERT INTO user_profile (user_id, ${profileColumns})
           VALUES ($1, ${profileParams})
           ON CONFLICT (user_id) DO UPDATE SET
             ${profileSet},
             updated_at = NOW()`,
          [userId, ...profileValues]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const updatedUser = result.rows[0];
    console.log('✅ Profilo utente aggiornato:', updatedUser.email);
    
    // Data/anno di nascita: se è 1º gennaio restituiamo solo l'anno (GDPR)
    let dataNascitaFormattata = null;
    if (updatedUser.data_nascita) {
      const data = new Date(updatedUser.data_nascita);
      if (data.getMonth() === 0 && data.getDate() === 1) {
        dataNascitaFormattata = String(data.getFullYear());
      } else {
        dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
      }
    }
    
    res.json({
      success: true,
      message: 'Profilo aggiornato con successo',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        nome: updatedUser.nome,
        cognome: updatedUser.cognome,
        genere: updatedUser.genere,
        data_nascita: dataNascitaFormattata,
        cittadinanza: updatedUser.cittadinanza,
        paese_residenza: updatedUser.paese_residenza,
        regione_residenza: updatedUser.regione_residenza,
        provincia_residenza: updatedUser.provincia_residenza,
        comune_residenza: updatedUser.comune_residenza,
        ruolo: updatedUser.ruolo,
        grado_elezione: updatedUser.grado_elezione,
        paese_elezione: updatedUser.paese_elezione,
        regione_elezione: updatedUser.regione_elezione,
        provincia_elezione: updatedUser.provincia_elezione,
        comune_elezione: updatedUser.comune_elezione,
        grado_candidatura: updatedUser.grado_candidatura,
        paese_candidatura: updatedUser.paese_candidatura,
        regione_candidatura: updatedUser.regione_candidatura,
        provincia_candidatura: updatedUser.provincia_candidatura,
        comune_candidatura: updatedUser.comune_candidatura,
        status: updatedUser.status,
        avatar_config: updatedUser.avatar_config,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// PUT /api/users/:userId/seleziona-rappresentante - Seleziona rappresentante o candidato per categoria
router.put('/:userId/seleziona-rappresentante', verifyToken, requireVerifiedCivicIdentity, async (req, res) => {
  try {
    console.log('🎯 PUT /api/users/:userId/seleziona-rappresentante - Selezione rappresentante/candidato');
    
    const { userId } = req.params;
    const { campo, rappresentanteId, source = 'matching' } = req.body;
    const authenticatedUserId = req.userId; // ID dell'utente autenticato dal token
    
    console.log('🔍 DEBUG - userId dal parametro:', userId);
    console.log('🔍 DEBUG - authenticatedUserId dal token:', authenticatedUserId);
    console.log('🔍 DEBUG - campo:', campo);
    console.log('🔍 DEBUG - rappresentanteId:', rappresentanteId);
    
    // Verifica che l'utente autenticato possa modificare questo profilo
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Non autorizzato a modificare questo profilo'
      });
    }
    
    // I campi selezionabili derivano dal registry politico; il nome colonna resta legacy.
    if (!REPRESENTATIVE_FIELDS.has(campo)) {
      return res.status(400).json({
        success: false,
        error: 'Campo non valido'
      });
    }

    const fieldContract = getSelectionFieldContract(campo);
    let selectedCandidacyId = null;
    let selectedMandateId = null;

    // Il matching richiede il 100% delle Opinioni; il Podio e una via diretta
    // basata sulla trasparenza dimostrata. I controlli server-side di livello e
    // territorio restano comunque obbligatori.
    if (rappresentanteId !== null && rappresentanteId !== undefined && rappresentanteId !== '') {
      const isPodiumDirectChoice = source === 'podio' && campo.startsWith('rappresentante_');
      if (source !== 'matching' && source !== 'podio') {
        return res.status(400).json({ success: false, error: 'Fonte selezione non valida' });
      }

      if (!isPodiumDirectChoice) {
        const opinionGrade = fieldContract?.office?.opinionGrade;
        const completion = await getUserOpinionCompletion(pool, userId, opinionGrade);
        if (!completion.isComplete) {
          return res.status(409).json({
            success: false,
            error: 'OPINIONI_INCOMPLETE',
            message: 'Completa tutte le Opinioni di questo livello prima di effettuare la selezione.',
            data: {
              totalOpinions: completion.totalOpinions,
              answeredOpinions: completion.answeredOpinions,
              missingOpinions: completion.missingOpinions
            }
          });
        }
      }
      const eligibilityGrade = fieldContract?.office?.aliases?.[0];
      const isCandidateField = campo.startsWith('candidato_');
      const eligibility = isCandidateField
        ? await isCandidateSelectionEligible(pool, userId, rappresentanteId, eligibilityGrade)
        : await isRepresentativeSelectionEligible(pool, userId, rappresentanteId, eligibilityGrade);

      const selectedSubject = eligibility.subjects?.find((row) => String(row.id) === String(rappresentanteId));
      if (isCandidateField) selectedCandidacyId = selectedSubject?.candidacy_id || null;
      else selectedMandateId = selectedSubject?.mandate_id || null;
      if (!eligibility.eligible) {
        return res.status(422).json({
          success: false,
          error: isCandidateField ? 'CANDIDATO_NON_VOTABILE' : 'RAPPRESENTANTE_NON_SELEZIONABILE',
          message: isCandidateField
            ? 'Il candidato selezionato non è votabile nella tua elezione/circoscrizione.'
            : 'Il rappresentante selezionato non è pertinente al livello/territorio richiesto.',
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
        kind: fieldContract.kind,
        officeValue: fieldContract.office.id,
        selectedUserId: rappresentanteId || null,
        selectedCandidacyId,
        selectedMandateId,
        source,
      });
      result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const isCandidato = campo.startsWith('candidato_');
    const entityType = isCandidato ? 'Candidato' : 'Rappresentante';
    
    console.log(`✅ ${entityType} selezionato con successo`);
    
    res.json({
      success: true,
      message: `${entityType} selezionato con successo`,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Errore nella selezione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});


// PUT /api/users/:userId/political-selection - Canonical jurisdiction-aware political selection
router.put('/:userId/political-selection', verifyToken, requireVerifiedCivicIdentity, async (req, res) => {
  let client = null;
  try {
    const { userId } = req.params;
    const { kind, officeId, selectedUserId = null, source = 'matching' } = req.body || {};
    if (String(req.userId) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Non autorizzato a modificare questo profilo' });
    }
    if (!['matching', 'podio'].includes(source)) {
      return res.status(400).json({ success: false, error: 'Fonte selezione non valida' });
    }
    const contract = resolveSelectionContract({ kind, officeValue: officeId });
    if (!contract) {
      return res.status(400).json({ success: false, error: 'Selezione politica non valida' });
    }

    let selectedCandidacyId = null;
    let selectedMandateId = null;
    if (selectedUserId) {
      const podiumDirect = source === 'podio' && contract.kind === 'representative';
      if (!podiumDirect && contract.office.opinionGrade) {
        const completion = await getUserOpinionCompletion(pool, userId, contract.office.opinionGrade);
        if (!completion.isComplete) {
          return res.status(409).json({
            success: false, error: 'OPINIONI_INCOMPLETE',
            message: 'Completa tutte le Opinioni di questo livello prima di effettuare la selezione.',
            data: completion,
          });
        }
      }
      const eligibility = contract.kind === 'candidate'
        ? await isCandidateSelectionEligible(pool, userId, selectedUserId, contract.office.id)
        : await isRepresentativeSelectionEligible(pool, userId, selectedUserId, contract.office.id);
      if (!eligibility.eligible) {
        return res.status(422).json({
          success: false,
          error: contract.kind === 'candidate' ? 'CANDIDATO_NON_VOTABILE' : 'RAPPRESENTANTE_NON_SELEZIONABILE',
          data: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason },
        });
      }
      const subject = eligibility.subjects?.find((row) => String(row.id) === String(selectedUserId));
      selectedCandidacyId = contract.kind === 'candidate' ? subject?.candidacy_id || null : null;
      selectedMandateId = contract.kind === 'representative' ? subject?.mandate_id || null : null;
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const stored = await setPoliticalSelection(client, {
      userId, kind: contract.kind, officeValue: contract.officeId,
      selectedUserId, selectedCandidacyId, selectedMandateId, source,
    });
    await client.query('COMMIT');
    return res.json({
      success: true,
      selection: {
        kind: contract.kind, jurisdictionId: contract.jurisdictionId, officeId: contract.officeId,
        selectedUserId: selectedUserId || null, storage: stored.canonical.available ? 'CANONICAL' : 'LEGACY',
      },
    });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('Errore selezione politica canonica:', error);
    return res.status(500).json({ success: false, error: 'Errore interno del server' });
  } finally {
    if (client) client.release();
  }
});


// GET /api/users/:userId/opinioni - Ottieni opinioni di un utente specifico
router.get('/:userId/opinioni', verifyToken, userDataAuditMiddleware, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/:userId/opinioni - Richiesta opinioni utente');
    
    const { userId } = req.params;
    const { grado } = req.query; // Parametro opzionale per filtrare per grado
    const authenticatedUserId = req.userId;

    // Privacy by role:
    // - cittadini/utenti non politici: opinioni accessibili solo a sé stessi e agli admin;
    // - politici/candidati: opinioni consultabili dagli utenti autenticati.
    // Non usiamo più opinions_public come controllo di autorizzazione.
    const targetSubject = await getAccountSubject(pool, userId);
    if (!targetSubject) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const canReadOpinions =
      String(authenticatedUserId) === String(targetSubject.id) ||
      Boolean(req.user?.isAdmin) ||
      Boolean(targetSubject.capabilities?.isPolitician) ||
      Boolean(targetSubject.capabilities?.isCandidate);
    if (!canReadOpinions) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato',
        message: 'Le opinioni dei cittadini sono private'
      });
    }
    
    // The catalog contains public question metadata only. Access checks above
    // and personal answer retrieval below remain intact.
    const opinioni = sortOpinionsByText(grado ? getOpinionsForGrade(grado) : getAllOpinions());

    const userAnswersResult = await pool.query(
      'SELECT * FROM opinioni_risposte WHERE user_id = $1',
      [userId]
    );
    const userAnswers = userAnswersResult.rows[0] || {};
    
    console.log('🔍 DEBUG - Opinion caricate:', opinioni.length);
    if (grado) {
      console.log('🔍 DEBUG - Filtro grado applicato:', grado);
    }

    const fontiOpinioni = userAnswers.fonti_opinioni || {};
    
    const formattedOpinions = opinioni.map(opinion => {
      const opinionId = opinion.id;
      const userAnswer = userAnswers[opinionId] || null;
      
      let frontendAnswer = null;
      if (userAnswer === 'f') frontendAnswer = 'f';
      else if (userAnswer === 'c') frontendAnswer = 'c';
      else if (userAnswer === 'i') frontendAnswer = 'i';
      else if (userAnswer === null) frontendAnswer = null;
      else if (userAnswer === 'Sì' || userAnswer === 'Favorevole') frontendAnswer = 'f';
      else if (userAnswer === 'No' || userAnswer === 'Contrario') frontendAnswer = 'c';
      else if (userAnswer === 'Indeciso') frontendAnswer = 'i';
      
      return {
        id: opinionId,
        text: opinion.text,
        grado: opinion.gradi_opinione,
        userAnswer: frontendAnswer,
        source: fontiOpinioni[opinionId] || 'unknown'
      };
    });
    
    console.log(`✅ Trovate ${formattedOpinions.length} opinioni per utente autorizzato`);
    
    res.json({
      success: true,
      data: {
        opinioni: formattedOpinions,
        fonti: fontiOpinioni,
        utenteId: userId,
        grado: grado || 'tutti'
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

// PUT /api/users/:userId/opinioni - Salva le opinioni di un utente specifico (solo admin)
router.put('/:userId/opinioni', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('💾 PUT /api/users/:userId/opinioni - Salvataggio opinioni utente da admin');
    
    const { userId } = req.params;
    const { opinioni, fonti } = req.body;
    
    console.log('👤 User ID:', userId);
    console.log('📋 Aggiornamento opinioni politiche ricevuto (valori non registrati nei log)');
    
    if (!opinioni || typeof opinioni !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti',
        message: 'Il campo opinioni è obbligatorio'
      });
    }
    
    // Le opinioni politiche restano soggette al consenso esplicito del soggetto
    // anche quando l'aggiornamento è eseguito da un Admin. Finché la DPIA non
    // approva una base giuridica diversa per dati politici da fonti pubbliche,
    // questa superficie deve fallire chiusa senza consenso attivo.
    const userCheckResult = await pool.query(`
      SELECT
        u.id,
        COALESCE(
          uc.political_opinions_consent,
          u.political_opinions_consent,
          false
        ) AS political_opinions_consent
      FROM users u
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE u.id = $1
    `, [userId]);
    if (!userCheckResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    
    if (userCheckResult.rows[0].political_opinions_consent !== true) {
      return res.status(403).json({
        success: false,
        error: 'Consenso richiesto',
        message: 'Le opinioni politiche del soggetto non possono essere create o modificate senza consenso esplicito attivo.',
        consent_required: true
      });
    }

    // Verifica che gli ID delle opinioni esistano in opinioni_domande
    // e ottieni la lista delle colonne valide in opinioni_risposte
    const validOpinionIds = new Set(getAllOpinions().map(op => op.id));
    
    // Ottieni anche le colonne esistenti in opinioni_risposte per validazione
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name != 'user_id' 
      AND column_name != 'fonti_opinioni'
    `);
    const validColumns = new Set(columnsResult.rows.map(row => row.column_name));
    
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    // Processa le opinioni - usa direttamente l'ID come nome colonna
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      // Verifica che l'ID esista in opinioni_domande e che la colonna esista in opinioni_risposte
      if (!validOpinionIds.has(opinionId)) {
        console.warn(`⚠️ Opinione ID non valido ignorato: ${opinionId}`);
        continue;
      }
      
      if (!validColumns.has(opinionId)) {
        console.warn(`⚠️ Colonna non trovata in opinioni_risposte ignorata: ${opinionId}`);
        continue;
      }
      
      // Usa direttamente l'ID come nome della colonna. NULL non è più una risposta valida.
      const dbField = opinionId;
      const dbValue = normalizeOpinionAnswer(risposta);
      if (!dbValue) {
        return res.status(400).json({
          success: false,
          error: 'Risposta non valida',
          message: 'Usa soltanto Favorevole, Contrario o Non lo so. Una risposta già espressa non può essere cancellata.'
        });
      }
      
      updateFields.push(`${dbField} = $${paramIndex}`);
      updateValues.push(dbValue);
      paramIndex++;
      // Non registrare nei log il valore dell'opinione politica.
    }
    
    // Processa le fonti se fornite
    let fontiFinali = {};
    if (fonti && typeof fonti === 'object') {
      // Carica le fonti esistenti
      const existingResult = await pool.query(
        'SELECT fonti_opinioni FROM opinioni_risposte WHERE user_id = $1',
        [userId]
      );
      
      if (existingResult.rows[0] && existingResult.rows[0].fonti_opinioni) {
        fontiFinali = existingResult.rows[0].fonti_opinioni;
      }
      
      // Aggiorna con le nuove fonti - usa direttamente l'ID come chiave nel JSON
      Object.entries(fonti).forEach(([opinionId, fonte]) => {
        // Verifica che l'ID sia valido e che la fonte non sia vuota
        if (validOpinionIds.has(opinionId) && fonte && fonte.trim() !== '') {
          fontiFinali[opinionId] = fonte;
        } else if (validOpinionIds.has(opinionId) && (!fonte || fonte.trim() === '')) {
          // Rimuovi la fonte se è vuota
          delete fontiFinali[opinionId];
        }
      });
      
      // Per JSONB, PostgreSQL accetta direttamente l'oggetto JavaScript
      updateFields.push(`fonti_opinioni = $${paramIndex}::jsonb`);
      updateValues.push(JSON.stringify(fontiFinali));
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // L'Admin usa lo stesso lock users della revoca GDPR e dei salvataggi
    // personali. Il pre-check precedente è solo un filtro UX: la verifica
    // AUTOREVOLE del consenso avviene dopo il lock, nella transazione.
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const lockedUser = await client.query(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]
      );
      if (lockedUser.rows.length === 0) {
        throw Object.assign(new Error('Profile no longer exists'), {
          code: 'OPINION_USER_NOT_FOUND'
        });
      }
      // New statement = fresh READ COMMITTED snapshot after waiting for
      // any concurrent consent revocation transaction to finish.
      const currentConsent = await client.query(`
        SELECT COALESCE(
          uc.political_opinions_consent, u.political_opinions_consent, false
        ) AS granted
        FROM users u
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE u.id = $1
      `, [userId]);
      if (currentConsent.rows[0]?.granted !== true) {
        throw Object.assign(new Error('Political consent revoked'), {
          code: 'OPINION_CONSENT_REQUIRED'
        });
      }

      const checkResult = await client.query(
        'SELECT user_id FROM opinioni_risposte WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      if (checkResult.rows.length === 0) {
        const insertFields = updateFields.map(field => field.split(' = ')[0]);
        const insertPlaceholders = updateFields.map((_, i) => `$${i + 2}`).join(', ');
        const insertQuery = `
          INSERT INTO opinioni_risposte (user_id, ${insertFields.join(', ')})
          VALUES ($1, ${insertPlaceholders})
        `;
        result = await client.query(insertQuery, [userId, ...updateValues]);
      } else {
        const params = [...updateValues, userId];
        const updateQuery = `
          UPDATE opinioni_risposte
          SET ${updateFields.join(', ')}
          WHERE user_id = $${params.length}
        `;
        result = await client.query(updateQuery, params);
        if (result.rowCount === 0) {
          throw Object.assign(new Error('Opinion row no longer exists'), {
            code: 'OPINION_ROW_NOT_FOUND'
          });
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log('✅ Opinioni politiche salvate con successo');
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      updatedFields: updateFields.length - (fonti && typeof fonti === 'object' ? 1 : 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    if (error?.code === 'OPINION_CONSENT_REQUIRED') {
      return res.status(403).json({
        success: false, error: 'Consenso richiesto', consent_required: true,
        message: 'Le opinioni politiche del soggetto non possono essere modificate senza consenso esplicito attivo.'
      });
    }
    if (error?.code === 'OPINION_USER_NOT_FOUND' || error?.code === 'OPINION_ROW_NOT_FOUND') {
      return res.status(404).json({
        success: false, error: 'Record non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    console.error('❌ Errore nel salvare opinioni utente:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Dettagli errore:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


module.exports = router;
