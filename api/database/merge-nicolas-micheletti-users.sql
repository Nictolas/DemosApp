-- =============================================================================
-- Merge profilo "Nicolas Micheletti" meno recente nel più recente, poi cancella il vecchio.
-- Regola: nel profilo nuovo si copia dal vecchio SOLO dove il nuovo è NULL.
-- Eseguire in Neon SQL Editor (o altro client PostgreSQL).
-- =============================================================================

BEGIN;

-- 1) Individua i due profili (più recente = created_at maggiore, meno recente = created_at minore)
WITH profili AS (
  SELECT
    id,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) AS ordine
  FROM users
  WHERE nome = 'Nicolas' AND cognome = 'Micheletti'
),
vecchio AS ( SELECT id AS id_vecchio FROM profili WHERE ordine = 1 ),
nuovo   AS ( SELECT id AS id_nuovo   FROM profili WHERE ordine = 2 )
SELECT vecchio.id_vecchio, nuovo.id_nuovo INTO TEMP ids_merge FROM vecchio CROSS JOIN nuovo;

-- Verifica che ci siano esattamente 2 righe (2 profili Nicolas Micheletti)
DO $$
DECLARE
  n INTEGER;
  id_old UUID;
  id_new UUID;
BEGIN
  SELECT COUNT(*) INTO n FROM users WHERE nome = 'Nicolas' AND cognome = 'Micheletti';
  IF n != 2 THEN
    RAISE EXCEPTION 'Trovati % profili "Nicolas Micheletti", attesi 2. Interrompo.', n;
  END IF;
  SELECT id_vecchio, id_nuovo INTO id_old, id_new FROM ids_merge;
  RAISE NOTICE 'Vecchio id: %, Nuovo id: %', id_old, id_new;
END $$;

-- 2) Riassegna eventuali riferimenti da utente vecchio a nuovo
--    (chi segue l'attivista/organizzazione punta al profilo che resterà)
UPDATE users u
SET attivisti = (SELECT id_nuovo FROM ids_merge)
WHERE u.attivisti = (SELECT id_vecchio FROM ids_merge);

UPDATE users u
SET organizzazioni = (SELECT id_nuovo FROM ids_merge)
WHERE u.organizzazioni = (SELECT id_vecchio FROM ids_merge);

-- 3) Copia nel profilo NUOVO i valori del VECCHIO solo dove il nuovo è NULL
UPDATE users u
SET
  email                    = COALESCE(u.email, o.email),
  ruolo                    = COALESCE(u.ruolo, o.ruolo),
  status                   = COALESCE(u.status, o.status),
  avatar_config            = COALESCE(u.avatar_config, o.avatar_config),
  genere                   = COALESCE(u.genere, o.genere),
  data_nascita             = COALESCE(u.data_nascita, o.data_nascita),
  cittadinanza             = COALESCE(u.cittadinanza, o.cittadinanza),
  paese_residenza          = COALESCE(u.paese_residenza, o.paese_residenza),
  regione_residenza        = COALESCE(u.regione_residenza, o.regione_residenza),
  provincia_residenza      = COALESCE(u.provincia_residenza, o.provincia_residenza),
  comune_residenza         = COALESCE(u.comune_residenza, o.comune_residenza),
  paese_elezione           = COALESCE(u.paese_elezione, o.paese_elezione),
  regione_elezione         = COALESCE(u.regione_elezione, o.regione_elezione),
  provincia_elezione       = COALESCE(u.provincia_elezione, o.provincia_elezione),
  comune_elezione          = COALESCE(u.comune_elezione, o.comune_elezione),
  grado_elezione           = COALESCE(u.grado_elezione, o.grado_elezione),
  paese_candidatura        = COALESCE(u.paese_candidatura, o.paese_candidatura),
  regione_candidatura      = COALESCE(u.regione_candidatura, o.regione_candidatura),
  provincia_candidatura    = COALESCE(u.provincia_candidatura, o.provincia_candidatura),
  comune_candidatura       = COALESCE(u.comune_candidatura, o.comune_candidatura),
  grado_candidatura        = COALESCE(u.grado_candidatura, o.grado_candidatura),
  facebook_url             = COALESCE(u.facebook_url, o.facebook_url),
  twitter_url              = COALESCE(u.twitter_url, o.twitter_url),
  instagram_url            = COALESCE(u.instagram_url, o.instagram_url),
  linkedin_url             = COALESCE(u.linkedin_url, o.linkedin_url),
  telegram_url             = COALESCE(u.telegram_url, o.telegram_url),
  website_url              = COALESCE(u.website_url, o.website_url),
  twitch_url               = COALESCE(u.twitch_url, o.twitch_url),
  youtube_url              = COALESCE(u.youtube_url, o.youtube_url),
  tipologie_attivismo      = COALESCE(u.tipologie_attivismo, o.tipologie_attivismo),
  updated_at               = NOW()
FROM users o, ids_merge m
WHERE u.id = m.id_nuovo
  AND o.id = m.id_vecchio;

-- 4) Elimina il profilo meno recente
DELETE FROM users
WHERE id = (SELECT id_vecchio FROM ids_merge);

COMMIT;

-- Pulizia tabella temporanea (opzionale, la sessione la scarta comunque)
DROP TABLE IF EXISTS ids_merge;
