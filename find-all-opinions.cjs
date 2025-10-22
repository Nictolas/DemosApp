const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:[REDACTED_NEON_PASSWORD]@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function findAllOpinions() {
  try {
    console.log('🔍 RICERCA TUTTE LE OPINIONI - Inizio\n');
    
    // 1. Trova tutte le colonne di opinioni nella tabella users
    console.log('1️⃣ COLONNE OPINIONI NELLA TABELLA USERS');
    console.log('======================================');
    
    const opinionColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE '%_%'
      AND column_name NOT IN (
        'created_at', 'updated_at', 'id', 'email', 'password', 'status', 'role', 'nome', 'cognome', 
        'data_nascita', 'genere', 'cittadinanza', 'paese_residenza', 'regione_residenza', 
        'provincia_residenza', 'comune_residenza', 'cap_residenza', 'indirizzo_residenza', 
        'telefono', 'avatar', 'grado_elezione', 'grado_candidatura', 'partito', 'bio', 
        'programma', 'slogan', 'sito_web', 'facebook', 'twitter', 'instagram', 'linkedin', 
        'youtube', 'tiktok', 'telegram', 'whatsapp', 'email_pubblica', 'telefono_pubblico', 
        'indirizzo_pubblico', 'cap_pubblico', 'comune_pubblico', 'provincia_pubblico', 
        'regione_pubblico', 'paese_pubblico', 'verificato', 'attivo', 'ultimo_accesso', 
        'ultimo_login', 'tentativi_login', 'bloccato', 'bloccato_fino', 'token_verifica', 
        'token_reset', 'token_reset_scadenza', 'token_verifica_scadenza', 'token_refresh', 
        'token_refresh_scadenza', 'token_access', 'token_access_scadenza', 'sessione_id', 
        'sessione_scadenza', 'sessione_ip', 'sessione_user_agent', 'sessione_attiva', 
        'sessione_ultima_attivita', 'sessione_ultimo_accesso', 'sessione_ultimo_login', 
        'sessione_tentativi_login', 'sessione_bloccata', 'sessione_bloccata_fino', 
        'sessione_token_verifica', 'sessione_token_reset', 'sessione_token_reset_scadenza', 
        'sessione_token_verifica_scadenza', 'sessione_token_refresh', 'sessione_token_refresh_scadenza', 
        'sessione_token_access', 'sessione_token_access_scadenza', 'auth_method', 'avatar_config', 
        'candidato_attivo', 'candidato_camera', 'candidato_comune', 'candidato_europeo', 
        'candidato_regionale', 'candidato_senato', 'codice_attivista', 'comune_candidatura', 
        'comune_elezione', 'consent_ip_address', 'consent_timestamp', 'consent_user_agent', 
        'cookie_policy_consent', 'data_analytics', 'data_candidatura', 'email_notifications', 
        'email_verification_token', 'facebook_url', 'firestore_uid', 'instagram_url', 'is_admin', 
        'is_premium', 'linkedin_url', 'luogo_nascita', 'marketing_emails', 'note_candidatura', 
        'notifiche_preferenze', 'opinions_public', 'paese_candidatura', 'paese_elezione', 
        'password_hash', 'preferenze_notifiche', 'privacy_policy_consent', 'profile_visibility', 
        'provincia_candidatura', 'provincia_elezione', 'push_notifications', 'rappresentante_camera', 
        'rappresentante_comune', 'rappresentante_europeo', 'rappresentante_regionale', 
        'rappresentante_senato', 'regione_candidatura', 'regione_elezione', 'reset_token', 
        'reset_token_expires', 'status_candidatura', 'telegram_url', 'terms_of_service_consent', 
        'tipologie_attivismo', 'twitch_url', 'twitter_url', 'website_url', 'youtube_url', 
        'fonti_opinioni'
      )
      ORDER BY column_name
    `);
    
    console.log('📊 Colonne di opinioni trovate:', opinionColumns.rows.length);
    opinionColumns.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.column_name}`);
    });
    
    // 2. Crea le opinioni mancanti in opinioni_domande
    console.log('\n2️⃣ CREAZIONE OPINIONI MANCANTI');
    console.log('===============================');
    
    const opinioniToCreate = [];
    
    for (const row of opinionColumns.rows) {
      const columnName = row.column_name;
      
      // Determina il grado basato sul nome della colonna
      let grado = ['E']; // Default europeo
      
      if (columnName.includes('cassonetti') || columnName.includes('concessione') || 
          columnName.includes('divieto') || columnName.includes('estensione') || 
          columnName.includes('finanziamento') || columnName.includes('nuova_biblioteca') || 
          columnName.includes('nuove_case') || columnName.includes('nuove_piste') || 
          columnName.includes('nuovi_asili') || columnName.includes('nuovo_stadio') || 
          columnName.includes('parcheggi') || columnName.includes('potenziamento') || 
          columnName.includes('riduzione_tasse') || columnName.includes('sicurezza') || 
          columnName.includes('sostegno') || columnName.includes('verde_pubblico') || 
          columnName.includes('raccolta_rifiuti') || columnName.includes('riduzione_illuminazione') || 
          columnName.includes('sussidi') || columnName.includes('videosorveglianza') || 
          columnName.includes('riduzione_parcheggi')) {
        grado = ['CO']; // Comunale
      } else if (columnName.includes('nuovi_inceneritori') || columnName.includes('chiusura_ospedali')) {
        grado = ['R']; // Regionale
      }
      
      // Converte il nome della colonna in testo leggibile
      const text = columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      opinioniToCreate.push({
        id: columnName,
        text: text,
        gradi_opinione: grado
      });
    }
    
    console.log(`📊 Opinion da creare: ${opinioniToCreate.length}`);
    
    // Inserisci le opinioni in opinioni_domande
    for (const opinione of opinioniToCreate) {
      await pool.query(`
        INSERT INTO opinioni_domande (id, text, gradi_opinione)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          gradi_opinione = EXCLUDED.gradi_opinione
      `, [opinione.id, opinione.text, opinione.gradi_opinione]);
    }
    
    console.log('✅ Tutte le opinioni create in opinioni_domande');
    
    // 3. Verifica il risultato
    console.log('\n3️⃣ VERIFICA RISULTATO');
    console.log('======================');
    
    const finalCount = await pool.query('SELECT COUNT(*) FROM opinioni_domande');
    console.log('📊 Totale opinioni in opinioni_domande:', finalCount.rows[0].count);
    
    const sampleOpinions = await pool.query('SELECT id, text, gradi_opinione FROM opinioni_domande ORDER BY id LIMIT 10');
    console.log('📊 Esempi opinioni create:', sampleOpinions.rows);
    
    console.log('\n🏁 TUTTE LE OPINIONI RICREATE');
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('📋 Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

findAllOpinions();
