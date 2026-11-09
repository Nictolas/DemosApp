-- One current Capo di Stato preference per account, whether an approved choice or
-- a new pending suggestion. The historical 25 vote rows are preserved untouched.
CREATE TABLE IF NOT EXISTS public.capo_stato_scelte (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 3 AND 150),
  tipo text NOT NULL CHECK (tipo IN ('voto','proposta')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capo_stato_scelte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capo_stato_scelte FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS capo_stato_scelte_tipo_nome_idx
ON public.capo_stato_scelte (tipo, lower(btrim(regexp_replace(normalize(nome, NFC), '[[:space:]]+', ' ', 'g'))));

-- Backfill only choices explicitly saved via the legacy voting endpoint.
-- A subject_proposals row (including an editorial Admin nomination) is NOT
-- proof that the account holder supported the person: never invent a vote.
-- Multiple old rows per user remain untouched for audit; only the latest
-- is selected into the canonical one-choice table.
WITH chosen AS (
  SELECT DISTINCT ON (v.userid) v.userid AS user_id, v.nome,
    COALESCE(v.updated_at,v.timestamp,v.created_at,'1970-01-01'::timestamp)
      AT TIME ZONE 'UTC' AS changed_at
  FROM public.voti_capo_stato v
  WHERE char_length(btrim(v.nome)) BETWEEN 3 AND 150
  ORDER BY v.userid,
    COALESCE(v.updated_at,v.timestamp,v.created_at,'1970-01-01'::timestamp) DESC,
    v.id DESC
)
INSERT INTO public.capo_stato_scelte (user_id,nome,tipo,changed_at)
SELECT c.user_id,c.nome,'voto',c.changed_at
FROM chosen c JOIN public.users u ON u.id=c.user_id
ON CONFLICT (user_id) DO NOTHING;
