-- Script SQL per inserire i rappresentanti nella tabella users e opinioni_risposte
-- Gli utenti esistenti (basati su nome e cognome) non verranno duplicati

-- Inserisci gli utenti nella tabella users (evita duplicati basati su nome e cognome)
INSERT INTO users (id, email, nome, cognome, genere, cittadinanza, paese_residenza, paese_elezione, grado_elezione, status)
SELECT 
    LOWER(REPLACE(nome || '_' || cognome, ' ', '_')) AS id,
    LOWER(nome || '.' || cognome || '@rappresentante.it') AS email,
    nome,
    cognome,
    genere,
    cittadinanza,
    paese_residenza,
    paese_elezione,
    grado_elezione,
    'approved' AS status
FROM (VALUES
    ('Giorgia', 'Meloni', 'd', 'it', 'it', 'it', 'C'),
    ('Francesco', 'Lollobrigida', 'u', 'it', 'it', 'it', 'C'),
    ('Matteo', 'Salvini', 'u', 'it', 'it', 'it', 'C'),
    ('Antonio', 'Tajani', 'u', 'it', 'it', 'it', 'C'),
    ('Carlo', 'Calenda', 'u', 'it', 'it', 'it', 'C'),
    ('Maurizio', 'Lupi', 'u', 'it', 'it', 'it', 'C'),
    ('Stefano', 'Patuanelli', 'u', 'it', 'it', 'it', 'S'),
    ('Vito', 'Bardi', 'u', 'it', 'it', 'it', 'R'),
    ('Roberto', 'Occhiuto', 'u', 'it', 'it', 'it', 'R'),
    ('Vincenzo', 'De Luca', 'u', 'it', 'it', 'it', 'R'),
    ('Stefano', 'Bonaccini', 'u', 'it', 'it', 'it', 'R'),
    ('Massimiliano', 'Fedriga', 'u', 'it', 'it', 'it', 'R'),
    ('Attilio', 'Fontana', 'u', 'it', 'it', 'it', 'R'),
    ('Francesco', 'Acquaroli', 'u', 'it', 'it', 'it', 'R'),
    ('Donato', 'Toma', 'u', 'it', 'it', 'it', 'R'),
    ('Alberto', 'Cirio', 'u', 'it', 'it', 'it', 'R'),
    ('Michele', 'Emiliano', 'u', 'it', 'it', 'it', 'R'),
    ('Christian', 'Solinas', 'u', 'it', 'it', 'it', 'R'),
    ('Renato', 'Schifani', 'u', 'it', 'it', 'it', 'R'),
    ('Eugenio', 'Giani', 'u', 'it', 'it', 'it', 'R'),
    ('Donatella', 'Tesei', 'd', 'it', 'it', 'it', 'R'),
    ('Luca', 'Zaia', 'u', 'it', 'it', 'it', 'R'),
    ('Maurizio', 'Fugatti', 'u', 'it', 'it', 'it', 'R')
) AS t(nome, cognome, genere, cittadinanza, paese_residenza, paese_elezione, grado_elezione)
WHERE NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE LOWER(TRIM(u.nome)) = LOWER(TRIM(t.nome)) 
    AND LOWER(TRIM(u.cognome)) = LOWER(TRIM(t.cognome))
)
ON CONFLICT (id) DO NOTHING
ON CONFLICT (email) DO NOTHING;

-- Inserisci le opinioni nella tabella opinioni_risposte
-- Per ogni utente, inserisci/aggiorna l'opinione sulla carne_coltivata e le fonti

INSERT INTO opinioni_risposte (user_id, carne_coltivata, fonti_opinioni)
SELECT 
    u.id AS user_id,
    op.risposta AS carne_coltivata,
    op.fonte AS fonti_opinioni
FROM users u
INNER JOIN (
    VALUES
        ('Giorgia', 'Meloni', 'c', '{"carne_coltivata": "https://www.coldiretti.it/economia/meloni-ha-firmato-la-petizione-contro-il-cibo-in-provetta"}'::jsonb),
        ('Francesco', 'Lollobrigida', 'c', '{"carne_coltivata": "https://www.coldiretti.it/economia/meloni-ha-firmato-la-petizione-contro-il-cibo-in-provetta"}'::jsonb),
        ('Matteo', 'Salvini', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Antonio', 'Tajani', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Carlo', 'Calenda', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Maurizio', 'Lupi', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Stefano', 'Patuanelli', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Stefano', 'Bonaccini', 'c', '{"carne_coltivata": "https://informatorezootecnico.edagricole.it/economia-mercati/coldiretti-giu-mani-legge-vieta-carne-artificiale/"}'::jsonb),
        ('Vito', 'Bardi', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Roberto', 'Occhiuto', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Vincenzo', 'De Luca', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Massimiliano', 'Fedriga', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Attilio', 'Fontana', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Francesco', 'Acquaroli', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Donato', 'Toma', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Alberto', 'Cirio', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Michele', 'Emiliano', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Christian', 'Solinas', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Renato', 'Schifani', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Eugenio', 'Giani', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Donatella', 'Tesei', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Luca', 'Zaia', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb),
        ('Maurizio', 'Fugatti', 'c', '{"carne_coltivata": "https://www.agenzianova.com/news/carne-coltivata-coldiretti-lopposizione-alla-legge-italiana-va-contro-la-scienza-e-la-salute-cittadini/"}'::jsonb)
) AS op(nome, cognome, risposta, fonte)
    ON LOWER(TRIM(u.nome)) = LOWER(TRIM(op.nome))
    AND LOWER(TRIM(u.cognome)) = LOWER(TRIM(op.cognome))
ON CONFLICT (user_id) DO UPDATE SET
    carne_coltivata = EXCLUDED.carne_coltivata,
    fonti_opinioni = EXCLUDED.fonti_opinioni;

