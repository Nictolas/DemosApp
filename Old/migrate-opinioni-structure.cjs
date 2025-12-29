const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function migrateOpinioniStructure() {
  try {
    console.log('🚀 Inizio migrazione struttura opinioni...');
    
    // 1. Controlla se la tabella opinioni_domande esiste già
    console.log('📝 Controllo se opinioni_domande esiste già...');
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'opinioni_domande'
      )
    `);
    
    if (!checkResult.rows[0].exists) {
      console.log('📝 Rinomino opinioni -> opinioni_domande...');
      await pool.query(`
        ALTER TABLE opinioni RENAME TO opinioni_domande
      `);
      console.log('✅ Tabella rinominata');
    } else {
      console.log('✅ Tabella opinioni_domande esiste già');
    }
    
    // 2. Crea la tabella opinioni_risposte
    console.log('🔧 Creazione tabella opinioni_risposte...');
    await pool.query(`
      CREATE TABLE opinioni_risposte (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opinione_id VARCHAR NOT NULL REFERENCES opinioni_domande(id) ON DELETE CASCADE,
        risposta TEXT CHECK (risposta IN ('f', 'c', 'i') OR risposta IS NULL),
        fonte TEXT,
        UNIQUE(user_id, opinione_id)
      )
    `);
    console.log('✅ Tabella opinioni_risposte creata');
    
    // 3. Crea indici per performance
    console.log('📊 Creazione indici...');
    await pool.query(`
      CREATE INDEX idx_opinioni_risposte_user_id ON opinioni_risposte(user_id)
    `);
    await pool.query(`
      CREATE INDEX idx_opinioni_risposte_opinione_id ON opinioni_risposte(opinione_id)
    `);
    console.log('✅ Indici creati');
    
    // 4. Migra i dati dalle colonne users alle opinioni_risposte
    console.log('📦 Migrazione dati dalle colonne users...');
    
    // Lista delle colonne opinioni da migrare
    const opinionColumns = [
      'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa', 'caccia', 'eutanasia',
      'carne_coltivata', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo', 'case_chiuse', 'omobitransfobia',
      'nuovi_inceneritori', 'chiusura_ospedali_di_provincia',
      'cassonetti_intelligenti_con_tessera', 'nuova_biblioteca_comunale', 'nuove_piste_ciclabili', 'nuovi_asili_nido_comunali',
      'nuovo_stadio_comunale', 'riduzione_parcheggi_a_pagamento',
      'concessione_spazi_pubblici_a_centri_sociali_autogestiti', 'divieto_di_nuovi_fast_food_nel_centro_storico',
      'estensione_delle_zone_a_traffico_limitato', 'finanziamento_eventi_culturali_gratuiti', 'nuove_case_popolari',
      'raccolta_rifiuti_porta_a_porta', 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico',
      'sussidi_comunali_per_famiglie_numerose', 'videosorveglianza_in_spazi_pubblici',
      'parcheggi_gratuiti_per_residenti', 'potenziamento_trasporto_pubblico', 'riduzione_tasse_rifiuti',
      'sicurezza_strade_scolastiche', 'sostegno_commercio_locale', 'verde_pubblico_e_giardini'
    ];
    
    // Per ogni colonna opinione, migra i dati
    for (const column of opinionColumns) {
      console.log(`  📝 Migrando colonna: ${column}`);
      
      // Trova l'ID dell'opinione corrispondente
      const opinionResult = await pool.query(`
        SELECT id FROM opinioni_domande 
        WHERE text ILIKE $1
      `, [`%${column.replace(/_/g, ' ')}%`]);
      
      if (opinionResult.rows.length > 0) {
        const opinioneId = opinionResult.rows[0].id;
        
        // Migra i dati non-null dalla colonna users
        await pool.query(`
          INSERT INTO opinioni_risposte (user_id, opinione_id, risposta)
          SELECT id, $1, ${column}
          FROM users 
          WHERE ${column} IS NOT NULL AND ${column} IN ('f', 'c', 'i')
          ON CONFLICT (user_id, opinione_id) DO UPDATE SET
            risposta = EXCLUDED.risposta,
            updated_at = NOW()
        `, [opinioneId]);
        
        console.log(`    ✅ Migrata colonna ${column}`);
      } else {
        console.log(`    ⚠️ Opinione non trovata per colonna ${column}`);
      }
    }
    
    console.log('✅ Migrazione dati completata');
    
    // 5. Verifica i risultati
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM opinioni_risposte
    `);
    console.log(`📊 Totale opinioni_risposte migrate: ${countResult.rows[0].total}`);
    
    console.log('🎉 Migrazione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

migrateOpinioniStructure();
