const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/opinioni/test - Endpoint di test senza autenticazione
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 TEST - Endpoint opinioni raggiunto senza autenticazione');
    
    res.json({
      success: true,
      message: 'Endpoint opinioni raggiunto correttamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore endpoint test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore endpoint test'
    });
  }
});

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

// GET /api/opinioni - Ottieni tutte le opinioni (per gestione)
router.get('/', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT o.*, o.gradi_opinione as categoria_nome
      FROM opinioni o
      ORDER BY o.gradi_opinione[1], o.text
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni'
    });
  }
});

// GET /api/opinioni-proposte - Ottieni opinioni proposte
router.get('/proposte', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT * FROM opinioni_proposte 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      opinioni: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni proposte:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni proposte'
    });
  }
});

// GET /api/opinioni-list - Ottieni opinioni per grado con risposte utente
router.get('/opinioni-list', verifyToken, async (req, res) => {
  try {
    const { grado } = req.query;
    const userId = req.userId;
    
    console.log('🔍 GET /api/opinioni-list - Richiesta opinioni per grado:', grado);
    console.log('👤 User ID:', userId);
    
    // Query per ottenere le opinioni dalla tabella opinioni usando il campo gradi_opinione (array)
    const query = `
      SELECT o.*, o.gradi_opinione as categoria_nome
      FROM opinioni o
      WHERE $1 = ANY(o.gradi_opinione)
      ORDER BY o.text
    `;
    
    console.log('📝 Query opinioni:', query);
    console.log('🔍 Parametro grado:', grado);
    
    const result = await pool.query(query, [grado]);
    
    console.log('📊 Risultati opinioni:', result.rows.length);
    if (result.rows.length === 0) {
      console.log('⚠️ Nessuna opinione trovata per grado:', grado);
      console.log('🔍 Verifico se esistono opinioni nella tabella...');
      
      // Query per vedere tutte le opinioni disponibili
      const allOpinionsQuery = `
        SELECT 
          unnest(gradi_opinione) as grado,
          COUNT(*) as count 
        FROM opinioni 
        GROUP BY unnest(gradi_opinione)
        ORDER BY grado
      `;
      const allOpinionsResult = await pool.query(allOpinionsQuery);
      console.log('📋 Tutte le opinioni disponibili:', allOpinionsResult.rows);
    } else {
      console.log('✅ Prime 3 opinioni trovate:', result.rows.slice(0, 3));
    }
    
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
    
    console.log('👤 Query utente:', userQuery);
    console.log('🔍 User ID per query:', userId);
    
    const userResult = await pool.query(userQuery, [userId]);
    const userAnswers = userResult.rows[0] || {};
    
    console.log('📊 Risposte utente trovate:', Object.keys(userAnswers).length);
    console.log('🔍 Esempi risposte:', Object.entries(userAnswers).slice(0, 3));
    
    // Mappa le opinioni con le risposte dell'utente
    const opinioniWithAnswers = result.rows.map(opinione => {
      // Cerca la risposta corrispondente nelle colonne opinioni dell'utente
      const opinioneKey = opinione.text?.toLowerCase().replace(/\s+/g, '_');
      let userAnswer = null;
      
      // Mappa le opinioni nazionali
      if (opinioneKey?.includes('energia_nucleare')) {
        userAnswer = userAnswers.energia_nucleare;
      } else if (opinioneKey?.includes('sperimentazione_animale')) {
        userAnswer = userAnswers.sperimentazione_animale;
      } else if (opinioneKey?.includes('legalizzazione_canapa')) {
        userAnswer = userAnswers.legalizzazione_canapa;
      } else if (opinioneKey?.includes('caccia')) {
        userAnswer = userAnswers.caccia;
      } else if (opinioneKey?.includes('eutanasia')) {
        userAnswer = userAnswers.eutanasia;
      } else if (opinioneKey?.includes('carne_coltivata')) {
        userAnswer = userAnswers.carne_coltivata;
      } else if (opinioneKey?.includes('cittadina_animale')) {
        userAnswer = userAnswers.cittadina_animale;
      } else if (opinioneKey?.includes('nato')) {
        userAnswer = userAnswers.nato;
      } else if (opinioneKey?.includes('matrimonio_gay')) {
        userAnswer = userAnswers.matrimonio_gay;
      } else if (opinioneKey?.includes('salario_minimo')) {
        userAnswer = userAnswers.salario_minimo;
      } else if (opinioneKey?.includes('case_chiuse')) {
        userAnswer = userAnswers.case_chiuse;
      } else if (opinioneKey?.includes('omobitransfobia')) {
        userAnswer = userAnswers.omobitransfobia;
      }
      // Mappa le opinioni comunali
      else if (opinioneKey?.includes('cassonetti_intelligenti_con_tessera')) {
        userAnswer = userAnswers.comunale_cassonetti_intelligenti_con_tessera;
      } else if (opinioneKey?.includes('concessione_spazi_pubblici_a_centri_sociali_autogestiti')) {
        userAnswer = userAnswers.comunale_concessione_spazi_pubblici_a_centri_sociali_autogestiti;
      } else if (opinioneKey?.includes('divieto_di_nuovi_fast_food_nel_centro_storico')) {
        userAnswer = userAnswers.comunale_divieto_di_nuovi_fast_food_nel_centro_storico;
      } else if (opinioneKey?.includes('estensione_delle_zone_a_traffico_limitato')) {
        userAnswer = userAnswers.comunale_estensione_delle_zone_a_traffico_limitato;
      } else if (opinioneKey?.includes('finanziamento_eventi_culturali_gratuiti')) {
        userAnswer = userAnswers.comunale_finanziamento_eventi_culturali_gratuiti;
      } else if (opinioneKey?.includes('nuova_biblioteca_comunale')) {
        userAnswer = userAnswers.comunale_nuova_biblioteca_comunale;
      } else if (opinioneKey?.includes('nuove_case_popolari')) {
        userAnswer = userAnswers.comunale_nuove_case_popolari;
      } else if (opinioneKey?.includes('nuove_piste_ciclabili')) {
        userAnswer = userAnswers.comunale_nuove_piste_ciclabili;
      } else if (opinioneKey?.includes('nuovi_asili_nido_comunali')) {
        userAnswer = userAnswers.comunale_nuovi_asili_nido_comunali;
      } else if (opinioneKey?.includes('nuovo_stadio_comunale')) {
        userAnswer = userAnswers.comunale_nuovo_stadio_comunale;
      } else if (opinioneKey?.includes('parcheggi_gratuiti_per_residenti')) {
        userAnswer = userAnswers.comunale_parcheggi_gratuiti_per_residenti;
      } else if (opinioneKey?.includes('potenziamento_trasporto_pubblico')) {
        userAnswer = userAnswers.comunale_potenziamento_trasporto_pubblico;
      } else if (opinioneKey?.includes('riduzione_tasse_rifiuti')) {
        userAnswer = userAnswers.comunale_riduzione_tasse_rifiuti;
      } else if (opinioneKey?.includes('sicurezza_strade_scolastiche')) {
        userAnswer = userAnswers.comunale_sicurezza_strade_scolastiche;
      } else if (opinioneKey?.includes('sostegno_commercio_locale')) {
        userAnswer = userAnswers.comunale_sostegno_commercio_locale;
      } else if (opinioneKey?.includes('verde_pubblico_e_giardini')) {
        userAnswer = userAnswers.comunale_verde_pubblico_e_giardini;
      }
      // Mappa le opinioni regionali
      else if (opinioneKey?.includes('nuovi_inceneritori')) {
        userAnswer = userAnswers.regionale_nuovi_inceneritori;
      } else if (opinioneKey?.includes('chiusura_ospedali_di_provincia')) {
        userAnswer = userAnswers.regionale_chiusura_ospedali_di_provincia;
      }
      
      // Converti la risposta nel formato corretto
      let formattedAnswer = null;
      if (userAnswer === null || userAnswer === undefined) {
        formattedAnswer = 'Astenuto';
      } else if (userAnswer === 'Favorevole' || userAnswer === 'favorevole') {
        formattedAnswer = 'Favorevole';
      } else if (userAnswer === 'Contrario' || userAnswer === 'contrario') {
        formattedAnswer = 'Contrario';
      } else if (userAnswer === 'Indeciso' || userAnswer === 'indeciso') {
        formattedAnswer = 'Indeciso';
      } else {
        formattedAnswer = 'Astenuto'; // Default per valori non riconosciuti
      }
      
      return {
        ...opinione,
        userAnswer: formattedAnswer
      };
    });
    
    console.log('📤 Invio risposta con', opinioniWithAnswers.length, 'opinioni');
    
    res.json({
      success: true,
      opinioni: opinioniWithAnswers
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare opinioni per grado:', error);
    console.error('📋 Stack trace completo:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare opinioni per grado'
    });
  }
});

// GET /api/opinioni/user-answers - Ottieni risposte utente per opinioni
router.get('/user-answers', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    const query = `
      SELECT energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
             carne_coltivata, cittadina_animale, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia
      FROM users
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      userAnswers: result.rows[0] || {}
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare risposte utente:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare risposte utente'
    });
  }
});

// GET /api/opinioni/debug - Endpoint di debug per verificare struttura tabella
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Verifico struttura tabella opinioni...');
    
    // 1. Verifica esistenza tabella
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opinioni'
      );
    `;
    
    const tableExistsResult = await pool.query(tableExistsQuery);
    const tableExists = tableExistsResult.rows[0].exists;
    
    console.log('📋 Tabella opinioni esiste:', tableExists);
    
    if (!tableExists) {
      return res.json({
        success: false,
        error: 'Tabella opinioni non trovata',
        message: 'La tabella opinioni non esiste nel database'
      });
    }
    
    // 2. Verifica struttura tabella
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position;
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    // 3. Conta righe totali
    const countQuery = 'SELECT COUNT(*) as total FROM opinioni';
    const countResult = await pool.query(countQuery);
    const totalRows = countResult.rows[0].total;
    
    // 4. Verifica gradi disponibili (usando array)
    const degreesQuery = `
      SELECT 
        unnest(gradi_opinione) as grado,
        COUNT(*) as count 
      FROM opinioni 
      GROUP BY unnest(gradi_opinione)
      ORDER BY grado
    `;
    const degreesResult = await pool.query(degreesQuery);
    
    // 5. Esempi di opinioni
    const examplesQuery = 'SELECT * FROM opinioni LIMIT 3';
    const examplesResult = await pool.query(examplesQuery);
    
    console.log('📊 DEBUG completato - Righe totali:', totalRows);
    
    res.json({
      success: true,
      debug: {
        tableExists,
        totalRows: parseInt(totalRows),
        structure: structureResult.rows,
        degrees: degreesResult.rows,
        examples: examplesResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore debug tabella opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante debug',
      message: error.message
    });
  }
});

