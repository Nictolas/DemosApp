const express = require('express');
const router = express.Router();

// Endpoint per il logout
router.post('/logout', async (req, res) => {
  try {
    // Il logout è principalmente gestito lato client rimuovendo il token
    // Questo endpoint serve per eventuali operazioni di cleanup lato server
    
    console.log('DEBUG Logout - Richiesta logout ricevuta');
    
    // In futuro qui potremmo aggiungere:
    // - Invalidazione del token nel database
    // - Log delle sessioni
    // - Cleanup di dati temporanei
    
    res.status(200).json({
      success: true,
      message: 'Logout effettuato con successo'
    });
    
  } catch (error) {
    console.error('Errore durante logout:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server durante il logout'
    });
  }
});

module.exports = router;
