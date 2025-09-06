const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER INIZIATIVE POPOLARI =====

// GET /api/iniziative-popolari - Lista iniziative popolari con classifica voti
router.get('/', async (req, res) => {
  try {
    // Query per ottenere le iniziative
    const iniziativeResult = await pool.query(
      'SELECT id, nome, sitoWeb, quorum FROM iniziative_popolari ORDER BY created_at DESC'
    );
    
    // Query per ottenere la classifica dei voti
    const classificaQuery = `
      SELECT 
        i.nome,
        COUNT(v.id) as voti
      FROM iniziative_popolari i
      LEFT JOIN voti_iniziative_popolari v ON i.id = v.iniziativaId
      GROUP BY i.id, i.nome
      ORDER BY voti DESC, i.nome ASC
    `;
    
    const classificaResult = await pool.query(classificaQuery);
    
    console.log('🔍 DEBUG /api/iniziative-popolari - Iniziative trovate:', iniziativeResult.rows.length);
    console.log('🔍 DEBUG /api/iniziative-popolari - Classifica trovata:', classificaResult.rows.length);
    
    // Processa la classifica per il frontend
    const classifica = classificaResult.rows.map(item => ({
      nome: item.nome,
      voti: parseInt(item.voti)
    }));
    
    // Per ora, restituiamo dati mock per mieiVoti e blocco
    // TODO: Implementare la logica per ottenere i voti dell'utente corrente
    const mieiVoti = []; // Array vuoto per ora
    const blocco = {
      isBlocked: false,
      unlockDate: null
    };
    
    const responseData = {
      iniziative: iniziativeResult.rows,
      classifica,
      mieiVoti,
      blocco
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Errore nel recupero iniziative popolari:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/iniziative-popolari - Crea nuova iniziativa popolare
router.post('/', async (req, res) => {
  try {
    const { nome, userId, dataInizio, dataFine, sitoWeb, status, quorum } = req.body;
    
    if (!nome || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Nome e userId sono obbligatori'
      });
    }
    
    // Genera un ID univoco per l'iniziativa
    const iniziativaId = `iniziativa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      'INSERT INTO iniziative_popolari (id, userId, nome, dataInizio, dataFine, sitoWeb, status, quorum, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *',
      [iniziativaId, userId, nome, dataInizio, dataFine, sitoWeb, status, quorum]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione iniziativa popolare:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
