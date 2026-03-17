-- Schema PostgreSQL completo per DemosApp (compatibile con Firebase)

-- Tabella utenti (equivalente alla collection 'utenti' di Firebase)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cognome VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fcm_tokens TEXT[],
    notifiche_preferenze JSONB DEFAULT '{}'::jsonb,
    avatar_config JSONB DEFAULT '{}'::jsonb,
    ruolo VARCHAR(50),
    premium BOOLEAN DEFAULT false,
    -- Campi aggiuntivi trovati in Firestore
    paese_candidatura VARCHAR(100),
    provincia_residenza VARCHAR(100),
    comune_residenza VARCHAR(100),
    regione_residenza VARCHAR(100),
    provincia_elezione VARCHAR(100),
    regione_elezione VARCHAR(100),
    grado_elezione VARCHAR(100),
    paese_elezione VARCHAR(100),
    provincia_candidatura VARCHAR(100),
    paese_residenza VARCHAR(100),
    comune_candidatura VARCHAR(100),
    cittadina_animale BOOLEAN,
    caccia BOOLEAN,
    eutanasia BOOLEAN,
    case_chiuse BOOLEAN,
    salario_minimo BOOLEAN,
    matrimonio_gay BOOLEAN,
    legalizzazione_canapa BOOLEAN,
    energia_nucleare BOOLEAN,
    nato BOOLEAN,
    omobitransfobia BOOLEAN,
    data_nascita DATE,
    genere VARCHAR(20),
    uid VARCHAR(255),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Tabella comunicazioni (equivalente alla collection 'comunicazioni')
CREATE TABLE IF NOT EXISTS comunicazioni (
    id VARCHAR(255) PRIMARY KEY,
    id_utente VARCHAR(255) REFERENCES users(id),
    titolo TEXT NOT NULL,
    testo TEXT,
    zona TEXT,
    voto_dato VARCHAR(50) CHECK (voto_dato IN ('Favorevole', 'Contrario', 'Astenuto')),
    vincitore VARCHAR(50) CHECK (vincitore IN ('Favorevole', 'Contrario', 'Astenuto')),
    commento TEXT,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    punti_trasparenza INTEGER DEFAULT 0,
    FOREIGN KEY (id_utente) REFERENCES users(id)
);

-- Tabella opinioni (equivalente alla collection 'opinioni')
CREATE TABLE IF NOT EXISTS opinioni (
    id VARCHAR(255) PRIMARY KEY,
    text TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    original_proponente TEXT
);

-- Tabella opinioni proposte (equivalente alla collection 'opinioni_proposte')
CREATE TABLE IF NOT EXISTS opinioni_proposte (
    id VARCHAR(255) PRIMARY KEY,
    testo TEXT NOT NULL,
    proponente TEXT NOT NULL,
    proponente_email TEXT NOT NULL,
    voti INTEGER DEFAULT 0,
    votanti TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_creazione TIMESTAMP WITH TIME ZONE
);

