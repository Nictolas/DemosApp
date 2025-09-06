const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER CAPO DI STATO =====

// GET /api/capo-stato - Lista candidati capo di stato con classifica voti
router.get('/', async (req, res) => {
  try {
    // Query per ottenere la classifica dei candidati basata sui voti ricevuti
    const query = `
      SELECT 
        nome,
        COUNT(*) as voti_totali,
        COUNT(DISTINCT userid) as votanti_unici,
        MAX(timestamp) as ultimo_voto
      FROM voti_capo_stato
      GROUP BY nome
      ORDER BY voti_totali DESC, ultimo_voto DESC
    `;
    
    const result = await pool.query(query);
    
    console.log('🔍 DEBUG /api/capo-stato - Candidati trovati:', result.rows.length);
    
    // Processa i candidati per il frontend
    let candidati = result.rows.map((candidato, index) => {
      // Crea una configurazione avatar di default basata sul nome
      const defaultConfig = {
        style: 'adventurer',
        seed: candidato.nome,
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
      
      return {
        id: `candidato_${index + 1}`,
        nome: candidato.nome,
        cognome: '', // Non disponibile nella tabella voti
        email: '', // Non disponibile nella tabella voti
        ruolo: 'Candidato',
        status: 'active',
        avatar_config: JSON.stringify(defaultConfig),
        voti_totali: parseInt(candidato.voti_totali),
        votanti_unici: parseInt(candidato.votanti_unici),
        ultimo_voto: candidato.ultimo_voto,
        posizione: index + 1
      };
    });
    
    res.json({
      success: true,
      data: candidati
    });
  } catch (error) {
    console.error('❌ Errore nel recupero candidati capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/capo-stato - Vota per un candidato capo di stato
router.post('/', async (req, res) => {
  try {
    const { nome, userid } = req.body;
    
    if (!nome || !userid) {
      return res.status(400).json({
        success: false,
        error: 'Nome del candidato e userid sono obbligatori'
      });
    }
    
    // Genera un ID univoco per il voto
    const votoId = `voto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inserisce il voto nella tabella voti_capo_stato
    const result = await pool.query(
      `INSERT INTO voti_capo_stato (
        id, userid, nome, timestamp, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW(), NOW()) 
      RETURNING id, userid, nome, timestamp`,
      [votoId, userid, nome]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel voto per candidato capo di stato:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
