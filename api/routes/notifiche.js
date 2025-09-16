const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ===== ENDPOINTS PER NOTIFICHE =====

// GET /api/notifiche - Lista notifiche per utente (include comunicazioni)
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'ID utente richiesto'
      });
    }
    
    // Recupera notifiche tradizionali
    const notificheResult = await pool.query(
      'SELECT * FROM notifiche_utente WHERE utente_id = $1 ORDER BY data_creazione DESC',
      [user_id]
    );
    
    // Recupera comunicazioni (votazioni) per mostrare come notifiche
    const comunicazioniResult = await pool.query(`
      SELECT 
        c.*,
        u.nome,
        u.cognome,
        u.ruolo,
        'comunicazione' as tipo_notifica,
        c.data_creazione as data_creazione
      FROM comunicazioni c
      JOIN utenti u ON c.id_utente = u.id
      WHERE c.id_utente != $1
      ORDER BY c.data_creazione DESC
      LIMIT 50
    `, [user_id]);
    
    // Combina notifiche e comunicazioni
    const notifiche = notificheResult.rows.map(n => ({
      ...n,
      tipo_notifica: 'notifica'
    }));
    
    const comunicazioni = comunicazioniResult.rows.map(c => ({
      id: c.id,
      titolo: c.titolo,
      messaggio: c.testo,
      data_creazione: c.data_creazione,
      tipo_notifica: 'comunicazione',
      autore: {
        nome: c.nome,
        cognome: c.cognome,
        ruolo: c.ruolo
      },
      voto_dato: c.voto_dato,
      vincitore: c.vincitore,
      commento: c.commento
    }));
    
    // Ordina per data di creazione
    const allItems = [...notifiche, ...comunicazioni]
      .sort((a, b) => new Date(b.data_creazione) - new Date(a.data_creazione));
    
    res.json({
      success: true,
      notifiche: allItems
    });
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/notifiche - Crea nuova notifica
router.post('/', async (req, res) => {
  try {
    const { user_id, titolo, messaggio, tipo } = req.body;
    
    if (!user_id || !titolo || !messaggio) {
      return res.status(400).json({
        success: false,
        error: 'ID utente, titolo e messaggio sono obbligatori'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO notifiche (user_id, titolo, messaggio, tipo, data_creazione) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [user_id, titolo, messaggio, tipo]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nella creazione notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
