-- Script per creare la tabella "notifiche_avvistamenti"
-- Questa tabella contiene le notifiche inviate quando un utente avvisa i vicini di un avvistamento

-- ============================================
-- PARTE 1: Crea la tabella notifiche_avvistamenti
-- ============================================

CREATE TABLE IF NOT EXISTS notifiche_avvistamenti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_utente UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo_avvistamento VARCHAR(100) NOT NULL, -- Es: "Lupo", "Cinghiale", ecc. Il titolo sarà "Avvistamento {tipo_avvistamento}"
    comune_residenza TEXT NOT NULL, -- Comune dell'utente che ha inviato l'avvistamento
    data TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb -- Per informazioni aggiuntive (coordinate, foto, ecc.)
);

-- Aggiungi commento alla tabella
COMMENT ON TABLE notifiche_avvistamenti IS 'Tabella per le notifiche di avvistamenti inviate ai vicini';

-- Aggiungi indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_notifiche_avvistamenti_comune ON notifiche_avvistamenti(comune_residenza);
CREATE INDEX IF NOT EXISTS idx_notifiche_avvistamenti_data ON notifiche_avvistamenti(data DESC);
CREATE INDEX IF NOT EXISTS idx_notifiche_avvistamenti_utente ON notifiche_avvistamenti(id_utente);

-- ============================================
-- PARTE 2: Verifica struttura tabella
-- ============================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_avvistamenti'
ORDER BY ordinal_position;

