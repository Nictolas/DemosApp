-- DEMOS: Avatar editoriali Grazia, distinti dagli avatar dei profili utenti.
-- Solo il backend autenticato gestisce lettura/scrittura, nessun accesso diretto
-- dei ruoli Data API. La configurazione è SVG parametrico, non un file caricato.
CREATE TABLE IF NOT EXISTS public.grazia_avatar_configs (
  nome_key text PRIMARY KEY CHECK (length(nome_key) BETWEEN 2 AND 150),
  avatar_config jsonb NOT NULL CHECK (jsonb_typeof(avatar_config) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grazia_avatar_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.grazia_avatar_configs FROM PUBLIC, anon, authenticated;
