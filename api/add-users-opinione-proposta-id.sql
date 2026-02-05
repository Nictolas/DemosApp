-- Aggiunge in users la colonna per limitare a 1 proposta di opinione per utente.
-- Eseguire in Neon SQL Editor.
-- Dopo averla aggiunta, l'API aggiorna questa colonna quando l'utente propone un'opinione
-- e blocca nuove proposte se è già valorizzata.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS opinione_proposta_id TEXT;

COMMENT ON COLUMN users.opinione_proposta_id IS 'ID dell''unica opinione proposta dall''utente (max 1 proposta per utente)';