-- Tabella voti capo stato (equivalente alla collection 'voti_capo_stato')
CREATE TABLE IF NOT EXISTS voti_capo_stato (
    id VARCHAR(255) PRIMARY KEY,
    nome TEXT NOT NULL,
    userId VARCHAR(255) REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella voti referendum abrogativi (equivalente alla collection 'voti_referendum_abrogativi')
CREATE TABLE IF NOT EXISTS voti_referendum_abrogativi (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) REFERENCES users(id),
    referendumId VARCHAR(255) REFERENCES opinioni(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella richieste premium (equivalente alla collection 'premium_requests')
CREATE TABLE IF NOT EXISTS premium_requests (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Tabella notifiche amministrative (equivalente alla collection 'admin_notifications')
CREATE TABLE IF NOT EXISTS admin_notifications (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    userData JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT false,
    createdAt TIMESTAMP WITH TIME ZONE,
    updatedAt TIMESTAMP WITH TIME ZONE
);

-- Tabella elezioni (equivalente alla collection 'elezioni')
CREATE TABLE IF NOT EXISTS elezioni (
    id VARCHAR(255) PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    zona VARCHAR(100),
    dataInizio DATE,
    dataFine DATE,
    circa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP WITH TIME ZONE,
    updatedAt TIMESTAMP WITH TIME ZONE
);

-- Tabella iniziative popolari (equivalente alla collection 'iniziative_popolari')
CREATE TABLE IF NOT EXISTS iniziative_popolari (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255) REFERENCES users(id),
    nome TEXT NOT NULL,
    dataInizio DATE,
    dataFine DATE,
    sitoWeb TEXT,
    status VARCHAR(50),
    quorum INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP WITH TIME ZONE,
    updatedAt TIMESTAMP WITH TIME ZONE,
    acceptedAt TIMESTAMP WITH TIME ZONE
);

-- Tabella voti iniziative popolari (equivalente alla collection 'voti_iniziative_popolari')
CREATE TABLE IF NOT EXISTS voti_iniziative_popolari (
    id VARCHAR(255) PRIMARY KEY,
    iniziativaId VARCHAR(255) REFERENCES iniziative_popolari(id),
    userId VARCHAR(255) REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella ICE (Iniziative Cittadini Europei) (equivalente alla collection 'ice')
CREATE TABLE IF NOT EXISTS ice (
    id VARCHAR(255) PRIMARY KEY,
    nome TEXT NOT NULL,
    descrizione TEXT,
    dataInizio DATE,
    dataFine DATE,
    sitoWeb TEXT,
    quorum INTEGER,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voti_ice (
    id VARCHAR(255) PRIMARY KEY,
    iceId VARCHAR(255) REFERENCES ice(id),
    userId VARCHAR(255) REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella richieste di riconoscimento ruolo politico/candidato
CREATE TABLE IF NOT EXISTS riconoscimenti (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo_ruolo VARCHAR(2) NOT NULL CHECK (tipo_ruolo IN ('P', 'C', 'CP')),
    nome VARCHAR(255) NOT NULL,
    cognome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    -- Dati di elezione (solo per P o CP)
    paese_elezione VARCHAR(100),
    regione_elezione VARCHAR(100),
    provincia_elezione VARCHAR(100),
    comune_elezione VARCHAR(100),
    grado_elezione VARCHAR(100),
    -- Dati di candidatura (solo per C o CP)
    paese_candidatura VARCHAR(100),
    regione_candidatura VARCHAR(100),
    provincia_candidatura VARCHAR(100),
    comune_candidatura VARCHAR(100),
    grado_candidatura VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le prestazioni
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_id_utente ON comunicazioni(id_utente);
CREATE INDEX IF NOT EXISTS idx_opinioni_proposte_votanti ON opinioni_proposte(votanti);
CREATE INDEX IF NOT EXISTS idx_voti_capo_stato_userId ON voti_capo_stato(userId);
CREATE INDEX IF NOT EXISTS idx_voti_referendum_userId ON voti_referendum_abrogativi(userId);
CREATE INDEX IF NOT EXISTS idx_premium_requests_status ON premium_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_elezioni_tipo ON elezioni(tipo);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_userId ON iniziative_popolari(userId);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_status ON iniziative_popolari(status);
CREATE INDEX IF NOT EXISTS idx_voti_iniziative_userId ON voti_iniziative_popolari(userId);
CREATE INDEX IF NOT EXISTS idx_voti_iniziative_iniziativaId ON voti_iniziative_popolari(iniziativaId);
CREATE INDEX IF NOT EXISTS idx_ice_dataInizio ON ice(dataInizio);
CREATE INDEX IF NOT EXISTS idx_voti_ice_userId ON voti_ice(userId);
CREATE INDEX IF NOT EXISTS idx_voti_ice_iceId ON voti_ice(iceId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_riconoscimenti_user_id ON riconoscimenti(user_id);
