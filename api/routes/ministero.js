const express = require('express');
const router = express.Router();
const logger = require('../services/centralizedLogger');
const ministeroSync = require('../services/ministeroSync');

/**
 * Endpoint per recuperare i dati dal database (sincronizzati dal Ministero)
 * GET /api/ministero/iniziative
 * Recupera i dati dal database invece che direttamente dall'API del Ministero
 * così l'utente vede i dati aggiornati dalla sincronizzazione automatica ogni 6 ore
 */
router.get('/iniziative', async (req, res) => {
  try {
    const { pool } = require('../middleware/auth');
    const { source } = req.query; // Permette di forzare la chiamata all'API con ?source=ministero
    
    // Se viene richiesto esplicitamente, chiama l'API del Ministero
    if (source === 'ministero') {
      return await fetchFromMinisteroAPI(req, res);
    }

    // Di default, recupera dal database (dati sincronizzati)
    console.log('📊 Recupero dati iniziative dal database (sincronizzati)...');
    
    const result = await pool.query(`
      SELECT * FROM iniziative_ministero 
      ORDER BY data_ultimo_aggiornamento DESC, created_at DESC
    `);

    const iniziative = result.rows.map(row => ({
      id: row.id,
      id_ministero: row.id_ministero,
      titolo: row.titolo,
      descrizione: row.descrizione,
      tipo: row.tipo,
      stato: row.stato,
      data_inizio: row.data_inizio,
      data_fine: row.data_fine,
      firme_raccolte: row.firme_raccolte,
      sostenitori: row.firme_raccolte, // Per compatibilità con il frontend
      quorum_raggiunto: row.quorum_raggiunto,
      sito_web: row.sito_web,
      data_ultimo_aggiornamento: row.data_ultimo_aggiornamento,
      // Dati raw per compatibilità
      idDecTipoIniziativa: { nome: row.tipo },
      idDecStatoIniziativa: { nome: row.stato },
      ...(row.dati_raw && typeof row.dati_raw === 'object' ? row.dati_raw : {})
    }));

    // Calcola statistiche
    const statistiche = {
      totaleIniziative: iniziative.length,
      totaleFirme: iniziative.reduce((sum, item) => sum + (item.firme_raccolte || 0), 0),
      iniziativePerStato: {},
      iniziativePerTipo: {}
    };

    iniziative.forEach((item) => {
      if (item.stato) {
        statistiche.iniziativePerStato[item.stato] = (statistiche.iniziativePerStato[item.stato] || 0) + 1;
      }
      if (item.tipo) {
        statistiche.iniziativePerTipo[item.tipo] = (statistiche.iniziativePerTipo[item.tipo] || 0) + 1;
      }
    });

    console.log(`✅ Dati recuperati dal database: ${iniziative.length} iniziative`);

    res.json({
      success: true,
      data: { content: iniziative }, // Formato compatibile con il frontend
      iniziative: iniziative,
      statistiche: statistiche,
      timestamp: new Date().toISOString(),
      source: 'Database (sincronizzato dal Ministero)'
    });

  } catch (error) {
    console.error('❌ Errore nel recupero dati dal database:', error);
    
    // Log dell'errore
    logger.logError(error, req, {
      endpoint: '/api/ministero/iniziative',
      errorMessage: error.message,
      errorStack: error.stack
    }).catch(err => console.error('Errore logging:', err));

    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message || 'Errore durante il recupero dei dati dal database'
    });
  }
});

/**
 * Funzione helper per chiamare direttamente l'API del Ministero (usata solo se ?source=ministero)
 */
