-- DEMOS — voti sulle proposte di Opinione
-- Migrazione additiva e idempotente. Da applicare esplicitamente prima di abilitare la superficie.

CREATE TABLE IF NOT EXISTS voti_opinioni_proposte (
  id BIGSERIAL PRIMARY KEY,
  utente_id UUID NOT NULL,
  opinione_id VARCHAR(255) NOT NULL,
  data_voto TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voti_opinioni_proposte_utente_opinione_unique UNIQUE (utente_id, opinione_id)
);

CREATE INDEX IF NOT EXISTS idx_voti_opinioni_proposte_utente_id
  ON voti_opinioni_proposte (utente_id);

CREATE INDEX IF NOT EXISTS idx_voti_opinioni_proposte_opinione_id
  ON voti_opinioni_proposte (opinione_id);

COMMENT ON TABLE voti_opinioni_proposte IS
  'Voti correnti degli utenti sulle proposte di Opinione pendenti; schema gestito da migrazione, non dalle route runtime.';
