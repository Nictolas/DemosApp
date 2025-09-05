const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');

const router = express.Router();

// GET /api/opinioni/profile - Ottieni opinioni per profilo utente
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Query per ottenere le domande delle opinioni dalla tabella opinioni
    const opinionQuery = `
      SELECT DISTINCT o.gradi_opinione[1] as grado_primario, o.text
      FROM opinioni o
      ORDER BY o.gradi_opinione[1], o.text
    `;
    
    const opinionResult = await pool.query(opinionQuery);
    
    // Formatta le domande per il frontend
    const questions = opinionResult.rows.map(row => ({
      id: `${row.grado_primario}_${row.text.replace(/\s+/g, '_')}`,
      text: `${row.grado_primario}: ${row.text}`
    }));
    
    // Query per ottenere le risposte dell'utente dalla tabella utenti
    const userQuery = `
      SELECT 
        -- Opinion nazionali
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali
        comunale_cassonetti_intelligenti_con_tessera, comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        comunale_divieto_di_nuovi_fast_food_nel_centro_storico, comunale_estensione_delle_zone_a_traffico_limitato,
        comunale_finanziamento_eventi_culturali_gratuiti, comunale_nuova_biblioteca_comunale,
        comunale_nuove_case_popolari, comunale_nuove_piste_ciclabili, comunale_nuovi_asili_nido_comunali,
        comunale_nuovo_stadio_comunale, comunale_parcheggi_gratuiti_per_residenti,
        comunale_potenziamento_trasporto_pubblico, comunale_riduzione_tasse_rifiuti,
        comunale_sicurezza_strade_scolastiche, comunale_sostegno_commercio_locale,
        comunale_verde_pubblico_e_giardini,
        -- Opinion regionali
        regionale_nuovi_inceneritori, regionale_chiusura_ospedali_di_provincia
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    res.json({
      success: true,
      data: {
        questions: questions,
        userAnswers: userAnswers
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// POST /api/opinioni/salva - Salva le opinioni dell'utente
router.post('/salva', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { opinioni } = req.body;
    
    console.log('💾 POST /api/opinioni/salva - Salvataggio opinioni utente');
    console.log('👤 User ID:', userId);
    console.log('📋 Opinion ricevute:', opinioni);
    console.log('🔍 Tipo opinioni:', typeof opinioni);
    console.log('🔍 Chiavi opinioni:', Object.keys(opinioni || {}));
    
    if (!opinioni || typeof opinioni !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti',
        message: 'Il campo opinioni è obbligatorio'
      });
    }
    
    // Mappa delle opinioni ai campi del database
    const opinionMapping = {
      // Opinion nazionali
      'energia_nucleare': 'energia_nucleare',
      'sperimentazione_animale': 'sperimentazione_animale',
      'legalizzazione_canapa': 'legalizzazione_canapa',
      'caccia': 'caccia',
      'eutanasia': 'eutanasia',
      'carne_coltivata': 'carne_coltivata',
      'cittadina_animale': 'cittadina_animale',
      'nato': 'nato',
      'matrimonio_gay': 'matrimonio_gay',
      'salario_minimo': 'salario_minimo',
      'case_chiuse': 'case_chiuse',
      'omobitransfobia': 'omobitransfobia',
      
      // Opinion comunali
      'comunale_cassonetti_intelligenti_con_tessera': 'comunale_cassonetti_intelligenti_con_tessera',
      'comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti',
      'comunale_divieto_di_nuovi_fast_food_nel_centro_storico': 'comunale_divieto_di_nuovi_fast_food_nel_centro_storico',
      'comunale_estensione_delle_zone_a_traffico_limitato': 'comunale_estensione_delle_zone_a_traffico_limitato',
      'comunale_finanziamento_eventi_culturali_gratuiti': 'comunale_finanziamento_eventi_culturali_gratuiti',
      'comunale_nuova_biblioteca_comunale': 'comunale_nuova_biblioteca_comunale',
      'comunale_nuove_case_popolari': 'comunale_nuove_case_popolari',
      'comunale_nuove_piste_ciclabili': 'comunale_nuove_piste_ciclabili',
      'comunale_nuovi_asili_nido_comunali': 'comunale_nuovi_asili_nido_comunali',
      'comunale_nuovo_stadio_comunale': 'comunale_nuovo_stadio_comunale',
      'comunale_parcheggi_gratuiti_per_residenti': 'comunale_parcheggi_gratuiti_per_residenti',
      'comunale_potenziamento_trasporto_pubblico': 'comunale_potenziamento_trasporto_pubblico',
      'comunale_riduzione_tasse_rifiuti': 'comunale_riduzione_tasse_rifiuti',
      'comunale_sicurezza_strade_scolastiche': 'comunale_sicurezza_strade_scolastiche',
      'comunale_sostegno_commercio_locale': 'comunale_sostegno_commercio_locale',
      'comunale_verde_pubblico_e_giardini': 'comunale_verde_pubblico_e_giardini',
      
      // Opinion regionali
      'nuovi_inceneritori': 'regionale_nuovi_inceneritori',
      'chiusura_ospedali_di_provincia': 'regionale_chiusura_ospedali_di_provincia',
      'regionale_nuovi_inceneritori': 'regionale_nuovi_inceneritori',
      'regionale_chiusura_ospedali_di_provincia': 'regionale_chiusura_ospedali_di_provincia'
    };
    
    // Prepara i campi da aggiornare
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      const dbField = opinionMapping[opinionId];
      
      if (dbField) {
        // Converti le risposte
        let dbValue = null;
        if (risposta === 'Favorevole') dbValue = 'Sì';
        else if (risposta === 'Contrario') dbValue = 'No';
        else if (risposta === 'Indeciso') dbValue = 'Indeciso';
        else if (risposta === 'Astenuto') dbValue = null;
        
        updateFields.push(`${dbField} = $${paramIndex}`);
        updateValues.push(dbValue);
        paramIndex++;
        
        console.log(`📝 Campo ${dbField} = ${dbValue}`);
      } else {
        console.warn(`⚠️ Campo non mappato: ${opinionId}`);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna opinione valida da salvare',
        message: 'Verifica che le opinioni corrispondano ai campi disponibili'
      });
    }
    
    // Aggiungi updated_at
    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date());
    
    // Esegui l'UPDATE
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex + 1}
    `;
    
    updateValues.push(userId);
    
    console.log('📝 Query UPDATE:', updateQuery);
    console.log('🔍 Valori:', updateValues);
    
    const result = await pool.query(updateQuery, updateValues);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato',
        message: 'Impossibile aggiornare le opinioni'
      });
    }
    
    console.log('✅ Opinion salvate con successo per utente:', userId);
    
    res.json({
      success: true,
      message: 'Opinioni salvate con successo',
      updatedFields: updateFields.length - 1, // -1 per escludere updated_at
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore nel salvare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile salvare le opinioni'
    });
  }
});

module.exports = router;
