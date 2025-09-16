const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Usa sempre Neon per ora
  connectionString: 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ===== ENDPOINTS PER COMUNICAZIONI =====

// GET /api/comunicazioni - Lista comunicazioni
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recupero comunicazioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/comunicazioni - Crea nuova comunicazione
router.post('/', async (req, res) => {
  try {
    const { 
      titolo, 
      voto_dato, 
      commento, 
      vincitore, 
      zona, 
      id_utente, 
      tipo = 'votazione',
      voti // Array di voti per "Comunica Voti"
    } = req.body;
    
    if (!titolo || !id_utente) {
      return res.status(400).json({
        success: false,
        error: 'Titolo e ID utente sono obbligatori'
      });
    }

    // Se ci sono voti multipli (Comunica Voti), salva una riga per ogni voto
    if (voti && Array.isArray(voti) && voti.length > 0) {
      const comunicazioni = [];
      
      for (const voto of voti) {
        if (!voto.nome || !voto.voto) continue;
        
        const testo = `Il voto di ${voto.nome}: ${voto.voto}`;
        const titoloCompleto = `${titolo} - ${voto.nome}`;
        
        const result = await pool.query(
          `INSERT INTO comunicazioni (
            id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento, 
            data_creazione, likes, dislikes, punti_trasparenza
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3
          ) RETURNING *`,
          [id_utente, titoloCompleto, testo, zona || 'Generale', voto.voto, vincitore, commento || '']
        );
        
        comunicazioni.push(result.rows[0]);
      }
      
      return res.status(201).json({
        success: true,
        data: comunicazioni,
        message: `${comunicazioni.length} voti salvati con successo`
      });
    }
    
    // Salvataggio singolo (Nuova Comunicazione Votazione)
    const testo = `Voto: ${voto_dato || 'Non specificato'}${commento ? ` - Commento: ${commento}` : ''}`;
    
    const result = await pool.query(
      `INSERT INTO comunicazioni (
        id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento, 
        data_creazione, likes, dislikes, punti_trasparenza
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), 0, 0, 3
      ) RETURNING *`,
      [id_utente, titolo, testo, zona || 'Generale', voto_dato, vincitore, commento || '']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// GET /api/ultima-comunicazione - Ultima comunicazione
router.get('/ultima-comunicazione', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY data_creazione DESC LIMIT 1'
    );
    
    res.json({
      success: true,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
