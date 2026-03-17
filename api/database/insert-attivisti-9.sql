-- =============================================================================
-- Inserimento di 9 attivisti (ruolo 'A') nella tabella users
-- Per la pagina https://www.demos.community/attivisti
-- Eseguire in Neon SQL Editor (o altro client PostgreSQL).
-- =============================================================================
--
-- Colonne usate dalla pagina Attivisti (api/routes/attivisti.js):
--   id, nome, cognome, email, ruolo, status, created_at, updated_at,
--   avatar_config, genere, data_nascita, cittadinanza, paese_residenza,
--   regione_residenza, provincia_residenza, comune_residenza,
--   facebook_url, twitter_url, instagram_url, linkedin_url, telegram_url,
--   website_url, twitch_url, youtube_url, tipologie_attivismo
--
-- Per gli attivisti inseriti qui: ruolo 'A', status 'a'.
-- Email univoca per ogni riga (placeholder; non usate per login).
-- tipologie_attivismo: tipo/nome/emoji come in client/src/constants/attivismo-types.ts
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
  twitter_url,
  instagram_url,
  linkedin_url,
  telegram_url,
  youtube_url,
  tipologie_attivismo,
  created_at,
  updated_at
) VALUES
-- Alessandro Di Battista (politica)
(
  gen_random_uuid(),
  'Alessandro',
  'Di Battista',
  'att+alessandro-dibattista@attivisti.demos.community',
  'A',
  'a',
  'https://alessandrodibattista.it',
  'https://www.facebook.com/alessandrodibattistaofficial',
  'https://twitter.com/dibattistaale',
  'https://www.instagram.com/alessandrodibattista',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"politica","nome":"Politica e Istituzioni","emoji":"🏛️"}]'::jsonb,
  NOW(),
  NOW()
),
-- Marco Cappato (politica, diritti umani – Associazione Luca Coscioni)
(
  gen_random_uuid(),
  'Marco',
  'Cappato',
  'att+marco-cappato@attivisti.demos.community',
  'A',
  'a',
  'https://www.associazionelucacoscioni.it',
  'https://www.facebook.com/marco.cappato',
  'https://twitter.com/marcocappato',
  'https://www.instagram.com/marcocappato',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"politica","nome":"Politica e Istituzioni","emoji":"🏛️"},{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- Ilaria Cucchi (giustizia)
(
  gen_random_uuid(),
  'Ilaria',
  'Cucchi',
  'att+ilaria-cucchi@attivisti.demos.community',
  'A',
  'a',
  NULL,
  NULL,
  NULL,
  'https://www.instagram.com/ilaria_cucchi',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"giustizia","nome":"Giustizia","emoji":"⚖️"}]'::jsonb,
  NOW(),
  NOW()
),
-- Roberto Saviano (giustizia, diritti umani)
(
  gen_random_uuid(),
  'Roberto',
  'Saviano',
  'att+roberto-saviano@attivisti.demos.community',
  'A',
  'a',
  NULL,
  'https://www.facebook.com/robertosaviano',
  'https://twitter.com/robertosaviano',
  'https://www.instagram.com/robertosaviano',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"giustizia","nome":"Giustizia","emoji":"⚖️"},{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- Luca Casarini (volontariato, diritti umani – rescue, no border)
(
  gen_random_uuid(),
  'Luca',
  'Casarini',
  'att+luca-casarini@attivisti.demos.community',
  'A',
  'a',
  NULL,
  NULL,
  'https://twitter.com/casariniluca',
  'https://www.instagram.com/lucacasarini',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"volontariato","nome":"Volontariato","emoji":"❤️"},{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- Patrick Zaki (diritti umani)
(
  gen_random_uuid(),
  'Patrick',
  'Zaki',
  'att+patrick-zaki@attivisti.demos.community',
  'A',
  'a',
  NULL,
  NULL,
  NULL,
  'https://www.instagram.com/patrick_zaki',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- Luigi Ciotti (volontariato, giustizia – Libera)
(
  gen_random_uuid(),
  'Luigi',
  'Ciotti',
  'att+luigi-ciotti@attivisti.demos.community',
  'A',
  'a',
  'https://www.libera.it',
  'https://www.facebook.com/DonLuigiCiotti',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '[{"tipo":"volontariato","nome":"Volontariato","emoji":"❤️"},{"tipo":"giustizia","nome":"Giustizia","emoji":"⚖️"}]'::jsonb,
  NOW(),
  NOW()
),
-- Gino Strada (sanità, diritti umani – Emergency)
(
  gen_random_uuid(),
  'Gino',
  'Strada',
  'att+gino-strada@attivisti.demos.community',
  'A',
  'a',
  'https://www.emergency.it',
  'https://www.facebook.com/emergency.ong',
  NULL,
  'https://www.instagram.com/emergency_ong',
  NULL,
  NULL,
  NULL,
  '[{"tipo":"sanita","nome":"Sanità","emoji":"🏥"},{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"}]'::jsonb,
  NOW(),
  NOW()
),
-- Gino Cecchettin (diritti umani, giustizia – violenza di genere)
(
  gen_random_uuid(),
  'Gino',
  'Cecchettin',
  'att+gino-cecchettin@attivisti.demos.community',
  'A',
  'a',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '[{"tipo":"diritti_umani","nome":"Diritti Umani","emoji":"🤝"},{"tipo":"giustizia","nome":"Giustizia","emoji":"⚖️"}]'::jsonb,
  NOW(),
  NOW()
);
