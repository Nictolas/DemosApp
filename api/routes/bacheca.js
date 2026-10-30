const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

/**
 * @route GET /api/bacheca
 * @desc Ottiene i dati per la bacheca dell'utente
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Recupera notifiche recenti (ultime 5)
    const notificheQuery = `
      SELECT 
        id,
        titolo,
        messaggio,
        tipo,
        created_at as data
      FROM notifiche
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const notificheResult = await pool.query(notificheQuery, [userId]);
    
    // Recupera votazioni recenti (ultime 3)
    const votazioniQuery = `
      SELECT 
        id,
        descrizione,
        camera,
        data_votazione,
        esito
      FROM voti_camera
      ORDER BY data_votazione DESC
      LIMIT 3
    `;
    const votazioniResult = await pool.query(votazioniQuery);
    
    // Recupera eventi recenti (ultimi 5)
    const eventiQuery = `
      SELECT 
        id,
        titolo,
        descrizione,
        data_evento as data
      FROM eventi
      ORDER BY data_evento DESC
      LIMIT 5
    `;
    const eventiResult = await pool.query(eventiQuery);
    
    // The former activity query referenced non-existent columns
    // (categoria, domanda, user_id, created_at) in opinioni_domande.
    // A future activity feed needs a proper event source, never the catalog.
    const attivitaResult = { rows: [] };
    
    // Formatta i dati
    const dati = {
      notifiche_recenti: notificheResult.rows.map(row => ({
        id: row.id,
        titolo: row.titolo,
        messaggio: row.messaggio,
        tipo: row.tipo,
        data: row.data ? row.data.toISOString() : null,
      })),
      votazioni_recenti: votazioniResult.rows.map(row => ({
        id: row.id,
        descrizione: row.descrizione,
        camera: row.camera,
        data_votazione: row.data_votazione ? row.data_votazione.toISOString() : null,
        esito: row.esito,
      })),
      eventi: eventiResult.rows.map(row => ({
        id: row.id,
        titolo: row.titolo,
        descrizione: row.descrizione,
        data: row.data ? row.data.toISOString() : null,
      })),
      attivita: attivitaResult.rows.map(row => ({
        tipo: row.tipo,
        descrizione: row.descrizione,
        data: row.data ? row.data.toISOString() : null,
      })),
    };
    
    res.json({
      success: true,
      data: dati,
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dati bacheca:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message,
    });
  }
});

module.exports = router;
