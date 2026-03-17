-- Script per svuotare le tabelle delle notifiche
-- e inserire 3 notifiche di esempio per ciascuna tabella

-- ============================================
-- PARTE 1: Svuotare le tabelle
-- ============================================

-- Svuota notifiche_comunali
TRUNCATE TABLE notifiche_comunali CASCADE;

-- Svuota notifiche_voti_comuni
TRUNCATE TABLE notifiche_voti_comuni CASCADE;

-- Svuota notifiche_demos
TRUNCATE TABLE notifiche_demos CASCADE;

-- ============================================
-- PARTE 2: Recuperare un ID utente valido per le notifiche
-- ============================================

-- Usa il primo utente attivo come id_utente per le notifiche di esempio
DO $$
DECLARE
    system_user_id UUID;
BEGIN
    -- Recupera il primo utente attivo
    SELECT id INTO system_user_id 
    FROM users 
    WHERE status = 'active' OR status IS NULL
    LIMIT 1;
    
    -- Se non ci sono utenti attivi, usa il primo utente disponibile
    IF system_user_id IS NULL THEN
        SELECT id INTO system_user_id 
        FROM users 
        LIMIT 1;
    END IF;
    
    -- Se ancora non c'è un utente, crea un UUID di esempio (ma questo non funzionerà con foreign key)
    IF system_user_id IS NULL THEN
        RAISE EXCEPTION 'Nessun utente trovato nel database. Crea almeno un utente prima di eseguire questo script.';
    END IF;
    
    -- ============================================
    -- PARTE 3: Inserire 3 notifiche in notifiche_comunali
    -- ============================================
    
    INSERT INTO notifiche_comunali (id, id_utente, titolo, testo, comune_residenza, data, likes, dislikes) VALUES
    (
        gen_random_uuid(),
        system_user_id,
        'Chiusura strade per lavori',
        'Si informa la cittadinanza che dal 15 gennaio al 20 gennaio 2025, via Roma sarà chiusa al traffico per lavori di manutenzione stradale. Si prega di utilizzare vie alternative.',
        'Roma',
        CURRENT_DATE - INTERVAL '5 days',
        12,
        2
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Nuovo servizio di raccolta differenziata',
        'A partire dal 1 febbraio 2025, entrerà in vigore il nuovo calendario per la raccolta differenziata. I calendari sono disponibili presso l''ufficio comunale o sul sito web del comune.',
        'Milano',
        CURRENT_DATE - INTERVAL '3 days',
        25,
        1
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Apertura nuovo parco pubblico',
        'Il nuovo parco "Giardini della Libertà" sarà inaugurato sabato 25 gennaio 2025 alle ore 10:00. Tutti i cittadini sono invitati a partecipare all''inaugurazione.',
        'Torino',
        CURRENT_DATE - INTERVAL '1 day',
        45,
        0
    );
    
    RAISE NOTICE 'Inserite 3 notifiche in notifiche_comunali';
    
    -- ============================================
    -- PARTE 4: Inserire 3 notifiche in notifiche_voti_comuni
    -- ============================================
    
    INSERT INTO notifiche_voti_comuni (id, id_utente, titolo, testo, voto, comune_residenza, politico, data, likes, dislikes) VALUES
    (
        gen_random_uuid(),
        system_user_id,
        'Votazione Bilancio Comunale 2025',
        'Il Consiglio Comunale ha approvato il bilancio comunale per l''anno 2025 con 18 voti favorevoli e 5 contrari.',
        'Favorevole',
        'Roma',
        'Mario Rossi',
        CURRENT_DATE - INTERVAL '7 days',
        30,
        8
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Votazione Piano Urbanistico',
        'Approvato il nuovo Piano Urbanistico Generale con modifiche alle zone residenziali e commerciali.',
        'Favorevole',
        'Milano',
        'Luigi Bianchi',
        CURRENT_DATE - INTERVAL '4 days',
        22,
        5
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Votazione Regolamento Rifiuti',
        'Il nuovo regolamento per la gestione dei rifiuti urbani è stato approvato all''unanimità dal Consiglio Comunale.',
        'Favorevole',
        'Torino',
        'Anna Verdi',
        CURRENT_DATE - INTERVAL '2 days',
        18,
        3
    );
    
    RAISE NOTICE 'Inserite 3 notifiche in notifiche_voti_comuni';
    
    -- ============================================
    -- PARTE 5: Inserire 3 notifiche in notifiche_demos
    -- ============================================
    
    INSERT INTO notifiche_demos (id, id_utente, titolo, testo, comune_residenza, data) VALUES
    (
        gen_random_uuid(),
        system_user_id,
        'Notifica Demos: Nuova funzionalità disponibile',
        'Abbiamo aggiunto una nuova funzionalità per visualizzare le statistiche dei voti dei tuoi rappresentanti. Accedi alla sezione "Rappresentanti" per scoprirla!',
        NULL,
        CURRENT_DATE - INTERVAL '6 days'
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Notifica Demos: Aggiornamento piattaforma',
        'La piattaforma Demos è stata aggiornata con miglioramenti alle prestazioni e nuove funzionalità. Scopri tutte le novità nella sezione "Novità".',
        NULL,
        CURRENT_DATE - INTERVAL '3 days'
    ),
    (
        gen_random_uuid(),
        system_user_id,
        'Notifica Demos: Partecipa al sondaggio',
        'Stiamo raccogliendo opinioni per migliorare la piattaforma. Partecipa al sondaggio nella sezione "Opinioni" e condividi il tuo parere con noi!',
        NULL,
        CURRENT_DATE
    );
    
    RAISE NOTICE 'Inserite 3 notifiche in notifiche_demos';
    
    RAISE NOTICE 'Script completato con successo!';
END $$;

-- ============================================
-- PARTE 6: Verifica finale - Conta le notifiche inserite
-- ============================================

SELECT 
    'notifiche_comunali' as tabella,
    COUNT(*) as numero_notifiche
FROM notifiche_comunali

UNION ALL

SELECT 
    'notifiche_voti_comuni' as tabella,
    COUNT(*) as numero_notifiche
FROM notifiche_voti_comuni

UNION ALL

SELECT 
    'notifiche_demos' as tabella,
    COUNT(*) as numero_notifiche
FROM notifiche_demos;

