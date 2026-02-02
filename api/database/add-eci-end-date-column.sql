-- Aggiunge la colonna data di scadenza alla tabella eci (usata da scripts/sync_eci.py)
ALTER TABLE eci ADD COLUMN IF NOT EXISTS end_date DATE;
