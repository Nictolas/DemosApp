const express = require('express');
const router = express.Router();
const logger = require('../services/centralizedLogger');

/**
 * Endpoint per recuperare i dati pubblici dal portale del Ministero della Giustizia
 * GET /api/ministero/iniziative
 */
router.get('/iniziative', async (req, res) => {
  try {
    const ministeroUrl = 'https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';
    
    console.log('📡 Chiamata API Ministero:', ministeroUrl);
    
    // Chiamata all'API del Ministero
    const response = await fetch(ministeroUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Demos-Community/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore risposta API Ministero:', response.status, errorText);
      
      // Log dell'errore
      logger.logError(
        new Error(`API Ministero risposta non OK: ${response.status}`),
        req,
        {
          endpoint: '/api/ministero/iniziative',
          status: response.status,
          responseText: errorText
        }
      ).catch(err => console.error('Errore logging:', err));

      return res.status(response.status).json({
        success: false,
        error: 'Errore nella chiamata all\'API del Ministero',
        status: response.status,
        message: errorText || 'Errore sconosciuto'
      });
    }

    const data = await response.json();
    
    console.log('✅ Dati ricevuti dal Ministero:', {
      tipo: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
      count: Array.isArray(data) ? data.length : 'N/A'
    });

    // Log della richiesta riuscita
    logger.logInfo('Chiamata API Ministero completata con successo', req, {
      endpoint: '/api/ministero/iniziative',
      dataReceived: Array.isArray(data) ? data.length : 'object'
    }).catch(err => console.error('Errore logging:', err));

    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      source: 'Ministero della Giustizia'
    });

  } catch (error) {
    console.error('❌ Errore nella chiamata API Ministero:', error);
    
    // Log dell'errore
    logger.logError(error, req, {
      endpoint: '/api/ministero/iniziative',
      errorMessage: error.message,
      errorStack: error.stack
    }).catch(err => console.error('Errore logging:', err));

    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message || 'Errore durante la chiamata all\'API del Ministero'
    });
  }
});

module.exports = router;

