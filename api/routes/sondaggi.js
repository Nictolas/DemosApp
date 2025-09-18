const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../middleware/auth');

const router = express.Router();

// GET /api/sondaggi - Ottieni tutti i sondaggi (opinioni aggregate)
router.get('/', async (req, res) => {
  try {
    // 1. Prima recupera le domande dalla tabella opinioni
    const questionsQuery = `
      SELECT id, text
      FROM opinioni 
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
    // 2. Poi genera statistiche aggregate dalle risposte degli utenti
    const stats = {};
    const questions = [];
    
    for (const opinione of opinioni) {
      const questionId = opinione.id;
      const questionText = opinione.text;
      
      // Mappa l'ID dell'opinione alla colonna corretta nella tabella users
      const opinionMapping = {
        // Opinion nazionali/europee/regionali/comunali (stesse colonne, senza prefissi)
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
        
        // Opinion regionali/comunali (senza prefissi)
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        
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
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
      };

      const columnName = opinionMapping[questionId];
      if (!columnName) {
        console.log(`⚠️ DEBUG: ID opinione non mappato: ${questionId}`);
        continue; // Salta questa opinione se non è mappata
      }
      
      // Query per contare le risposte per questa opinione
      const statsQuery = `
        SELECT 
          COUNT(*) as totale_voti,
          COUNT(CASE WHEN ${columnName} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${columnName} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${columnName} = 'Indeciso' THEN 1 END) as indeciso,
          COUNT(CASE WHEN ${columnName} = 'Astenuto' THEN 1 END) as astenuto
        FROM users 
        WHERE ${columnName} IS NOT NULL
      `;
      
      try {
        const statsResult = await pool.query(statsQuery);
        const row = statsResult.rows[0];
        
        stats[questionId] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          indeciso: parseInt(row.indeciso) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
        
        questions.push({
          id: questionId,
          text: questionText
        });
      } catch (statsError) {
        console.log(`⚠️ Errore nel recuperare statistiche per opinione ${questionId}:`, statsError.message);
        // Se la colonna non esiste, salta questa opinione
        continue;
      }
    }
    
    res.json({
      success: true,
      data: {
        stats,
        questions
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi'
    });
  }
});

// GET /api/sondaggi/stats - Statistiche generali
router.get('/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as utenti_attivi,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as utenti_in_attesa
      FROM users
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche sondaggi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche sondaggi'
    });
  }
});

// GET /api/sondaggi/genere - Statistiche per genere
router.get('/genere', async (req, res) => {
  try {
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere'
    });
  }
});

// GET /api/sondaggi/:regione - Statistiche per regione
router.get('/:regione', async (req, res) => {
  try {
    const { regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // 1. Prima recupera le domande dalla tabella opinioni
    const questionsQuery = `
      SELECT id, text
      FROM opinioni 
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
    // 2. Poi genera statistiche aggregate dalle risposte degli utenti per la regione
    const stats = {};
    const questions = [];
    
    for (const opinione of opinioni) {
      const questionId = opinione.id;
      const questionText = opinione.text;
      
      // Mappa l'ID dell'opinione alla colonna corretta nella tabella users
      const opinionMapping = {
        // Opinion nazionali/europee/regionali/comunali (stesse colonne, senza prefissi)
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
        
        // Opinion regionali/comunali (senza prefissi)
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        
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
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
      };

      const columnName = opinionMapping[questionId];
      if (!columnName) {
        console.log(`⚠️ DEBUG: ID opinione non mappato: ${questionId}`);
        continue; // Salta questa opinione se non è mappata
      }
      
      // Query per contare le risposte per questa opinione nella regione specifica
      const statsQuery = `
        SELECT 
          COUNT(*) as totale_voti,
          COUNT(CASE WHEN ${columnName} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${columnName} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${columnName} = 'Indeciso' THEN 1 END) as indeciso,
          COUNT(CASE WHEN ${columnName} = 'Astenuto' THEN 1 END) as astenuto
        FROM users 
        WHERE ${columnName} IS NOT NULL 
        AND regione_residenza = $1
      `;
      
      try {
        const statsResult = await pool.query(statsQuery, [regionName]);
        const row = statsResult.rows[0];
        
        stats[questionId] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          indeciso: parseInt(row.indeciso) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
        
        questions.push({
          id: questionId,
          text: questionText
        });
      } catch (statsError) {
        console.log(`⚠️ Errore nel recuperare statistiche per opinione ${questionId} in regione ${regionName}:`, statsError.message);
        // Se la colonna non esiste, salta questa opinione
        continue;
      }
    }
    
    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'regione',
          value: regionName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi regionali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi regionali'
    });
  }
});

