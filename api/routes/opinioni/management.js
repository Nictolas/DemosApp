const express = require('express');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { normalizeOpinionScope, getOpinionScopeLabel } = require('../../services/politicalJurisdictionRegistryService');

const router = express.Router();

// Funzione helper per aggiungere la colonna in opinioni_risposte se non esiste
async function ensureOpinioniRisposteColumn(opinionId) {
  try {
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' 
      AND column_name = $1
    `;
    const columnCheck = await pool.query(checkColumnQuery, [opinionId]);
    
    if (columnCheck.rows.length === 0) {
      console.log(`📊 Aggiungo colonna ${opinionId} a opinioni_risposte...`);
      // Usa un identificatore quotato per il nome della colonna
      const addColumnQuery = `ALTER TABLE opinioni_risposte ADD COLUMN "${opinionId}" TEXT`;
      await pool.query(addColumnQuery);
      console.log(`✅ Colonna ${opinionId} aggiunta a opinioni_risposte`);
    } else {
      console.log(`ℹ️ Colonna ${opinionId} già esistente in opinioni_risposte`);
    }
  } catch (error) {
    console.error(`❌ Errore nell'aggiungere colonna ${opinionId} a opinioni_risposte:`, error);
    // Non bloccare l'operazione se fallisce, ma logga l'errore
  }
}

// Funzione helper per notificare tutti gli utenti quando viene aggiunta una nuova opinione
async function notifyAllUsersNewOpinion(opinionText, opinionId) {
  try {
    console.log('📢 Invio notifiche per nuova opinione:', opinionText);
    
    const titolo = 'Nuova opinione disponibile';
    const messaggio = `È stata aggiunta una nuova opinione: "${opinionText}". Vai nella sezione Opinioni per esprimere la tua posizione!`;
    
    // Controlla se esiste già una comunicazione con tipo 'new_opinions' e la sovrascrivi
    const existingNotification = await pool.query(
      'SELECT id FROM comunicazioni WHERE tipo = $1 ORDER BY data_creazione DESC LIMIT 1',
      ['new_opinions']
    );

    let result;
    if (existingNotification.rows.length > 0) {
      // Aggiorna notifica esistente (sovrascrive)
      const comunicazioneId = existingNotification.rows[0].id;
      
      // Reset like/dislike e read_by per far apparire la notifica come non letta per tutti
      await pool.query(
        'DELETE FROM reazioni WHERE comunicazione_id = $1',
        [comunicazioneId]
      );

      result = await pool.query(
        `UPDATE comunicazioni SET
          id_utente = NULL,
          titolo = $1,
          testo = $2,
          zona = 'Generale',
          commento = NULL,
          data_creazione = NOW(),
          likes = 0,
          dislikes = 0,
          punti_trasparenza = 0,
          read_by = ARRAY[]::uuid[]
        WHERE id = $3
        RETURNING *`,
        [titolo, messaggio, comunicazioneId]
      );
      
      console.log(`✅ Notifica new_opinions aggiornata (sovrascritta) per: ${opinionText}`);
    } else {
      // Crea nuova notifica new_opinions
      result = await pool.query(
        `INSERT INTO comunicazioni (
          id, id_utente, titolo, testo, zona, voto_dato, vincitore, commento,
          data_creazione, likes, dislikes, punti_trasparenza, tipo, read_by
        ) VALUES (
          gen_random_uuid(), NULL, $1, $2, 'Generale', NULL, NULL, NULL, NOW(), 0, 0, 0, $3, ARRAY[]::uuid[]
        ) RETURNING *`,
        [titolo, messaggio, 'new_opinions']
      );
      
      console.log(`✅ Notifica new_opinions creata per: ${opinionText}`);
    }

  } catch (error) {
    console.error('❌ Errore nell\'invio notifiche per nuova opinione:', error);
    // Non bloccare l'operazione se fallisce, ma logga l'errore
  }
}

