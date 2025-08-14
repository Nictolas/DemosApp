const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function recreateCompleteSchema() {
  console.log('🏗️ Ricreazione completa schema database...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Elimina tutte le tabelle esistenti
    console.log('🗑️ Eliminazione tabelle esistenti...');
    const dropTables = [
      'DROP TABLE IF EXISTS reazioni CASCADE',
      'DROP TABLE IF EXISTS voti_referendum_abrogativi CASCADE',
      'DROP TABLE IF EXISTS voti_ice CASCADE',
      'DROP TABLE IF EXISTS voti_iniziative_popolari CASCADE',
      'DROP TABLE IF EXISTS voti_capo_stato CASCADE',
      'DROP TABLE IF EXISTS voti_amnistia CASCADE',
      'DROP TABLE IF EXISTS voti_grazia CASCADE',
      'DROP TABLE IF EXISTS voti_ministri CASCADE',
      'DROP TABLE IF EXISTS notifiche_utente CASCADE',
      'DROP TABLE IF EXISTS admin_notifications CASCADE',
      'DROP TABLE IF EXISTS richieste_premium CASCADE',
      'DROP TABLE IF EXISTS richieste_grazia CASCADE',
      'DROP TABLE IF EXISTS programmi CASCADE',
      'DROP TABLE IF EXISTS ministeri CASCADE',
      'DROP TABLE IF EXISTS referendum_abrogativi CASCADE',
      'DROP TABLE IF EXISTS ice CASCADE',
      'DROP TABLE IF EXISTS iniziative_popolari CASCADE',
      'DROP TABLE IF EXISTS elezioni CASCADE',
      'DROP TABLE IF EXISTS opinioni_proposte CASCADE',
      'DROP TABLE IF EXISTS opinioni CASCADE',
      'DROP TABLE IF EXISTS comunicazioni CASCADE',
      'DROP TABLE IF EXISTS utenti CASCADE'
    ];
    
    for (const dropQuery of dropTables) {
      await client.query(dropQuery);
    }
    console.log('✅ Tabelle esistenti eliminate');
    
    // Ricrea lo schema completo e corretto
    console.log('🏗️ Creazione nuovo schema completo...');
    
    const schema = `
      -- Tabella utenti (completa)
      CREATE TABLE utenti (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cognome VARCHAR(255) NOT NULL,
        data_nascita DATE,
        sesso VARCHAR(20),
        genere VARCHAR(20),
        paese VARCHAR(100),
        paese_residenza VARCHAR(100),
        regione VARCHAR(100),
        regione_residenza VARCHAR(100),
        provincia VARCHAR(100),
        provincia_residenza VARCHAR(100),
        comune VARCHAR(100),
        comune_residenza VARCHAR(100),
        indirizzo TEXT,
        telefono VARCHAR(50),
        professione VARCHAR(100),
        istruzione VARCHAR(100),
        reddito VARCHAR(50),
        partito VARCHAR(100),
        is_admin BOOLEAN DEFAULT false,
        is_premium BOOLEAN DEFAULT false,
        premium BOOLEAN DEFAULT false,
        data_registrazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ultimo_accesso TIMESTAMP WITH TIME ZONE,
        avatar_url TEXT,
        bio TEXT,
        social_links JSONB,
        preferenze_notifiche JSONB,
        notifiche_preferenze JSONB,
        avatar_config JSONB,
        fcm_tokens TEXT[],
        paese_candidatura VARCHAR(100),
        regione_candidatura VARCHAR(100),
        provincia_candidatura VARCHAR(100),
        comune_candidatura VARCHAR(100),
        candidato_attivo BOOLEAN DEFAULT false,
        data_candidatura TIMESTAMP WITH TIME ZONE,
        status_candidatura VARCHAR(50),
        note_candidatura TEXT,
        cittadinanza VARCHAR(100),
        comune_elezione VARCHAR(100),
        grado_elezione VARCHAR(100),
        paese_elezione VARCHAR(100),
        grado_candidatura VARCHAR(100),
        ruolo VARCHAR(100),
        carne_coltivata BOOLEAN,
        cittadina_animale BOOLEAN,
        sperimentazione_animale BOOLEAN,
        caccia BOOLEAN,
        eutanasia BOOLEAN,
        case_chiuse BOOLEAN,
        salario_minimo BOOLEAN,
        matrimonio_gay BOOLEAN,
        legalizzazione_canapa BOOLEAN,
        energia_nucleare BOOLEAN,
        nato BOOLEAN,
        omobitransfobia BOOLEAN,
        approved_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'pending',
        uid VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella opinioni (completa)
      CREATE TABLE opinioni (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        titolo TEXT,
        descrizione TEXT,
        text TEXT,
        categoria VARCHAR(100),
        fonte VARCHAR(100) DEFAULT 'unknown',
        source VARCHAR(100),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_modifica TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'attiva',
        tags TEXT[],
        immagine_url TEXT,
        fonte_url TEXT,
        autore_fonte VARCHAR(255),
        data_fonte TIMESTAMP WITH TIME ZONE,
        rilevanza INTEGER,
        complessita INTEGER,
        controversia INTEGER,
        note_internal TEXT,
        original_proponente TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella opinioni proposte (completa)
      CREATE TABLE opinioni_proposte (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        titolo TEXT,
        descrizione TEXT,
        testo TEXT,
        categoria VARCHAR(100),
        fonte VARCHAR(100) DEFAULT 'unknown',
        data_proposta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'in_revisione',
        tags TEXT[],
        immagine_url TEXT,
        fonte_url TEXT,
        autore_fonte VARCHAR(255),
        data_fonte TIMESTAMP WITH TIME ZONE,
        rilevanza INTEGER,
        complessita INTEGER,
        controversia INTEGER,
        note_revisione TEXT,
        revisore_id VARCHAR(255) REFERENCES utenti(id),
        data_revisione TIMESTAMP WITH TIME ZONE,
        proponente TEXT,
        proponente_email TEXT,
        voti INTEGER DEFAULT 0,
        votanti TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella comunicazioni (completa)
      CREATE TABLE comunicazioni (
        id VARCHAR(255) PRIMARY KEY,
        mittente_id VARCHAR(255) REFERENCES utenti(id),
        destinatario_id VARCHAR(255) REFERENCES utenti(id),
        oggetto TEXT,
        messaggio TEXT NOT NULL,
        data_invio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_lettura TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'inviato',
        tipo VARCHAR(50) DEFAULT 'messaggio',
        allegati JSONB,
        priorita VARCHAR(20) DEFAULT 'normale'
      );

      -- Tabella iniziative popolari (completa)
      CREATE TABLE iniziative_popolari (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        userid VARCHAR(255),
        nome TEXT,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        dataInizio DATE,
        dataFine DATE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT,
        sitoWeb TEXT,
        createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        acceptedAt TIMESTAMP WITH TIME ZONE
      );

      -- Tabella ICE (completa)
      CREATE TABLE ice (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        dataInizio DATE,
        dataFine DATE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT,
        nome TEXT,
        sitoWeb TEXT,
        data_creazione_original TIMESTAMP WITH TIME ZONE
      );

      -- Tabella referendum abrogativi (completa)
      CREATE TABLE referendum_abrogativi (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        userid VARCHAR(255),
        nome TEXT,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        dataInizio DATE,
        dataFine DATE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT,
        sitoWeb TEXT,
        createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        acceptedAt TIMESTAMP WITH TIME ZONE
      );

      -- Tabella elezioni (completa)
      CREATE TABLE elezioni (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        tipo VARCHAR(100) DEFAULT 'generale',
        zona VARCHAR(100),
        data_inizio TIMESTAMP WITH TIME ZONE,
        data_fine TIMESTAMP WITH TIME ZONE,
        dataInizio DATE,
        dataFine DATE,
        status VARCHAR(50) DEFAULT 'attiva',
        quorum INTEGER,
        candidati JSONB,
        regole JSONB,
        risultati JSONB,
        note TEXT,
        circa TEXT,
        createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella richieste premium (completa)
      CREATE TABLE richieste_premium (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        tipo_richiesta VARCHAR(50) DEFAULT 'upgrade',
        data_richiesta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'in_attesa',
        motivazione TEXT,
        documenti_url JSONB,
        note_admin TEXT,
        data_approvazione TIMESTAMP WITH TIME ZONE,
        approvatore_id VARCHAR(255) REFERENCES utenti(id)
      );

      -- Tabella richieste grazia (completa)
      CREATE TABLE richieste_grazia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        nome TEXT,
        url_prova TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT
      );

      -- Tabella ministeri (completa)
      CREATE TABLE ministeri (
        id VARCHAR(255) PRIMARY KEY,
        nome VARCHAR(255),
        categoria VARCHAR(100),
        descrizione TEXT,
        abilitato BOOLEAN DEFAULT true,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_modifica TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella programmi (completa)
      CREATE TABLE programmi (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        proposta_1 TEXT,
        proposta_2 TEXT,
        proposta_3 TEXT,
        proposta_4 TEXT,
        proposta_5 TEXT,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_modifica TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella reazioni (completa)
      CREATE TABLE reazioni (
        id VARCHAR(255) PRIMARY KEY,
        comunicazione_id VARCHAR(255) REFERENCES comunicazioni(id),
        utente_id VARCHAR(255) REFERENCES utenti(id),
        tipo VARCHAR(20) DEFAULT 'like',
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella notifiche utente (completa)
      CREATE TABLE notifiche_utente (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        tipo VARCHAR(50) DEFAULT 'generica',
        titolo TEXT,
        message TEXT,
        messaggio TEXT,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_lettura TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'non_letta',
        priorita VARCHAR(20) DEFAULT 'normale',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella notifiche admin (completa)
      CREATE TABLE admin_notifications (
        id VARCHAR(255) PRIMARY KEY,
        tipo VARCHAR(50) DEFAULT 'generica',
        titolo TEXT,
        title TEXT,
        messaggio TEXT,
        message TEXT,
        destinatario_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_lettura TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'non_letta',
        priorita VARCHAR(20) DEFAULT 'normale',
        azioni JSONB,
        metadata JSONB,
        type VARCHAR(50),
        userData JSONB,
        createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT false,
        updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti capo stato (completa)
      CREATE TABLE voti_capo_stato (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        candidato_id VARCHAR(255),
        elezione_id VARCHAR(255) REFERENCES elezioni(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        nome TEXT,
        userid VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti iniziative popolari (completa)
      CREATE TABLE voti_iniziative_popolari (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        iniziativa_id VARCHAR(255) REFERENCES iniziative_popolari(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        iniziativaId VARCHAR(255),
        userId VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti ICE (completa)
      CREATE TABLE voti_ice (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        ice_id VARCHAR(255) REFERENCES ice(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT
      );

      -- Tabella voti referendum (completa)
      CREATE TABLE voti_referendum_abrogativi (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        referendum_id VARCHAR(255) REFERENCES referendum_abrogativi(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        userId VARCHAR(255),
        referendumId VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti amnistia (completa)
      CREATE TABLE voti_amnistia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        legge TEXT,
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        userId VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti grazia (completa)
      CREATE TABLE voti_grazia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        nome TEXT,
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        userId VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella voti ministri (completa)
      CREATE TABLE voti_ministri (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        categoria VARCHAR(100),
        nome_ministro VARCHAR(255),
        nome_display VARCHAR(255),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        userId VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await client.query(schema);
    console.log('✅ Schema completo creato');
    
    // Verifica tabelle create
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelle create nel database:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log(`\n🎉 Schema completato! ${tables.rows.length} tabelle create`);
    console.log('🚀 Il database è pronto per la migrazione completa dei dati');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Errore durante la ricreazione dello schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

recreateCompleteSchema();