// GET /api/sondaggi/genere/:regione - Statistiche per genere per regione
router.get('/genere/:regione', async (req, res) => {
  try {
    const { regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    const query = `
      SELECT 
        genere,
        COUNT(*) as totale
      FROM users 
      WHERE genere IS NOT NULL 
      AND regione_residenza = $1
      GROUP BY genere
      ORDER BY totale DESC
    `;
    
    const result = await pool.query(query, [regionName]);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere per regione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere per regione'
    });
  }
});

// GET /api/sondaggi/:regione/:provincia - Statistiche per provincia
router.get('/:regione/:provincia', async (req, res) => {
  try {
    const { regione, provincia } = req.params;
    
    // Converte slug in nome regione e provincia
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    
    // 1. Prima recupera le domande dalla tabella opinioni
    const questionsQuery = `
      SELECT id, text
      FROM opinioni 
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
    // 2. Poi genera statistiche aggregate dalle risposte degli utenti per la provincia
    const stats = {};
    const questions = [];
    
    for (const opinione of opinioni) {
      const questionId = opinione.id;
      const questionText = opinione.text;
      
      // Mappa l'ID dell'opinione alla colonna corretta nella tabella users
      const opinionMapping = {
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
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
        'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
        'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
        'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
        'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
        'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
        'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
        'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
        'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
        'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
        'nuove_case_popolari': 'nuove_case_popolari',
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
      };

      const columnName = opinionMapping[questionId];
      if (!columnName) continue;

      const statsQuery = `
        SELECT 
          COUNT(*) as totale_utenti,
          COUNT(CASE WHEN ${columnName} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${columnName} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${columnName} = 'Indeciso' THEN 1 END) as indeciso,
          COUNT(CASE WHEN ${columnName} = 'Astenuto' THEN 1 END) as astenuto
        FROM users 
        WHERE ${columnName} IS NOT NULL
        AND regione_residenza = $1
        AND provincia_residenza = $2
      `;
      
      try {
        const statsResult = await pool.query(statsQuery, [regionName, provinciaName]);
        const row = statsResult.rows[0];
        
        stats[questionId] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          indeciso: parseInt(row.indeciso) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
        
        questions.push({
          id: questionId,
          text: questionText
        });
      } catch (statsError) {
        console.log(`⚠️ Errore nel recuperare statistiche per opinione ${questionId} in provincia ${provinciaName}:`, statsError.message);
        continue;
      }
    }
    
    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'provincia',
          value: provinciaName,
          regione: regionName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi provinciali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi provinciali'
    });
  }
});

// GET /api/sondaggi/:regione/:provincia/:comune - Statistiche per comune
router.get('/:regione/:provincia/:comune', async (req, res) => {
  try {
    const { regione, provincia, comune } = req.params;
    
    // Converte slug in nome regione, provincia e comune
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    const provinciaName = provincia.charAt(0).toUpperCase() + provincia.slice(1).replace(/-/g, ' ');
    const comuneName = comune.charAt(0).toUpperCase() + comune.slice(1).replace(/-/g, ' ');
    
    // 1. Prima recupera le domande dalla tabella opinioni
    const questionsQuery = `
      SELECT id, text
      FROM opinioni 
      ORDER BY text
    `;
    
    const questionsResult = await pool.query(questionsQuery);
    const opinioni = questionsResult.rows;
    
    // 2. Poi genera statistiche aggregate dalle risposte degli utenti per il comune
    const stats = {};
    const questions = [];
    
    for (const opinione of opinioni) {
      const questionId = opinione.id;
      const questionText = opinione.text;
      
      // Mappa l'ID dell'opinione alla colonna corretta nella tabella users
      const opinionMapping = {
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
        'nuovi_inceneritori': 'nuovi_inceneritori',
        'chiusura_ospedali_di_provincia': 'chiusura_ospedali_di_provincia',
        'cassonetti_intelligenti_con_tessera': 'cassonetti_intelligenti_con_tessera',
        'nuova_biblioteca_comunale': 'nuova_biblioteca_comunale',
        'nuove_piste_ciclabili': 'nuove_piste_ciclabili',
        'nuovi_asili_nido_comunali': 'nuovi_asili_nido_comunali',
        'nuovo_stadio_comunale': 'nuovo_stadio_comunale',
        'riduzione_parcheggi_a_pagamento': 'riduzione_parcheggi_a_pagamento',
        'concessione_spazi_pubblici_a_centri_sociali_autogestiti': 'concessione_spazi_pubblici_a_centri_sociali_autogestiti',
        'divieto_di_nuovi_fast_food_nel_centro_storico': 'divieto_di_nuovi_fast_food_nel_centro_storico',
        'estensione_delle_zone_a_traffico_limitato': 'estensione_delle_zone_a_traffico_limitato',
        'finanziamento_eventi_culturali_gratuiti': 'finanziamento_eventi_culturali_gratuiti',
        'nuove_case_popolari': 'nuove_case_popolari',
        'parcheggi_gratuiti_per_residenti': 'parcheggi_gratuiti_per_residenti',
        'potenziamento_trasporto_pubblico': 'potenziamento_trasporto_pubblico',
        'raccolta_rifiuti_porta_a_porta': 'raccolta_rifiuti_porta_a_porta',
        'riduzione_dell_illuminazione_notturna_per_risparmio_energetico': 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
        'riduzione_tasse_rifiuti': 'riduzione_tasse_rifiuti',
        'sicurezza_strade_scolastiche': 'sicurezza_strade_scolastiche',
        'sostegno_commercio_locale': 'sostegno_commercio_locale',
        'sussidi_comunali_per_famiglie_numerose': 'sussidi_comunali_per_famiglie_numerose',
        'videosorveglianza_in_spazi_pubblici': 'videosorveglianza_in_spazi_pubblici',
        'verde_pubblico_e_giardini': 'verde_pubblico_e_giardini'
      };

      const columnName = opinionMapping[questionId];
      if (!columnName) continue;

      const statsQuery = `
        SELECT 
          COUNT(*) as totale_utenti,
          COUNT(CASE WHEN ${columnName} = 'Favorevole' THEN 1 END) as favorevole,
          COUNT(CASE WHEN ${columnName} = 'Contrario' THEN 1 END) as contrario,
          COUNT(CASE WHEN ${columnName} = 'Indeciso' THEN 1 END) as indeciso,
          COUNT(CASE WHEN ${columnName} = 'Astenuto' THEN 1 END) as astenuto
        FROM users 
        WHERE ${columnName} IS NOT NULL
        AND regione_residenza = $1
        AND provincia_residenza = $2
        AND comune_residenza = $3
      `;
      
      try {
        const statsResult = await pool.query(statsQuery, [regionName, provinciaName, comuneName]);
        const row = statsResult.rows[0];
        
        stats[questionId] = {
          favorevole: parseInt(row.favorevole) || 0,
          contrario: parseInt(row.contrario) || 0,
          indeciso: parseInt(row.indeciso) || 0,
          astenuto: parseInt(row.astenuto) || 0
        };
        
        questions.push({
          id: questionId,
          text: questionText
        });
      } catch (statsError) {
        console.log(`⚠️ Errore nel recuperare statistiche per opinione ${questionId} in comune ${comuneName}:`, statsError.message);
        continue;
      }
    }
    
    res.json({
      success: true,
      data: {
        stats,
        questions,
        filter: {
          type: 'comune',
          value: comuneName,
          regione: regionName,
          provincia: provinciaName
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare sondaggi comunali:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare sondaggi comunali'
    });
  }
});

module.exports = router;
