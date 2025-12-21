-- Script per rinominare la tabella "comunicazioni" in "notifiche_voti_comuni"
-- e creare le nuove tabelle "notifiche_demos" e "notifiche_comunali"
-- con le stesse colonne di "notifiche_voti_comuni"

-- ============================================
-- PARTE 1: Rinominare "comunicazioni" in "notifiche_voti_comuni"
-- ============================================

-- Verifica se la tabella comunicazioni esiste e la rinomina
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'comunicazioni'
    ) THEN
        -- Rinomina la tabella
        ALTER TABLE comunicazioni RENAME TO notifiche_voti_comuni;
        RAISE NOTICE 'Tabella "comunicazioni" rinominata in "notifiche_voti_comuni"';
    ELSE
        RAISE NOTICE 'Tabella "comunicazioni" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Ottenere la struttura della tabella notifiche_voti_comuni
-- ============================================

-- Questa query verrà usata per creare le nuove tabelle con la stessa struttura
-- Le colonne attese sono:
-- - id (UUID PRIMARY KEY)
-- - id_utente (UUID REFERENCES users(id))
-- - titolo (TEXT)
-- - testo (TEXT)
-- - tipo (VARCHAR)
-- - data_creazione (TIMESTAMP WITH TIME ZONE)
-- - likes (INTEGER)
-- - dislikes (INTEGER)
-- - read_by (UUID[])
-- - voto (TEXT)
-- - data (DATE)
-- - comune_residenza (TEXT)
-- - politico (TEXT)

-- ============================================
-- PARTE 3: Creare la tabella "notifiche_demos"
-- ============================================

CREATE TABLE IF NOT EXISTS notifiche_demos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utente UUID REFERENCES users(id),
    titolo TEXT,
    testo TEXT NOT NULL,
    tipo VARCHAR(50),
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    read_by UUID[] DEFAULT ARRAY[]::UUID[],
    voto TEXT,
    data DATE,
    comune_residenza TEXT,
    politico TEXT
);

-- Aggiungi commento alla tabella
COMMENT ON TABLE notifiche_demos IS 'Tabella per le notifiche Demos';

-- ============================================
-- PARTE 4: Creare la tabella "notifiche_comunali"
-- ============================================

CREATE TABLE IF NOT EXISTS notifiche_comunali (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utente UUID REFERENCES users(id),
    titolo TEXT,
    testo TEXT NOT NULL,
    tipo VARCHAR(50),
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    read_by UUID[] DEFAULT ARRAY[]::UUID[],
    voto TEXT,
    data DATE,
    comune_residenza TEXT,
    politico TEXT
);

-- Aggiungi commento alla tabella
COMMENT ON TABLE notifiche_comunali IS 'Tabella per le notifiche comunali';

-- ============================================
-- PARTE 5: Verifica finale struttura tabelle
-- ============================================

-- Mostra la struttura di tutte e tre le tabelle
SELECT 
    'notifiche_voti_comuni' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_voti_comuni'
ORDER BY ordinal_position

UNION ALL

SELECT 
    'notifiche_demos' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_demos'
ORDER BY ordinal_position

UNION ALL

SELECT 
    'notifiche_comunali' as tabella,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_comunali'
ORDER BY ordinal_position;

