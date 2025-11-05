const { pool } = require('../middleware/auth');
const logger = require('./centralizedLogger');

/**
 * Servizio per sincronizzare iniziative e referendum dal Ministero della Giustizia
 */
class MinisteroSyncService {
  /**
   * Estrae i dati dall'API del Ministero
   */
  async fetchFromMinistero() {
    try {
      const ministeroUrl = 'https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';
      
      console.log('📡 Chiamata API Ministero per sincronizzazione:', ministeroUrl);
      
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
   */
  async syncAll() {
    try {
      console.log('🔄 Inizio sincronizzazione iniziative/referendum dal Ministero...');
      
      const data = await this.fetchFromMinistero();
      
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

      console.log(`📊 Trovate ${iniziative.length} iniziative/referendum da sincronizzare`);

      const results = {
        created: 0,
        updated: 0,
        errors: 0
      };

      for (const iniziativa of iniziative) {
        try {
          const result = await this.saveIniziativa(iniziativa);
          if (result.action === 'created') {
            results.created++;
            console.log(`✅ Creata nuova iniziativa: ${result.id}`);
          } else {
            results.updated++;
            console.log(`🔄 Aggiornata iniziativa: ${result.id}`);
          }
        } catch (error) {
          results.errors++;
          console.error(`❌ Errore sincronizzazione iniziativa:`, error.message);
        }
      }

      await logger.info('Sincronizzazione Ministero completata', {
        total: iniziative.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors
      });

      console.log(`✅ Sincronizzazione completata: ${results.created} create, ${results.updated} aggiornate, ${results.errors} errori`);

      return results;
    } catch (error) {
      console.error('❌ Errore nella sincronizzazione:', error);
      await logger.error('Errore sincronizzazione Ministero', { error: error.message });
      throw error;
    }
  }
}

module.exports = new MinisteroSyncService();

