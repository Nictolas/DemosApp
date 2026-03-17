-- Aggiunge la colonna status alla tabella eci (usata da scripts/sync_eci.py)
ALTER TABLE eci ADD COLUMN IF NOT EXISTS status VARCHAR(50);
