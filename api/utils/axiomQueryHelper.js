/**
 * Utility helper per query Axiom
 * Sostituisce le query PostgreSQL per centralized_logs e audit_logs
 */

let Axiom;
let axiomClient;

/**
 * Inizializza il client Axiom
 */
function initAxiomClient() {
  if (axiomClient) return axiomClient;
  
  if (process.env.AXIOM_ENABLED !== 'true' || !process.env.AXIOM_API_TOKEN || !process.env.AXIOM_ORG_ID) {
    return null;
  }
  
  try {
    Axiom = require('@axiomhq/axiom-node');
    const region = (process.env.AXIOM_REGION || 'eu').toLowerCase();
    axiomClient = new Axiom.Client({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: region
    });
    return axiomClient;
  } catch (error) {
    console.error('❌ Errore inizializzazione Axiom client:', error.message);
    return null;
  }
}

/**
 * Esegue una query APL su Axiom
 */
async function queryAxiom(aplQuery, options = {}) {
  const client = initAxiomClient();
  if (!client) {
    throw new Error('Axiom non configurato o non abilitato');
  }
  
  const {
    startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: ultimi 7 giorni
    endTime = new Date(),
    timeout = 30000
  } = options;
  
  try {
    const result = await client.query(aplQuery, {
      startTime,
      endTime,
      timeout
    });
    
    // Normalizza la risposta (Axiom può restituire dati in formati diversi)
    let records = [];
    if (result.matches && Array.isArray(result.matches)) {
      records = result.matches;
    } else if (result.data?.rows && Array.isArray(result.data.rows)) {
      records = result.data.rows;
    } else if (result.rows && Array.isArray(result.rows)) {
      records = result.rows;
    } else if (Array.isArray(result)) {
      records = result;
    }
    
    // Normalizza i record (i dati possono essere in record.data)
    return records.map(record => {
      // Preserva _time e _sysTime dal record originale
      const originalTime = record._time || record._sysTime;
      
      if (record.data) {
        try {
          const parsedData = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
          // Se _time non è nei dati parsati, usa quello originale
          if (!parsedData._time && originalTime) {
            parsedData._time = originalTime;
          }
          // Se _time è ancora mancante, prova _sysTime
          if (!parsedData._time && record._sysTime) {
            parsedData._time = new Date(record._sysTime).toISOString();
          }
          return parsedData;
        } catch (e) {
          // Se il parsing fallisce, mantieni il record originale ma aggiungi _time se mancante
          if (!record._time && originalTime) {
            record._time = originalTime;
          }
          return record;
        }
      }
      
      // Se non c'è data, assicurati che _time sia presente
      if (!record._time && originalTime) {
        record._time = originalTime;
      } else if (!record._time && record._sysTime) {
        record._time = new Date(record._sysTime).toISOString();
      }
      
      return record;
    });
  } catch (error) {
    console.error('❌ Errore query Axiom:', error.message);
    throw error;
  }
}

/**
 * Conta i record in un dataset Axiom
 */
