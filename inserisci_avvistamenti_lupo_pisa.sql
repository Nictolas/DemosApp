-- Script per inserire avvistamenti di lupo per Pisa, Vecchiano e San Giuliano Terme
-- Questi avvistamenti verranno visualizzati in https://www.demos.community/notifiche

-- ============================================
-- PARTE 1: Verifica che la tabella esista
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_avvistamenti'
    ) THEN
        RAISE EXCEPTION 'Tabella notifiche_avvistamenti non trovata. Esegui prima lo script crea_tabella_notifiche_avvistamenti.sql';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Inserisci avvistamento di lupo per Pisa
-- ============================================

INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Lupo',
    'Pisa',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    '{"zona": "Periferia", "ora": "16:00"}'::jsonb
FROM users u
WHERE u.comune_residenza = 'Pisa'
  AND u.id NOT IN (
    SELECT id_utente FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento = 'Lupo' 
    AND comune_residenza = 'Pisa'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day'
  )
LIMIT 1;

-- Se non troviamo un utente di Pisa, inseriamo comunque con un utente qualsiasi
DO $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifiche_avvistamenti
    WHERE tipo_avvistamento = 'Lupo'
    AND comune_residenza = 'Pisa'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    IF v_count = 0 THEN
        SELECT id INTO v_user_id
        FROM users
        WHERE comune_residenza IS NOT NULL
        AND comune_residenza != ''
        LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            INSERT INTO notifiche_avvistamenti (
                id_utente,
                tipo_avvistamento,
                comune_residenza,
                data,
                data_creazione,
                metadata
            )
            VALUES (
                v_user_id,
                'Lupo',
                'Pisa',
                CURRENT_TIMESTAMP - INTERVAL '2 hours',
                CURRENT_TIMESTAMP - INTERVAL '2 hours',
                '{"zona": "Periferia", "ora": "16:00"}'::jsonb
            );
            RAISE NOTICE 'Avvistamento di lupo per Pisa inserito';
        END IF;
    END IF;
END $$;

-- ============================================
-- PARTE 3: Inserisci avvistamento di lupo per Vecchiano
-- ============================================

INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Lupo',
    'Vecchiano',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    '{"zona": "Zona rurale", "ora": "15:00"}'::jsonb
FROM users u
WHERE u.comune_residenza = 'Vecchiano'
  AND u.id NOT IN (
    SELECT id_utente FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento = 'Lupo' 
    AND comune_residenza = 'Vecchiano'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day'
  )
LIMIT 1;

-- Se non troviamo un utente di Vecchiano, inseriamo comunque con un utente qualsiasi
DO $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifiche_avvistamenti
    WHERE tipo_avvistamento = 'Lupo'
    AND comune_residenza = 'Vecchiano'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    IF v_count = 0 THEN
        SELECT id INTO v_user_id
        FROM users
        WHERE comune_residenza IS NOT NULL
        AND comune_residenza != ''
        LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            INSERT INTO notifiche_avvistamenti (
                id_utente,
                tipo_avvistamento,
                comune_residenza,
                data,
                data_creazione,
                metadata
            )
            VALUES (
                v_user_id,
                'Lupo',
                'Vecchiano',
                CURRENT_TIMESTAMP - INTERVAL '3 hours',
                CURRENT_TIMESTAMP - INTERVAL '3 hours',
                '{"zona": "Zona rurale", "ora": "15:00"}'::jsonb
            );
            RAISE NOTICE 'Avvistamento di lupo per Vecchiano inserito';
        END IF;
    END IF;
END $$;

-- ============================================
-- PARTE 4: Inserisci avvistamento di lupo per San Giuliano Terme
-- ============================================

INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Lupo',
    'San Giuliano Terme',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    '{"zona": "Area collinare", "ora": "14:00"}'::jsonb
FROM users u
WHERE u.comune_residenza = 'San Giuliano Terme'
  AND u.id NOT IN (
    SELECT id_utente FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento = 'Lupo' 
    AND comune_residenza = 'San Giuliano Terme'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day'
  )
LIMIT 1;

-- Se non troviamo un utente di San Giuliano Terme, inseriamo comunque con un utente qualsiasi
DO $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifiche_avvistamenti
    WHERE tipo_avvistamento = 'Lupo'
    AND comune_residenza = 'San Giuliano Terme'
    AND data > CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    IF v_count = 0 THEN
        SELECT id INTO v_user_id
        FROM users
        WHERE comune_residenza IS NOT NULL
        AND comune_residenza != ''
        LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            INSERT INTO notifiche_avvistamenti (
                id_utente,
                tipo_avvistamento,
                comune_residenza,
                data,
                data_creazione,
                metadata
            )
            VALUES (
                v_user_id,
                'Lupo',
                'San Giuliano Terme',
                CURRENT_TIMESTAMP - INTERVAL '4 hours',
                CURRENT_TIMESTAMP - INTERVAL '4 hours',
                '{"zona": "Area collinare", "ora": "14:00"}'::jsonb
            );
            RAISE NOTICE 'Avvistamento di lupo per San Giuliano Terme inserito';
        END IF;
    END IF;
END $$;

-- ============================================
-- PARTE 5: Verifica inserimento
-- ============================================

SELECT 
    id,
    tipo_avvistamento,
    'Avvistamento ' || tipo_avvistamento as titolo,
    comune_residenza,
    data,
    (SELECT COUNT(*) FROM users WHERE comune_residenza = na.comune_residenza) as cittadini_nel_comune
FROM notifiche_avvistamenti na
WHERE tipo_avvistamento = 'Lupo'
  AND comune_residenza IN ('Pisa', 'Vecchiano', 'San Giuliano Terme')
ORDER BY data DESC;

