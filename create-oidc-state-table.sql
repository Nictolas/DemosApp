-- Tabella per salvare gli OIDC state temporanei
-- Necessaria per gestire il flusso OIDC su istanze multiple (es. Render)

CREATE TABLE IF NOT EXISTS oidc_states (
  state VARCHAR(255) PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indice per pulizia automatica degli state scaduti
CREATE INDEX IF NOT EXISTS idx_oidc_states_expires_at ON oidc_states(expires_at);

-- Funzione per pulire automaticamente gli state scaduti (opzionale, può essere chiamata periodicamente)
-- DELETE FROM oidc_states WHERE expires_at < NOW();

