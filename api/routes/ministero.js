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

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('⚠️ Risposta non JSON, tentativo di parsing:', text.substring(0, 200));
      
      // Prova a parsare come JSON anche se il content-type non è corretto
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('❌ Impossibile parsare la risposta come JSON');
        data = { raw: text };
      }
    }
    
    console.log('✅ Dati ricevuti dal Ministero:', {
      tipo: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : 'N/A',
      count: Array.isArray(data) ? data.length : 'N/A',
      preview: JSON.stringify(data).substring(0, 500)
    });

    // Estrai informazioni utili dai dati
    let iniziative = [];
    let statistiche = {
      totaleIniziative: 0,
      totaleFirme: 0,
      iniziativePerStato: {},
      iniziativePerTipo: {}
    };

    if (Array.isArray(data)) {
      iniziative = data;
      statistiche.totaleIniziative = data.length;
      
      // Calcola statistiche se i dati hanno struttura prevedibile
      data.forEach((item) => {
        if (item && typeof item === 'object') {
          // Conta firme se presente
          if (item.firme !== undefined) {
            statistiche.totaleFirme += parseInt(item.firme) || 0;
          }
          if (item.numeroFirme !== undefined) {
            statistiche.totaleFirme += parseInt(item.numeroFirme) || 0;
          }
          
          // Conta per stato
          if (item.stato) {
            statistiche.iniziativePerStato[item.stato] = (statistiche.iniziativePerStato[item.stato] || 0) + 1;
          }
          
          // Conta per tipo
          if (item.tipo) {
            statistiche.iniziativePerTipo[item.tipo] = (statistiche.iniziativePerTipo[item.tipo] || 0) + 1;
          }
        }
      });
    } else if (data && typeof data === 'object') {
      // Se è un oggetto, cerca array annidati
      if (data.iniziative && Array.isArray(data.iniziative)) {
        iniziative = data.iniziative;
        statistiche.totaleIniziative = data.iniziative.length;
      } else if (data.data && Array.isArray(data.data)) {
        iniziative = data.data;
        statistiche.totaleIniziative = data.data.length;
      } else {
        // Se è un oggetto singolo, trattalo come array con un elemento
        iniziative = [data];
        statistiche.totaleIniziative = 1;
      }
    }

    // Log della richiesta riuscita
    logger.logInfo('Chiamata API Ministero completata con successo', req, {
      endpoint: '/api/ministero/iniziative',
      totaleIniziative: statistiche.totaleIniziative,
      totaleFirme: statistiche.totaleFirme
    }).catch(err => console.error('Errore logging:', err));

    res.json({
      success: true,
      data: data,
      iniziative: iniziative,
      statistiche: statistiche,
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

