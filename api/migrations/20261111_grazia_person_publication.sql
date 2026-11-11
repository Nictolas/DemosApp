-- Ogni nominativo di Grazia è privato finché l'Admin non lo pubblica esplicitamente.
-- I nomi già presenti restano NON pubblicati (DEFAULT FALSE), senza cancellazioni.
ALTER TABLE public.grazia_carcerati
  ADD COLUMN IF NOT EXISTS pubblicato boolean NOT NULL DEFAULT false;
ALTER TABLE public.grazia_carcerati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.grazia_carcerati FROM PUBLIC, anon, authenticated;
COMMENT ON COLUMN public.grazia_carcerati.pubblicato IS
  'Pubblicazione esplicita per singolo nominativo dopo verifica giuridica: false di default.';
