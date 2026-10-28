-- DEMOS / GH-260 - Provenienza sesso, senza un secondo valore M/F.
-- NON eseguire automaticamente: gate DPO/privacy + rollout CIE e QA richiesti.
-- FASE A: nessun backfill e nessuna modifica ai valori users.sesso preesistenti.
-- Applicare PRIMA del codice che scrive sesso_fonte; CIE resta OFF in produzione.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sesso_fonte VARCHAR(1);

DO $sex_source$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_sesso_fonte_valida'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_sesso_fonte_valida
      CHECK (
        sesso_fonte IS NULL OR (
          sesso_fonte IN ('L', 'N', 'O', 'C')
          AND sesso IN ('M', 'F')
          AND account_type = 'PERSON'
        )
      );
  END IF;
END
$sex_source$;

COMMENT ON COLUMN public.users.sesso_fonte IS
  'Provenienza M/F: NULL=sconosciuta/non verificata, L=legacy, N=inferita, O=fonte ufficiale, C=CIE UserInfo verificata. NON certifica CIE senza identity_verifications valida. Nessun backfill automatico.';

COMMIT;
