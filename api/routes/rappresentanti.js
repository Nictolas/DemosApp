const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');
const { buildPoliticalMatches } = require('../services/politicalMatchingService');
const { listEligibleRepresentatives } = require('../services/politicalEligibilityService');
const {
  resolvePoliticalOffice,
  getLegacySelectionDescriptors,
} = require('../services/politicalJurisdictionRegistryService');
const { loadPoliticalSelections, selectionsByOffice } = require('../services/politicalSelectionService');

const router = express.Router();
const REPRESENTATIVE_SELECTION_DESCRIPTORS = Object.freeze(getLegacySelectionDescriptors('representative'));

async function loadRepresentativeSelectionProjection(userId) {
  const state = await loadPoliticalSelections(pool, { userId, kind: 'representative', adapterId: 'it' });
  const byOffice = selectionsByOffice(state);
  const projection = Object.fromEntries(REPRESENTATIVE_SELECTION_DESCRIPTORS.map((descriptor) => [
    descriptor.field,
    byOffice.get(descriptor.officeId)?.selectedUserId || null,
  ]));
  return { state, projection };
}

// GET /api/rappresentanti/disponibili - Ottieni rappresentanti disponibili per grado e categoria
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado_elezione } = req.query;
    const userId = req.userId;

    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Richiesta ricevuta:', { grado_elezione, userId });


    if (!grado_elezione) {
      return res.status(400).json({
        success: false,
        error: 'Parametro grado_elezione richiesto'
      });
    }

    // Fonte canonica: mandati attivi. Camera, Senato ed Europeo sono globalmente selezionabili;
    // Regione e Comune sono filtrati sulla giurisdizione dell'utente.
    const eligibility = await listEligibleRepresentatives(pool, userId, grado_elezione);
    const result = { rows: eligibility.subjects };    console.log('🔍 DEBUG - Fonte eleggibilità rappresentanti:', eligibility.source, 'strict:', eligibility.strict);
    console.log('🔍 DEBUG - Parametri query:', [grado_elezione]);
    console.log('🔍 DEBUG - Risultati trovati:', result.rows.length);

    const office = resolvePoliticalOffice(grado_elezione);
    const gradoDatabase = office?.opinionGrade || grado_elezione;

    console.log(`🔍 DEBUG ${grado_elezione} - Grado database: ${gradoDatabase}`);

    // Matching DEMOS: gate utente 100%, matrice +3/+1/0/-1, percentuale e copertura.
    const matching = await buildPoliticalMatches({
      pool,
      userId,
      subjects: result.rows,
      grade: gradoDatabase
    });

    let candidati = matching.matches.slice(0, 4);

    console.log('🔍 DEBUG - Rappresentanti finali matching:', candidati.map((candidato) => ({
      id: candidato.id,
      score: candidato.matching_score,
      compatibilita: candidato.compatibilita_percentuale,
      copertura: `${candidato.copertura_posizioni}/${candidato.copertura_totale}`
    })));

    // Assicurati che ogni candidato abbia un avatar_config valido
    candidati = candidati.map(candidato => {
      let avatarConfig = candidato.avatar_config;

      // Fix per avatar_config doppio-encoded (rimuove virgolette extra)
      if (avatarConfig && typeof avatarConfig === 'string' && avatarConfig.startsWith('"') && avatarConfig.endsWith('"')) {
        try {
          avatarConfig = JSON.parse(avatarConfig);
        } catch (e) {
          console.warn('⚠️ Errore nel parsing avatar_config doppio-encoded:', e);
          avatarConfig = null;
        }
      }

      // Se non c'è avatar_config o è vuoto, genera uno di default
      if (!avatarConfig || avatarConfig === '{}' || avatarConfig === 'null') {
        // Genera un avatar_config di default basato sul nome per varietà
        const defaultConfig = {
          skinColor: "#FDBCB4",
          hairColor: "#8B4513",
          hairStyle: "short",
          mustacheStyle: "none",
          mustacheColor: "#2C1810",
          beardStyle: "none",
          beardColor: "#2C1810",
          noseStyle: "normal",
          suitColor: "#2C3E50",
          tieColor: "#E74C3C",
          glassesStyle: "none",
          glassesColor: "#2C3E50"
        };

        // Varia i colori in base al nome per diversità
        const nameHash = candidato.nome ? candidato.nome.charCodeAt(0) : 0;
        const colors = [
          { suit: "#2C3E50", tie: "#E74C3C" }, // Blu scuro + rosso
          { suit: "#8B4513", tie: "#3498DB" }, // Marrone + blu
          { suit: "#2E7D32", tie: "#F1C40F" }, // Verde + giallo
          { suit: "#5D6D7E", tie: "#9B59B6" }, // Grigio + viola
          { suit: "#1A237E", tie: "#FF5722" }  // Blu navy + arancione
        ];

        const colorIndex = nameHash % colors.length;
        defaultConfig.suitColor = colors[colorIndex].suit;
        defaultConfig.tieColor = colors[colorIndex].tie;

        avatarConfig = JSON.stringify(defaultConfig);
      } else if (avatarConfig) {
        // Se c'è già un avatar_config, assicurati che abbia tutti i campi necessari
        try {
          const existingConfig = JSON.parse(avatarConfig);
          const completeConfig = {
            skinColor: existingConfig.skinColor || "#FDBCB4",
            hairColor: existingConfig.hairColor || "#8B4513",
            hairStyle: existingConfig.hairStyle || "short",
            mustacheStyle: existingConfig.mustacheStyle || "none",
            mustacheColor: existingConfig.mustacheColor || "#2C1810",
            beardStyle: existingConfig.beardStyle || "none",
            beardColor: existingConfig.beardColor || "#2C1810",
            noseStyle: existingConfig.noseStyle || "normal",
            suitColor: existingConfig.suitColor || "#2C3E50",
            tieColor: existingConfig.tieColor || "#E74C3C",
            glassesStyle: existingConfig.glassesStyle || "none",
            glassesColor: existingConfig.glassesColor || "#2C3E50"
          };
          avatarConfig = JSON.stringify(completeConfig);
        } catch (error) {
          console.warn('⚠️ Errore nel parsing avatar_config per utente:', candidato.id, error);
          // Se c'è un errore nel parsing, genera un config di default
          const defaultConfig = {
            skinColor: "#FDBCB4",
            hairColor: "#8B4513",
            hairStyle: "short",
            mustacheStyle: "none",
            mustacheColor: "#2C1810",
            beardStyle: "none",
            beardColor: "#2C1810",
            noseStyle: "normal",
            suitColor: "#2C3E50",
            tieColor: "#E74C3C",
            glassesStyle: "none",
            glassesColor: "#2C3E50"
          };
          avatarConfig = JSON.stringify(defaultConfig);
        }
      }

      return {
        ...candidato,
        avatar_config: avatarConfig // avatarConfig è già una stringa JSON
      };
    });

    const selectionState = await loadRepresentativeSelectionProjection(userId);
    const utente = selectionState.projection;

    // Mappa i nomi delle colonne per mantenere compatibilità con il frontend
    const utenteMapped = {
      rappresentante_europeo: utente.rappresentante_europeo,
      rappresentante_camera: utente.rappresentante_camera,
      rappresentante_senato: utente.rappresentante_senato,
      rappresentante_regione: utente.rappresentante_regionale, // Mappa il nome corretto
      rappresentante_comune: utente.rappresentante_comune
    };

    res.json({
      success: true,
      data: {
        candidati: candidati,
        utente: utenteMapped,
        matching: {
          userComplete: matching.isComplete,
          totalOpinions: matching.totalOpinions,
          answeredOpinions: matching.answeredOpinions,
          missingOpinions: matching.missingOpinions
        },
        eligibility: { source: eligibility.source, strict: eligibility.strict, reason: eligibility.reason }
      }
    });

  } catch (error) {
    console.error('❌ Errore nel recuperare rappresentanti disponibili:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti disponibili',
      details: error.message
    });
  }
});

