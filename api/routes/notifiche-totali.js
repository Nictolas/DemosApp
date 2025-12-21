const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

// Usa il pool centralizzato ottimizzato
const pool = getPool();

// GET /api/notifiche-totali - Lista tutte le notifiche (solo admin)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    // Verifica se l'utente è admin
    const userResult = await pool.query(
      'SELECT is_admin, ruolo FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const isAdmin = userResult.rows[0].is_admin === true || userResult.rows[0].ruolo === 'AD';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Accesso negato. Solo gli amministratori possono accedere a questa risorsa.'
      });
    }

    // Recupera tutte le notifiche dalle tre tabelle
    const [votiComuni, demos, comunali] = await Promise.all([
      // Notifiche voti comuni (ex comunicazioni)
      pool.query(`
        SELECT 
          id,
          id_utente,
          titolo,
          testo,
          data,
          voto,
          comune_residenza,
          politico,
          likes,
          dislikes,
          'notifiche_voti_comuni' as tabella_origine
        FROM notifiche_voti_comuni
        ORDER BY data DESC NULLS LAST
        LIMIT 100
      `),
      // Notifiche Demos
      pool.query(`
        SELECT 
          id,
          id_utente,
          titolo,
          testo,
          data,
          comune_residenza,
          'notifiche_demos' as tabella_origine
        FROM notifiche_demos
        ORDER BY data DESC NULLS LAST
        LIMIT 100
      `),
      // Notifiche comunali
      pool.query(`
        SELECT 
          id,
          id_utente,
          titolo,
          testo,
          data,
          comune_residenza,
          likes,
          dislikes,
          'notifiche_comunali' as tabella_origine
        FROM notifiche_comunali
        ORDER BY data DESC NULLS LAST
        LIMIT 100
      `)
    ]);

    // Combina tutte le notifiche
    const allNotifiche = [
      ...votiComuni.rows,
      ...demos.rows,
      ...comunali.rows
    ].sort((a, b) => {
      const dateA = a.data ? new Date(a.data) : new Date(0);
      const dateB = b.data ? new Date(b.data) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    res.json({
      success: true,
      notifiche: allNotifiche,
      stats: {
        voti_comuni: votiComuni.rows.length,
        demos: demos.rows.length,
        comunali: comunali.rows.length,
        totali: allNotifiche.length
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero notifiche totali:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;

