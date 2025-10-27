-- Script RAPIDO per creare le colonne attivisti e organizzazioni
-- Copia e incolla queste righe in Neon Console SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS attivisti VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti);
CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);

