const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/rappresentanti/disponibili - Ottieni rappresentanti disponibili per grado e categoria
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Richiesta ricevuta:', { grado, categoria, userId });
    
    // Query per ottenere utenti con ruolo "Politico" o "Candidato Politico" dalla tabella users
    // Filtra per grado_elezione in base al parametro grado ricevuto
    let gradoFilter = '';
    let queryParams = [userId];
    
    if (grado) {
      // Mappa i gradi dal frontend ai valori del database
      const gradoMapping = {
        'Europeo': 'Europeo',
        'Camera': 'Camera',
        'Senato': 'Senato', 
        'Regionale': 'Regionale',
        'Comunale': 'Comunale'
      };
      
      const mappedGrado = gradoMapping[grado] || grado;
      gradoFilter = `AND grado_elezione = $2`;
      queryParams.push(mappedGrado);
    }
    
    const query = `
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        avatar_config,
        grado_candidatura,
        regione_candidatura,
        provincia_candidatura,
        comune_candidatura,
        grado_elezione,
        regione_elezione,
        provincia_elezione,
        comune_elezione,
        -- Opinion nazionali
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali
        comunale_cassonetti_intelligenti_con_tessera, comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        comunale_divieto_di_nuovi_fast_food_nel_centro_storico, comunale_estensione_delle_zone_a_traffico_limitato,
        comunale_finanziamento_eventi_culturali_gratuiti, comunale_nuova_biblioteca_comunale,
        comunale_nuove_case_popolari, comunale_nuove_piste_ciclabili, comunale_nuovi_asili_nido_comunali,
        comunale_nuovo_stadio_comunale, comunale_parcheggi_gratuiti_per_residenti,
        comunale_potenziamento_trasporto_pubblico, comunale_riduzione_tasse_rifiuti,
        comunale_sicurezza_strade_scolastiche, comunale_sostegno_commercio_locale,
        comunale_verde_pubblico_e_giardini,
        -- Opinion regionali
        regionale_nuovi_inceneritori, regionale_chiusura_ospedali_di_provincia
      FROM users
      WHERE id != $1 
        AND (ruolo = 'Politico' OR ruolo = 'Candidato Politico')
        AND status = 'active'
        ${gradoFilter}
      ORDER BY cognome, nome
    `;
    
    const result = await pool.query(query, queryParams);
    
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Utenti trovati:', result.rows.length);
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Filtro applicato:', gradoFilter);
    
    // Carica le opinioni dell'utente corrente per il calcolo della compatibilità
    const userOpinionsQuery = `
      SELECT 
        -- Opinion nazionali
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali
        comunale_cassonetti_intelligenti_con_tessera, comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        comunale_divieto_di_nuovi_fast_food_nel_centro_storico, comunale_estensione_delle_zone_a_traffico_limitato,
        comunale_finanziamento_eventi_culturali_gratuiti, comunale_nuova_biblioteca_comunale,
        comunale_nuove_case_popolari, comunale_nuove_piste_ciclabili, comunale_nuovi_asili_nido_comunali,
        comunale_nuovo_stadio_comunale, comunale_parcheggi_gratuiti_per_residenti,
        comunale_potenziamento_trasporto_pubblico, comunale_riduzione_tasse_rifiuti,
        comunale_sicurezza_strade_scolastiche, comunale_sostegno_commercio_locale,
        comunale_verde_pubblico_e_giardini,
        -- Opinion regionali
        regionale_nuovi_inceneritori, regionale_chiusura_ospedali_di_provincia
      FROM users
      WHERE id = $1
    `;
    
    const userOpinionsResult = await pool.query(userOpinionsQuery, [userId]);
    const userOpinions = userOpinionsResult.rows[0] || {};
    
    console.log('🔍 DEBUG - Opinion utente corrente caricate:', Object.keys(userOpinions).length);
    
    // Funzione per calcolare le opinioni comuni tra utente e rappresentante
    const calculateCommonOpinions = (userOpinions, candidateOpinions) => {
      let commonCount = 0;
      const opinionFields = [
        'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia', 'eutanasia',
        'carne_coltivata', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo', 'case_chiuse', 'omobitransfobia',
        'comunale_cassonetti_intelligenti_con_tessera', 'comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti',
        'comunale_divieto_di_nuovi_fast_food_nel_centro_storico', 'comunale_estensione_delle_zone_a_traffico_limitato',
        'comunale_finanziamento_eventi_culturali_gratuiti', 'comunale_nuova_biblioteca_comunale',
        'comunale_nuove_case_popolari', 'comunale_nuove_piste_ciclabili', 'comunale_nuovi_asili_nido_comunali',
        'comunale_nuovo_stadio_comunale', 'comunale_parcheggi_gratuiti_per_residenti',
        'comunale_potenziamento_trasporto_pubblico', 'comunale_riduzione_tasse_rifiuti',
        'comunale_sicurezza_strade_scolastiche', 'comunale_sostegno_commercio_locale',
        'comunale_verde_pubblico_e_giardini',
        'regionale_nuovi_inceneritori', 'regionale_chiusura_ospedali_di_provincia'
      ];
      
      opinionFields.forEach(field => {
        const userAnswer = userOpinions[field];
        const candidateAnswer = candidateOpinions[field];
        
        // Conta come opinione comune solo se entrambi hanno risposto e la risposta è identica
        if (userAnswer && candidateAnswer && userAnswer === candidateAnswer) {
          commonCount++;
        }
      });
      
      return commonCount;
    };
    
    // Debug: controlliamo quanti utenti hanno grado_elezione = 'Europeo'
    const debugQuery = `SELECT COUNT(*) as count FROM users WHERE grado_elezione = 'Europeo'`;
    const debugResult = await pool.query(debugQuery);
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Utenti con grado_elezione Europeo:', debugResult.rows[0].count);
    
    // Debug: controlliamo quanti utenti hanno grado_elezione = 'Europeo' E ruolo corretto
    const debugQuery2 = `SELECT COUNT(*) as count FROM users WHERE grado_elezione = 'Europeo' AND (ruolo = 'Politico' OR ruolo = 'Candidato Politico') AND status = 'active'`;
    const debugResult2 = await pool.query(debugQuery2);
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Utenti con grado_elezione Europeo E ruolo corretto:', debugResult2.rows[0].count);
    
    // I candidati sono già filtrati dalla query SQL, non serve ulteriore filtro
    let candidati = result.rows;
    
    // Calcola le opinioni comuni per ogni candidato e aggiungi il campo opinioni_comuni
    candidati = candidati.map(candidato => {
      const opinioniComuni = calculateCommonOpinions(userOpinions, candidato);
      return {
        ...candidato,
        opinioni_comuni: opinioniComuni
      };
    });
    
    // Ordina per opinioni comuni (decrescente) e poi per cognome
    candidati.sort((a, b) => {
      if (b.opinioni_comuni !== a.opinioni_comuni) {
        return b.opinioni_comuni - a.opinioni_comuni;
      }
      return a.cognome.localeCompare(b.cognome);
    });
    
    // Limita ai primi 4 candidati più compatibili
    candidati = candidati.slice(0, 4);
    
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Candidati dopo calcolo compatibilità:', candidati.length);
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Top candidati:', candidati.map(c => ({ 
      nome: c.nome, 
      cognome: c.cognome, 
      opinioni_comuni: c.opinioni_comuni 
    })));
    
    // Debug: vediamo alcuni esempi di utenti con grado_elezione = 'Europeo'
    const debugQuery3 = `SELECT id, nome, cognome, ruolo, grado_elezione, status, avatar_config FROM users WHERE grado_elezione = 'Europeo' LIMIT 5`;
    const debugResult3 = await pool.query(debugQuery3);
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Esempi utenti Europeo:', debugResult3.rows);
    
    // Debug: controlliamo se i candidati hanno avatar_config
    console.log('🔍 DEBUG /api/rappresentanti/disponibili - Primi 3 candidati con avatar_config:', 
      candidati.slice(0, 3).map(c => ({ id: c.id, nome: c.nome, cognome: c.cognome, avatar_config: c.avatar_config }))
    );
    
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
        avatar_config: typeof avatarConfig === 'object' ? JSON.stringify(avatarConfig) : avatarConfig
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
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare rappresentanti disponibili'
    });
  }
});

