-- Aggiunge colonne Obiettivi e URL iniziativa alla tabella eci
ALTER TABLE eci ADD COLUMN IF NOT EXISTS obiettivi TEXT;
ALTER TABLE eci ADD COLUMN IF NOT EXISTS url VARCHAR(1024);
