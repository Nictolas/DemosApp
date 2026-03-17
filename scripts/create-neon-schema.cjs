const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createNeonSchema() {
  console.log('🏗️ Creazione schema database Neon...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connesso al database Neon');
    
    // Schema completo per tutte le tabelle
    const schema = `
      -- Tabella utenti
      CREATE TABLE IF NOT EXISTS utenti (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        cognome VARCHAR(255) NOT NULL,
        data_nascita DATE,
        sesso VARCHAR(20),
        paese VARCHAR(100),
        regione VARCHAR(100),
        provincia VARCHAR(100),
        comune VARCHAR(100),
        indirizzo TEXT,
        telefono VARCHAR(50),
        professione VARCHAR(100),
        istruzione VARCHAR(100),
        reddito VARCHAR(50),
        partito VARCHAR(100),
        is_admin BOOLEAN DEFAULT false,
        is_premium BOOLEAN DEFAULT false,
        data_registrazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ultimo_accesso TIMESTAMP WITH TIME ZONE,
        avatar_url TEXT,
        bio TEXT,
        social_links JSONB,
        preferenze_notifiche JSONB,
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
        carne_coltivata BOOLEAN,
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

      -- Tabella opinioni
      CREATE TABLE IF NOT EXISTS opinioni (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        titolo TEXT,
        descrizione TEXT,
        categoria VARCHAR(100),
        fonte VARCHAR(100) DEFAULT 'unknown',
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
        note_internal TEXT
      );

      -- Tabella opinioni proposte
      CREATE TABLE IF NOT EXISTS opinioni_proposte (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        titolo TEXT,
        descrizione TEXT,
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
        data_revisione TIMESTAMP WITH TIME ZONE
      );

      -- Tabella comunicazioni
      CREATE TABLE IF NOT EXISTS comunicazioni (
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

      -- Tabella iniziative popolari
      CREATE TABLE IF NOT EXISTS iniziative_popolari (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT
      );

      -- Tabella ICE
      CREATE TABLE IF NOT EXISTS ice (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT
      );

      -- Tabella referendum abrogativi
      CREATE TABLE IF NOT EXISTS referendum_abrogativi (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        promotore_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_scadenza TIMESTAMP WITH TIME ZONE,
        quorum INTEGER,
        status VARCHAR(50) DEFAULT 'attiva',
        firme_raccolte INTEGER DEFAULT 0,
        firme_necessarie INTEGER,
        categoria VARCHAR(100),
        tags TEXT[],
        documento_url TEXT,
        immagine_url TEXT,
        note TEXT
      );

      -- Tabella elezioni
      CREATE TABLE IF NOT EXISTS elezioni (
        id VARCHAR(255) PRIMARY KEY,
        titolo TEXT,
        descrizione TEXT,
        tipo VARCHAR(100) DEFAULT 'generale',
        data_inizio TIMESTAMP WITH TIME ZONE,
        data_fine TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'attiva',
        quorum INTEGER,
        candidati JSONB,
        regole JSONB,
        risultati JSONB,
        note TEXT
      );

      -- Tabella richieste premium
      CREATE TABLE IF NOT EXISTS richieste_premium (
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

      -- Tabella richieste grazia
      CREATE TABLE IF NOT EXISTS richieste_grazia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        nome TEXT,
        url_prova TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT
      );

      -- Tabella ministeri
      CREATE TABLE IF NOT EXISTS ministeri (
        id VARCHAR(255) PRIMARY KEY,
        nome VARCHAR(255),
        categoria VARCHAR(100),
        descrizione TEXT,
        abilitato BOOLEAN DEFAULT true,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_modifica TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella programmi
      CREATE TABLE IF NOT EXISTS programmi (
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

      -- Tabella reazioni
      CREATE TABLE IF NOT EXISTS reazioni (
        id VARCHAR(255) PRIMARY KEY,
        comunicazione_id VARCHAR(255) REFERENCES comunicazioni(id),
        utente_id VARCHAR(255) REFERENCES utenti(id),
        tipo VARCHAR(20) DEFAULT 'like',
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabella notifiche utente
      CREATE TABLE IF NOT EXISTS notifiche_utente (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        tipo VARCHAR(50) DEFAULT 'generica',
        titolo TEXT,
        messaggio TEXT,
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_lettura TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'non_letta',
        priorita VARCHAR(20) DEFAULT 'normale'
      );

      -- Tabella notifiche admin
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id VARCHAR(255) PRIMARY KEY,
        tipo VARCHAR(50) DEFAULT 'generica',
        titolo TEXT,
        messaggio TEXT,
        destinatario_id VARCHAR(255) REFERENCES utenti(id),
        data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_lettura TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'non_letta',
        priorita VARCHAR(20) DEFAULT 'normale',
        azioni JSONB,
        metadata JSONB
      );

      -- Tabella voti capo stato
      CREATE TABLE IF NOT EXISTS voti_capo_stato (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        candidato_id VARCHAR(255),
        elezione_id VARCHAR(255) REFERENCES elezioni(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT
      );

      -- Tabella voti iniziative popolari
      CREATE TABLE IF NOT EXISTS voti_iniziative_popolari (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        iniziativa_id VARCHAR(255) REFERENCES iniziative_popolari(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT
      );

      -- Tabella voti ICE
      CREATE TABLE IF NOT EXISTS voti_ice (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        ice_id VARCHAR(255) REFERENCES ice(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT
      );

      -- Tabella voti referendum
      CREATE TABLE IF NOT EXISTS voti_referendum_abrogativi (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        referendum_id VARCHAR(255) REFERENCES referendum_abrogativi(id),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        voto BOOLEAN,
        note TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT
      );

      -- Tabella voti amnistia
      CREATE TABLE IF NOT EXISTS voti_amnistia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        legge TEXT,
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT
      );

      -- Tabella voti grazia
      CREATE TABLE IF NOT EXISTS voti_grazia (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        nome TEXT,
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT
      );

      -- Tabella voti ministri
      CREATE TABLE IF NOT EXISTS voti_ministri (
        id VARCHAR(255) PRIMARY KEY,
        utente_id VARCHAR(255) REFERENCES utenti(id),
        categoria VARCHAR(100),
        nome_ministro VARCHAR(255),
        nome_display VARCHAR(255),
        data_voto TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        note TEXT
      );
    `;
    
    console.log('🏗️ Applicazione schema...');
    await client.query(schema);
    console.log('✅ Schema applicato con successo');
    
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
    console.log('🚀 Il database è pronto per la migrazione dei dati');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Errore durante la creazione dello schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createNeonSchema();
