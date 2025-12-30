-- Creazione tabella notifiche_preferenze
-- Migrazione delle preferenze notifiche dalla colonna JSON in users a tabella separata

-- Crea la tabella notifiche_preferenze
CREATE TABLE IF NOT EXISTS notifiche_preferenze (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  demos BOOLEAN DEFAULT false,
  istituzione BOOLEAN DEFAULT false,
  avvistamenti BOOLEAN DEFAULT true, -- Default true per retrocompatibilità
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_user_id ON notifiche_preferenze(user_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_demos ON notifiche_preferenze(demos) WHERE demos = true;
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_istituzione ON notifiche_preferenze(istituzione) WHERE istituzione = true;
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_avvistamenti ON notifiche_preferenze(avvistamenti) WHERE avvistamenti = true;

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_notifiche_preferenze_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifiche_preferenze_updated_at
  BEFORE UPDATE ON notifiche_preferenze
  FOR EACH ROW
  EXECUTE FUNCTION update_notifiche_preferenze_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE notifiche_preferenze IS 'Preferenze notifiche push per ogni utente';
COMMENT ON COLUMN notifiche_preferenze.demos IS 'Notifiche da Demos (annunci generali)';
COMMENT ON COLUMN notifiche_preferenze.istituzione IS 'Notifiche sui voti dei rappresentanti istituzionali';
COMMENT ON COLUMN notifiche_preferenze.avvistamenti IS 'Notifiche su avvistamenti animali nel comune';


