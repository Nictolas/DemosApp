-- Tabella per salvare i dati CIE in attesa di completamento registrazione
-- Quando un utente accede per la prima volta con CIE, i suoi dati vengono salvati qui
-- e deve completare il modulo di registrazione

CREATE TABLE IF NOT EXISTS cie_pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_number VARCHAR(20) UNIQUE NOT NULL,
  given_name VARCHAR(255),
  family_name VARCHAR(255),
  sub VARCHAR(255),
  cie_data JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indice per pulizia automatica delle registrazioni scadute
CREATE INDEX IF NOT EXISTS idx_cie_pending_registrations_expires_at 
ON cie_pending_registrations(expires_at);

-- Indice per ricerca rapida per fiscal_number
CREATE INDEX IF NOT EXISTS idx_cie_pending_registrations_fiscal_number 
ON cie_pending_registrations(fiscal_number);

-- Funzione per pulire automaticamente le registrazioni scadute (opzionale)
-- DELETE FROM cie_pending_registrations WHERE expires_at < NOW();

