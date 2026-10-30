const express = require('express');
const router = express.Router();
const logger = require('../services/centralizedLogger');
const ministeroSync = require('../services/ministeroSync');
const ministeroSyncJob = require('../jobs/ministeroSyncJob');
const { remember, isEnabled } = require('../services/redisCache');
const { keys, ttl } = require('../config/cacheKeys');
const { verifyToken, requireAdmin } = require('../middleware/auth');

/**
 * Endpoint per recuperare i dati dal database (sincronizzati dal Ministero)
 * GET /api/ministero/iniziative
 * Recupera i dati dal database invece che direttamente dall'API del Ministero
 * così l'utente vede i dati aggiornati dalla sincronizzazione automatica:
 * - Sincronizzazione completa: ogni 1 ora (configurabile)
 * - Sincronizzazione referendum in corso: ogni 30 minuti (configurabile)
 */
router.get('/iniziative', async (req, res) => {
  try {
    const { pool } = require('../middleware/auth');
    // La superficie pubblica legge sempre il dataset canonico sincronizzato.
    // Le chiamate live e gli strumenti operativi non sono controllabili dal client pubblico.

    console.log('📊 Recupero dati iniziative dal database (sincronizzati)...');

    const payload = await remember(keys.ministeroIniziativeDb, ttl.ministeroIniziative, async () => {
      const result = await pool.query(`
      SELECT * FROM iniziative_ministero 
      ORDER BY data_ultimo_aggiornamento DESC, created_at DESC
    `);

      const iniziative = result.rows.map((row) => ({
        id: row.id,
        id_ministero: row.id_ministero,
        titolo: row.titolo,
        descrizione: row.descrizione,
        tipo: row.tipo,
        stato: row.stato,
        data_inizio: row.data_inizio,
        data_fine: row.data_fine,
        firme_raccolte: row.firme_raccolte,
        sostenitori: row.firme_raccolte,
        quorum_raggiunto: row.quorum_raggiunto,
        sito_web: row.sito_web,
        data_ultimo_aggiornamento: row.data_ultimo_aggiornamento,
        idDecTipoIniziativa: { nome: row.tipo },
        idDecStatoIniziativa: { nome: row.stato },
        ...(row.dati_raw && typeof row.dati_raw === 'object' ? row.dati_raw : {})
      }));

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

      return {
        success: true,
        data: { content: iniziative },
        iniziative,
        statistiche,
        source: 'Database (sincronizzato dal Ministero)'
      };
    });

    console.log(`✅ Dati recuperati dal database: ${payload.iniziative.length} iniziative`);

    if (isEnabled()) {
      const edge = Math.min(180, ttl.ministeroIniziative);
      res.set('Cache-Control', `public, max-age=${edge}, s-maxage=${edge}`);
    }
    res.json({
      ...payload,
      timestamp: new Date().toISOString()
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
router.post('/sync', verifyToken, requireAdmin, async (req, res) => {
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
 * Endpoint per verificare lo stato della sincronizzazione automatica
 * GET /api/ministero/sync/status
 */
router.get('/sync/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../middleware/auth');
    
    // Ottieni lo stato dal job
    const jobStatus = ministeroSyncJob.getStatus();
    
    // Ottieni statistiche dal database
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as totale,
        COUNT(*) FILTER (WHERE stato = 'in_corso') as in_corso,
        COUNT(*) FILTER (WHERE tipo LIKE '%Referendum abrogativo%') as referendum,
        COUNT(*) FILTER (WHERE tipo LIKE '%Referendum abrogativo%' AND stato = 'in_corso') as referendum_in_corso,
        MAX(data_ultimo_aggiornamento) as ultimo_aggiornamento
      FROM iniziative_ministero
    `);
    
    const stats = statsQuery.rows[0];
    
    // Calcola quando sarà la prossima sincronizzazione
    let prossimaSync = null;
    if (jobStatus.lastSyncTime) {
      const lastSync = new Date(jobStatus.lastSyncTime);
      const nextSync = new Date(lastSync.getTime() + jobStatus.intervalMs);
      prossimaSync = nextSync.toISOString();
    }
    
    res.json({
      success: true,
      job: {
        isRunning: jobStatus.isRunning,
        lastSyncTime: jobStatus.lastSyncTime,
        lastSyncStatus: jobStatus.lastSyncStatus,
        lastSyncError: jobStatus.lastSyncError,
        intervalMs: jobStatus.intervalMs,
        intervalMinutes: jobStatus.intervalMs / 1000 / 60,
        intervalInCorsoMs: jobStatus.intervalInCorsoMs,
        intervalInCorsoMinutes: jobStatus.intervalInCorsoMs / 1000 / 60,
        maxRetries: jobStatus.maxRetries,
        prossimaSync: prossimaSync
      },
      database: {
        totaleIniziative: parseInt(stats.totale) || 0,
        inCorso: parseInt(stats.in_corso) || 0,
        referendum: parseInt(stats.referendum) || 0,
        referendumInCorso: parseInt(stats.referendum_in_corso) || 0,
        ultimoAggiornamento: stats.ultimo_aggiornamento
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore nel recupero stato sincronizzazione:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero stato',
      message: error.message
    });
  }
});

/**
 * Endpoint per ottenere le iniziative sincronizzate dal database
 * GET /api/ministero/database
 */
router.get('/database', verifyToken, requireAdmin, async (req, res) => {
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
router.get('/logs', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Verifica se Axiom è configurato
    if (process.env.AXIOM_ENABLED !== 'true') {
      return res.json({
        success: false,
        error: 'Axiom non abilitato',
        message: 'I log sono disponibili solo con Axiom abilitato. Controlla i log della console del server su Render.com.',
        hint: 'I log sono disponibili anche nella console del server o sui log di Render.com'
      });
    }
    
    const { getCentralizedLogs } = require('../utils/axiomQueryHelper');
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTime = new Date();
    
    // Ottieni log da Axiom
    const allLogs = await getCentralizedLogs({
      startTime: twentyFourHoursAgo,
      endTime,
      limit: 1000
    });
    
    // Filtra log relativi a ministero, sincronizzazione o iniziative
    const filteredLogs = allLogs.filter(log => {
      const message = (log.message || '').toLowerCase();
      const endpoint = (log.endpoint || '').toLowerCase();
      return message.includes('ministero') || 
             message.includes('sincronizzazione') || 
             message.includes('iniziativa') ||
             endpoint.includes('ministero');
    });
    
    // Se non trova log filtrati, mostra gli ultimi log generici
    const logsToFormat = filteredLogs.length > 0 
      ? filteredLogs 
      : allLogs.slice(0, 20);
    
    // Formatta i log per la risposta
    const formattedLogs = logsToFormat.map(log => ({
      id: log._time || Date.now().toString(),
      timestamp: log._time || new Date().toISOString(),
      level: log.level || 'INFO',
      message: log.message || '',
      meta: log.meta_data || {},
      endpoint: log.endpoint || null,
      userId: log.user_id || null,
      ipAddress: log.ip_address || null,
      createdAt: log._time || new Date().toISOString()
    }));
    
    // Aggiungi informazioni utili
    const explanation = formattedLogs.length === 0 
      ? '⚠️ Nessun log trovato negli ultimi 24 ore. I log potrebbero non essere ancora indicizzati su Axiom (attendi qualche minuto).'
      : filteredLogs.length === 0 && allLogs.length > 0
        ? 'ℹ️ Nessun log trovato con i filtri specifici (ministero/sincronizzazione/iniziativa), ma ci sono altri log. Mostriamo gli ultimi log generici.'
        : null;
    
    res.json({
      success: true,
      count: formattedLogs.length,
      totalLogsInTable: allLogs.length,
      logs: formattedLogs,
      timestamp: new Date().toISOString(),
      explanation: explanation,
      info: {
        purpose: 'Questo endpoint mostra i log di debug relativi alla sincronizzazione delle iniziative dal Ministero della Giustizia.',
        whatItShouldShow: [
          'Conteggi aggregati di iniziative create, aggiornate, saltate e fallite (senza titoli o identificativi)',
          'Errori se una sincronizzazione fallisce',
          'Dettagli sul processo (quante iniziative recuperate, salvate, errori)'
        ],
        whyEmpty: formattedLogs.length === 0
          ? 'I log potrebbero non essere ancora indicizzati su Axiom (attendi qualche minuto) o non ci sono log relativi a ministero/sincronizzazione.'
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

