-- Script per rimuovere colonne specifiche dalle tabelle delle notifiche
-- e rimuovere il sistema di lettura delle notifiche

-- ============================================
-- PARTE 1: Rimuovere colonne da "notifiche_comunali"
-- Colonne da rimuovere: politico, voto, read_by, data_creazione, tipo
-- ============================================

DO $$ 
BEGIN
    -- Rimuovi colonna "politico"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali' AND column_name = 'politico'
    ) THEN
        ALTER TABLE notifiche_comunali DROP COLUMN politico;
        RAISE NOTICE 'Colonna "politico" rimossa da notifiche_comunali';
    END IF;

    -- Rimuovi colonna "voto"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali' AND column_name = 'voto'
    ) THEN
        ALTER TABLE notifiche_comunali DROP COLUMN voto;
        RAISE NOTICE 'Colonna "voto" rimossa da notifiche_comunali';
    END IF;

    -- Rimuovi colonna "read_by"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali' AND column_name = 'read_by'
    ) THEN
        ALTER TABLE notifiche_comunali DROP COLUMN read_by;
        RAISE NOTICE 'Colonna "read_by" rimossa da notifiche_comunali';
    END IF;

    -- Rimuovi colonna "data_creazione"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali' AND column_name = 'data_creazione'
    ) THEN
        ALTER TABLE notifiche_comunali DROP COLUMN data_creazione;
        RAISE NOTICE 'Colonna "data_creazione" rimossa da notifiche_comunali';
    END IF;

    -- Rimuovi colonna "tipo"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_comunali' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE notifiche_comunali DROP COLUMN tipo;
        RAISE NOTICE 'Colonna "tipo" rimossa da notifiche_comunali';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Rimuovere colonne da "notifiche_demos"
-- Colonne da rimuovere: tipo, likes, dislikes, read_by, voto, politico
-- ============================================

DO $$ 
BEGIN
    -- Rimuovi colonna "tipo"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN tipo;
        RAISE NOTICE 'Colonna "tipo" rimossa da notifiche_demos';
    END IF;

    -- Rimuovi colonna "likes"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'likes'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN likes;
        RAISE NOTICE 'Colonna "likes" rimossa da notifiche_demos';
    END IF;

    -- Rimuovi colonna "dislikes"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'dislikes'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN dislikes;
        RAISE NOTICE 'Colonna "dislikes" rimossa da notifiche_demos';
    END IF;

    -- Rimuovi colonna "read_by"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'read_by'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN read_by;
        RAISE NOTICE 'Colonna "read_by" rimossa da notifiche_demos';
    END IF;

    -- Rimuovi colonna "voto"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'voto'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN voto;
        RAISE NOTICE 'Colonna "voto" rimossa da notifiche_demos';
    END IF;

    -- Rimuovi colonna "politico"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'politico'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN politico;
        RAISE NOTICE 'Colonna "politico" rimossa da notifiche_demos';
    END IF;
END $$;

-- ============================================
-- PARTE 3: Rimuovere colonne da "notifiche_voti_comuni"
-- Colonne da rimuovere: tipo, read_by
-- ============================================

DO $$ 
BEGIN
    -- Rimuovi colonna "tipo"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_voti_comuni' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE notifiche_voti_comuni DROP COLUMN tipo;
        RAISE NOTICE 'Colonna "tipo" rimossa da notifiche_voti_comuni';
    END IF;

    -- Rimuovi colonna "read_by"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_voti_comuni' AND column_name = 'read_by'
    ) THEN
        ALTER TABLE notifiche_voti_comuni DROP COLUMN read_by;
        RAISE NOTICE 'Colonna "read_by" rimossa da notifiche_voti_comuni';
    END IF;
END $$;

-- ============================================
-- PARTE 4: Verifica finale struttura tabelle
-- ============================================

-- Mostra la struttura di notifiche_comunali
SELECT 
    'notifiche_comunali' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_comunali'
ORDER BY ordinal_position;

-- Mostra la struttura di notifiche_demos
SELECT 
    'notifiche_demos' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_demos'
ORDER BY ordinal_position;

-- Mostra la struttura di notifiche_voti_comuni
SELECT 
    'notifiche_voti_comuni' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_voti_comuni'
ORDER BY ordinal_position;

