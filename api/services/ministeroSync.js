const { pool } = require('../middleware/auth');
const logger = require('./centralizedLogger');
const { invalidateMinisteroIniziativeCache } = require('./redisCache');
const { normalizeMinisteroDate, resolveIniziativaDataFine } = require('../utils/dateUtils');
const { resolveFirmaUrl } = require('../utils/iniziativeMinisteroMapper');
const { resolveProcessTypeFromSource, getSignatureThreshold } = require('./civicProcessRegistryService');

// Do not send arbitrary API/SQL error messages or record fields to operational logs.
function safeMinisteroErrorCode(error) {
  const code = error?.code;
  // Only PostgreSQL SQLSTATE classes and known network error codes are public diagnostics.
  const transportCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ABORT_ERR']);
  return typeof code === 'string' && (/^[0-9]{2}[A-Z0-9]{3}$/.test(code) || code === 'XX000' || transportCodes.has(code))
    ? code
    : 'UNCLASSIFIED';
}

const MINISTERO_JURISDICTION_ID = 'it';
const MINISTERO_SOURCE_ID = 'it.justice.signature_portal';

function resolveMinisteroProcessType(tipo) {
  return resolveProcessTypeFromSource({
    jurisdictionId: MINISTERO_JURISDICTION_ID,
    sourceId: MINISTERO_SOURCE_ID,
    rawType: tipo
  });
}

function isIniziativaPopolareTipo(tipo) {
  return resolveMinisteroProcessType(tipo)?.family === 'popular_initiative';
}

function isReferendumTipo(tipo) {
  return resolveMinisteroProcessType(tipo)?.family === 'referendum';
}

function getOfficialSignatureThreshold(tipo) {
  const processType = resolveMinisteroProcessType(tipo);
  return processType ? getSignatureThreshold(processType.id) : null;
}

/**
 * Servizio per sincronizzare iniziative e referendum dal Ministero della Giustizia
 */
