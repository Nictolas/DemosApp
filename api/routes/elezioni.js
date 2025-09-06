const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/elezioni/prossime - Ottieni le prossime elezioni
router.get('/prossime', async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      WHERE createdat > NOW() 
      ORDER BY createdat ASC 
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// GET /api/elezioni - Ottieni tutte le elezioni (per gestione)
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM elezioni 
      ORDER BY createdat DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni'
    });
  }
});

// GET /api/elezioni-utente - Ottieni elezioni per utente (endpoint principale)
router.get('/utente', verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Usa l'ID reale dell'utente autenticato
    
    const query = `
      SELECT e.*, 
             CASE WHEN v.user_id IS NOT NULL THEN true ELSE false END as ha_votato
      FROM elezioni e
      LEFT JOIN voti_elezioni v ON e.id = v.elezione_id AND v.user_id = $1
      WHERE e.createdat > NOW()
      ORDER BY e.createdat ASC
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      elezioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare elezioni utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare elezioni utente'
    });
  }
});

// GET /api/elezioni-utente/disponibili - Ottieni candidati disponibili per grado e categoria
router.get('/elezioni-utente/disponibili', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    const userId = req.userId;
    
    console.log('🔍 DEBUG /api/elezioni-utente/disponibili - Richiesta ricevuta:', { grado, categoria, userId });
    
    // Query per ottenere utenti con ruolo "Candidato" o "Candidato Politico" dalla tabella users
    // Filtra per grado_candidatura in base al parametro grado ricevuto
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
      gradoFilter = `AND grado_candidatura = $2`;
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
      WHERE id != $1 
        AND (ruolo = 'Candidato' OR ruolo = 'Candidato Politico')
        AND status = 'active'
        ${gradoFilter}
      ORDER BY cognome, nome
    `;
    
    const result = await pool.query(query, queryParams);
    
    console.log('🔍 DEBUG /api/elezioni-utente/disponibili - Utenti trovati:', result.rows.length);
    
    // Processa i candidati per il frontend
    let candidati = result.rows.map(candidato => {
      let avatarConfig = candidato.avatar_config;
      
      // Se avatar_config è null o vuoto, crea una configurazione di default
      if (!avatarConfig) {
        const defaultConfig = {
          style: 'adventurer',
          seed: `${candidato.nome}-${candidato.cognome}`,
          backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
          backgroundType: 'gradientLinear',
          backgroundRotation: 0,
          scale: 100,
          translateX: 0,
          translateY: 0,
          rotate: 0,
          flip: false,
          accessoriesProbability: 100,
          clothingProbability: 100,
          clothingColor: ['262e33', '65c9ff', '5199e4', '25557c', '000000', '3c4f5c', 'ae5d29', 'ca9077', 'd63384', 'f06292'],
          eyesProbability: 100,
          eyebrowsProbability: 100,
          facialHairProbability: 100,
          glassesProbability: 100,
          hairProbability: 100,
          hairColor: ['auburn', 'black', 'blonde', 'blondeGolden', 'brown', 'brownDark', 'gray', 'red', 'silverGray'],
          mouthProbability: 100,
          mustacheProbability: 100,
          skinProbability: 100,
          skinColor: ['edb98a', 'f8d25c', 'fd9841', 'f8d25c', 'd08b5b', 'ae5d29', '614335', 'fd9841'],
          topProbability: 100,
          topType: ['NoHair', 'Eyepatch', 'Hat', 'Hijab', 'Turban', 'WinterHat1', 'WinterHat2', 'WinterHat3', 'WinterHat4', 'LongHairBigHair', 'LongHairBob', 'LongHairBun', 'LongHairCurly', 'LongHairCurvy', 'LongHairDreads', 'LongHairFrida', 'LongHairFro', 'LongHairFroBand', 'LongHairNotTooLong', 'LongHairShavedSides', 'LongHairMiaWallace', 'LongHairStraight', 'LongHairStraight2', 'LongHairStraightStrand', 'ShortHairDreads01', 'ShortHairDreads02', 'ShortHairFrizzle', 'ShortHairShaggyMullet', 'ShortHairShortCurly', 'ShortHairShortFlat', 'ShortHairShortRound', 'ShortHairShortWaved', 'ShortHairSides', 'ShortHairTheCaesar', 'ShortHairTheCaesarSidePart']
        };
        avatarConfig = JSON.stringify(defaultConfig);
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

// GET /api/elezioni-utente - Endpoint per la pagina Elezioni (simile a rappresentanti)
router.get('/elezioni-utente', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/elezioni-utente - Richiesta candidati');
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
    
    console.log('🔍 DEBUG - Candidati selezionati dall\'utente:', user);
    
    // Ottieni i dettagli dei candidati selezionati
    const candidatiIds = [
      user.candidato_europeo,
      user.candidato_camera,
      user.candidato_senato,
      user.candidato_regionale,
      user.candidato_comune
    ].filter(id => id); // Rimuovi valori null/undefined
    
    let candidatiDettagliati = {};
    
    if (candidatiIds.length > 0) {
      const candidatiQuery = `
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
          comune_candidatura
        FROM users
        WHERE id = ANY($1)
      `;
      
      const candidatiResult = await pool.query(candidatiQuery, [candidatiIds]);
      
      // Crea un oggetto con id come chiave
      candidatiDettagliati = candidatiResult.rows.reduce((acc, candidato) => {
        acc[candidato.id] = {
          nome: candidato.nome,
          cognome: candidato.cognome,
          avatar_config: candidato.avatar_config
        };
        return acc;
      }, {});
    }
    
    console.log('🔍 DEBUG - Candidati dettagliati:', candidatiDettagliati);
    
    // Organizza i candidati per categoria (come fa rappresentanti)
    const candidatiPerCategoria = {
      europeo: user.candidato_europeo ? [candidatiDettagliati[user.candidato_europeo]] : [],
      camera: user.candidato_camera ? [candidatiDettagliati[user.candidato_camera]] : [],
      senato: user.candidato_senato ? [candidatiDettagliati[user.candidato_senato]] : [],
      regione: user.candidato_regionale ? [candidatiDettagliati[user.candidato_regionale]] : [],
      comune: user.candidato_comune ? [candidatiDettagliati[user.candidato_comune]] : []
    };
    
    // Crea idMap per compatibilità con il frontend
    const idMap = {
      europeo: user.candidato_europeo || null,
      camera: user.candidato_camera || null,
      senato: user.candidato_senato || null,
      regione: user.candidato_regionale || null,
      comune: user.candidato_comune || null
    };
    
    res.json({
      success: true,
      data: {
        candidati: candidatiPerCategoria,
        idMap: idMap
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare candidati per elezioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare candidati per elezioni'
    });
  }
});

// POST /api/elezioni - Crea nuova elezione
router.post('/', verifyToken, validateInput(['titolo', 'descrizione', 'tipo', 'candidati']), async (req, res) => {
  try {
    const { titolo, descrizione, tipo, candidati } = req.body;
    
    const query = `
      INSERT INTO elezioni (titolo, descrizione, tipo, candidati, createdat)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(query, [titolo, descrizione, tipo, JSON.stringify(candidati)]);
    
    res.json({
      success: true,
      elezione: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione elezione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione elezione'
    });
  }
});

// GET /api/candidati - Ottieni candidati per grado e categoria
router.get('/candidati', verifyToken, async (req, res) => {
  try {
    const { grado, categoria } = req.query;
    
    const query = `
      SELECT c.*, u.nome, u.cognome
      FROM candidati c
      JOIN users u ON c.user_id = u.id
      WHERE c.grado = $1 AND c.categoria = $2
      ORDER BY u.nome, u.cognome
    `;
    
    const result = await pool.query(query, [grado, categoria]);
    
    res.json({
      success: true,
      candidati: result.rows
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
