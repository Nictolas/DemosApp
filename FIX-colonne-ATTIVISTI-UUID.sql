-- Script per assicurarsi che le colonne attivisti e organizzazioni siano UUID
-- Elimina se esistono come VARCHAR e le ricrea come UUID

-- Elimina le colonne esistenti
ALTER TABLE users DROP COLUMN IF EXISTS attivisti CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS organizzazioni CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS codice_attivista CASCADE;

-- Crea le colonne come UUID
ALTER TABLE users ADD COLUMN attivisti UUID DEFAULT NULL;
ALTER TABLE users ADD COLUMN organizzazioni UUID DEFAULT NULL;

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti);
CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);

-- Aggiungi foreign key constraints
ALTER TABLE users ADD CONSTRAINT fk_attivisti 
  FOREIGN KEY (attivisti) REFERENCES users(id);

ALTER TABLE users ADD CONSTRAINT fk_organizzazioni 
  FOREIGN KEY (organizzazioni) REFERENCES users(id);

