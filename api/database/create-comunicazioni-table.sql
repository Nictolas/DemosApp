-- DEMOS canonical communications base table.
-- This table is consumed by /api/comunicazioni, opinion announcements, GDPR export/erasure
-- and Transparency Podium. Institutional metadata is added by the subsequent migration.
BEGIN;

CREATE TABLE IF NOT EXISTS comunicazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_utente UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  titolo TEXT NOT NULL,
  testo TEXT,
  zona TEXT,
  voto_dato VARCHAR(50),
  vincitore VARCHAR(50),
  commento TEXT,
  data_creazione TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  punti_trasparenza INTEGER NOT NULL DEFAULT 0,
  read_by UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  CONSTRAINT comunicazioni_voto_dato_check CHECK (
    voto_dato IS NULL OR voto_dato IN ('Favorevole','Contrario','Astenuto')
  ),
  CONSTRAINT comunicazioni_vincitore_check CHECK (
    vincitore IS NULL OR vincitore IN ('Favorevole','Contrario','Astenuto')
  )
);

CREATE INDEX IF NOT EXISTS idx_comunicazioni_user_created
  ON comunicazioni(id_utente, data_creazione DESC);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_created
  ON comunicazioni(data_creazione DESC);

COMMIT;