// GET /api/rappresentanti - Ottieni rappresentanti dell'utente
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/rappresentanti - Richiesta rappresentanti');
    const userId = req.userId;
    console.log('🔍 DEBUG - userId:', userId);
    
    // Prima controlliamo quali ruoli esistono nel database
    const rolesQuery = `SELECT DISTINCT ruolo FROM users WHERE ruolo IS NOT NULL`;
    const rolesResult = await pool.query(rolesQuery);
    console.log('🔍 DEBUG - Ruoli disponibili nel database:', rolesResult.rows.map(r => r.ruolo));
    
    // Controlliamo anche quanti utenti ci sono in totale
    const countQuery = `SELECT COUNT(*) as total FROM users`;
    const countResult = await pool.query(countQuery);
    console.log('🔍 DEBUG - Totale utenti nel database:', countResult.rows[0].total);
    
    // Usa SOLO la tabella users - SEMPRE così
    // Filtra per utenti che possono essere rappresentanti (Politico, Candidato, etc.)
    const query = `
      SELECT 
        id as rappresentante_id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        'disponibile' as stato
      FROM users
      WHERE id != $1 
        AND ruolo IN ('Politico', 'Candidato', 'Candidato Politico', 'Elettore')
        AND status = 'active'
      ORDER BY cognome, nome
    `;
    
    const result = await pool.query(query, [userId]);
    console.log('🔍 DEBUG - Risultati query rappresentanti:', result.rows.length, 'utenti trovati');
    
    // Struttura la risposta come si aspetta il frontend
    const rappresentanti = {};
    const idMap = {};
    
    // Organizza i rappresentanti per categoria (per ora tutti insieme)
    if (result.rows.length > 0) {
      rappresentanti['tutti'] = result.rows;
      // Crea idMap per mappare gli ID
      result.rows.forEach(rapp => {
        idMap[rapp.rappresentante_id] = `${rapp.nome} ${rapp.cognome}`;
      });
    }
    
    res.json({
      success: true,
      data: {
        rappresentanti,
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
