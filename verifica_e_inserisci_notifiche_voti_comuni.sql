-- Script per verificare e inserire notifiche di esempio in notifiche_voti_comuni
-- Se la tabella è vuota, inserisce 3 notifiche di esempio

-- ============================================
-- PARTE 1: Verifica se la tabella esiste e conta le righe
-- ============================================

DO $$ 
DECLARE
    row_count INTEGER;
    utente_politico_id UUID;
    utente_admin_id UUID;
BEGIN
    -- Verifica se la tabella esiste
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_voti_comuni'
    ) THEN
        RAISE EXCEPTION 'Tabella notifiche_voti_comuni non trovata';
    END IF;
    
    -- Conta le righe esistenti
    SELECT COUNT(*) INTO row_count FROM notifiche_voti_comuni;
    RAISE NOTICE 'Righe esistenti in notifiche_voti_comuni: %', row_count;
    
    -- Se ci sono già righe, non inserire nulla
    IF row_count > 0 THEN
        RAISE NOTICE 'La tabella contiene già % righe. Nessuna inserzione necessaria.', row_count;
        RETURN;
    END IF;
    
    -- Trova un utente con ruolo "P" (Politico)
    SELECT id INTO utente_politico_id
    FROM users
    WHERE ruolo = 'P'
    LIMIT 1;
    
    IF utente_politico_id IS NULL THEN
        RAISE NOTICE 'Nessun utente con ruolo "P" trovato. Inserimento senza politico.';
    END IF;
    
    -- Trova un utente admin o qualsiasi utente per id_utente
    SELECT id INTO utente_admin_id
    FROM users
    WHERE is_admin = true OR id IS NOT NULL
    LIMIT 1;
    
    IF utente_admin_id IS NULL THEN
        RAISE EXCEPTION 'Nessun utente trovato nel database';
    END IF;
    
    -- Inserisci 3 notifiche di esempio
    INSERT INTO notifiche_voti_comuni (
        id_utente,
        titolo,
        testo,
        voto,
        data,
        comune_residenza,
        politico,
        likes,
        dislikes
    ) VALUES
    (
        utente_admin_id,
        'Votazione Bilancio Comunale 2025',
        'Il consiglio comunale ha votato sul bilancio comunale per l''anno 2025. La votazione si è conclusa con l''approvazione del documento.',
        'Favorevole',
        CURRENT_DATE - INTERVAL '5 days',
        COALESCE((SELECT comune_residenza FROM users WHERE id = utente_admin_id LIMIT 1), 'Roma'),
        utente_politico_id::text,
        15,
        3
    ),
    (
        utente_admin_id,
        'Votazione Piano Urbanistico',
        'Approvato il nuovo piano urbanistico comunale che prevede la realizzazione di nuove aree verdi e la riqualificazione del centro storico.',
        'Favorevole',
        CURRENT_DATE - INTERVAL '3 days',
        COALESCE((SELECT comune_residenza FROM users WHERE id = utente_admin_id LIMIT 1), 'Roma'),
        utente_politico_id::text,
        22,
        5
    ),
    (
        utente_admin_id,
        'Votazione Regolamento Rifiuti',
        'Il consiglio ha discusso e votato il nuovo regolamento per la gestione dei rifiuti urbani, con particolare attenzione alla raccolta differenziata.',
        'Favorevole',
        CURRENT_DATE - INTERVAL '1 day',
        COALESCE((SELECT comune_residenza FROM users WHERE id = utente_admin_id LIMIT 1), 'Roma'),
        utente_politico_id::text,
        8,
        1
    );
    
    RAISE NOTICE 'Inserite 3 notifiche di esempio in notifiche_voti_comuni';
END $$;

-- ============================================
-- PARTE 2: Verifica inserimento
-- ============================================

SELECT 
    id,
    titolo,
    voto,
    data,
    comune_residenza,
    politico,
    likes,
    dislikes
FROM notifiche_voti_comuni
ORDER BY data DESC;