async function fetchFromMinisteroAPI(req, res) {
  try {
    const ministeroUrl = 'https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';
    
    console.log('📡 Chiamata diretta API Ministero:', ministeroUrl);
    
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
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('❌ Impossibile parsare la risposta come JSON');
        data = { raw: text };
      }
    }

    let iniziative = [];
    let statistiche = {
      totaleIniziative: 0,
      totaleFirme: 0,
      iniziativePerStato: {},
      iniziativePerTipo: {}
    };

    if (data && typeof data === 'object' && data.content && Array.isArray(data.content)) {
      iniziative = data.content;
      statistiche.totaleIniziative = data.content.length;
      
      data.content.forEach((item) => {
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
    }

    res.json({
      success: true,
      data: data,
      iniziative: iniziative,
      statistiche: statistiche,
      timestamp: new Date().toISOString(),
      source: 'Ministero della Giustizia (diretto)'
    });
  } catch (error) {
    throw error;
  }
}

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
    }
    // Rimuoviamo il filtro di default che escludeva le iniziative concluse
    // Ora mostra TUTTE le iniziative di default, a meno che non venga specificato un filtro stato
    
    query += ' ORDER BY data_ultimo_aggiornamento DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    
    console.log(`📊 Query database: ${result.rows.length} iniziative trovate`);
    
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
    
    // Prima verifica se la tabella centralized_logs esiste
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'centralized_logs'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({
        success: false,
        error: 'Tabella centralized_logs non trovata',
        message: 'La tabella dei log non è stata ancora creata. I log sono disponibili solo nella console del server o nei log di Render.',
        hint: 'Esegui lo script create-centralized-logs-table.cjs per creare la tabella, oppure controlla i log su Render.com'
      });
    }
    
    // Prima controlla quanti log ci sono in totale nella tabella
    const totalLogsResult = await pool.query(`
      SELECT COUNT(*) as total FROM centralized_logs
    `);
    const totalLogs = parseInt(totalLogsResult.rows[0].total || 0);
    
    // Recupera gli ultimi log dalla tabella centralized_logs
    // Cerca log relativi a ministero, sincronizzazione o iniziative
    // Nota: timestamp è BIGINT (millisecondi Unix), quindi convertiamo il limite temporale
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000); // 24 ore fa in millisecondi
    
    const result = await pool.query(`
      SELECT 
        id,
        timestamp,
        level,
        message,
        meta_data,
        endpoint,
        user_id,
        ip_address,
        created_at
      FROM centralized_logs 
      WHERE 
        (message ILIKE '%ministero%' 
         OR message ILIKE '%sincronizzazione%' 
         OR message ILIKE '%iniziativa%'
         OR endpoint ILIKE '%ministero%')
        AND timestamp >= $1
      ORDER BY timestamp DESC 
      LIMIT 100
    `, [twentyFourHoursAgo]);
    
    // Se non trova log filtrati, mostriamo anche gli ultimi log generici (senza filtro)
    let allLogs = [];
    if (result.rows.length === 0 && totalLogs > 0) {
      const allLogsResult = await pool.query(`
        SELECT 
          id,
          timestamp,
          level,
          message,
          meta_data,
          endpoint,
          user_id,
          ip_address,
          created_at
        FROM centralized_logs 
        WHERE timestamp >= $1
        ORDER BY timestamp DESC 
        LIMIT 20
      `, [twentyFourHoursAgo]);
      allLogs = allLogsResult.rows;
    }
    
    // Formatta i log per la risposta
    const logsToFormat = result.rows.length > 0 ? result.rows : allLogs;
    const formattedLogs = logsToFormat.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      meta: row.meta_data || {},
      endpoint: row.endpoint,
      userId: row.user_id,
      ipAddress: row.ip_address,
      createdAt: row.created_at
    }));
    
    // Aggiungi informazioni utili
    const explanation = formattedLogs.length === 0 
      ? totalLogs === 0
        ? '⚠️ La tabella centralized_logs è vuota. Il logging su database è probabilmente disabilitato (vedi centralizedLogger.js, riga 99-101). I log vengono scritti solo nella console del server.'
        : '⚠️ Nessun log trovato negli ultimi 24 ore che corrisponda ai filtri "ministero/sincronizzazione/iniziativa". Potrebbero esserci log con messaggi diversi. Mostriamo gli ultimi log generici.'
      : result.rows.length === 0 && allLogs.length > 0
        ? 'ℹ️ Nessun log trovato con i filtri specifici, ma ci sono altri log nella tabella. Mostriamo gli ultimi log generici.'
        : null;
    
    res.json({
      success: true,
      count: formattedLogs.length,
      totalLogsInTable: totalLogs,
      logs: formattedLogs,
      timestamp: new Date().toISOString(),
      explanation: explanation,
      info: {
        purpose: 'Questo endpoint mostra i log di debug relativi alla sincronizzazione delle iniziative dal Ministero della Giustizia.',
        whatItShouldShow: [
          'Log di ogni iniziativa durante il salvataggio (creata/aggiornata)',
          'Errori se una sincronizzazione fallisce',
          'Dettagli sul processo (quante iniziative recuperate, salvate, errori)'
        ],
        whyEmpty: formattedLogs.length === 0 && totalLogs > 0
          ? 'I log di sincronizzazione potrebbero non essere scritti nel database (logging disabilitato) o usare messaggi diversi. Controlla i log della console del server su Render.com.'
          : formattedLogs.length === 0 && totalLogs === 0
          ? 'Il logging su database è disabilitato. I log vengono scritti solo nella console del server.'
          : null
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recupero log:', error);
    
    res.json({
      success: false,
      error: 'Errore nel recupero log',
      message: error.message,
      hint: 'I log sono disponibili anche nella console del server o sui log di Render.com'
    });
  }
});

module.exports = router;

