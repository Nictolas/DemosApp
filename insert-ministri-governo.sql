-- Script SQL per inserire i ministri del governo nella tabella users
-- Gli utenti esistenti (basati su nome e cognome) non verranno duplicati

INSERT INTO users (
    id, 
    email, 
    nome, 
    cognome, 
    ruolo, 
    status, 
    data_nascita, 
    genere, 
    cittadinanza, 
    paese_residenza, 
    comune_residenza, 
    comune_elezione, 
    grado_elezione
)
SELECT 
    gen_random_uuid() AS id,
    LOWER(REPLACE(REPLACE(nome || '.' || cognome || '@governo.it', ' ', ''), 'è', 'e')) AS email,
    nome,
    cognome,
    'P' AS ruolo,
    'a' AS status,
    data_nascita::DATE,
    genere,
    'it' AS cittadinanza,
    'it' AS paese_residenza,
    comune_residenza,
    comune_elezione,
    grado_elezione
FROM (VALUES
    ('Matteo', 'Piantedosi', '1963-04-20', 'u', 'Roma', NULL, NULL),
    ('Carlo', 'Nordio', '1947-02-06', 'u', 'Treviso', 'Treviso', 'C'),
    ('Guido', 'Crosetto', '1963-09-19', 'u', 'Roma', NULL, NULL),
    ('Giancarlo', 'Giorgetti', '1966-12-16', 'u', 'Cazzago Brabbia', 'Sondrio', 'C'),
    ('Adolfo', 'Urso', '1957-07-12', 'u', 'Roma', 'Padova', 'S'),
    ('Francesco', 'Lollobrigida', '1972-03-21', 'u', 'Roma', 'Roma', 'C'),
    ('Gilberto', 'Pichetto Fratin', '1954-01-04', 'u', 'Gifflenga', 'Vercelli', 'C'),
    ('Marina Elvira', 'Calderone', '1965-07-30', 'd', 'Roma', NULL, NULL),
    ('Giuseppe', 'Valditara', '1961-01-12', 'u', 'Milano', NULL, NULL),
    ('Anna Maria', 'Bernini', '1965-08-17', 'd', 'Bologna', 'Padova', 'S'),
    ('Alessandro', 'Giuli', '1975-09-27', 'u', 'Roma', NULL, NULL),
    ('Orazio', 'Schillaci', '1966-04-27', 'u', 'Roma', NULL, NULL),
    ('Daniela', 'Santanchè', '1961-04-07', 'd', 'Milano', 'Cremona', 'S')
) AS t(nome, cognome, data_nascita, genere, comune_residenza, comune_elezione, grado_elezione)
ON CONFLICT (email) DO NOTHING;