// GET /api/opinioni - Ottieni tutte le opinioni ufficiali (escludendo quelle da approvare)
router.get('/', verifyToken, async (req, res) => {
  try {
    // Filtra le opinioni per escludere quelle con grado "da approvare"
    const query = `
      SELECT o.id, o.text, o.gradi_opinione, o.approfondimento
      FROM opinioni_domande o
      WHERE NOT ('da approvare' = ANY(o.gradi_opinione))
      ORDER BY o.text
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni/proposte - Ottieni tutte le opinioni (per gestione)
router.get('/proposte', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 GET /api/opinioni/proposte - Richiesta opinioni per gestione');
    
    const query = `
      SELECT id, text, gradi_opinione, approfondimento
      FROM opinioni_domande
      ORDER BY text
    `;
    
    const result = await pool.query(query);
    
    // Debug: log dei primi 3 risultati per vedere la struttura
    console.log('🔍 DEBUG - Prime 3 opinioni con gradi_opinione:', result.rows.slice(0, 3).map(row => ({
      id: row.id,
      text: row.text,
      gradi_opinione: row.gradi_opinione
    })));
    
    // Mappa le lettere ai nomi completi per il frontend
    const mappedData = result.rows.map(row => {
      const mappedGradi = row.gradi_opinione?.map(grado => getOpinionScopeLabel(grado) || grado) || [];
      
      return {
        ...row,
        gradi_opinione: mappedGradi
      };
    });
    
    console.log('🔍 DEBUG - Dati mappati per frontend:', mappedData.slice(0, 3).map(row => ({
      id: row.id,
      text: row.text,
      gradi_opinione: row.gradi_opinione
    })));
    
    console.log(`✅ Trovate ${result.rows.length} opinioni per gestione`);
    
    res.json({
      success: true,
      data: mappedData
    });
    
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile recuperare le opinioni'
    });
  }
});

// POST /api/opinioni - Crea una nuova opinione
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id, text, gradi_opinione } = req.body;
    
    console.log('📝 POST /api/opinioni - Creazione nuova opinione');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 Testo:', text);
    console.log('🔍 Gradi:', gradi_opinione);
    
    if (!id || !text || !gradi_opinione || !Array.isArray(gradi_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti o non validi',
        message: 'ID, testo e gradi_opinione sono obbligatori e gradi_opinione deve essere un array'
      });
    }
    
    const insertQuery = `
      INSERT INTO opinioni_domande (id, text, gradi_opinione, approfondimento)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        gradi_opinione = EXCLUDED.gradi_opinione,
        approfondimento = EXCLUDED.approfondimento
    `;
    
    // Mappa i nomi completi alle lettere per il database
    const mappedGradi = gradi_opinione.map(grado => normalizeOpinionScope(grado) || grado);
    
    // Verifica se l'opinione esiste già (per distinguere tra nuovo inserimento e aggiornamento)
    const checkExisting = await pool.query(
      'SELECT id, gradi_opinione FROM opinioni_domande WHERE id = $1',
      [id]
    );
    const isNewOpinion = checkExisting.rows.length === 0;
    const wasPending = Array.isArray(checkExisting.rows[0]?.gradi_opinione)
      && checkExisting.rows[0].gradi_opinione.includes('da approvare');

    // Compatibilità con lo schema additivo in cui le proposte pendenti vivono in
    // opinioni_proposte invece che in opinioni_domande con grado "da approvare".
    let existedInProposalTable = false;
    try {
      const proposalResult = await pool.query(
        'SELECT id FROM opinioni_proposte WHERE id = $1',
        [id]
      );
      existedInProposalTable = proposalResult.rows.length > 0;
    } catch (proposalLookupError) {
      if (proposalLookupError.code !== '42P01') throw proposalLookupError;
    }
    
    const approfondimento = `## Proposta ${gradi_opinione.join(', ')}\n\n${text}`;
    const result = await pool.query(insertQuery, [id, text, mappedGradi, approfondimento]);

    const closesPendingProposal = !mappedGradi.includes('da approvare')
      && (wasPending || existedInProposalTable);
    if (closesPendingProposal) {
      if (existedInProposalTable) {
        await pool.query('DELETE FROM opinioni_proposte WHERE id = $1', [id]);
      }
      await pool.query(
        'UPDATE users SET opinione_proposta_id = NULL WHERE opinione_proposta_id = $1',
        [id]
      );
    }
    
    // Aggiungi la colonna corrispondente in opinioni_risposte se non esiste
    await ensureOpinioniRisposteColumn(id);
    
    // Notifica tutti gli utenti solo se è una nuova opinione (non un aggiornamento)
    if (isNewOpinion) {
      await notifyAllUsersNewOpinion(text, id);
    }
    
    console.log('✅ Opinione creata/aggiornata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione creata/aggiornata con successo',
      data: { id, text, gradi_opinione }
    });
    
  } catch (error) {
    console.error('❌ Errore nella creazione opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile creare l\'opinione'
    });
  }
});

// PUT /api/opinioni/:id - Aggiorna un'opinione esistente
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, gradi_opinione } = req.body;
    
    console.log('✏️ PUT /api/opinioni/:id - Aggiornamento opinione');
    console.log('🔍 ID opinione:', id);
    console.log('🔍 Nuovo testo:', text);
    console.log('🔍 Nuovi gradi:', gradi_opinione);
    
    if (!text || !gradi_opinione || !Array.isArray(gradi_opinione)) {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti o non validi',
        message: 'Testo e gradi_opinione sono obbligatori e gradi_opinione deve essere un array'
      });
    }
    
    // Mappa i nomi completi alle lettere per il database
    const mappedGradi = gradi_opinione.map(grado => normalizeOpinionScope(grado) || grado);

    const previous = await pool.query(
      'SELECT gradi_opinione FROM opinioni_domande WHERE id = $1',
      [id]
    );
    const wasPending = Array.isArray(previous.rows[0]?.gradi_opinione)
      && previous.rows[0].gradi_opinione.includes('da approvare');
    
    const updateQuery = `
      UPDATE opinioni_domande
      SET text = $1, gradi_opinione = $2, approfondimento = $3
      WHERE id = $4
    `;
    
    const approfondimento = `## Proposta ${gradi_opinione.join(', ')}\n\n${text}`;
    const result = await pool.query(updateQuery, [text, mappedGradi, approfondimento, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: 'Impossibile aggiornare l\'opinione'
      });
    }
    
    if (wasPending && !mappedGradi.includes('da approvare')) {
      await pool.query(
        'UPDATE users SET opinione_proposta_id = NULL WHERE opinione_proposta_id = $1',
        [id]
      );
    }

    // Aggiungi la colonna corrispondente in opinioni_risposte se non esiste
    await ensureOpinioniRisposteColumn(id);
    
    console.log('✅ Opinione aggiornata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione aggiornata con successo',
      data: { id, text, gradi_opinione }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'aggiornare opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile aggiornare l\'opinione'
    });
  }
});

// DELETE /api/opinioni/:id - Elimina un'opinione
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE /api/opinioni/:id - Eliminazione opinione');
    console.log('🔍 ID opinione:', id);
    
    const deleteQuery = 'DELETE FROM opinioni_domande WHERE id = $1';
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: 'Impossibile eliminare l\'opinione'
      });
    }
    
    console.log('✅ Opinione eliminata con successo:', id);
    
    res.json({
      success: true,
      message: 'Opinione eliminata con successo',
      data: { id }
    });
    
  } catch (error) {
    console.error('❌ Errore nell\'eliminare opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile eliminare l\'opinione'
    });
  }
});

module.exports = router;