class MinisteroSyncService {
  /**
   * Estrae i dati dall'API del Ministero con gestione paginazione
   */
  async fetchFromMinistero(page = 0, size = 100) {
    try {
      // L'API del Ministero potrebbe supportare paginazione con parametri page e size
      // Prova prima senza parametri, poi con paginazione se necessario
      let ministeroUrl = 'https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';
      
      // Aggiungi parametri di paginazione se specificati
      if (page > 0 || size !== 100) {
        const params = new URLSearchParams();
        if (page > 0) params.append('page', page.toString());
        if (size !== 100) params.append('size', size.toString());
        if (params.toString()) {
          ministeroUrl += '?' + params.toString();
        }
      }
      
      console.log(`📡 Chiamata API Ministero per sincronizzazione (page ${page}, size ${size}):`, ministeroUrl);
      
      const response = await fetch(ministeroUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Demos-Community/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`API Ministero risposta non OK: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Errore fetch Ministero:', safeMinisteroErrorCode(error));
      throw error;
    }
  }

  /**
   * Recupera tutte le iniziative dall'API del Ministero gestendo la paginazione
   */
  async fetchAllFromMinistero() {
    try {
      console.log('📡 Recupero tutte le iniziative dal Ministero (con gestione paginazione)...');
      
      let allIniziative = [];
      let currentPage = 0;
      let hasMorePages = true;
      const pageSize = 100; // Dimensione pagina standard
      
      while (hasMorePages) {
        const data = await this.fetchFromMinistero(currentPage, pageSize);
        
        // Estrai le iniziative dalla risposta
        let pageIniziative = [];
        if (Array.isArray(data)) {
          pageIniziative = data;
        } else if (data && typeof data === 'object') {
          // L'API del Ministero restituisce {resultCode, resultDescription, infoPaginazione, content}
          if (data.content && Array.isArray(data.content)) {
            pageIniziative = data.content;
          } else if (data.iniziative && Array.isArray(data.iniziative)) {
            pageIniziative = data.iniziative;
          } else if (data.data && Array.isArray(data.data)) {
            pageIniziative = data.data;
          }
        }
        
        console.log(`📄 Pagina ${currentPage}: trovate ${pageIniziative.length} iniziative`);
        
        // Aggiungi le iniziative di questa pagina
        if (pageIniziative.length > 0) {
          allIniziative = allIniziative.concat(pageIniziative);
        }
        
        // Controlla se ci sono altre pagine
        if (data && typeof data === 'object') {
          const paginazione = data.infoPaginazione || data.pagination || data.pagina;
          
          if (paginazione) {
            // Se c'è infoPaginazione, controlla se ci sono altre pagine
            const totalElements = paginazione.totalElements || paginazione.total || paginazione.totale || 0;
            const totalPages = paginazione.totalPages || paginazione.total_page || paginazione.pagine_totali || 0;
            const currentPageNum = paginazione.number || paginazione.currentPage || paginazione.pagina || currentPage;
            const isLast = paginazione.last !== undefined ? paginazione.last : (currentPageNum >= totalPages - 1);
            
            console.log(`📊 Paginazione: totale ${totalElements} elementi, ${totalPages} pagine, pagina corrente ${currentPageNum + 1}`);
            
            if (isLast || pageIniziative.length === 0 || (totalPages > 0 && currentPageNum >= totalPages - 1)) {
              hasMorePages = false;
            } else {
              currentPage++;
            }
          } else {
            // Se non c'è infoPaginazione, controlla se la pagina corrente è vuota o ha meno elementi della dimensione
            if (pageIniziative.length === 0 || pageIniziative.length < pageSize) {
              hasMorePages = false;
            } else {
              currentPage++;
              // Limite di sicurezza: non più di 100 pagine
              if (currentPage >= 100) {
                console.log('⚠️ Raggiunto limite sicurezza di 100 pagine, interrompo recupero');
                hasMorePages = false;
              }
            }
          }
        } else {
          // Se la risposta non è un oggetto con paginazione, prendi solo questa pagina
          hasMorePages = false;
        }
      }
      
      console.log(`✅ Recuperate tutte le iniziative: ${allIniziative.length} totali`);
      
      // Ritorna i dati nel formato atteso
      return {
        content: allIniziative,
        infoPaginazione: {
          totalElements: allIniziative.length,
          totalPages: Math.ceil(allIniziative.length / pageSize)
        }
      };
    } catch (error) {
      console.error('Errore paginazione Ministero:', safeMinisteroErrorCode(error));
      throw error;
    }
  }

  /**
   * Estrae i campi rilevanti da un'iniziativa/referendum
   */
  extractFields(item) {
    // Mappa i campi dall'API del Ministero della Giustizia
    const extracted = {
      // ID Ministero (campo principale)
      id_ministero: item.id ? String(item.id) : (item.codice || item.numero || null),
      
      // Titolo e descrizione
      titolo: item.titolo || item.nome || item.denominazione || item.oggetto || '',
      descrizione: item.descrizione || item.descrizioneBreve || item.testo || item.oggetto || '',
      
      // Tipo (dall'oggetto idDecTipoIniziativa)
      // Normalizza il tipo rimuovendo parentesi e dettagli aggiuntivi per matching migliore
      tipo: (() => {
        const tipoRaw = item.idDecTipoIniziativa?.nome || item.tipo || item.tipologia || 'iniziativa';
        // Rimuovi tutto dopo la prima parentesi (es. "Referendum abrogativo (art. 75)" -> "Referendum abrogativo")
        return tipoRaw.split('(')[0].trim();
      })(),
      
      // Stato (dall'oggetto idDecStatoIniziativa, mappa in valori standard)
      stato: this.mapStatoMinistero(item.idDecStatoIniziativa?.nome || item.stato || item.status || 'in_corso'),
      
      // Esito (mappa da stato per compatibilità con tabelle legacy)
      esito: this.mapStatoToEsito(item.idDecStatoIniziativa?.nome || item.stato || item.status || 'in_corso'),
      
      // Date (usa i campi corretti dell'API; 9999-12-31 = sentinel Ministero → null)
      data_inizio: normalizeMinisteroDate(
        item.dataInizioRaccolta || item.dataInizio || item.data_inizio || item.dataApertura || null
      ),
      data_fine: normalizeMinisteroDate(
        item.dataFineRaccolta || item.dataFine || item.data_fine || null
      ),
      
      // SOSTENITORI = FIRME RACCOLTE (campo chiave!)
      firme_raccolte: parseInt(item.sostenitori || item.firme || item.firmeRaccolte || item.numeroFirme || 0),
      
      // URL e link (fallback alla pagina ufficiale Ministero se manca il sito del comitato)
      sito_web: resolveFirmaUrl(
        item.sito || item.sitoWeb || item.sito_web || item.link || null,
        item.id ? String(item.id) : (item.codice || item.numero || null)
      ),
      
      // Altri campi utili
      estremi: item.estremi || null,
      quesito: item.quesito || null,
      titolo_legge: item.titoloLeggeCostituzionale || null,
      
      data_ultimo_aggiornamento: new Date().toISOString(),
      
      // Dati raw per riferimento (mantieni come oggetto per JSONB)
      dati_raw: item
    };

    // Se dal sito non arriva data_fine ma c'è data_inizio, salva inizio + 6 mesi (solo iniziative popolari)
    if (!extracted.data_fine && extracted.data_inizio && isIniziativaPopolareTipo(extracted.tipo)) {
      extracted.data_fine = resolveIniziativaDataFine(null, extracted.data_inizio);
    }

    // Determina se è conclusa
    if (extracted.data_fine) {
      const dataFine = new Date(extracted.data_fine);
      const oggi = new Date();
      if (dataFine < oggi) {
        extracted.stato = 'conclusa';
        extracted.esito = 'Conclusa';
      }
    }

    // La fonte canonica e il Ministero: il raggiungimento della soglia deriva
    // automaticamente dal numero ufficiale di firme, mai da inserimento manuale.
    const signatureThreshold = getOfficialSignatureThreshold(extracted.tipo);
    extracted.quorum_raggiunto = signatureThreshold !== null
      && extracted.firme_raccolte >= signatureThreshold;

    return extracted;
  }

  /**
   * Mappa lo stato del Ministero in valori standard
   */
  mapStatoMinistero(statoMinistero) {
    if (!statoMinistero) return 'in_corso';
    
    const statoLower = statoMinistero.toLowerCase();
    
    // Mappa stati comuni
    if (statoLower.includes('raccolta') || statoLower.includes('aperto')) {
      return 'in_corso';
    }
    if (statoLower.includes('conclus') || statoLower.includes('chiuso') || statoLower.includes('terminato')) {
      return 'conclusa';
    }
    if (statoLower.includes('approvato') || statoLower.includes('accettato')) {
      return 'approvata';
    }
    if (statoLower.includes('rifiutato') || statoLower.includes('respinto')) {
      return 'rifiutata';
    }
    
    // Normalizza il nome per database
    return statoLower.replace(/\s+/g, '_').toLowerCase();
  }

  /**
   * Mappa lo stato del Ministero all'esito (compatibilità con tabelle legacy)
   */
  mapStatoToEsito(stato) {
    if (!stato) return 'In Attesa';
    
    const statoLower = String(stato).toLowerCase();
    
    // Mapping degli stati comuni del Ministero
    const mapping = {
      'in corso': 'In Attesa',
      'in_corso': 'In Attesa',
      'in attesa': 'In Attesa',
      'attiva': 'In Attesa',
      'aperta': 'In Attesa',
      'conclusa': 'Conclusa',
      'chiusa': 'Conclusa',
      'approvata': 'Approvata',
      'rifiutata': 'Rifiutata',
      'respinta': 'Rifiutata'
    };
    
    // Cerca match esatto o parziale
    for (const [key, value] of Object.entries(mapping)) {
      if (statoLower.includes(key)) {
        return value;
      }
    }
    
    // Default
    return 'In Attesa';
  }

  /**
   * Salva o aggiorna un'iniziativa/referendum nel database
   */
  async saveIniziativa(iniziativa) {
    try {
      const fields = this.extractFields(iniziativa);
      
      // Debug: log dei campi estratti (solo se DEBUG_MODE è abilitato)
      const DEBUG_MODE = process.env.NODE_ENV === 'development' && process.env.DEBUG_MODE === 'true';
      if (DEBUG_MODE) {
        console.log(`🔍 DEBUG saveIniziativa - Campi estratti:`, {
          id_ministero: fields.id_ministero,
          titolo: fields.titolo?.substring(0, 50) || 'N/A',
          tipo: fields.tipo,
          stato: fields.stato,
          titolo_length: fields.titolo?.length || 0
        });
      }
      
      // Valida che titolo non sia vuoto (è NOT NULL nel database)
      if (!fields.titolo || fields.titolo.trim() === '') {
        throw new Error(`Titolo mancante o vuoto per iniziativa con id_ministero: ${fields.id_ministero || 'N/A'}`);
      }
      
      // Genera un ID univoco se non c'è
      const id = fields.id_ministero ? `ministero_${fields.id_ministero}` : `ministero_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Verifica se esiste già (per id_ministero o titolo+tipo)
      // Gestisci correttamente il caso in cui id_ministero è null
      // Usa TRIM per rimuovere spazi e normalizza per il matching
      let existingQuery;
      let existingParams;
      
      // Normalizza il titolo per il matching (trim e lowercase per confronto più flessibile)
      const titoloNormalizzato = fields.titolo?.trim() || '';
      
      if (fields.id_ministero) {
        // Cerca per id_ministero esatto O per titolo+tipo (usando TRIM per normalizzare)
        existingQuery = `SELECT id, id_ministero, titolo FROM iniziative_ministero 
                         WHERE id_ministero = $1 
                         OR (TRIM(titolo) = $2 AND tipo = $3) 
                         LIMIT 1`;
        existingParams = [fields.id_ministero, titoloNormalizzato, fields.tipo];
      } else {
        // Se non c'è id_ministero, cerca solo per titolo+tipo
        existingQuery = `SELECT id, id_ministero, titolo FROM iniziative_ministero 
                         WHERE TRIM(titolo) = $1 AND tipo = $2 
                         LIMIT 1`;
        existingParams = [titoloNormalizzato, fields.tipo];
      }
      
      if (DEBUG_MODE) {
        console.log(`🔍 DEBUG saveIniziativa - Query ricerca esistente:`, {
          query: existingQuery,
          params: existingParams
        });
      }
      
      const existing = await pool.query(existingQuery, existingParams);
      
      if (DEBUG_MODE) {
        console.log(`🔍 DEBUG saveIniziativa - Risultato ricerca:`, {
          found: existing.rows.length > 0,
          existing_id: existing.rows[0]?.id || 'N/A',
          existing_id_ministero: existing.rows[0]?.id_ministero || 'N/A'
        });
      }

      if (existing.rows.length > 0) {
        // Aggiorna esistente
        if (DEBUG_MODE) {
          console.log(`🔄 DEBUG saveIniziativa - Aggiornamento esistente ID: ${existing.rows[0].id}`);
        }
        
        const updateParams = [
          fields.titolo,
          fields.descrizione,
          fields.tipo,
          fields.stato,
          fields.esito,
          fields.data_inizio || null,
          fields.data_fine || null,
          fields.firme_raccolte || 0,
          fields.quorum_raggiunto || false,
          fields.sito_web || null,
          fields.dati_raw ? JSON.stringify(fields.dati_raw) : '{}',
          fields.data_ultimo_aggiornamento,
          existing.rows[0].id
        ];
        
        if (DEBUG_MODE) {
          console.log(`🔍 DEBUG saveIniziativa - Parametri UPDATE:`, {
            titolo: fields.titolo?.substring(0, 50),
            tipo: fields.tipo,
            stato: fields.stato,
            esito: fields.esito,
            id_ministero: fields.id_ministero,
            where_id: existing.rows[0].id
          });
        }
        
        await pool.query(
          `UPDATE iniziative_ministero SET
            titolo = $1,
            descrizione = $2,
            tipo = $3,
            stato = $4,
            esito = $5,
            data_inizio = $6,
            data_fine = $7,
            firme_raccolte = $8,
            quorum_raggiunto = $9,
            sito_web = $10,
            dati_raw = $11::jsonb,
            data_ultimo_aggiornamento = $12,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $13`,
          updateParams
        );
        
        if (DEBUG_MODE) {
          console.log(`✅ DEBUG saveIniziativa - Aggiornamento completato: ${existing.rows[0].id}`);
        }
        return { action: 'updated', id: existing.rows[0].id };
      } else {
        // Inserisci nuova
        if (DEBUG_MODE) {
          console.log(`➕ DEBUG saveIniziativa - Inserimento nuovo record ID: ${id}`);
        }
        
        const insertParams = [
          id,
          fields.id_ministero || null,
          fields.titolo,
          fields.descrizione || null,
          fields.tipo,
          fields.stato,
          fields.esito,
          fields.data_inizio || null,
          fields.data_fine || null,
          fields.firme_raccolte || 0,
          fields.quorum_raggiunto || false,
          fields.sito_web || null,
          fields.dati_raw ? JSON.stringify(fields.dati_raw) : '{}',
          fields.data_ultimo_aggiornamento
        ];
        
        if (DEBUG_MODE) {
          console.log(`🔍 DEBUG saveIniziativa - Parametri INSERT:`, {
            id: id,
            id_ministero: fields.id_ministero || 'NULL',
            titolo: fields.titolo?.substring(0, 50),
            tipo: fields.tipo,
            stato: fields.stato
          });
        }
        
        // Usa INSERT ... ON CONFLICT per gestire duplicati
        // Gestisce sia conflitti su id (PRIMARY KEY) che su id_ministero (UNIQUE)
        let conflictTarget = '(id)';
        if (fields.id_ministero) {
          // Se c'è id_ministero, prova prima con quello (più specifico)
          conflictTarget = '(id_ministero)';
        }
        
        const result = await pool.query(
          `INSERT INTO iniziative_ministero (
            id, id_ministero, titolo, descrizione, tipo, stato, esito,
            data_inizio, data_fine, firme_raccolte, quorum_raggiunto,
            sito_web, dati_raw, data_ultimo_aggiornamento
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
          ON CONFLICT ${conflictTarget} DO UPDATE SET
            titolo = EXCLUDED.titolo,
            descrizione = EXCLUDED.descrizione,
            tipo = EXCLUDED.tipo,
            stato = EXCLUDED.stato,
            esito = EXCLUDED.esito,
            data_inizio = EXCLUDED.data_inizio,
            data_fine = EXCLUDED.data_fine,
            firme_raccolte = EXCLUDED.firme_raccolte,
            quorum_raggiunto = EXCLUDED.quorum_raggiunto,
            sito_web = EXCLUDED.sito_web,
            dati_raw = EXCLUDED.dati_raw,
            data_ultimo_aggiornamento = EXCLUDED.data_ultimo_aggiornamento,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id`,
          insertParams
        );
        
        if (DEBUG_MODE) {
          console.log(`✅ DEBUG saveIniziativa - Inserimento completato: ${result.rows[0].id}`);
        }
        return { action: 'created', id: result.rows[0].id };
      }
    } catch (error) {
      // The caller reports only aggregate counts and allowlisted diagnostic codes.
      throw error;
    }
  }

  /**
   * Sincronizza tutte le iniziative/referendum dal Ministero
   * Include tutte le iniziative, anche quelle concluse
   */
  async syncAll() {
    try {
      console.log('🔄 Inizio sincronizzazione iniziative/referendum dal Ministero...');
      
      // Usa il nuovo metodo che gestisce la paginazione
      const data = await this.fetchAllFromMinistero();
      
      // Estrai array di iniziative (l'API restituisce {resultCode, resultDescription, infoPaginazione, content})
      let iniziative = [];
      if (Array.isArray(data)) {
        iniziative = data;
      } else if (data && typeof data === 'object') {
        // L'API del Ministero restituisce i dati in data.content
        if (data.content && Array.isArray(data.content)) {
          iniziative = data.content;
        } else if (data.iniziative && Array.isArray(data.iniziative)) {
          iniziative = data.iniziative;
        } else if (data.data && Array.isArray(data.data)) {
          iniziative = data.data;
        } else {
          iniziative = [data];
        }
      }

      console.log(`📊 Trovate ${iniziative.length} iniziative/referendum da sincronizzare (incluse quelle concluse)`);

      const results = {
        created: 0,
        updated: 0,
        errors: 0,
        skipped: 0
      };
      const failureCodes = Object.create(null);

      // Processa tutte le iniziative in batch per ottimizzare la memoria
      const BATCH_SIZE = 10; // Processa 10 iniziative alla volta
      const totalBatches = Math.ceil(iniziative.length / BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, iniziative.length);
        const batch = iniziative.slice(startIndex, endIndex);
        
        console.log(`📦 Processando batch ${batchIndex + 1}/${totalBatches} (${batch.length} iniziative)`);
        
        // Processa il batch
        for (const iniziativa of batch) {
          try {
            // Verifica che l'iniziativa abbia almeno un ID o un titolo
            const fields = this.extractFields(iniziativa);
            if (!fields.id_ministero && !fields.titolo) {
              results.skipped++;
              continue;
            }

            const result = await this.saveIniziativa(iniziativa);
            if (result.action === 'created') {
              results.created++;
            } else {
              results.updated++;
            }
          } catch (error) {
            results.errors++;
            const code = safeMinisteroErrorCode(error);
            failureCodes[code] = (failureCodes[code] || 0) + 1;
          }
        }
        
        // Libera memoria dopo ogni batch
        // Rimuovi riferimenti espliciti
        batch.length = 0;
        
        // Forza garbage collection se disponibile (dopo ogni batch)
        if (global.gc && (batchIndex + 1) % 5 === 0) {
          // GC ogni 5 batch per non rallentare troppo
          const beforeGC = process.memoryUsage();
          global.gc();
          const afterGC = process.memoryUsage();
          const freed = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
          if (freed > 0) {
            console.log(`🧹 GC dopo batch ${batchIndex + 1}: liberati ${freed}MB`);
          }
        }
      }

      // Salva il totale prima di liberare la memoria
      const totalIniziative = iniziative.length;

      // Backfill: iniziative già in DB con data_inizio ma senza data_fine dal sito
      try {
        const backfill = await pool.query(`
          UPDATE iniziative_ministero
          SET data_fine = (data_inizio + INTERVAL '6 months')::date,
              updated_at = CURRENT_TIMESTAMP
          WHERE data_fine IS NULL
            AND data_inizio IS NOT NULL
            AND LOWER(COALESCE(tipo, '')) LIKE '%iniziativa%'
            AND LOWER(COALESCE(tipo, '')) NOT LIKE '%referendum%'
          RETURNING id
        `);
        if (backfill.rowCount > 0) {
          console.log(`📅 Backfill data_fine (+6 mesi): aggiornate ${backfill.rowCount} iniziative`);
          results.backfilled_data_fine = backfill.rowCount;
        }

        const backfillPopolari = await pool.query(`
          UPDATE iniziative_popolari
          SET data_fine = (data_inizio + INTERVAL '6 months')::date
          WHERE data_fine IS NULL
            AND data_inizio IS NOT NULL
          RETURNING id
        `);
        if (backfillPopolari.rowCount > 0) {
          console.log(`📅 Backfill data_fine iniziative_popolari: aggiornate ${backfillPopolari.rowCount} proposte`);
          results.backfilled_data_fine_popolari = backfillPopolari.rowCount;
        }

        const referendumThreshold = getOfficialSignatureThreshold('Referendum abrogativo');
        const initiativeThreshold = getOfficialSignatureThreshold('Legge di iniziativa popolare');
        const quorumBackfill = await pool.query(`
          UPDATE iniziative_ministero
          SET quorum_raggiunto = CASE
                WHEN LOWER(COALESCE(tipo, '')) LIKE '%referendum%'
                  THEN COALESCE(firme_raccolte, 0) >= $1
                WHEN LOWER(COALESCE(tipo, '')) LIKE '%iniziativa%'
                  THEN COALESCE(firme_raccolte, 0) >= $2
                ELSE FALSE
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE quorum_raggiunto IS DISTINCT FROM CASE
                WHEN LOWER(COALESCE(tipo, '')) LIKE '%referendum%'
                  THEN COALESCE(firme_raccolte, 0) >= $1
                WHEN LOWER(COALESCE(tipo, '')) LIKE '%iniziativa%'
                  THEN COALESCE(firme_raccolte, 0) >= $2
                ELSE FALSE
              END
          RETURNING id
        `, [referendumThreshold, initiativeThreshold]);
        if (quorumBackfill.rowCount > 0) {
          console.log(`✅ Soglia firme riallineata automaticamente per ${quorumBackfill.rowCount} record ufficiali`);
          results.backfilled_quorum = quorumBackfill.rowCount;
        }
      } catch (backfillError) {
        console.warn('Backfill Ministero fallito:', safeMinisteroErrorCode(backfillError));
      }

      await logger.info('Sincronizzazione Ministero completata', {
        total: totalIniziative,
        created: results.created,
        updated: results.updated,
        errors: results.errors,
        skipped: results.skipped
      });

      if (results.errors > 0) {
        console.error('Sincronizzazione Ministero: errori aggregati per codice', failureCodes);
      }
      console.log(`✅ Sincronizzazione completata: ${results.created} create, ${results.updated} aggiornate, ${results.errors} errori, ${results.skipped} saltate`);
      console.log(`📊 Totale iniziative processate: ${totalIniziative}, sincronizzate: ${results.created + results.updated}`);

      // Libera memoria dopo la sincronizzazione
      iniziative.length = 0; // Libera l'array
      iniziative = null; // Rimuovi riferimento
      
      // Forza garbage collection finale se disponibile
      if (global.gc) {
        const beforeGC = process.memoryUsage();
        global.gc();
        const afterGC = process.memoryUsage();
        const freed = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);
        if (freed > 0) {
          console.log(`🧹 GC finale: liberati ${freed}MB dopo sincronizzazione`);
        }
      }

      await invalidateMinisteroIniziativeCache();

      return results;
    } catch (error) {
      const code = safeMinisteroErrorCode(error);
      console.error('Errore sincronizzazione Ministero:', code);
      await logger.error('Errore sincronizzazione Ministero', { code });
      throw error;
    }
  }
}

module.exports = new MinisteroSyncService();

