-- Schema PostgreSQL per DemosApp

-- Tabella utenti (equivalente alla collection 'utenti' di Firebase)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
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
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Tabella comunicazioni (equivalente alla collection 'comunicazioni')
CREATE TABLE IF NOT EXISTS comunicazioni (
    id UUID PRIMARY KEY,
    id_utente UUID REFERENCES users(id),
    titolo TEXT,
    testo TEXT NOT NULL,
    zona TEXT,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    punti_trasparenza INTEGER DEFAULT 0,
    FOREIGN KEY (id_utente) REFERENCES users(id)
);

-- Tabella opinioni (equivalente alla collection 'opinioni')
CREATE TABLE IF NOT EXISTS opinioni (
    id UUID PRIMARY KEY,
    text TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    original_proponente TEXT
);

-- Tabella opinioni proposte (equivalente alla collection 'opinioni_proposte')
CREATE TABLE IF NOT EXISTS opinioni_proposte (
    id UUID PRIMARY KEY,
    testo TEXT NOT NULL,
    proponente TEXT NOT NULL,
    proponente_email TEXT NOT NULL,
    voti INTEGER DEFAULT 0,
    votanti TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella voti capo stato (equivalente alla collection 'voti_capo_stato')
CREATE TABLE IF NOT EXISTS voti_capo_stato (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    userId UUID REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella voti referendum abrogativi (equivalente alla collection 'voti_referendum_abrogativi')
CREATE TABLE IF NOT EXISTS voti_referendum_abrogativi (
    id UUID PRIMARY KEY,
    userId UUID REFERENCES users(id),
    referendumId UUID REFERENCES opinioni(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella richieste premium (equivalente alla collection 'premium_requests')
CREATE TABLE IF NOT EXISTS premium_requests (
    id UUID PRIMARY KEY,
    userId UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Tabella notifiche amministrative (equivalente alla collection 'admin_notifications')
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    userData JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT false
);

-- Indici per migliorare le prestazioni
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_comunicazioni_id_utente ON comunicazioni(id_utente);
CREATE INDEX idx_opinioni_proposte_votanti ON opinioni_proposte(votanti);
CREATE INDEX idx_voti_capo_stato_userId ON voti_capo_stato(userId);
CREATE INDEX idx_voti_referendum_userId ON voti_referendum_abrogativi(userId);
CREATE INDEX idx_premium_requests_status ON premium_requests(status);
CREATE INDEX idx_admin_notifications_read ON admin_notifications(read);
