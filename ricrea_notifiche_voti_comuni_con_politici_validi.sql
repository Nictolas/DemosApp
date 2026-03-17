-- Script per cancellare tutte le righe in notifiche_voti_comuni
-- e inserire 5 nuove righe con politico collegato a utenti reali con ruolo "P"

-- ============================================
-- PARTE 1: Verifica utenti con ruolo "P" disponibili
-- ============================================

-- Mostra gli utenti con ruolo "P" disponibili
SELECT 
    id,
    nome,
    cognome,
    ruolo,
    comune_residenza
FROM users
WHERE ruolo = 'P'
ORDER BY nome, cognome
LIMIT 10;

-- ============================================
-- PARTE 2: Cancella tutte le righe esistenti
-- ============================================

TRUNCATE TABLE notifiche_voti_comuni;

-- ============================================
-- PARTE 3: Inserisci 5 nuove righe con politici validi
-- ============================================

-- Verifica prima se ci sono utenti con ruolo "P"
DO $$
DECLARE
    politici_count INTEGER;
    politico_record RECORD;
    counter INTEGER := 1;
BEGIN
    -- Conta quanti politici ci sono
    SELECT COUNT(*) INTO politici_count
    FROM users
    WHERE ruolo = 'P';
    
    IF politici_count = 0 THEN
        RAISE NOTICE '⚠️ Nessun utente con ruolo "P" trovato. Impossibile inserire notifiche.';
        RAISE NOTICE 'Crea almeno un utente con ruolo "P" prima di eseguire questo script.';
    ELSE
        RAISE NOTICE '✅ Trovati % utenti con ruolo "P"', politici_count;
        
        -- Inserisce fino a 5 notifiche, una per ogni politico disponibile
        FOR politico_record IN 
            SELECT id, nome, cognome, comune_residenza
            FROM users
            WHERE ruolo = 'P'
            ORDER BY nome, cognome
            LIMIT 5
        LOOP
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
            ) VALUES (
                gen_random_uuid(),
                politico_record.id,
                'Votazione ' || counter::text || ' - ' || politico_record.nome || ' ' || politico_record.cognome,
                'Il politico ' || politico_record.nome || ' ' || politico_record.cognome || ' ha espresso il suo voto sulla proposta.',
                CASE (counter % 3)
                    WHEN 0 THEN 'Favorevole'
                    WHEN 1 THEN 'Contrario'
                    ELSE 'Astenuto'
                END,
                COALESCE(politico_record.comune_residenza, 'Comune non specificato'),
                politico_record.id::text,  -- Inserisce l'ID dell'utente come riferimento al politico
                0,
                0,
                CURRENT_DATE - (counter - 1)
            );
            
            RAISE NOTICE '✅ Inserita notifica per politico: % % (ID: %)', 
                politico_record.nome, 
                politico_record.cognome, 
                politico_record.id;
            
            counter := counter + 1;
        END LOOP;
        
        RAISE NOTICE '✅ Inserite % notifiche', counter - 1;
    END IF;
END $$;

-- ============================================
-- PARTE 4: Verifica finale
-- ============================================

-- Mostra le notifiche inserite con i dettagli del politico
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

-- Verifica che tutti i politici siano validi
SELECT 
    COUNT(*) as totale_notifiche,
    COUNT(CASE WHEN u.id IS NOT NULL AND u.ruolo = 'P' THEN 1 END) as politici_validi,
    COUNT(CASE WHEN u.id IS NULL OR u.ruolo != 'P' THEN 1 END) as politici_non_validi
FROM notifiche_voti_comuni nv
LEFT JOIN users u ON u.id::text = nv.politico;