// GET /api/rappresentanti - Ottieni rappresentanti dell'utente
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/rappresentanti - Richiesta rappresentanti');
    const userId = req.userId;

    const selectionState = await loadRepresentativeSelectionProjection(userId);
    const user = selectionState.projection;

    console.log('🔍 DEBUG Backend - User data:', {
      userId,
      rappresentante_europeo: user.rappresentante_europeo,
      rappresentante_camera: user.rappresentante_camera,
      rappresentante_senato: user.rappresentante_senato,
      rappresentante_regionale: user.rappresentante_regionale,
      rappresentante_comune: user.rappresentante_comune
    });

    // Ottieni i dettagli dei rappresentanti selezionati
    const rappresentantiSelezionati = {};
    const idMap = {};

    // Lista dei campi rappresentante
    const campiRappresentante = REPRESENTATIVE_SELECTION_DESCRIPTORS.map(({ field, category }) => ({ campo: field, categoria: category }));

    for (const { campo, categoria } of campiRappresentante) {
      const rappresentanteId = user[campo];

      if (rappresentanteId) {
        console.log(`🔍 DEBUG Backend - Trovato rappresentante per ${categoria}: ${rappresentanteId}`);
        // Ottieni i dettagli del rappresentante
        const rappresentanteQuery = `
          SELECT
            id,
            nome,
            cognome,

            ruolo,
            status,
            avatar_config
          FROM users
          WHERE id = $1
        `;

        const rappresentanteResult = await pool.query(rappresentanteQuery, [rappresentanteId]);

        if (rappresentanteResult.rows.length > 0) {
          const rappresentante = rappresentanteResult.rows[0];
          rappresentantiSelezionati[categoria] = [rappresentante];
          idMap[rappresentanteId] = `${rappresentante.nome} ${rappresentante.cognome}`;
          console.log(`🔍 DEBUG Backend - Rappresentante ${categoria} caricato:`, rappresentante.nome, rappresentante.cognome);
        } else {
          console.log(`⚠️ DEBUG Backend - Rappresentante ${categoria} con ID ${rappresentanteId} non trovato nel database`);
        }
      } else {
        console.log(`🔍 DEBUG Backend - Nessun rappresentante per ${categoria}`);
      }
    }

    console.log('🔍 DEBUG Backend - Rappresentanti selezionati finali:', rappresentantiSelezionati);
    console.log('🔍 DEBUG Backend - idMap finale:', idMap);

    const responseData = {
      success: true,
      data: {
        rappresentanti: rappresentantiSelezionati,
        idMap
      }
    };

    console.log('🔍 DEBUG Backend - Response data:', JSON.stringify(responseData, null, 2));

    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recuperare rappresentanti:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti'
    });
  }
});

// POST /api/rappresentanti - Assegna rappresentante
router.post('/', verifyToken, validateInput(['rappresentante_id', 'categoria_id']), async (req, res) => {
  try {
    const { rappresentante_id, categoria_id } = req.body;
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato

    const query = `
      INSERT INTO rappresentanti (utente_id, rappresentante_id, categoria_id, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [userId, rappresentante_id, categoria_id]);

    res.json({
      success: true,
      rappresentante: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nell\'assegnazione rappresentante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'assegnazione rappresentante'
    });
  }
});

// DELETE /api/rappresentanti/:id - Rimuovi rappresentante
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID rappresentante richiesto'
      });
    }

    const result = await pool.query('DELETE FROM rappresentanti WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rappresentante non trovato'
      });
    }

    res.json({
      success: true,
      message: 'Rappresentante rimosso'
    });
  } catch (error) {
    console.error('❌ Errore nella rimozione rappresentante:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella rimozione rappresentante'
    });
  }
});

module.exports = router;
