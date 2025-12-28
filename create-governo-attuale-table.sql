-- Tabella per memorizzare i ministri attuali del governo
CREATE TABLE IF NOT EXISTS governo_attuale (
    id VARCHAR(255) PRIMARY KEY,
    ruolo_ministro VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    nome_utente VARCHAR(255),
    cognome_utente VARCHAR(255),
    email_utente VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_governo_attuale_ruolo ON governo_attuale(ruolo_ministro);
CREATE INDEX IF NOT EXISTS idx_governo_attuale_user_id ON governo_attuale(user_id);

-- Commenti per documentazione
COMMENT ON TABLE governo_attuale IS 'Tabella per memorizzare i ministri attuali del governo';
COMMENT ON COLUMN governo_attuale.ruolo_ministro IS 'Ruolo del ministro (es: Primo Ministro, Ministro degli affari esteri, etc.)';
COMMENT ON COLUMN governo_attuale.user_id IS 'ID dell\'utente dalla tabella users che ricopre questo ruolo';

