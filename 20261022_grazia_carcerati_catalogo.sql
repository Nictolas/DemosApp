-- Catalogo dei carcerati verificati per la pagina Grazia.
-- I nomi qui elencati non rappresentano preferenze espresse dagli utenti.
CREATE TABLE IF NOT EXISTS public.grazia_carcerati (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  attivo boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS grazia_carcerati_nome_key
  ON public.grazia_carcerati (lower(btrim(nome)));

ALTER TABLE public.grazia_carcerati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.grazia_carcerati FROM anon, authenticated;

INSERT INTO public.grazia_carcerati (nome, attivo)
VALUES ('Raffaella Ragnoli', true), ('Roberto Canulli', true)
ON CONFLICT (lower(btrim(nome))) DO UPDATE SET attivo = EXCLUDED.attivo;
