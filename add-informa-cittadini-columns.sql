-- SQL per creare la tabella dedicata "informa_cittadini" su Neon
-- Questa tabella è separata da "comunicazioni" (riservata agli admin)

CREATE TABLE IF NOT EXISTS informa_cittadini (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utente UUID NOT NULL REFERENCES users(id),
  tipologia TEXT NOT NULL,
  dove TEXT NOT NULL,
  dal_giorno DATE NOT NULL,
  al_giorno DATE NOT NULL,
  zona TEXT,
  data_creazione TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

