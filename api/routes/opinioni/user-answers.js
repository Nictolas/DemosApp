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
    
    // Query per ottenere le risposte dell'utente dalla tabella utenti - SENZA PREFISSI
    const userQuery = `
      SELECT 
        -- Opinion nazionali/europee
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        -- Opinion comunali (senza prefissi)
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale,
        nuove_case_popolari, nuove_piste_ciclabili, nuovi_asili_nido_comunali,
        nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti,
        sicurezza_strade_scolastiche, sostegno_commercio_locale,
        verde_pubblico_e_giardini,
        -- Opinion regionali (senza prefissi)
        nuovi_inceneritori, chiusura_ospedali_di_provincia,
        -- Opinion nazionali/comunali (senza prefissi)
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici,
        riduzione_parcheggi_a_pagamento
      FROM users
      WHERE id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    // Formatta le opinioni per il frontend come fa l'endpoint principale
    const formattedOpinions = questions.map(question => {
      // Estrai l'ID dell'opinione dal formato "grado_text"
      const opinionId = question.id.split('_').slice(1).join('_');
      const userAnswer = userAnswers[opinionId];
      
      // Converti le risposte del database al formato frontend
      let frontendAnswer = null;
      if (userAnswer === 'Sì') frontendAnswer = 'Favorevole';
      else if (userAnswer === 'No') frontendAnswer = 'Contrario';
      else if (userAnswer === 'Indeciso') frontendAnswer = 'Indeciso';
      else if (userAnswer === 'Contrario') frontendAnswer = 'Contrario';
      else if (userAnswer === 'Favorevole') frontendAnswer = 'Favorevole';
      else if (userAnswer === null) frontendAnswer = 'Astenuto';
      
      return {
        id: opinionId,
        text: question.text.split(': ')[1], // Rimuovi il prefisso del grado
        userAnswer: frontendAnswer
      };
    });

    res.json({
      success: true,
      data: formattedOpinions
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
      
      // Opinion comunali (senza prefissi)
      'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
      'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
      'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
      'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
      'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
      
      // Opinion nazionali/comunali (senza prefissi)
      'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
      'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
      'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
      'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
      'nuove_case_popolari': 'nuove_case_popolari',
      'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
      'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
      'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
      'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
      'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
      
      // Opinion regionali (senza prefissi)
      'nuovi_inceneritori': 'nuovi_inceneritori',
      'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
      
      // Colonne extra (senza prefissi)
      'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
      'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
      'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
      'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
      'sostegno_commercio_locale': 'sostegno_commercio_locale',
      'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
    };
    
    // Prepara i campi da aggiornare
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    for (const [opinionId, risposta] of Object.entries(opinioni)) {
      console.log(`🔍 DEBUG - Processando opinione: ${opinionId} = ${risposta}`);
      const dbField = opinionMapping[opinionId];
      console.log(`🔍 DEBUG - Campo database: ${dbField}`);
      
      if (dbField) {
        // Mantieni le risposte originali (le colonne users sono TEXT)
        let dbValue = null;
        if (risposta === 'Favorevole') dbValue = 'Favorevole';
        else if (risposta === 'Contrario') dbValue = 'Contrario';
        else if (risposta === 'Indeciso') dbValue = 'Indeciso';
        else if (risposta === 'Astenuto') dbValue = null;
        
        updateFields.push(`${dbField} = $${paramIndex}`);
        updateValues.push(dbValue);
        paramIndex++;
        
        console.log(`📝 Campo ${dbField} = ${dbValue}`);
      } else {
        console.warn(`⚠️ Campo non mappato: ${opinionId}`);
        console.warn(`⚠️ Chiavi disponibili nella mappatura:`, Object.keys(opinionMapping));
      }
    }
    
    console.log(`🔍 DEBUG - Campi da aggiornare: ${updateFields.length}`);
    console.log(`🔍 DEBUG - Valori:`, updateValues);
    
    if (updateFields.length === 0) {
      console.error('❌ ERRORE: Nessun campo da aggiornare');
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
