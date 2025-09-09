const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER CANDIDATI =====

// GET /api/candidati/disponibili - Ottieni candidati disponibili per grado e categoria
router.get('/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Richiesta ricevuta:', { grado, categoria, userId });
    console.log('🔍 DEBUG /api/candidati/disponibili - Query params:', req.query);
    console.log('🔍 DEBUG /api/candidati/disponibili - Headers:', req.headers);
    
    // Query per ottenere utenti con ruolo "Candidato" o "Candidato Politico" dalla tabella users
    // Filtra per grado_candidatura in base al parametro grado ricevuto
    let gradoFilter = '';
    let queryParams = [];
    
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
      gradoFilter = ` AND grado_candidatura = $1`;
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
        -- Opinion nazionali/europee
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali (senza prefissi)
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale,
        nuove_case_popolari, nuove_piste_ciclabili, nuovi_asili_nido_comunali,
        nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti,
        sicurezza_strade_scolastiche, sostegno_commercio_locale,
        verde_pubblico_e_giardini,
        -- Opinion regionali (senza prefissi)
        nuovi_inceneritori, chiusura_ospedali_di_provincia,
        -- Opinion nazionali/comunali (senza prefissi)
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici,
        riduzione_parcheggi_a_pagamento
      FROM users
      WHERE (ruolo = 'Candidato' OR ruolo = 'Candidato Politico')${gradoFilter}
      ORDER BY cognome, nome
    `;
    
    const result = await pool.query(query, queryParams);
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Utenti trovati:', result.rows.length);
    console.log('🔍 DEBUG /api/candidati/disponibili - Filtro applicato:', gradoFilter);
    console.log('🔍 DEBUG /api/candidati/disponibili - Parametri query:', queryParams);
    
    // Log dei primi candidati trovati per debug
    if (result.rows.length > 0) {
      console.log('🔍 DEBUG /api/candidati/disponibili - Primi candidati:', result.rows.slice(0, 3).map(r => ({
        id: r.id,
        nome: r.nome,
        cognome: r.cognome,
        ruolo: r.ruolo,
        grado_candidatura: r.grado_candidatura,
        grado_elezione: r.grado_elezione
      })));
    } else {
      console.log('❌ DEBUG /api/candidati/disponibili - Nessun candidato trovato');
    }
    
    // Carica le opinioni specifiche per il grado richiesto dalla tabella opinioni
    const gradoOpinionsQuery = `
      SELECT o.id, o.text, o.gradi_opinione
      FROM opinioni o
      WHERE $1 = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    const gradoOpinionsResult = await pool.query(gradoOpinionsQuery, [grado]);
    const gradoOpinions = gradoOpinionsResult.rows;
    
    console.log(`🔍 DEBUG - Opinion per grado ${grado} caricate:`, gradoOpinions.length);
    console.log(`🔍 DEBUG - Opinion per grado ${grado}:`, gradoOpinions.map(o => o.text));
    
    // Carica le opinioni dell'utente corrente per il calcolo della compatibilità
    const userOpinionsQuery = `
      SELECT 
        -- Opinion nazionali/europee
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali (senza prefissi)
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale,
        nuove_case_popolari, nuove_piste_ciclabili, nuovi_asili_nido_comunali,
        nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti,
        sicurezza_strade_scolastiche, sostegno_commercio_locale,
        verde_pubblico_e_giardini,
        -- Opinion regionali (senza prefissi)
        nuovi_inceneritori, chiusura_ospedali_di_provincia,
        -- Opinion nazionali/comunali (senza prefissi)
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici,
        riduzione_parcheggi_a_pagamento
      FROM users
      WHERE id = $1
    `;
    
    const userOpinionsResult = await pool.query(userOpinionsQuery, [userId]);
    const userOpinions = userOpinionsResult.rows[0] || {};
    
    console.log('🔍 DEBUG - Opinion utente corrente caricate:', Object.keys(userOpinions).length);
    console.log('🔍 DEBUG - Opinion utente corrente:', userOpinions);
    
    // Funzione per calcolare le opinioni comuni tra utente e candidato
    const calculateCommonOpinions = async (userOpinions, candidateOpinions, grado) => {
      let commonCount = 0;
      
      console.log('🔍 DEBUG calculateCommonOpinions - Inizio calcolo per candidato:', candidateOpinions.nome, candidateOpinions.cognome, 'grado:', grado);
      
      // Carica le opinioni dalla tabella opinioni per il grado specifico
      const gradoOpinionsQuery = `
        SELECT o.id, o.text, o.gradi_opinione
        FROM opinioni o
        WHERE $1 = ANY(o.gradi_opinione)
        ORDER BY o.text
      `;
      
      const gradoOpinionsResult = await pool.query(gradoOpinionsQuery, [grado]);
      const gradoOpinions = gradoOpinionsResult.rows;
      
      console.log(`🔍 DEBUG calculateCommonOpinions - Opinion caricate dalla tabella opinioni per grado ${grado}:`, gradoOpinions.length);
      
      // Mappa delle opinioni ai campi del database
      const opinionMapping = {
        'energia_nucleare': 'energia_nucleare',
        'sperimentazione_animale': 'sperimentazione_animale',
        'legalizzazione_canapa': 'legalizzazione_canapa',
        'caccia': 'caccia',
        'eutanasia': 'eutanasia',
        'carne_coltivata': 'carne_coltivata',
        'cittadina_animale': 'cittadina_animale',
        'nato': 'nato',
        'matrimonio_gay': 'matrimonio_gay',
        'salario_minimo': 'salario_minimo',
        'case_chiuse': 'case_chiuse',
        'omobitransfobia': 'omobitransfobia',
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
        'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
        'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
        'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
        'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
        'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
        'nuove_case_popolari': 'nuove_case_popolari',
        'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
        'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
        'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento'
      };
      
      // Funzione per normalizzare le risposte al formato frontend
      const normalizeAnswer = (answer) => {
        if (!answer || answer === null || answer === undefined) return 'Astenuto';
        if (answer === 'Sì') return 'Favorevole';
        if (answer === 'No') return 'Contrario';
        if (answer === 'Indeciso') return 'Indeciso';
        if (answer === 'Favorevole') return 'Favorevole';
        if (answer === 'Contrario') return 'Contrario';
        if (answer === 'Astenuto') return 'Astenuto';
        return 'Astenuto'; // Default per valori non riconosciuti
      };
      
      console.log(`🔍 DEBUG calculateCommonOpinions - User opinions sample:`, Object.keys(userOpinions).slice(0, 5).map(key => `${key}: ${userOpinions[key]}`));
      console.log(`🔍 DEBUG calculateCommonOpinions - Candidate opinions sample:`, Object.keys(candidateOpinions).slice(0, 5).map(key => `${key}: ${candidateOpinions[key]}`));
      
      // Controlla ogni opinione dalla tabella opinioni
      gradoOpinions.forEach(opinion => {
        const opinionId = opinion.id;
        const fieldName = opinionMapping[opinionId];
        
        if (!fieldName) {
          console.log(`🔍 DEBUG calculateCommonOpinions - Campo non mappato per opinione: ${opinionId} (${opinion.text})`);
          return;
        }
        
        const userAnswer = userOpinions[fieldName];
        const candidateAnswer = candidateOpinions[fieldName];
        
        // Normalizza le risposte al formato frontend
        const normalizedUserAnswer = normalizeAnswer(userAnswer);
        const normalizedCandidateAnswer = normalizeAnswer(candidateAnswer);
        
        console.log(`🔍 DEBUG calculateCommonOpinions - ${opinion.text} (${fieldName}): user="${userAnswer}"->"${normalizedUserAnswer}", candidate="${candidateAnswer}"->"${normalizedCandidateAnswer}"`);
        
        // Conta come opinione comune solo se entrambi hanno risposto con una posizione valida e la risposta è identica
        if (normalizedUserAnswer && normalizedCandidateAnswer && 
            normalizedUserAnswer !== 'Astenuto' && normalizedCandidateAnswer !== 'Astenuto' &&
            normalizedUserAnswer === normalizedCandidateAnswer) {
          commonCount++;
          console.log(`🔍 DEBUG calculateCommonOpinions - OPINIONE COMUNE trovata: ${opinion.text} = "${normalizedUserAnswer}"`);
        } else if (normalizedUserAnswer && normalizedCandidateAnswer) {
          console.log(`🔍 DEBUG calculateCommonOpinions - OPINIONI DIVERSE: ${opinion.text} = user:"${normalizedUserAnswer}" vs candidate:"${normalizedCandidateAnswer}"`);
        } else {
          console.log(`🔍 DEBUG calculateCommonOpinions - OPINIONE NON VALIDA: ${opinion.text} = user:"${normalizedUserAnswer}" candidate:"${normalizedCandidateAnswer}"`);
        }
      });
      
      console.log(`🔍 DEBUG calculateCommonOpinions - Totale opinioni comuni per ${candidateOpinions.nome} ${candidateOpinions.cognome} (${grado}): ${commonCount}`);
      return commonCount;
    };
    
    // I candidati sono già filtrati dalla query SQL, non serve ulteriore filtro
    let candidati = result.rows;
    
    // Calcola le opinioni comuni per ogni candidato e aggiungi il campo opinioni_comuni
    candidati = await Promise.all(candidati.map(async (candidato) => {
      const opinioniComuni = await calculateCommonOpinions(userOpinions, candidato, grado);
      return {
        ...candidato,
        opinioni_comuni: opinioniComuni
      };
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
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Candidati dopo calcolo compatibilità:', candidati.length);
    console.log('🔍 DEBUG /api/candidati/disponibili - Top candidati:', candidati.map(c => ({ 
      nome: c.nome, 
      cognome: c.cognome, 
      opinioni_comuni: c.opinioni_comuni 
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
    
    // Ottieni i dati dell'utente corrente per il candidato selezionato
    const userQuery = `
      SELECT 
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const utente = userResult.rows[0] || {};
    
    // Mappa i nomi delle colonne per mantenere compatibilità con il frontend
    const utenteMapped = {
      candidato_europeo: utente.candidato_europeo,
      candidato_camera: utente.candidato_camera,
      candidato_senato: utente.candidato_senato,
      candidato_regione: utente.candidato_regionale, // Mappa il nome corretto
      candidato_comune: utente.candidato_comune
    };
    
    console.log('🔍 DEBUG /api/candidati/disponibili - Invio risposta:', {
      candidatiCount: candidati.length,
      utente: utenteMapped
    });
    
    res.json({
      success: true,
      data: {
        candidati: candidati,
        utente: utenteMapped
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati disponibili:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati disponibili'
    });
  }
});

// GET /api/candidati - Ottieni candidati dell'utente (endpoint principale)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/candidati - Richiesta candidati');
    const userId = req.userId;
    console.log('🔍 DEBUG - userId:', userId);
    
    // Ottieni i candidati selezionati dall'utente
    const userQuery = `
      SELECT 
        candidato_europeo,
        candidato_camera,
        candidato_senato,
        candidato_regionale,
        candidato_comune
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0] || {};
    
    console.log('🔍 DEBUG Frontend - Utente candidati selezionati:', user);
    
    // Ottieni i dettagli dei candidati selezionati
    const candidatiSelezionati = {};
    const idMap = {};
    
    // Lista dei campi candidato
    const campiCandidato = [
      { campo: 'candidato_europeo', categoria: 'europeo' },
      { campo: 'candidato_camera', categoria: 'camera' },
      { campo: 'candidato_senato', categoria: 'senato' },
      { campo: 'candidato_regionale', categoria: 'regione' },
      { campo: 'candidato_comune', categoria: 'comune' }
    ];
    
    for (const { campo, categoria } of campiCandidato) {
      const candidatoId = user[campo];
      
      if (candidatoId) {
        // Ottieni i dettagli del candidato
        const candidatoQuery = `
          SELECT 
            id,
            nome,
            cognome,
            email,
            ruolo,
            status,
            avatar_config
          FROM users
          WHERE id = $1 OR firebase_uid = $1
        `;
        
        const candidatoResult = await pool.query(candidatoQuery, [candidatoId]);
        const candidato = candidatoResult.rows[0];
        
        if (candidato) {
          // Aggiungi alla mappa ID usando l'ID originale per la compatibilità
          idMap[candidatoId] = `${candidato.nome} ${candidato.cognome}`;
          
          // Aggiungi alla categoria
          if (!candidatiSelezionati[categoria]) {
            candidatiSelezionati[categoria] = [];
          }
          candidatiSelezionati[categoria].push(candidato);
        }
      }
    }
    
    console.log('🔍 DEBUG Frontend - Candidati selezionati finali:', candidatiSelezionati);
    
    res.json({
      success: true,
      data: {
        candidati: candidatiSelezionati,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati'
    });
  }
});


module.exports = router;
