-- Script RAPIDO per creare le colonne attivisti e organizzazioni
-- Copia e incolla queste righe in Neon Console SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS attivisti UUID DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti);
CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);