async function countAxiomRecords(dataset, options = {}) {
  const client = initAxiomClient();
  if (!client) {
    throw new Error('Axiom non configurato o non abilitato');
  }
  
  const {
    startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endTime = new Date(),
    timeout = 30000
  } = options;
  
  const aplQuery = `['${dataset}'] | summarize count()`;
  
  try {
    const result = await client.query(aplQuery, {
      startTime,
      endTime,
      streaming: false,
      format: 'json',
      timeout
    });
    
    // Estrai count dalla struttura di risposta Axiom
    let count = 0;
    
    // Prova diverse strutture di risposta
    if (result.buckets?.totals?.[0]?.aggregations?.[0]?.value !== undefined) {
      count = parseInt(result.buckets.totals[0].aggregations[0].value) || 0;
    } else if (result.status?.rowsExamined !== undefined) {
      count = parseInt(result.status.rowsExamined) || 0;
    } else if (result.matches && Array.isArray(result.matches) && result.matches.length > 0) {
      // Se è un array, prova a estrarre il count dal primo elemento
      const firstMatch = result.matches[0];
      if (typeof firstMatch === 'object') {
        const keys = Object.keys(firstMatch);
        if (keys.length > 0) {
          count = parseInt(firstMatch[keys[0]]) || 0;
        }
      } else if (typeof firstMatch === 'number') {
        count = firstMatch;
      }
    } else if (result.data?.rows && Array.isArray(result.data.rows) && result.data.rows.length > 0) {
      const firstRow = result.data.rows[0];
      if (typeof firstRow === 'object') {
        const keys = Object.keys(firstRow);
        if (keys.length > 0) {
          count = parseInt(firstRow[keys[0]]) || 0;
        }
      } else if (typeof firstRow === 'number') {
        count = firstRow;
      }
    } else if (result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
      const firstRow = result.rows[0];
      if (typeof firstRow === 'object') {
        const keys = Object.keys(firstRow);
        if (keys.length > 0) {
          count = parseInt(firstRow[keys[0]]) || 0;
        }
      } else if (typeof firstRow === 'number') {
        count = firstRow;
      }
    }
    
    return count;
  } catch (error) {
    console.error(`❌ Errore conteggio record Axiom per dataset '${dataset}':`, error.message);
    if (error.response) {
      console.error('Dettagli errore Axiom:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Ottiene audit logs da Axiom (dataset real-time)
 */
async function getAuditLogs(options = {}) {
  const {
    userId = null,
    action = null,
    resource = null,
    success = null,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;
  
  let aplQuery = `['${process.env.AXIOM_REALTIME_DATASET || 'real-time'}']`;
  
  // Filtri (solo se non null)
  const filters = [];
  if (userId) filters.push(`user_id == '${userId}'`);
  if (action) filters.push(`action == '${action}'`);
  if (resource) filters.push(`resource == '${resource}'`);
  // success non viene filtrato in APL se è false (problema sintassi) - filtriamo lato server
  
  if (filters.length > 0) {
    aplQuery += ` | where ${filters.join(' AND ')}`;
  }
  
  aplQuery += ` | order by _time desc | limit ${limit * 3}`; // Prendi più record per filtrare lato server
  
  const records = await queryAxiom(aplQuery, { startTime, endTime });
  
  // Filtra solo audit logs (hanno action e resource) lato server
  let auditLogs = records.filter(log => {
    const logAction = log.action || (log.data && log.data.action);
    const logResource = log.resource || (log.data && log.data.resource);
    return logAction && logResource;
  });
  
  // Filtra per success lato server se specificato
  if (success !== null && success !== undefined) {
    auditLogs = auditLogs.filter(log => {
      const logSuccess = log.success !== undefined ? log.success : (log.data && log.data.success);
      return logSuccess === success;
    });
  }
  
  // Applica offset manualmente (Axiom non supporta offset direttamente)
  return auditLogs.slice(offset, offset + limit);
}

/**
 * Ottiene centralized logs da Axiom
 */
async function getCentralizedLogs(options = {}) {
  const {
    userId = null,
    level = null,
    endpoint = null,
    ipAddress = null,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;
  
  let aplQuery = `['${process.env.AXIOM_DATASET || 'centralized_logs'}']`;
  
  // Filtri (solo se non null)
  // NOTA: Alcuni campi come 'level' potrebbero non essere accessibili direttamente in APL
  // se sono dentro 'data', quindi filtriamo lato server
  const filters = [];
  if (userId) filters.push(`user_id == '${userId}'`);
  // level non viene filtrato in APL - filtriamo lato server
  if (endpoint) {
    // Se endpoint contiene caratteri speciali, usa contains invece di ==
    if (endpoint.includes('%') || endpoint.includes('*')) {
      filters.push(`endpoint contains '${endpoint.replace(/%/g, '').replace(/\*/g, '')}'`);
    } else {
      filters.push(`endpoint == '${endpoint}'`);
    }
  }
  if (ipAddress) filters.push(`ip_address == '${ipAddress}'`);
  
  if (filters.length > 0) {
    aplQuery += ` | where ${filters.join(' AND ')}`;
  }
  
  aplQuery += ` | order by _time desc | limit ${limit * 3}`; // Prendi più record per filtrare lato server
  
  const records = await queryAxiom(aplQuery, { startTime, endTime });
  
  // Filtra per level lato server se specificato
  let filteredRecords = records;
  if (level) {
    filteredRecords = records.filter(log => {
      const logLevel = log.level || (log.data && log.data.level);
      return logLevel === level || logLevel === level.charAt(0); // Supporta sia 'ERROR' che 'E'
    });
  }
  
  // Applica offset manualmente
  return filteredRecords.slice(offset, offset + limit);
}

/**
 * Ottiene security events da Axiom (dataset real-time)
 */
async function getSecurityEvents(options = {}) {
  const {
    userId = null,
    type = null,
    severity = null,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;
  
  let aplQuery = `['${process.env.AXIOM_REALTIME_DATASET || 'real-time'}']`;
  
  // Filtri (solo se non null)
  const filters = [];
  if (userId) filters.push(`user_id == '${userId}'`);
  if (type) filters.push(`type == '${type}'`);
  if (severity) filters.push(`severity == '${severity}'`);
  
  if (filters.length > 0) {
    aplQuery += ` | where ${filters.join(' AND ')}`;
  }
  
  aplQuery += ` | order by _time desc | limit ${limit * 2}`; // Prendi più record per filtrare lato server
  
  const records = await queryAxiom(aplQuery, { startTime, endTime });
  
  // Filtra solo security events (hanno type e severity) lato server
  const securityEvents = records.filter(log => log.type && log.severity);
  
  // Applica offset manualmente
  return securityEvents.slice(offset, offset + limit);
}

module.exports = {
  initAxiomClient,
  queryAxiom,
  countAxiomRecords,
  getAuditLogs,
  getCentralizedLogs,
  getSecurityEvents
};

