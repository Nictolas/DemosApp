const express = require('express');
const router = express.Router();
const logger = require('../services/centralizedLogger');
const ministeroSync = require('../services/ministeroSync');

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

    // L'API del Ministero restituisce {resultCode, resultDescription, infoPaginazione, content}
    if (data && typeof data === 'object' && data.content && Array.isArray(data.content)) {
      iniziative = data.content;
      statistiche.totaleIniziative = data.content.length;
      
      // Calcola statistiche
      data.content.forEach((item) => {
        if (item && typeof item === 'object') {
          // SOSTENITORI = FIRME (campo chiave dell'API!)
          if (item.sostenitori !== undefined) {
            statistiche.totaleFirme += parseInt(item.sostenitori) || 0;
          } else if (item.firme !== undefined) {
            statistiche.totaleFirme += parseInt(item.firme) || 0;
          }
          
          // Conta per stato (usa idDecStatoIniziativa.nome)
          const stato = item.idDecStatoIniziativa?.nome || item.stato;
          if (stato) {
            statistiche.iniziativePerStato[stato] = (statistiche.iniziativePerStato[stato] || 0) + 1;
          }
          
          // Conta per tipo (usa idDecTipoIniziativa.nome)
          const tipo = item.idDecTipoIniziativa?.nome || item.tipo;
          if (tipo) {
            statistiche.iniziativePerTipo[tipo] = (statistiche.iniziativePerTipo[tipo] || 0) + 1;
          }
        }
      });
    } else if (Array.isArray(data)) {
      iniziative = data;
      statistiche.totaleIniziative = data.length;
      
      // Calcola statistiche se i dati hanno struttura prevedibile
      data.forEach((item) => {
        if (item && typeof item === 'object') {
          if (item.sostenitori !== undefined) {
            statistiche.totaleFirme += parseInt(item.sostenitori) || 0;
          } else if (item.firme !== undefined) {
            statistiche.totaleFirme += parseInt(item.firme) || 0;
          }
          
          const stato = item.idDecStatoIniziativa?.nome || item.stato;
          if (stato) {
            statistiche.iniziativePerStato[stato] = (statistiche.iniziativePerStato[stato] || 0) + 1;
          }
          
          const tipo = item.idDecTipoIniziativa?.nome || item.tipo;
          if (tipo) {
            statistiche.iniziativePerTipo[tipo] = (statistiche.iniziativePerTipo[tipo] || 0) + 1;
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
    logger.info('Chiamata API Ministero completata con successo', {
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

/**
 * Endpoint per sincronizzare manualmente le iniziative/referendum dal Ministero
 * POST /api/ministero/sync
 */
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Sincronizzazione manuale richiesta');
    
    const results = await ministeroSync.syncAll();
    
    res.json({
      success: true,
      message: 'Sincronizzazione completata',
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore nella sincronizzazione manuale:', error);
    
    await logger.error('Errore sincronizzazione manuale Ministero', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione',
      message: error.message
    });
  }
});

/**
 * Endpoint per ottenere le iniziative sincronizzate dal database
 * GET /api/ministero/database
 */
router.get('/database', async (req, res) => {
  try {
    const { pool } = require('../middleware/auth');
    
    const { tipo, stato, include_concluse } = req.query;
    
    let query = 'SELECT * FROM iniziative_ministero WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (tipo) {
      query += ` AND tipo = $${paramIndex++}`;
      params.push(tipo);
    }
    
    if (stato) {
      query += ` AND stato = $${paramIndex++}`;
      params.push(stato);
    } else if (include_concluse !== 'true') {
      // Di default mostra solo quelle in corso
      query += ` AND stato != 'conclusa'`;
    }
    
    query += ' ORDER BY data_ultimo_aggiornamento DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore nel recupero dati dal database:', error);
    
    await logger.error('Errore recupero iniziative Ministero dal database', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dati',
      message: error.message
    });
  }
});

/**
 * Endpoint per vedere gli ultimi log di sincronizzazione (solo per debug)
 * GET /api/ministero/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { pool } = require('../middleware/auth');
    
    // Recupera gli ultimi log dalla tabella logs (se esiste)
    const result = await pool.query(`
      SELECT * FROM logs 
      WHERE message LIKE '%ministero%' OR message LIKE '%sincronizzazione%' OR message LIKE '%iniziativa%'
      ORDER BY timestamp DESC 
      LIMIT 100
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      logs: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore nel recupero log:', error);
    
    // Se la tabella non esiste, ritorna un messaggio
    res.json({
      success: false,
      error: 'Tabella logs non trovata o non disponibile',
      message: 'I log sono disponibili solo nella console del server o nei log di Render',
      hint: 'Controlla i log su Render.com o nella console del server'
    });
  }
});

module.exports = router;

