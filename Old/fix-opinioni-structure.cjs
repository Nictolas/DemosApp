const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function fixOpinioniStructure() {
  try {
    console.log('🔧 Correzione struttura opinioni_risposte...');
    
    // 1. Elimina la tabella opinioni_risposte esistente
    console.log('🗑️ Elimino tabella opinioni_risposte esistente...');
    await pool.query(`DROP TABLE IF EXISTS opinioni_risposte`);
    console.log('✅ Tabella eliminata');
    
    // 2. Crea la nuova tabella opinioni_risposte con tutte le colonne opinioni
    console.log('🔧 Creazione nuova tabella opinioni_risposte...');
    await pool.query(`
      CREATE TABLE opinioni_risposte (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        -- Opinion nazionali/europee
        energia_nucleare TEXT,
        sperimentazione_animale TEXT,
        legalizzazione_canapa TEXT,
        caccia TEXT,
        eutanasia TEXT,
        carne_coltivata TEXT,
        nato TEXT,
        matrimonio_gay TEXT,
        salario_minimo TEXT,
        case_chiuse TEXT,
        omobitransfobia TEXT,
        -- Opinion comunali
        cassonetti_intelligenti_con_tessera TEXT,
        concessione_spazi_pubblici_a_centri_sociali_autogestiti TEXT,
        divieto_di_nuovi_fast_food_nel_centro_storico TEXT,
        estensione_delle_zone_a_traffico_limitato TEXT,
        finanziamento_eventi_culturali_gratuiti TEXT,
        nuova_biblioteca_comunale TEXT,
        nuove_case_popolari TEXT,
        nuove_piste_ciclabili TEXT,
        nuovi_asili_nido_comunali TEXT,
        nuovo_stadio_comunale TEXT,
        parcheggi_gratuiti_per_residenti TEXT,
        potenziamento_trasporto_pubblico TEXT,
        riduzione_tasse_rifiuti TEXT,
        sicurezza_strade_scolastiche TEXT,
        sostegno_commercio_locale TEXT,
        verde_pubblico_e_giardini TEXT,
        -- Opinion regionali
        nuovi_inceneritori TEXT,
        chiusura_ospedali_di_provincia TEXT,
        -- Opinion nazionali/comunali
        raccolta_rifiuti_porta_a_porta TEXT,
        riduzione_dell_illuminazione_notturna_per_risparmio_energetico TEXT,
        sussidi_comunali_per_famiglie_numerose TEXT,
        videosorveglianza_in_spazi_pubblici TEXT,
        riduzione_parcheggi_a_pagamento TEXT,
        -- Fonti delle opinioni
        fonti_opinioni JSONB
      )
    `);
    console.log('✅ Nuova tabella creata');
    
    // 3. Migra i dati dalle colonne users alla nuova tabella
    console.log('📦 Migrazione dati da users a opinioni_risposte...');
    await pool.query(`
      INSERT INTO opinioni_risposte (
        user_id,
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale, nuove_case_popolari,
        nuove_piste_ciclabili, nuovi_asili_nido_comunali, nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti, sicurezza_strade_scolastiche,
        sostegno_commercio_locale, verde_pubblico_e_giardini, nuovi_inceneritori, chiusura_ospedali_di_provincia,
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici, riduzione_parcheggi_a_pagamento,
        fonti_opinioni
      )
      SELECT 
        id,
        energia_nucleare, sperimentazione_animale, legalizzazione_canapa, caccia, eutanasia,
        carne_coltivata, nato, matrimonio_gay, salario_minimo, case_chiuse, omobitransfobia,
        cassonetti_intelligenti_con_tessera, concessione_spazi_pubblici_a_centri_sociali_autogestiti,
        divieto_di_nuovi_fast_food_nel_centro_storico, estensione_delle_zone_a_traffico_limitato,
        finanziamento_eventi_culturali_gratuiti, nuova_biblioteca_comunale, nuove_case_popolari,
        nuove_piste_ciclabili, nuovi_asili_nido_comunali, nuovo_stadio_comunale, parcheggi_gratuiti_per_residenti,
        potenziamento_trasporto_pubblico, riduzione_tasse_rifiuti, sicurezza_strade_scolastiche,
        sostegno_commercio_locale, verde_pubblico_e_giardini, nuovi_inceneritori, chiusura_ospedali_di_provincia,
        raccolta_rifiuti_porta_a_porta, riduzione_dell_illuminazione_notturna_per_risparmio_energetico,
        sussidi_comunali_per_famiglie_numerose, videosorveglianza_in_spazi_pubblici, riduzione_parcheggi_a_pagamento,
        fonti_opinioni
      FROM users
      WHERE id IS NOT NULL
    `);
    
    // 4. Verifica i risultati
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM opinioni_risposte`);
    console.log(`📊 Totale righe migrate: ${countResult.rows[0].total}`);
    
    // 5. Mostra la struttura finale
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'opinioni_risposte' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Struttura finale tabella opinioni_risposte:');
    structureResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('🎉 Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixOpinioniStructure();
