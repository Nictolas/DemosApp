const express = require('express');
const { pool } = require('../../middleware/auth');
const { verifyToken } = require('../../middleware/auth');

const router = express.Router();

// GET /api/users/me - Ottieni profilo utente autenticato
router.get('/me', verifyToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/users/me - Richiesta profilo utente');
    
    const userId = req.user.id;
    
    // Recupera dati utente completi
    const result = await pool.query(`
      SELECT id, email, nome, cognome, genere, data_nascita, cittadinanza, 
             paese_residenza, regione_residenza, provincia_residenza, comune_residenza,
             ruolo, grado_elezione, paese_elezione, regione_elezione, provincia_elezione, comune_elezione,
             grado_candidatura, paese_candidatura, regione_candidatura, provincia_candidatura, comune_candidatura,
             status, avatar_config, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    const user = result.rows[0];
    console.log('✅ Profilo utente recuperato:', user.email);
    
    // Formatta la data di nascita per il frontend
    let dataNascitaFormattata = null;
    if (user.data_nascita) {
      const data = new Date(user.data_nascita);
      dataNascitaFormattata = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        genere: user.genere,
        data_nascita: dataNascitaFormattata,
        cittadinanza: user.cittadinanza,
        paese_residenza: user.paese_residenza,
        regione_residenza: user.regione_residenza,
        provincia_residenza: user.provincia_residenza,
        comune_residenza: user.comune_residenza,
        ruolo: user.ruolo,
        grado_elezione: user.grado_elezione,
        paese_elezione: user.paese_elezione,
        regione_elezione: user.regione_elezione,
        provincia_elezione: user.provincia_elezione,
        comune_elezione: user.comune_elezione,
        grado_candidatura: user.grado_candidatura,
        paese_candidatura: user.paese_candidatura,
        regione_candidatura: user.regione_candidatura,
        provincia_candidatura: user.provincia_candidatura,
        comune_candidatura: user.comune_candidatura,
        status: user.status,
        avatar_config: user.avatar_config,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel recupero profilo:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// POST /api/users/me/avatar - Aggiorna configurazione avatar
router.post('/me/avatar', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar_config } = req.body;
    
    console.log('🎨 POST /api/users/me/avatar - Aggiornamento avatar per utente:', userId);
    
    if (!avatar_config) {
      return res.status(400).json({
        success: false,
        error: 'Configurazione avatar richiesta'
      });
    }
    
    // Aggiorna la configurazione avatar
    const result = await pool.query(
      'UPDATE users SET avatar_config = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_config',
      [avatar_config, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }
    
    console.log('✅ Avatar aggiornato per utente:', userId);
    
    res.json({
      success: true,
      message: 'Avatar aggiornato con successo',
      avatar_config: result.rows[0].avatar_config
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

module.exports = router;
