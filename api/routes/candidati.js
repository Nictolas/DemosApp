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

// GET /api/candidati - Lista tutti i candidati dalla tabella users
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        nome,
        cognome,
        email,
        ruolo,
        status,
        grado_candidatura,
        regione_candidatura,
        provincia_candidatura,
        comune_candidatura
      FROM users
      WHERE (ruolo = 'Candidato' OR ruolo = 'Candidato Politico')
      ORDER BY cognome, nome
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero candidati:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
