-- SQL per inserire un evento dopo il 24 gennaio 2026
-- Modifica i valori secondo le tue esigenze

INSERT INTO eventi (
  nome_evento,
  tipologia_evento,
  paese_evento,
  regione_evento,
  provincia_evento,
  comune_evento,
  indirizzo_evento,
  giorno_inizio,
  giorno_fine,
  orario_inizio,
  orario_fine,
  organizzatore
) VALUES (
  'Assemblea Pubblica Demos',  -- Nome dell'evento
  'Assemblea',                  -- Tipologia: Assemblea, Elezioni, Incontro, etc.
  'Italia',                     -- Paese
  'TO',                         -- Regione: TO = Toscana (codice targa)
  'PI',                         -- Provincia: PI = Pisa (codice targa)
  'Pisa',                       -- Comune: nome completo della città
  'Piazza dei Miracoli',        -- Indirizzo (opzionale)
  '2026-02-15',                 -- Data inizio (dopo il 24 gennaio 2026)
  '2026-02-15',                 -- Data fine (opzionale, può essere uguale a giorno_inizio)
  '18:00',                      -- Orario inizio (opzionale, formato HH:MM)
  '20:00',                      -- Orario fine (opzionale, formato HH:MM)
  'Demos Community'            -- Organizzatore (opzionale)
);

-- Esempio alternativo: Evento di Elezioni
-- INSERT INTO eventi (
--   nome_evento,
--   tipologia_evento,
--   paese_evento,
--   regione_evento,
--   provincia_evento,
--   comune_evento,
--   indirizzo_evento,
--   giorno_inizio,
--   giorno_fine,
--   orario_inizio,
--   orario_fine,
--   organizzatore
-- ) VALUES (
--   'Elezioni Regionali 2026',
--   'Elezioni',
--   'Italia',
--   'TO',                       -- Regione: TO = Toscana (codice targa)
--   'PI',                       -- Provincia: PI = Pisa (codice targa)
--   'Pisa',                     -- Comune: nome completo della città
--   NULL,
--   '2026-03-10',
--   '2026-03-10',
--   '07:00',
--   '23:00',
--   'Ministero dell''Interno'
-- );
