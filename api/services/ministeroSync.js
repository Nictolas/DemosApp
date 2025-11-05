const { pool } = require('../middleware/auth');
const logger = require('./centralizedLogger');

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
      console.error('❌ Errore nel fetch dall\'API Ministero:', error);
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
      console.error('❌ Errore nel recupero di tutte le iniziative dal Ministero:', error);
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
      tipo: item.idDecTipoIniziativa?.nome || item.tipo || item.tipologia || 'iniziativa',
      
      // Stato (dall'oggetto idDecStatoIniziativa, mappa in valori standard)
      stato: this.mapStatoMinistero(item.idDecStatoIniziativa?.nome || item.stato || item.status || 'in_corso'),
      
      // Date (usa i campi corretti dell'API)
      data_inizio: item.dataInizioRaccolta || item.dataInizio || item.data_inizio || item.dataApertura || null,
      data_fine: item.dataFineRaccolta || item.dataFine || item.data_fine || null,
      
      // SOSTENITORI = FIRME RACCOLTE (campo chiave!)
      firme_raccolte: parseInt(item.sostenitori || item.firme || item.firmeRaccolte || item.numeroFirme || 0),
      
      // Quorum
      quorum: parseInt(item.quorum || item.quorumRichiesto || item.sogliaMinima || 0),
      
      // URL e link
      sito_web: item.sito || item.sitoWeb || item.sito_web || item.link || null,
      documento: item.documento || item.allegato || item.logo || null,
      
      // Metadati
      promotore: item.promotore || (item.idComitato && item.idComitato.length > 0 ? 'Comitato' : null) || item.comitato || item.organizzazione || null,
      
      // Altri campi utili
      estremi: item.estremi || null,
      quesito: item.quesito || null,
      titolo_legge: item.titoloLeggeCostituzionale || null,
      
      data_ultimo_aggiornamento: new Date().toISOString(),
      
      // Dati raw per riferimento (mantieni come oggetto per JSONB)
      dati_raw: item
    };

    // Determina se è conclusa
    if (extracted.data_fine) {
      const dataFine = new Date(extracted.data_fine);
      const oggi = new Date();
      if (dataFine < oggi) {
        extracted.stato = 'conclusa';
      }
    }

    // Determina se ha raggiunto il quorum
    if (extracted.quorum > 0 && extracted.firme_raccolte >= extracted.quorum) {
      extracted.quorum_raggiunto = true;
    } else {
      extracted.quorum_raggiunto = false;
    }

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
   * Salva o aggiorna un'iniziativa/referendum nel database
   */
  async saveIniziativa(iniziativa) {
    try {
      const fields = this.extractFields(iniziativa);
      
      // Genera un ID univoco se non c'è
      const id = fields.id_ministero ? `ministero_${fields.id_ministero}` : `ministero_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Verifica se esiste già (per id_ministero o titolo+tipo)
      const existing = await pool.query(
        `SELECT id FROM iniziative_ministero WHERE id_ministero = $1 OR (titolo = $2 AND tipo = $3)`,
        [fields.id_ministero, fields.titolo, fields.tipo]
      );

      if (existing.rows.length > 0) {
        // Aggiorna esistente
        await pool.query(
          `UPDATE iniziative_ministero SET
            titolo = $1,
            descrizione = $2,
            tipo = $3,
            stato = $4,
            data_inizio = $5,
            data_fine = $6,
            firme_raccolte = $7,
            quorum = $8,
            quorum_raggiunto = $9,
            sito_web = $10,
            documento = $11,
            promotore = $12,
            dati_raw = $13::jsonb,
            data_ultimo_aggiornamento = $14,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $15`,
          [
            fields.titolo,
            fields.descrizione,
            fields.tipo,
            fields.stato,
            fields.data_inizio,
            fields.data_fine,
            fields.firme_raccolte,
            fields.quorum,
            fields.quorum_raggiunto,
            fields.sito_web,
            fields.documento,
            fields.promotore,
            fields.dati_raw ? JSON.stringify(fields.dati_raw) : '{}',
            fields.data_ultimo_aggiornamento,
            existing.rows[0].id
          ]
        );
        return { action: 'updated', id: existing.rows[0].id };
      } else {
        // Inserisci nuova
        const result = await pool.query(
          `INSERT INTO iniziative_ministero (
            id, id_ministero, titolo, descrizione, tipo, stato,
            data_inizio, data_fine, firme_raccolte, quorum, quorum_raggiunto,
            sito_web, documento, promotore, dati_raw, data_ultimo_aggiornamento
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16)
          RETURNING id`,
          [
            id,
            fields.id_ministero,
            fields.titolo,
            fields.descrizione,
            fields.tipo,
            fields.stato,
            fields.data_inizio,
            fields.data_fine,
            fields.firme_raccolte,
            fields.quorum,
            fields.quorum_raggiunto,
            fields.sito_web,
            fields.documento,
            fields.promotore,
            fields.dati_raw ? JSON.stringify(fields.dati_raw) : '{}',
            fields.data_ultimo_aggiornamento
          ]
        );
        return { action: 'created', id: result.rows[0].id };
      }
    } catch (error) {
      console.error('❌ Errore nel salvataggio iniziativa:', error);
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

      // Processa tutte le iniziative, incluse quelle concluse
      for (const iniziativa of iniziative) {
        try {
          // Verifica che l'iniziativa abbia almeno un ID o un titolo
          const fields = this.extractFields(iniziativa);
          if (!fields.id_ministero && !fields.titolo) {
            console.log(`⚠️ Iniziativa saltata: manca id_ministero e titolo`);
            results.skipped++;
            continue;
          }

          const result = await this.saveIniziativa(iniziativa);
          if (result.action === 'created') {
            results.created++;
            console.log(`✅ Creata nuova iniziativa: ${result.id} - ${fields.titolo?.substring(0, 50) || 'N/A'} - Stato: ${fields.stato}`);
          } else {
            results.updated++;
            console.log(`🔄 Aggiornata iniziativa: ${result.id} - ${fields.titolo?.substring(0, 50) || 'N/A'} - Stato: ${fields.stato}`);
          }
        } catch (error) {
          results.errors++;
          console.error(`❌ Errore sincronizzazione iniziativa:`, error.message);
          // Log dettagli dell'errore per debug
          if (iniziativa && iniziativa.id) {
            console.error(`   ID iniziativa: ${iniziativa.id}`);
          }
        }
      }

      await logger.info('Sincronizzazione Ministero completata', {
        total: iniziative.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors,
        skipped: results.skipped
      });

      console.log(`✅ Sincronizzazione completata: ${results.created} create, ${results.updated} aggiornate, ${results.errors} errori, ${results.skipped} saltate`);
      console.log(`📊 Totale iniziative processate: ${iniziative.length}, sincronizzate: ${results.created + results.updated}`);

      return results;
    } catch (error) {
      console.error('❌ Errore nella sincronizzazione:', error);
      await logger.error('Errore sincronizzazione Ministero', { error: error.message });
      throw error;
    }
  }
}

module.exports = new MinisteroSyncService();

