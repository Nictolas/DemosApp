const express = require('express');
const { verifyToken } = require('../../middleware/auth');
const { pool } = require('../../middleware/auth');
const { compressRegione, decompressRegione } = require('../../utils/locationUtils');
const { decompressGender } = require('../../utils/genderUtils');

const router = express.Router();

// GET /api/opinioni/candidati - Endpoint di test senza autenticazione
router.get('/candidati', async (req, res) => {
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

// GET /api/opinioni/debug - Debug completo opinioni
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG - Richiesta debug opinioni');
    
    // 1. Verifica struttura tabella opinioni
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni' 
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(structureQuery);
    
    // 2. Conta opinioni totali
    const countQuery = 'SELECT COUNT(*) as total FROM opinioni_domande';
    const countResult = await pool.query(countQuery);
    
    // 3. Verifica gradi opinioni
    const degreesQuery = `
      SELECT DISTINCT unnest(gradi_opinione) as grado
      FROM opinioni_domande
      ORDER BY grado
    `;
    
    const degreesResult = await pool.query(degreesQuery);
    
    // 4. Esempio opinioni
    const sampleQuery = `
      SELECT id, text, gradi_opinione, created_at, updated_at
      FROM opinioni_domande
      LIMIT 5
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    
    res.json({
      success: true,
      debug: {
        timestamp: new Date().toISOString(),
        tableStructure: structureResult.rows,
        totalOpinions: countResult.rows[0].total,
        availableDegrees: degreesResult.rows.map(r => r.grado),
        sampleOpinions: sampleResult.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel debug opinioni:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel debug opinioni',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId - Ottieni statistiche per opinione
router.get('/stats/:opinionId', async (req, res) => {
  try {
    const { opinionId } = req.params;
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - opinionId ricevuto:', opinionId);
    
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
      'abolizione_contante': 'abolizione_contante',
      'antifascismo': 'antifascismo',
      'ius_soli': 'ius_soli',
      'leva_obbligatoria': 'leva_obbligatoria',
      'leva_obbliatoria': 'leva_obbliatoria',
      'potenziare_rinnovabili': 'potenziare_rinnovabili',
      'multe_in_base_al_reddito': 'multe_in_base_al_reddito',
      'test_antidroga_per_politici': 'test_antidroga_per_politici',
      'test_psichiatrico_per_politici': 'test_psichiatrico_per_politici',
      'sionismo': 'sionismo',
      'metabo_law': 'metabo_law',
      'fuochi_d_artificio': 'fuochi_d_artificio',
      'rilascio_di_palloncini': 'rilascio_di_palloncini',
      'ponte_sullo_stretto': 'ponte_sullo_stretto',
      'corrida': 'corrida',
      'esercito_comune_europeo': 'esercito_comune_europeo',
      'esercito_comune_ue': 'esercito_comune_ue',
      'esercito_ue': 'esercito_ue',
      'esercito_europeo': 'esercito_europeo',
      
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      console.log('❌ DEBUG /api/opinioni/stats/:opinionId - OpinionId non mappato:', opinionId);
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - columnName mappato:', columnName);

    // Query per ottenere le statistiche dalla tabella opinioni_risposte
    const statsQuery = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN orr.${columnName} IS NULL THEN 1 END) as astenuto
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
    `;
    
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - Eseguendo query SQL...');
    const statsResult = await pool.query(statsQuery);
    console.log('🔍 DEBUG /api/opinioni/stats/:opinionId - Query eseguita con successo, righe:', statsResult.rows.length);
    const stats = statsResult.rows[0];
    
    // Query per ottenere il testo dell'opinione
    const questionQuery = `
      SELECT text
      FROM opinioni_domande
      WHERE id = $1
    `;
    
    const questionResult = await pool.query(questionQuery, [opinionId]);
    const questionText = questionResult.rows[0]?.text || opinionId;
    
    const totaleUtenti = parseInt(stats.totale_utenti) || 0;
    const favorevole = parseInt(stats.favorevole) || 0;
    const contrario = parseInt(stats.contrario) || 0;
    const indeciso = parseInt(stats.indeciso) || 0;
    const astenuto = parseInt(stats.astenuto) || 0;
    
    res.json({
      success: true,
      data: {
        stats: {
          favorevole,
          contrario,
          indeciso,
          astenuto
        },
        questionText,
        totaleUtenti
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId/eta - Ottieni statistiche per età per opinione
router.get('/stats/:opinionId/eta', async (req, res) => {
  try {
    const { opinionId } = req.params;
    
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
      'abolizione_contante': 'abolizione_contante',
      'antifascismo': 'antifascismo',
      'ius_soli': 'ius_soli',
      'leva_obbligatoria': 'leva_obbligatoria',
      'leva_obbliatoria': 'leva_obbliatoria',
      'potenziare_rinnovabili': 'potenziare_rinnovabili',
      'multe_in_base_al_reddito': 'multe_in_base_al_reddito',
      'test_antidroga_per_politici': 'test_antidroga_per_politici',
      'test_psichiatrico_per_politici': 'test_psichiatrico_per_politici',
      'sionismo': 'sionismo',
      'metabo_law': 'metabo_law',
      'fuochi_d_artificio': 'fuochi_d_artificio',
      'rilascio_di_palloncini': 'rilascio_di_palloncini',
      'ponte_sullo_stretto': 'ponte_sullo_stretto',
      'corrida': 'corrida',
      'esercito_comune_europeo': 'esercito_comune_europeo',
      'esercito_comune_ue': 'esercito_comune_ue',
      'esercito_ue': 'esercito_ue',
      'esercito_europeo': 'esercito_europeo',
      
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per età dalla tabella opinioni_risposte
    const etaQuery = `
      WITH eta_groups AS (
        SELECT 
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) < 18 THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 18 AND 25 THEN '18-25'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 26 AND 35 THEN '26-35'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 36 AND 45 THEN '36-45'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 46 AND 55 THEN '46-55'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 56 AND 65 THEN '56-65'
            ELSE '65+'
          END as fascia_eta,
          orr.${columnName} as opinione_valore
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${columnName} IS NOT NULL
        AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
        AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        AND u.data_nascita IS NOT NULL
      )
      SELECT 
        fascia_eta,
        COUNT(CASE WHEN opinione_valore = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN opinione_valore = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN opinione_valore = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN opinione_valore IS NULL THEN 1 END) as astenuto
      FROM eta_groups
      GROUP BY fascia_eta
      ORDER BY 
        CASE fascia_eta
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN '65+' THEN 7
        END
    `;
    
    const etaResult = await pool.query(etaQuery);
    
    res.json({
      success: true,
      data: etaResult.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche età opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche età opinione',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId/genere - Ottieni statistiche per genere per opinione
router.get('/stats/:opinionId/genere', async (req, res) => {
  try {
    const { opinionId } = req.params;
    
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
      'abolizione_contante': 'abolizione_contante',
      'antifascismo': 'antifascismo',
      'ius_soli': 'ius_soli',
      'leva_obbligatoria': 'leva_obbligatoria',
      'leva_obbliatoria': 'leva_obbliatoria',
      'potenziare_rinnovabili': 'potenziare_rinnovabili',
      'multe_in_base_al_reddito': 'multe_in_base_al_reddito',
      'test_antidroga_per_politici': 'test_antidroga_per_politici',
      'test_psichiatrico_per_politici': 'test_psichiatrico_per_politici',
      'sionismo': 'sionismo',
      'metabo_law': 'metabo_law',
      'fuochi_d_artificio': 'fuochi_d_artificio',
      'rilascio_di_palloncini': 'rilascio_di_palloncini',
      'ponte_sullo_stretto': 'ponte_sullo_stretto',
      'corrida': 'corrida',
      'esercito_comune_europeo': 'esercito_comune_europeo',
      'esercito_comune_ue': 'esercito_comune_ue',
      'esercito_ue': 'esercito_ue',
      'esercito_europeo': 'esercito_europeo',
      
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per genere dalla tabella opinioni_risposte
    const genereQuery = `
      SELECT 
        u.genere,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN orr.${columnName} IS NULL THEN 1 END) as astenuto
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE 
      AND u.genere IS NOT NULL
      GROUP BY u.genere
      ORDER BY u.genere
    `;
    
    const genereResult = await pool.query(genereQuery);
    
    // Decomprimi i generi per il frontend
    const decompressedData = genereResult.rows.map(row => ({
      ...row,
      genere: decompressGender(row.genere) || row.genere
    }));
    
    res.json({
      success: true,
      data: decompressedData
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere opinione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere opinione',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId/regione/:regione - Ottieni statistiche per regione per opinione
router.get('/stats/:opinionId/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // Converte nome regione in codice per la query database
    const regionCode = compressRegione(regionName);
    
    if (!regionCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione non valida'
      });
    }
    
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
      'abolizione_contante': 'abolizione_contante',
      'antifascismo': 'antifascismo',
      'ius_soli': 'ius_soli',
      'leva_obbligatoria': 'leva_obbligatoria',
      'leva_obbliatoria': 'leva_obbliatoria',
      'potenziare_rinnovabili': 'potenziare_rinnovabili',
      'multe_in_base_al_reddito': 'multe_in_base_al_reddito',
      'test_antidroga_per_politici': 'test_antidroga_per_politici',
      'test_psichiatrico_per_politici': 'test_psichiatrico_per_politici',
      'sionismo': 'sionismo',
      'metabo_law': 'metabo_law',
      'fuochi_d_artificio': 'fuochi_d_artificio',
      'rilascio_di_palloncini': 'rilascio_di_palloncini',
      'ponte_sullo_stretto': 'ponte_sullo_stretto',
      'corrida': 'corrida',
      'esercito_comune_europeo': 'esercito_comune_europeo',
      'esercito_comune_ue': 'esercito_comune_ue',
      'esercito_ue': 'esercito_ue',
      'esercito_europeo': 'esercito_europeo',
      
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche dalla tabella opinioni_risposte per la regione specifica
    const statsQuery = `
      SELECT 
        COUNT(*) as totale_utenti,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN orr.${columnName} IS NULL THEN 1 END) as astenuto
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
      AND u.regione_residenza = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [regionCode]);
    const stats = statsResult.rows[0];
    
    // Query per ottenere il testo dell'opinione
    const questionQuery = `
      SELECT text
      FROM opinioni_domande
      WHERE id = $1
    `;
    
    const questionResult = await pool.query(questionQuery, [opinionId]);
    const questionText = questionResult.rows[0]?.text || opinionId;
    
    const totaleUtenti = parseInt(stats.totale_utenti) || 0;
    const favorevole = parseInt(stats.favorevole) || 0;
    const contrario = parseInt(stats.contrario) || 0;
    const indeciso = parseInt(stats.indeciso) || 0;
    const astenuto = parseInt(stats.astenuto) || 0;
    
    res.json({
      success: true,
      data: {
        stats: {
          favorevole,
          contrario,
          indeciso,
          astenuto
        },
        questionText,
        totaleUtenti,
        regione: regionName
      }
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche opinione regionale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche opinione regionale',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId/eta/regione/:regione - Ottieni statistiche per età per regione per opinione
router.get('/stats/:opinionId/eta/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // Converte nome regione in codice per la query database
    const regionCode = compressRegione(regionName);
    
    if (!regionCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione non valida'
      });
    }
    
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per età dalla tabella opinioni_risposte per la regione specifica
    const etaQuery = `
      WITH eta_groups AS (
        SELECT 
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) < 18 THEN 'Under 18'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 18 AND 25 THEN '18-25'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 26 AND 35 THEN '26-35'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 36 AND 45 THEN '36-45'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 46 AND 55 THEN '46-55'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascita)) BETWEEN 56 AND 65 THEN '56-65'
            ELSE '65+'
          END as fascia_eta,
          orr.${columnName} as opinione_valore
        FROM opinioni_risposte orr
        JOIN users u ON u.id = orr.user_id
        LEFT JOIN user_consents uc ON uc.user_id = u.id
        WHERE orr.${columnName} IS NOT NULL
        AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
        AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE
        AND u.data_nascita IS NOT NULL
        AND u.regione_residenza = $1
      )
      SELECT 
        fascia_eta,
        COUNT(CASE WHEN opinione_valore = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN opinione_valore = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN opinione_valore = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN opinione_valore IS NULL THEN 1 END) as astenuto
      FROM eta_groups
      GROUP BY fascia_eta
      ORDER BY 
        CASE fascia_eta
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN '65+' THEN 7
        END
    `;
    
    const etaResult = await pool.query(etaQuery, [regionCode]);
    
    res.json({
      success: true,
      data: etaResult.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche età opinione regionale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche età opinione regionale',
      message: error.message
    });
  }
});

// GET /api/opinioni/stats/:opinionId/genere/regione/:regione - Ottieni statistiche per genere per regione per opinione
router.get('/stats/:opinionId/genere/regione/:regione', async (req, res) => {
  try {
    const { opinionId, regione } = req.params;
    
    // Converte slug in nome regione (es. "toscana" -> "Toscana")
    const regionName = regione.charAt(0).toUpperCase() + regione.slice(1).replace(/-/g, ' ');
    
    // Converte nome regione in codice per la query database
    const regionCode = compressRegione(regionName);
    
    if (!regionCode) {
      return res.status(400).json({
        success: false,
        error: 'Regione non valida'
      });
    }
    
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

    const columnName = opinionMapping[opinionId];
    if (!columnName) {
      return res.status(404).json({
        success: false,
        error: 'Opinione non trovata',
        message: `L'opinione con ID '${opinionId}' non è supportata`
      });
    }

    // Query per ottenere le statistiche per genere dalla tabella opinioni_risposte per la regione specifica
    const genereQuery = `
      SELECT 
        u.genere,
        COUNT(CASE WHEN orr.${columnName} = 'f' THEN 1 END) as favorevole,
        COUNT(CASE WHEN orr.${columnName} = 'c' THEN 1 END) as contrario,
        COUNT(CASE WHEN orr.${columnName} = 'i' THEN 1 END) as indeciso,
        COUNT(CASE WHEN orr.${columnName} IS NULL THEN 1 END) as astenuto
      FROM opinioni_risposte orr
      JOIN users u ON u.id = orr.user_id
      LEFT JOIN user_consents uc ON uc.user_id = u.id
      WHERE orr.${columnName} IS NOT NULL
      AND u.ruolo IN ('E', 'A', 'Elettore', 'Attivista')
      AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE 
      AND u.genere IS NOT NULL
      AND u.regione_residenza = $1
      GROUP BY u.genere
      ORDER BY u.genere
    `;
    
    const genereResult = await pool.query(genereQuery, [regionCode]);
    
    res.json({
      success: true,
      data: genereResult.rows
    });
  } catch (error) {
    console.error('❌ Errore nel recuperare statistiche genere opinione regionale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recuperare statistiche genere opinione regionale',
      message: error.message
    });
  }
});

module.exports = router;