// POST /api/opinioni/salva - Salva le opinioni dell'utente
router.post('/salva', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { opinions } = req.body;
    
    console.log('💾 POST /api/opinioni/salva - Salvataggio opinioni utente');
    console.log('👤 User ID:', userId);
    console.log('📝 Opinion da salvare:', opinions);
    console.log('🔍 DEBUG: Type of opinions:', typeof opinions);
    console.log('🔍 DEBUG: Keys in opinions:', Object.keys(opinions));
    console.log('🔍 DEBUG: Values in opinions:', Object.values(opinions));
    console.log('🔍 DEBUG: Full opinions object:', JSON.stringify(opinions, null, 2));
    
    if (!opinions || typeof opinions !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Formato opinioni non valido',
        message: 'Le opinioni devono essere un oggetto'
      });
    }
    
    // Mappa le opinioni ai campi della tabella users
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
       'regionale_nuovi_inceneritori': 'regionale_nuovi_inceneritori',
       'regionale_chiusura_ospedali_di_provincia': 'regionale_chiusura_ospedali_di_provincia'
     };
    
    // Prepara l'UPDATE dinamico
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    for (const [opinionId, risposta] of Object.entries(opinions)) {
      console.log(`🔍 DEBUG: Processing opinionId: "${opinionId}" with risposta: "${risposta}"`);
      
      // Trova il campo corrispondente nella tabella users
      const fieldName = opinionMapping[opinionId];
      
      console.log(`🔍 DEBUG: Found fieldName: "${fieldName}" for opinionId: "${opinionId}"`);
      
      if (fieldName) {
        // Converti la risposta nel formato corretto per il database
        let dbValue = null;
        if (risposta === 'Favorevole') {
          dbValue = 'Favorevole';
        } else if (risposta === 'Contrario') {
          dbValue = 'Contrario';
        } else if (risposta === 'Indeciso') {
          dbValue = 'Indeciso';
        } else if (risposta === 'Astenuto') {
          dbValue = null;
        }
        
        console.log(`🔍 DEBUG: Converted risposta "${risposta}" to dbValue: "${dbValue}"`);
        
        updateFields.push(`${fieldName} = $${paramIndex}`);
        updateValues.push(dbValue);
        paramIndex++;
        
        console.log(`✅ DEBUG: Added field "${fieldName}" to updateFields`);
      } else {
        console.log(`❌ DEBUG: No fieldName found for opinionId: "${opinionId}"`);
        console.log(`🔍 DEBUG: Available keys in opinionMapping:`, Object.keys(opinionMapping));
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

// GET /api/opinioni/stats/:opinionId - Ottieni statistiche per opinione
router.get('/stats/:opinionId', verifyToken, async (req, res) => {
  try {
    const { opinionId } = req.params;
    
    // Query per ottenere le statistiche generali
    const statsQuery = `
      SELECT 
        COUNT(*) as total_votes,
        COUNT(CASE WHEN risposta = 'Sì' THEN 1 END) as si_votes,
        COUNT(CASE WHEN risposta = 'No' THEN 1 END) as no_votes,
        COUNT(CASE WHEN risposta = 'Indeciso' THEN 1 END) as indeciso_votes
      FROM voti_opinioni
      WHERE opinione_id = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [opinionId]);
    const stats = statsResult.rows[0];
    
    // Calcola le percentuali
    const total = parseInt(stats.total_votes) || 0;
    const percentages = {
      si: total > 0 ? Math.round((parseInt(stats.si_votes) / total) * 100) : 0,
      no: total > 0 ? Math.round((parseInt(stats.no_votes) / total) * 100) : 0,
      indeciso: total > 0 ? Math.round((parseInt(stats.indeciso_votes) / total) * 100) : 0
    };
    
    res.json({
      success: true,
      stats: {
        total: total,
        si: parseInt(stats.si_votes) || 0,
        no: parseInt(stats.no_votes) || 0,
        indeciso: parseInt(stats.indeciso_votes) || 0,
        percentages: percentages
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione'
    });
  }
});

module.exports = router;
