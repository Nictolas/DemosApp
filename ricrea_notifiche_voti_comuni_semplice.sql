-- Script semplificato per cancellare e ricreare notifiche_voti_comuni
-- Assicurati di avere almeno un utente con ruolo "P" prima di eseguire

-- ============================================
-- PARTE 1: Verifica utenti con ruolo "P"
-- ============================================

SELECT 
    id,
    nome,
    cognome,
    ruolo,
    comune_residenza
FROM users
WHERE ruolo = 'P'
ORDER BY nome, cognome;

-- ============================================
-- PARTE 2: Cancella tutte le righe esistenti
-- ============================================

TRUNCATE TABLE notifiche_voti_comuni;

-- ============================================
-- PARTE 3: Inserisci 5 nuove righe
-- ============================================
-- IMPORTANTE: Sostituisci gli ID degli utenti con quelli reali dalla query sopra

-- Esempio: inserisce 5 notifiche usando i primi 5 utenti con ruolo "P"
-- Se hai meno di 5 politici, inserisci solo quelli che hai
INSERT INTO notifiche_voti_comuni (
    id,
    id_utente,
    titolo,
    testo,
    voto,
    comune_residenza,
    politico,
    likes,
    dislikes,
    data
)
SELECT 
    gen_random_uuid(),
    u.id,
    'Votazione Regolamento Rifiuti - ' || u.nome || ' ' || u.cognome,
    'Il politico ' || u.nome || ' ' || u.cognome || ' ha votato sul nuovo regolamento per la gestione dei rifiuti urbani.',
    'Favorevole',
    COALESCE(u.comune_residenza, 'Torino'),
    u.id::text,
    0,
    0,
    CURRENT_DATE
FROM users u
WHERE u.ruolo = 'P'
ORDER BY u.nome, u.cognome
LIMIT 1
OFFSET 0;

-- Seconda notifica
INSERT INTO notifiche_voti_comuni (
    id,
    id_utente,
    titolo,
    testo,
    voto,
    comune_residenza,
    politico,
    likes,
    dislikes,
    data
)
SELECT 
    gen_random_uuid(),
    u.id,
    'Votazione Piano Urbanistico - ' || u.nome || ' ' || u.cognome,
    'Il politico ' || u.nome || ' ' || u.cognome || ' ha votato sul nuovo Piano Urbanistico Generale.',
    'Favorevole',
    COALESCE(u.comune_residenza, 'Milano'),
    u.id::text,
    0,
    0,
    CURRENT_DATE - 2
FROM users u
WHERE u.ruolo = 'P'
ORDER BY u.nome, u.cognome
LIMIT 1
OFFSET 1;

-- Terza notifica
INSERT INTO notifiche_voti_comuni (
    id,
    id_utente,
    titolo,
    testo,
    voto,
    comune_residenza,
    politico,
    likes,
    dislikes,
    data
)
SELECT 
    gen_random_uuid(),
    u.id,
    'Votazione Bilancio Comunale - ' || u.nome || ' ' || u.cognome,
    'Il politico ' || u.nome || ' ' || u.cognome || ' ha votato sul bilancio comunale.',
    'Contrario',
    COALESCE(u.comune_residenza, 'Roma'),
    u.id::text,
    0,
    0,
    CURRENT_DATE - 5
FROM users u
WHERE u.ruolo = 'P'
ORDER BY u.nome, u.cognome
LIMIT 1
OFFSET 2;

-- Quarta notifica
INSERT INTO notifiche_voti_comuni (
    id,
    id_utente,
    titolo,
    testo,
    voto,
    comune_residenza,
    politico,
    likes,
    dislikes,
    data
)
SELECT 
    gen_random_uuid(),
    u.id,
    'Votazione Piano Mobilità - ' || u.nome || ' ' || u.cognome,
    'Il politico ' || u.nome || ' ' || u.cognome || ' ha votato sul piano per la mobilità sostenibile.',
    'Astenuto',
    COALESCE(u.comune_residenza, 'Napoli'),
    u.id::text,
    0,
    0,
    CURRENT_DATE - 7
FROM users u
WHERE u.ruolo = 'P'
ORDER BY u.nome, u.cognome
LIMIT 1
OFFSET 3;

-- Quinta notifica
INSERT INTO notifiche_voti_comuni (
    id,
    id_utente,
    titolo,
    testo,
    voto,
    comune_residenza,
    politico,
    likes,
    dislikes,
    data
)
SELECT 
    gen_random_uuid(),
    u.id,
    'Votazione Piano Edilizio - ' || u.nome || ' ' || u.cognome,
    'Il politico ' || u.nome || ' ' || u.cognome || ' ha votato sul piano regolatore edilizio.',
    'Favorevole',
    COALESCE(u.comune_residenza, 'Firenze'),
    u.id::text,
    0,
    0,
    CURRENT_DATE - 10
FROM users u
WHERE u.ruolo = 'P'
ORDER BY u.nome, u.cognome
LIMIT 1
OFFSET 4;

-- ============================================
-- PARTE 4: Verifica finale
-- ============================================

SELECT 
    nv.id,
    nv.titolo,
    nv.voto,
    nv.comune_residenza,
    nv.politico as politico_id,
    u.nome || ' ' || u.cognome as politico_nome_completo,
    u.ruolo as politico_ruolo,
    nv.data,
    nv.likes,
    nv.dislikes
FROM notifiche_voti_comuni nv
LEFT JOIN users u ON u.id::text = nv.politico
ORDER BY nv.data DESC, nv.titolo;

