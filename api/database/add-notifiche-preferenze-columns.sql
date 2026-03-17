-- Aggiunge le colonne mancanti alla tabella notifiche_preferenze
-- Esegui questo script DOPO aver creato la tabella base

-- Aggiungi colonne per i diversi tipi di rappresentanti
ALTER TABLE notifiche_preferenze 
  ADD COLUMN IF NOT EXISTS eurodeputato BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS senatore BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deputato BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consigliere_regionale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consigliere_comunale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attivisti BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scuola BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizzazioni BOOLEAN DEFAULT false;

-- Rinomina avvistamenti in animali per coerenza con il frontend
ALTER TABLE notifiche_preferenze 
  RENAME COLUMN avvistamenti TO animali;

-- Crea indici per le nuove colonne (solo per quelle attive)
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_eurodeputato 
  ON notifiche_preferenze(eurodeputato) WHERE eurodeputato = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_senatore 
  ON notifiche_preferenze(senatore) WHERE senatore = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_deputato 
  ON notifiche_preferenze(deputato) WHERE deputato = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_consigliere_regionale 
  ON notifiche_preferenze(consigliere_regionale) WHERE consigliere_regionale = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_consigliere_comunale 
  ON notifiche_preferenze(consigliere_comunale) WHERE consigliere_comunale = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_attivisti 
  ON notifiche_preferenze(attivisti) WHERE attivisti = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_scuola 
  ON notifiche_preferenze(scuola) WHERE scuola = true;

CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_organizzazioni 
  ON notifiche_preferenze(organizzazioni) WHERE organizzazioni = true;

-- Aggiorna indice per animali (ex avvistamenti)
DROP INDEX IF EXISTS idx_notifiche_preferenze_avvistamenti;
CREATE INDEX IF NOT EXISTS idx_notifiche_preferenze_animali 
  ON notifiche_preferenze(animali) WHERE animali = true;

-- Aggiorna commenti
COMMENT ON COLUMN notifiche_preferenze.eurodeputato IS 'Notifiche dal tuo eurodeputato';
COMMENT ON COLUMN notifiche_preferenze.senatore IS 'Notifiche dal tuo senatore';
COMMENT ON COLUMN notifiche_preferenze.deputato IS 'Notifiche dal tuo deputato';
COMMENT ON COLUMN notifiche_preferenze.consigliere_regionale IS 'Notifiche dal tuo consigliere regionale';
COMMENT ON COLUMN notifiche_preferenze.consigliere_comunale IS 'Notifiche dal tuo consigliere comunale';
COMMENT ON COLUMN notifiche_preferenze.attivisti IS 'Notifiche da attivisti che segui';
COMMENT ON COLUMN notifiche_preferenze.scuola IS 'Notifiche per questioni scolastiche';
COMMENT ON COLUMN notifiche_preferenze.animali IS 'Notifiche per avvistamenti di animali (volpi, etc)';
COMMENT ON COLUMN notifiche_preferenze.organizzazioni IS 'Notifiche da organizzazioni che segui';

-- Mantieni retrocompatibilità: se istituzione è true, attiva tutte le preferenze rappresentanti
UPDATE notifiche_preferenze 
SET 
  eurodeputato = COALESCE(eurodeputato, istituzione),
  senatore = COALESCE(senatore, istituzione),
  deputato = COALESCE(deputato, istituzione),
  consigliere_regionale = COALESCE(consigliere_regionale, istituzione),
  consigliere_comunale = COALESCE(consigliere_comunale, istituzione)
WHERE istituzione = true;


