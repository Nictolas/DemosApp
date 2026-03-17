-- Script SQL per aggiungere un indice UNIQUE per prevenire duplicati
-- Esegui questo script direttamente nel database Neon Console

-- Prima, rimuovi eventuali duplicati esistenti (mantieni solo il primo)
DELETE FROM opinioni_domande a
USING opinioni_domande b
WHERE a.id < b.id
AND LOWER(TRIM(a.text)) = LOWER(TRIM(b.text))
AND 'da approvare' = ANY(a.gradi_opinione)
AND 'da approvare' = ANY(b.gradi_opinione);

-- Crea un indice UNIQUE parziale per opinioni "da approvare"
-- Questo previene duplicati a livello database in modo atomico
CREATE UNIQUE INDEX IF NOT EXISTS idx_opinioni_domande_text_unique_da_approvare
ON opinioni_domande (LOWER(TRIM(text)))
WHERE 'da approvare' = ANY(gradi_opinione);

-- Verifica che l'indice sia stato creato
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'opinioni_domande' 
AND indexname = 'idx_opinioni_domande_text_unique_da_approvare';

