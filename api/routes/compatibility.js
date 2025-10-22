const express = require('express');

const router = express.Router();

// Endpoint diretto per opinioni-list (compatibilità frontend)
router.get('/opinioni-list', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-list - Richiesta diretta (compatibilità frontend)');
    console.log('🔑 Headers ricevuti:', req.headers);
    
    // Chiama direttamente l'endpoint opinioni-list senza reindirizzamento
    const opinioniCompatibilityRoutes = require('../routes/opinioni/compatibility');
    
    // Crea una richiesta mock per il router con TUTTI gli headers
    const mockReq = {
      ...req,
      url: '/opinioni-list' + req.url.replace('/opinioni-list', ''),
      headers: { ...req.headers }, // Copia esplicita degli headers
      get: (name) => req.headers[name], // Metodo get per compatibilità
      header: (name) => req.headers[name] // Metodo header per compatibilità
    };
    
    console.log('🔑 Mock request headers:', mockReq.headers);
    
    // Usa il router modulare
    opinioniCompatibilityRoutes.handle(mockReq, res);
    
  } catch (error) {
    console.error('💥 Errore endpoint diretto opinioni-list:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta opinioni'
    });
  }
});

// Endpoint diretto per opinioni-proposte (compatibilità frontend)
router.get('/opinioni-proposte', async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni-proposte - Richiesta diretta (compatibilità frontend)');
    console.log('🔑 Headers ricevuti:', req.headers);
    
    // Reindirizza alla route modulare
    const opinioniProposteRoutes = require('../routes/opinioni-proposte');
    
    // Crea una richiesta mock per il router con TUTTI gli headers
    const mockReq = {
      ...req,
      url: '/' + req.url.replace('/opinioni-proposte', ''),
      headers: { ...req.headers }, // Copia esplicita degli headers
      get: (name) => req.headers[name], // Metodo get per compatibilità
      header: (name) => req.headers[name] // Metodo header per compatibilità
    };
    
    console.log('🔑 Mock request headers:', mockReq.headers);
    
    // Usa il router modulare
    opinioniProposteRoutes.handle(mockReq, res);
    
  } catch (error) {
    console.error('💥 Errore endpoint diretto opinioni-proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta opinioni proposte'
    });
  }
});

// Endpoint diretto per POST opinioni-proposte (compatibilità frontend)
router.post('/opinioni-proposte', async (req, res) => {
  try {
    console.log('🔍 POST /api/opinioni-proposte - Richiesta diretta (compatibilità frontend)');
    console.log('🔑 Headers ricevuti:', req.headers);
    console.log('📝 Body ricevuto:', req.body);
    
    // Reindirizza alla route modulare
    const opinioniRoutes = require('../routes/opinioni');
    
    // Crea una richiesta mock per il router con TUTTI gli headers
    const mockReq = {
      ...req,
      url: '/' + req.url.replace('/opinioni-proposte', ''),
      headers: { ...req.headers }, // Copia esplicita degli headers
      get: (name) => req.headers[name], // Metodo get per compatibilità
      header: (name) => req.headers[name] // Metodo header per compatibilità
    };
    
    console.log('🔑 Mock request headers:', mockReq.headers);
    
    // Usa il router modulare
    opinioniRoutes.handle(mockReq, res);
    
  } catch (error) {
    console.error('💥 Errore endpoint diretto POST opinioni-proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile processare la richiesta POST opinioni proposte'
    });
  }
});

module.exports = router;
