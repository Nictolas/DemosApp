const express = require('express');
const router = express.Router();

/**
 * 🧹 CLEAR TOKEN
 * POST /api/auth/clear-token
 * 
 * Endpoint per pulire i token vecchi e forzare un nuovo login
 * Utile quando ci sono problemi di audience o token non validi
 */
router.post('/clear-token', async (req, res) => {
  try {
    console.log('🧹 Richiesta di pulizia token ricevuta');
    
    // Log dell'utente che richiede la pulizia
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    console.log(`🧹 Pulizia token richiesta da IP: ${ipAddress}, UA: ${userAgent}`);
    
    // Restituisci una risposta di successo
    res.json({
      success: true,
      message: 'Token pulito con successo. Effettua un nuovo login.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nella pulizia token:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile pulire il token'
    });
  }
});

module.exports = router;
