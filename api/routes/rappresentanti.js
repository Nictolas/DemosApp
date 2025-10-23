const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

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
    
    const query = `
      SELECT 
        u.id,
        u.nome,
        u.cognome,
        u.email,
        u.ruolo,
        u.status,
        u.avatar_config,
        u.grado_candidatura,
        u.regione_candidatura,
        u.provincia_candidatura,
        u.comune_candidatura,
        u.grado_elezione,
        u.regione_elezione,
        u.provincia_elezione,
        u.comune_elezione
      FROM users u
      WHERE (u.ruolo = 'P' OR u.ruolo = 'CP')
        AND u.grado_elezione = $1
      ORDER BY u.cognome, u.nome
    `;
    
    const result = await pool.query(query, [grado_elezione]);
    
    console.log('🔍 DEBUG - Query rappresentanti:', query);
    console.log('🔍 DEBUG - Parametri query:', [grado_elezione]);
    console.log('🔍 DEBUG - Risultati trovati:', result.rows.length);
    
    // Mappa il grado_elezione del frontend al grado del database
    const gradoMapping = {
      'E': 'E',
      'C': 'N', 
      'S': 'N',
      'R': 'R',
      'CO': 'CO'
    };
    const gradoDatabase = gradoMapping[grado_elezione] || grado_elezione;
    
    // Ottieni le opinioni dell'utente corrente SOLO per il grado specifico
    let userOpinions = null;
    if (userId) {
      // Prima ottieni le opinioni del grado specifico
      const gradoOpinioniQuery = `
        SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)
      `;
      const gradoOpinioniResult = await pool.query(gradoOpinioniQuery, [gradoDatabase]);
      const opinioniDelGrado = gradoOpinioniResult.rows.map(row => row.id);
      
      if (opinioniDelGrado.length > 0) {
        // Costruisci la query dinamica per le colonne del grado specifico
        const colonneQuery = opinioniDelGrado.join(', ');
        const userAnswersQuery = `
          SELECT user_id, ${colonneQuery} FROM opinioni_risposte WHERE user_id = $1
        `;
        
        const userAnswersResult = await pool.query(userAnswersQuery, [userId]);
        userOpinions = {};
        
        if (userAnswersResult.rows.length > 0) {
          const userRow = userAnswersResult.rows[0];
          // Mappa solo le opinioni del grado specifico
          opinioniDelGrado.forEach(opinionId => {
            userOpinions[opinionId] = userRow[opinionId];
          });
        }
      }
    }
    
    
    // I candidati sono già filtrati dalla query SQL, non serve ulteriore filtro
    let candidati = result.rows;
    
    // Calcola opinioni comuni per ogni candidato (COPIA ESATTA dai candidati)
    candidati = await Promise.all(candidati.map(async (candidato) => {
      try {
        if (!userOpinions) {
          return { ...candidato, opinioni_comuni: 0 };
        }

        // Carica le opinioni del candidato per il grado specifico
        const candidatoAnswersQuery = `
          SELECT user_id, ${opinioniDelGrado.join(', ')} FROM opinioni_risposte WHERE user_id = $1
        `;
        const candidatoAnswersResult = await pool.query(candidatoAnswersQuery, [candidato.id]);
        
        if (candidatoAnswersResult.rows.length === 0) {
          return { ...candidato, opinioni_comuni: 0 };
        }
        
        const candidatoData = candidatoAnswersResult.rows[0];
        delete candidatoData.user_id;

        // Calcola opinioni comuni confrontando le opinioni (già filtrate per grado)
        let opinioniComuni = 0;
        const allOpinionIds = new Set([...Object.keys(candidatoData), ...Object.keys(userOpinions)]);
        
        allOpinionIds.forEach(opinionId => {
          const candidatoValue = candidatoData[opinionId];
          const userValue = userOpinions[opinionId];
          
          // Conta come opinione comune SOLO se:
          // 1. Entrambi hanno risposto (non null)
          // 2. Entrambi hanno un valore valido (f, c, i)
          // 3. I valori sono identici
          if (candidatoValue && userValue && 
              candidatoValue !== null && userValue !== null &&
              (candidatoValue === 'f' || candidatoValue === 'c' || candidatoValue === 'i') &&
              (userValue === 'f' || userValue === 'c' || userValue === 'i') &&
              candidatoValue === userValue) {
            opinioniComuni++;
          }
        });
        
        return { ...candidato, opinioni_comuni };
      } catch (error) {
        console.error('❌ Errore nel calcolo opinioni comuni per candidato:', candidato.id, error);
        return { ...candidato, opinioni_comuni: 0 };
      }
    }));
    
    // Ordina per opinioni comuni (decrescente) e poi per cognome
    candidati.sort((a, b) => {
      if (b.opinioni_comuni !== a.opinioni_comuni) {
        return b.opinioni_comuni - a.opinioni_comuni;
      }
      return a.cognome.localeCompare(b.cognome);
    });
    
    // Limita ai primi 4 candidati più compatibili
    candidati = candidati.slice(0, 4);
    
    
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
    
    // Ottieni i dati dell'utente corrente per il rappresentante selezionato
    const userQuery = `
      SELECT 
        rappresentante_europeo,
        rappresentante_camera,
        rappresentante_senato,
        rappresentante_regionale,
        rappresentante_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const utente = userResult.rows[0] || {};
    
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
        utente: utenteMapped
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
    
    // Ottieni i rappresentanti selezionati dall'utente
    const userQuery = `
      SELECT 
        rappresentante_europeo,
        rappresentante_camera,
        rappresentante_senato,
        rappresentante_regionale,
        rappresentante_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0] || {};
    
    
    // Ottieni i dettagli dei rappresentanti selezionati
    const rappresentantiSelezionati = {};
    const idMap = {};
    
    // Lista dei campi rappresentante
    const campiRappresentante = [
      { campo: 'rappresentante_europeo', categoria: 'europeo' },
      { campo: 'rappresentante_camera', categoria: 'camera' },
      { campo: 'rappresentante_senato', categoria: 'senato' },
      { campo: 'rappresentante_regionale', categoria: 'regione' },
      { campo: 'rappresentante_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiRappresentante) {
      const rappresentanteId = user[campo];
      
      if (rappresentanteId) {
        // Ottieni i dettagli del rappresentante
        const rappresentanteQuery = `
          SELECT 
            id,
            nome,
            cognome,
            email,
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
          
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        rappresentanti: rappresentantiSelezionati,
        idMap
      }
    });
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
