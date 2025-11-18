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
    
    console.log(`🔍 DEBUG ${grado_elezione} - Grado database: ${gradoDatabase}`);
    
    // Ottieni le opinioni dell'utente corrente SOLO per il grado specifico
    let userOpinions = null;
    if (userId) {
      // Prima ottieni le opinioni del grado specifico
      const gradoOpinioniQuery = `
        SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)
      `;
      const gradoOpinioniResult = await pool.query(gradoOpinioniQuery, [gradoDatabase]);
      const opinioniDelGrado = gradoOpinioniResult.rows.map(row => row.id);
      
      console.log(`🔍 DEBUG ${grado_elezione} - Grado database: ${gradoDatabase}, Opinion trovate: ${opinioniDelGrado.length}`);
      console.log(`🔍 DEBUG - Opinion IDs per grado ${gradoDatabase}:`, opinioniDelGrado);
      
      if (opinioniDelGrado.length > 0) {
        // Costruisci la query dinamica per le colonne del grado specifico
        const colonneQuery = opinioniDelGrado.join(', ');
        const userAnswersQuery = `
          SELECT user_id, ${colonneQuery} FROM opinioni_risposte WHERE user_id = $1
        `;
        
        const userAnswersResult = await pool.query(userAnswersQuery, [userId]);
        userOpinions = {};
        
        console.log(`🔍 DEBUG - User answers query result:`, userAnswersResult.rows.length, 'righe');
        
        if (userAnswersResult.rows.length > 0) {
          const userRow = userAnswersResult.rows[0];
          console.log(`🔍 DEBUG - User row keys:`, Object.keys(userRow));
          // Mappa solo le opinioni del grado specifico
          opinioniDelGrado.forEach(opinionId => {
            userOpinions[opinionId] = userRow[opinionId];
          });
          console.log(`🔍 DEBUG - User opinions mappate:`, userOpinions);
        } else {
          console.log(`🔍 DEBUG - Nessuna risposta utente trovata per userId: ${userId}`);
        }
      }
    }
    
    // Se non c'è un utente corrente, usa Nicolas Micheletti come riferimento per il test
    if (!userOpinions) {
      // Prima trova l'ID di Nicolas Micheletti
      const testUserResult = await pool.query(`
        SELECT id FROM users 
        WHERE nome ILIKE '%nicolas%' OR cognome ILIKE '%micheletti%' OR email ILIKE '%nicolas%'
        ORDER BY nome, cognome
        LIMIT 1
      `);
      
      if (testUserResult.rows.length > 0) {
        const testUserId = testUserResult.rows[0].id;
        const testUserAnswersQuery = `
          SELECT * FROM opinioni_risposte WHERE user_id = $1
        `;
        
        const testUserAnswersResult = await pool.query(testUserAnswersQuery, [testUserId]);
        userOpinions = {};
        
        if (testUserAnswersResult.rows.length > 0) {
          const testUserRow = testUserAnswersResult.rows[0];
          // Mappa tutte le colonne di opinioni (escludendo user_id e fonti_opinioni)
          Object.keys(testUserRow).forEach(key => {
            if (key !== 'user_id' && key !== 'fonti_opinioni') {
              userOpinions[key] = testUserRow[key];
            }
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
          return { ...candidato, opinioni_comuni: 0, opinioniComuni: 0 };
        }

        // Carica le opinioni del rappresentante SOLO per il grado specifico
        const gradoOpinioniQuery = `
          SELECT id FROM opinioni_domande WHERE $1 = ANY(gradi_opinione)
        `;
        const gradoOpinioniResult = await pool.query(gradoOpinioniQuery, [gradoDatabase]);
        const opinioniDelGrado = gradoOpinioniResult.rows.map(row => row.id);
        
        if (opinioniDelGrado.length === 0) {
          return { ...candidato, opinioni_comuni: 0, opinioniComuni: 0 };
        }
        
        const colonneQuery = opinioniDelGrado.join(', ');
        const candidatoAnswersQuery = `
          SELECT user_id, ${colonneQuery} FROM opinioni_risposte WHERE user_id = $1
        `;
        const candidatoAnswersResult = await pool.query(candidatoAnswersQuery, [candidato.id]);
        
        if (candidatoAnswersResult.rows.length === 0) {
          return { ...candidato, opinioni_comuni: 0, opinioniComuni: 0 };
        }
        
        const candidatoData = {};
        
        if (candidatoAnswersResult.rows.length > 0) {
          const candidatoRow = candidatoAnswersResult.rows[0];
          // Mappa SOLO le opinioni del grado specifico
          opinioniDelGrado.forEach(opinionId => {
            candidatoData[opinionId] = candidatoRow[opinionId];
          });
        }
        
        // Calcola opinioni comuni confrontando SOLO le opinioni del grado specifico
        let opinioniComuni = 0;
        
        console.log(`🔍 DEBUG - User opinions keys:`, Object.keys(userOpinions || {}));
        console.log(`🔍 DEBUG - Candidato data keys:`, Object.keys(candidatoData));
        
        if (userOpinions && Object.keys(userOpinions).length > 0) {
          // Confronta solo le opinioni del grado specifico
          Object.keys(userOpinions).forEach(opinionId => {
            const candidatoValue = candidatoData[opinionId];
            const userValue = userOpinions[opinionId];
            
            console.log(`🔍 DEBUG - Confronto opinione ${opinionId}: candidato=${candidatoValue}, user=${userValue}`);
            
            // Conta come opinione comune SOLO se:
            // 1. Entrambi hanno risposto (non null)
            // 2. Le risposte sono identiche
            if (candidatoValue !== null && userValue !== null && candidatoValue === userValue) {
              opinioniComuni++;
              console.log(`✅ OPINIONE COMUNE (${grado_elezione}): ${opinionId} = "${candidatoValue}"`);
            }
          });
        }
        
        console.log(`🔍 DEBUG - Candidato ${candidato.id} ha ${opinioniComuni} opinioni comuni`);
        
        return { ...candidato, opinioni_comuni: opinioniComuni, opinioniComuni };
      } catch (error) {
        console.error('❌ Errore nel calcolo opinioni comuni per candidato:', candidato.id, error);
        return { ...candidato, opinioni_comuni: 0, opinioniComuni: 0 };
      }
    }));
    
    // Ordina per opinioni comuni (decrescente) e poi per cognome
    candidati.sort((a, b) => {
      if (b.opinioniComuni !== a.opinioniComuni) {
        return b.opinioniComuni - a.opinioniComuni;
      }
      return a.cognome.localeCompare(b.cognome);
    });
    
    // Limita ai primi 4 candidati più compatibili
    candidati = candidati.slice(0, 4);
    
    // Debug temporaneo per vedere se opinioniComuni è presente
    console.log('🔍 DEBUG - Rappresentanti finali:');
    candidati.forEach((candidato, index) => {
      console.log(`  ${index + 1}. ${candidato.nome} ${candidato.cognome}: opinioniComuni=${candidato.opinioniComuni}`);
    });
    
    
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
        console.log(`🔍 DEBUG Backend - Trovato rappresentante per ${categoria}: ${rappresentanteId}`);
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
