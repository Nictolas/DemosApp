-- =============================================================================
-- Inserimento di 10 organizzazioni (ruolo 'O') nella tabella users
-- Eseguire in Neon SQL Editor dopo aver verificato che la colonna organizzazioni esista.
-- =============================================================================
--
-- Colonne di "users" usate dalla pagina Organizzazioni (api/routes/organizzazioni.js):
--   id, nome, cognome, email, ruolo, status, created_at, updated_at,
--   avatar_config, genere, data_nascita, cittadinanza, paese_residenza,
--   regione_residenza, provincia_residenza, comune_residenza,
--   facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url,
--   website_url, twitch_url, youtube_url, tipologie_attivismo
-- (supporters_count è calcolato a runtime dalla colonna users.organizzazioni dei sostenitori)
--
-- Per le organizzazioni inserite qui: cognome vuoto, email univoca, ruolo 'O', status 'a'.
-- tipologie_attivismo = JSONB array di oggetti con almeno "tipo" (es. ambiente, diritti_umani).
-- =============================================================================

INSERT INTO users (
  id,
  nome,
  cognome,
  email,
  ruolo,
  status,
  website_url,
  facebook_url,
  instagram_url,
  tipologie_attivismo,
  created_at,
  updated_at
) VALUES
-- 1) Legambiente (ambientalismo)
(
  gen_random_uuid(),
  'Legambiente',
  '',
  'org+legambiente@organizzazioni.demos.community',
  'O',
  'a',
  'https://www.legambiente.it/',
  'https://www.facebook.com/LegambienteItalia',
  'https://www.instagram.com/legambiente/',
  '[{"tipo":"ambiente","nome":"Ambiente e Sostenibilità","emoji":"🌱"}]'::jsonb,
  NOW(),
  NOW()
),
-- 2) ActionAid Italia (diritti umani, giustizia sociale)
(
  gen_random_uuid(),
  'ActionAid Italia',
  '',
  'org+actionaid@organizzazioni.demos.community',
  'O',
  'a',
  'http://www.actionaid.it',
  'https://www.facebook.com/ActionAid.Italia',
  'https://www.instagram.com/actionaiditalia/',
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- 3) Cittadinanzattiva APS (partecipazione civica, diritti dei cittadini)
(
  gen_random_uuid(),
  'Cittadinanzattiva APS',
  '',
  'org+cittadinanzattiva@organizzazioni.demos.community',
  'O',
  'a',
  'https://www.cittadinanzattiva.it/',
  'https://www.facebook.com/Cittadinanzattiva',
  'https://www.instagram.com/cittadinanzattiva/',
  '[{"tipo":"politica","nome":"Politica e Istituzioni","emoji":"🏛️"}]'::jsonb,
  NOW(),
  NOW()
),
-- 4) CILD – Italian Coalition for Civil Liberties and Rights (diritti civili)
(
  gen_random_uuid(),
  'CILD – Italian Coalition for Civil Liberties and Rights',
  '',
  'org+cild@organizzazioni.demos.community',
  'O',
  'a',
  'https://cild.eu/',
  'https://www.facebook.com/cild.eu/',
  'https://www.instagram.com/cild_eu/',
  '[{"tipo":"giustizia","nome":"Giustizia","emoji":"⚖️"}]'::jsonb,
  NOW(),
  NOW()
),
-- 5) Movimento Identità Trans – MIT (diritti trans)
(
  gen_random_uuid(),
  'Movimento Identità Trans (MIT)',
  '',
  'org+mit@organizzazioni.demos.community',
  'O',
  'a',
  'https://www.mit-italia.it/',
  'https://www.facebook.com/MovimentoIdentitaTrans',
  'https://www.instagram.com/movidentitatrans/',
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- 6) City Angels (volontariato urbano e attivismo sociale)
(
  gen_random_uuid(),
  'City Angels',
  '',
  'org+cityangels@organizzazioni.demos.community',
  'O',
  'a',
  'https://cityangels.it/',
  'https://www.facebook.com/CityAngelsOnlus',
  'https://www.instagram.com/cityangels.onlus/',
  '[{"tipo":"volontariato","nome":"Volontariato","emoji":"❤️"}]'::jsonb,
  NOW(),
  NOW()
),
-- 7) Extinction Rebellion Italia (attivismo climatico nonviolento)
(
  gen_random_uuid(),
  'Extinction Rebellion Italia',
  '',
  'org+xritalia@organizzazioni.demos.community',
  'O',
  'a',
  NULL,
  'https://www.facebook.com/ExtinctionRebellionItalia',
  'https://www.instagram.com/extinctionrebellionitalia/',
  '[{"tipo":"ambiente","nome":"Ambiente e Sostenibilità","emoji":"🌱"}]'::jsonb,
  NOW(),
  NOW()
),
-- 8) Di'' Gay Project (diritti LGBTQ+)
(
  gen_random_uuid(),
  'Di'' Gay Project',
  '',
  'org+digayproject@organizzazioni.demos.community',
  'O',
  'a',
  NULL,
  'https://www.facebook.com/digayproject',
  'https://www.instagram.com/digayproject/',
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- 9) Love My Way APS (attivismo queer/intersezionale)
(
  gen_random_uuid(),
  'Love My Way APS',
  '',
  'org+lovemyway@organizzazioni.demos.community',
  'O',
  'a',
  'https://www.lovemyway.it/',
  'https://www.facebook.com/lovemywayaps',
  'https://www.instagram.com/lovemyway_aps/',
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- 10) PeaceLink (pace, media e diritti)
(
  gen_random_uuid(),
  'PeaceLink',
  '',
  'org+peacelink@organizzazioni.demos.community',
  'O',
  'a',
  'https://www.peacelink.it/',
  'https://www.facebook.com/peacelink.it/',
  'https://www.instagram.com/peacelink_italia/',
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Se Neon restituisce errore tipo "there is no unique or exclusion constraint on column email",
-- rimuovi la riga "ON CONFLICT (email) DO NOTHING;" e riesegui solo l'INSERT.
